package service

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
	"github.com/uter-ai/uter/relaykit/types"
	hosttypes "github.com/uter-ai/uter/types"

	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// 组织预算准入：校验额与预留额必须同口径、同一次原子操作
// ---------------------------------------------------------------------------
//
// 这组用例锁死的是「组织预算并发扣费超额」这一条缺陷链上的四个点：
//
//	1. 校验用 max(preConsumedQuota,1)，实际预留却用原始 preConsumedQuota
//	   （零预估请求为 0）——校验完就把闸门绕过去了；
//	2. WalletFunding.PreConsume 在 amount<=0 时直接 return nil，
//	   ReserveOrgQuota 的原子预留根本不执行；
//	3. EnforceOrgQuota 在成员关系/组织行/成员子额度查询异常时返回 nil（fail-open）；
//	4. 组织归属解析失败时调用链继续按个人钱包计费。
//
// 修复后的不变量（本文件逐条断言）：
//   - 准入的「校验额」=「实际预留额」= BillingSession.preConsumedQuota；
//   - 零预估请求同样参与 organizations.used_quota 这一行的原子竞争；
//   - 结算把差额（含最小预留）如实退回，账本回到调用前，不留残余预留；
//   - 任何无法核实的归属/额度查询都拒绝，且拒绝时账本分文不动。

// newAdmissionRelayInfo 为单个请求构造独立的 RelayInfo。
//
// 不能复制同一个 RelayInfo：BillingSession 会把 Billing/UserQuota/OrganizationId
// 写回去，共用即构成数据竞争，也会让「每个请求一份 session」的真实并发模型失真。
// （RelayInfo 内含 sync.Mutex，连按值复制都不允许，因此这里逐字段构造。）
func newAdmissionRelayInfo(userId, tokenId, channelId int, tokenKey string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		UserId:          userId,
		TokenId:         tokenId,
		TokenKey:        tokenKey,
		OriginModelName: orgTestModel,
		UsingGroup:      "default",
		UserGroup:       "default",
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: channelId},
		UserSetting:     dto.UserSetting{BillingPreference: "wallet_only"},
		StartTime:       time.Now(),
		PriceData: hosttypes.PriceData{
			ModelRatio:      1,
			CompletionRatio: 1,
			GroupRatioInfo:  hosttypes.GroupRatioInfo{GroupRatio: 1},
		},
	}
}

func newAdmissionContext() *gin.Context {
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	return ctx
}

func getTokenRemainQuotaForAdmission(t *testing.T, tokenId int) int {
	t.Helper()
	var token model.Token
	require.NoError(t, model.DB.Select("remain_quota").Where("id = ?", tokenId).First(&token).Error)
	return token.RemainQuota
}

// TestOrgAdmissionZeroEstimateStillReservesAtomically 预估额度为 0 时必须照常原子预留。
//
// 修复前：WalletFunding.PreConsume(0) 直接 return nil，组织账本完全没有变动，
// 「预算是否够」只在 NewBillingSession 里被一次只读查询判断过。一旦这次判断通过，
// 后续并发请求全部通过，预算闸门形同虚设。
func TestOrgAdmissionZeroEstimateStillReservesAtomically(t *testing.T) {
	truncate(t)
	const orgId, userId, tokenId, channelId = 660, 760, 860, 960
	seedOrganization(t, orgId, 1_000_000)
	seedOrgMember(t, userId, orgId, model.OrgRoleMember, 0, 0)
	fx := newOrgFixture(t, userId, tokenId, channelId, 1_000_000)

	require.Nil(t, PreConsumeBilling(fx.ctx, 0, fx.relayInfo), "零预估请求不应被拒")

	floor := model.OrgAdmissionReserveFloor
	assert.Equal(t, floor, getOrgUsedQuota(t, orgId),
		"零预估请求必须在组织账本上留下原子预留（旧实现这里恒为 0）")
	assert.Equal(t, floor, getMemberUsedQuota(t, userId),
		"成员子额度账本必须与组织账本同一次原子预留写入")
	assert.Equal(t, int(floor), fx.relayInfo.FinalPreConsumedQuota,
		"FinalPreConsumedQuota 必须等于实际预留额，否则结算差额算错")

	// 结算 0：预留必须被完整退回，账本回到调用前——不允许留下残余预留。
	require.NoError(t, SettleBilling(fx.ctx, fx.relayInfo, 0))
	assert.Equal(t, int64(0), getOrgUsedQuota(t, orgId), "结算 0 后组织账本必须归零")
	assert.Equal(t, int64(0), getMemberUsedQuota(t, userId), "结算 0 后成员用量必须归零")
}

// TestOrgAdmissionZeroEstimateRejectedWhenBudgetExhausted 预算耗尽时零预估请求同样拒绝。
//
// 这是「零预估 = 白嫖」的正面回归：修复前预算 1000 全部用完后，
// 预扣额为 0 的请求仍能通过只读闸门（因为校验额被抬到 1，但账本早已越过预算
// 且预留额 0 不落账，实际效果是反复放行）。
func TestOrgAdmissionZeroEstimateRejectedWhenBudgetExhausted(t *testing.T) {
	truncate(t)
	const orgId, userId, tokenId, channelId = 661, 761, 861, 961
	const budget = 1_000
	seedOrganization(t, orgId, budget)
	seedOrgMember(t, userId, orgId, model.OrgRoleMember, 0, 0)
	require.NoError(t, model.DB.Model(&model.Organization{}).Where("id = ?", orgId).
		Update("used_quota", budget).Error, "把组织预算打到刚好耗尽")

	fx := newOrgFixture(t, userId, tokenId, channelId, 1_000_000)
	apiErr := PreConsumeBilling(fx.ctx, 0, fx.relayInfo)

	require.NotNil(t, apiErr, "预算已耗尽时，零预估请求也必须拒绝")
	assert.Equal(t, types.ErrorCodeInsufficientUserQuota, apiErr.GetErrorCode(),
		"组织预算不足必须映射成「额度不足」，而不是通用数据错误")
	assert.Equal(t, int64(budget), getOrgUsedQuota(t, orgId), "被拒的请求不得改动组织账本")
	assert.Equal(t, int64(0), getMemberUsedQuota(t, userId), "被拒的请求不得记账成员用量")
	assert.Equal(t, 1_000_000, getTokenRemainQuotaForAdmission(t, tokenId),
		"被拒的请求必须回滚令牌预扣，否则用户为一次未发生的请求付费")
}

// TestOrgAdmissionConcurrentBurstCannotBypassAtomicReserve 并发突发不得绕过原子预留。
//
// 预算故意设成「并发度的一半」，于是只有一半请求能抢到预留：
//   - 通过数必须**恰好**等于预算能容纳的预留笔数，这证明所有请求竞争的是同一行
//     organizations.used_quota，而不是各自读到一份旧快照后全部放行；
//   - 组织账本增量必须严格等于「通过数 × 最小预留额」，不允许出现
//     「预留了但没记账」或「记账了但没预留」；
//   - 必须有请求被拒，否则「预算」这个概念在并发下等于不存在。
//
// 修复前的实测（e2e，单笔实耗 30000）：预算 1000、并发 8 → 8 笔全部放行；
// 预算 40000、并发 20 → 19 笔放行。因为零预估请求根本没有预留，
// 唯一的闸门是只读校验，并发下全员通过（TOCTOU）。
func TestOrgAdmissionConcurrentBurstCannotBypassAtomicReserve(t *testing.T) {
	for _, concurrency := range []int{8, 20, 100} {
		t.Run("concurrency="+itoa(concurrency), func(t *testing.T) {
			truncate(t)
			orgId := 670 + concurrency
			userId := 770 + concurrency
			tokenId := 870 + concurrency
			channelId := 970 + concurrency
			// 预算只够一半请求预留：预算/floor 笔通过，其余必须被拒。
			admittable := concurrency / 2
			budget := int64(admittable) * model.OrgAdmissionReserveFloor
			seedOrganization(t, orgId, budget)
			seedOrgMember(t, userId, orgId, model.OrgRoleMember, 0, 0)
			fx := newOrgFixture(t, userId, tokenId, channelId, 1_000_000)
			tokenKey := fx.relayInfo.TokenKey

			// 先串行构造好每个请求的 RelayInfo，再并发跑准入：把「构造」与
			// 「并发竞争」分开，避免把测试自身的准备阶段算进竞争窗口。
			relayInfos := make([]*relaycommon.RelayInfo, concurrency)
			contexts := make([]*gin.Context, concurrency)
			for i := 0; i < concurrency; i++ {
				relayInfos[i] = newAdmissionRelayInfo(userId, tokenId, channelId, tokenKey)
				contexts[i] = newAdmissionContext()
			}

			var wg sync.WaitGroup
			var mu sync.Mutex
			admitted := 0
			rejected := 0
			for i := 0; i < concurrency; i++ {
				wg.Add(1)
				go func(i int) {
					defer wg.Done()
					err := PreConsumeBilling(contexts[i], 0, relayInfos[i])
					mu.Lock()
					defer mu.Unlock()
					if err == nil {
						admitted++
						return
					}
					rejected++
				}(i)
			}
			wg.Wait()

			used := getOrgUsedQuota(t, orgId)
			t.Logf("concurrency=%d budget=%d admittable=%d admitted=%d rejected=%d orgUsed=%d",
				concurrency, budget, admittable, admitted, rejected, used)

			assert.Equal(t, concurrency, admitted+rejected, "每个请求必须恰好有一个确定结果")
			assert.Equal(t, admittable, admitted,
				"通过数必须恰好等于预算能容纳的预留笔数（多一笔即闸门失效，少一笔即账本漏记）")
			assert.Equal(t, concurrency-admittable, rejected, "其余请求必须被预算拒绝")
			assert.Equal(t, int64(admitted)*model.OrgAdmissionReserveFloor, used,
				"组织账本增量必须严格等于通过数×最小预留额（无漏记、无重复记账）")
			assert.LessOrEqual(t, used, budget,
				"预留总额 %d 超过预算 %d：原子闸门被绕过", used, budget)
			assert.Equal(t, int64(admitted)*model.OrgAdmissionReserveFloor, getMemberUsedQuota(t, userId),
				"成员子额度账本必须与组织账本同步")
		})
	}
}

// itoa 是 t.Run 名字里用的最小整数格式化，避免为一行代码引入 strconv 别名混淆。
func itoa(v int) string {
	if v == 0 {
		return "0"
	}
	var buf [8]byte
	i := len(buf)
	for v > 0 {
		i--
		buf[i] = byte('0' + v%10)
		v /= 10
	}
	return string(buf[i:])
}

// TestOrgAdmissionRejectedWhenMembershipCannotBeResolved 归属无法确认时必须拒绝。
//
// 修复前：resolveOrgIdForBilling 出错时 `err == nil && orgId > 0` 为假，
// 调用链继续按「平台直管用户」走个人钱包——组织成员被静默改判出资方，
// 组织账本少收、个人钱包被扣，两本账同时错位。
func TestOrgAdmissionRejectedWhenMembershipCannotBeResolved(t *testing.T) {
	truncate(t)
	const orgId, userId, tokenId, channelId = 662, 762, 862, 962
	seedOrganization(t, orgId, 1_000_000)
	seedOrgMember(t, userId, orgId, model.OrgRoleMember, 100_000, 0)
	fx := newOrgFixture(t, userId, tokenId, channelId, 1_000_000)

	// 模拟「成员关系查不到」：用户行被硬删除（数据库抖动/被清理）。
	require.NoError(t, model.DB.Exec("DELETE FROM users WHERE id = ?", userId).Error)

	apiErr := PreConsumeBilling(fx.ctx, 1_000, fx.relayInfo)

	require.NotNil(t, apiErr, "无法确认归属时必须拒绝，不得回落到个人钱包")
	assert.Equal(t, int64(0), getOrgUsedQuota(t, orgId), "拒绝不得改动组织账本")
	assert.Equal(t, 1_000_000, getTokenRemainQuotaForAdmission(t, tokenId), "拒绝必须回滚令牌预扣")
}

// TestEnforceOrgQuotaFailsClosedOnLookupErrors 只读闸门的三条 fail-open 路径全部改为拒绝。
//
// 三条路径分别对应：成员关系查不到、组织行读不到、成员子额度读不到。
// 旧实现统一 `return nil`，等于「查询越失败，绕过越彻底」。
func TestEnforceOrgQuotaFailsClosedOnLookupErrors(t *testing.T) {
	t.Run("membership lookup fails", func(t *testing.T) {
		truncate(t)
		err := model.EnforceOrgQuota(999_999_999, 100)
		require.Error(t, err, "成员关系查询失败必须拒绝")
		assert.ErrorIs(t, err, model.ErrOrgQuotaUnverifiable)
	})

	t.Run("organization row missing", func(t *testing.T) {
		truncate(t)
		const orgId, userId = 663, 763
		seedOrganization(t, orgId, 1_000_000)
		seedOrgMember(t, userId, orgId, model.OrgRoleMember, 0, 0)
		require.NoError(t, model.DB.Exec("DELETE FROM organizations WHERE id = ?", orgId).Error)

		err := model.EnforceOrgQuota(userId, 100)
		require.Error(t, err, "组织行读不到时必须拒绝（预算与停用状态都无从判断）")
		assert.ErrorIs(t, err, model.ErrOrgQuotaUnverifiable)
	})

	t.Run("member sub-quota state unreadable", func(t *testing.T) {
		truncate(t)
		const orgId, userId = 664, 764
		seedOrganization(t, orgId, 1_000_000)
		seedOrgMember(t, userId, orgId, model.OrgRoleMember, 0, 0)

		// 制造「缓存与数据库不一致」：先把「属于 org」的快照写进 Redis 缓存，
		// 再把数据库里的归属改成 0（等价于成员被移出组织而缓存尚未失效）。
		// 此时归属解析仍读到旧组织，成员子额度却查不到——旧实现会 fail-open。
		server := miniredis.RunT(t)
		prevRDB, prevEnabled := common.RDB, common.RedisEnabled
		common.RDB = redis.NewClient(&redis.Options{Addr: server.Addr(), MaxRetries: -1})
		common.RedisEnabled = true
		t.Cleanup(func() {
			model.WaitCacheSyncForTest()
			_ = common.RDB.Close()
			common.RDB = prevRDB
			common.RedisEnabled = prevEnabled
		})

		_, cacheErr := model.GetUserCache(userId)
		require.NoError(t, cacheErr)
		model.WaitCacheSyncForTest()
		require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", userId).
			Update("organization_id", 0).Error)

		err := model.EnforceOrgQuota(userId, 100)
		require.Error(t, err, "成员子额度读不到时必须拒绝")
		assert.ErrorIs(t, err, model.ErrOrgQuotaUnverifiable)
	})

	t.Run("platform user still passes", func(t *testing.T) {
		truncate(t)
		const userId = 765
		seedOrgMember(t, userId, 0, "", 0, 0)
		require.NoError(t, model.EnforceOrgQuota(userId, 100),
			"明确读到 organization_id==0 的直管用户必须放行")
	})
}
