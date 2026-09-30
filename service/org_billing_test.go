package service

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Uter-AI/Uter/common"

	"github.com/Uter-AI/Uter/model"
	relaycommon "github.com/Uter-AI/Uter/relay/common"
	"github.com/Uter-AI/Uter/relaykit/dto"
	hosttypes "github.com/Uter-AI/Uter/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 组织成员的计费口径：
//
//	「消耗的额度从所属组织扣费」—— 出资方是 organizations 的共享预算账本
//	（quota = 预算，used_quota = 已用），个人钱包既不参与准入也不参与扣减。
//
// 因此每个用例都断言同一条不变量：
//
//	组织 used_quota 的增量 == 该次请求结算后的实际消耗（consume 日志的 Quota）
//
// 修复前的实测偏差（旧实现）：WalletFunding.PreConsume 对组织成员直接 return nil，
// 预扣额从未落账；结算只补 delta = actual − preConsumed，且 actual == preConsumed 时
// delta == 0 直接 return —— 组织被少收整整一笔预扣额；同时旧代码在结算里额外写了一次
// users.used_quota，把成员用量记成 actual + delta。

const (
	orgTestModel   = "gpt-4o-org-billing"
	orgTrustedHigh = 100_000_000 // 高于 common.GetTrustQuota()
)

type orgFixture struct {
	userId    int
	tokenId   int
	channelId int
	ctx       *gin.Context
	relayInfo *relaycommon.RelayInfo
}

func seedOrganization(t *testing.T, id int, quota int64) {
	t.Helper()
	org := &model.Organization{Id: id, Name: fmt.Sprintf("org-%d", id), Quota: quota, Status: 1}
	require.NoError(t, model.DB.Create(org).Error)
}

// seedOrgMember 建一个归属组织的用户，并显式给出个人钱包余额 —— 用于证明
// 个人余额不参与组织成员的准入与扣减。
func seedOrgMember(t *testing.T, id, orgId int, orgRole string, walletQuota int, subQuotaLimit int64) {
	t.Helper()
	user := &model.User{
		Id:             id,
		Username:       fmt.Sprintf("orguser%d", id),
		Quota:          walletQuota,
		Status:         common.UserStatusEnabled,
		OrganizationId: orgId,
		OrgRole:        orgRole,
		SubQuotaLimit:  subQuotaLimit,
	}
	require.NoError(t, model.DB.Create(user).Error)
}

func newOrgFixture(t *testing.T, userId, tokenId, channelId, tokenQuota int) *orgFixture {
	t.Helper()
	seedToken(t, tokenId, userId, fmt.Sprintf("orgkey%d", tokenId), tokenQuota)
	seedChannel(t, channelId)

	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Set("token_name", "org_token")

	return &orgFixture{
		userId:    userId,
		tokenId:   tokenId,
		channelId: channelId,
		ctx:       ctx,
		relayInfo: &relaycommon.RelayInfo{
			UserId:          userId,
			TokenId:         tokenId,
			TokenKey:        fmt.Sprintf("orgkey%d", tokenId),
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
		},
	}
}

func getOrgUsedQuota(t *testing.T, id int) int64 {
	t.Helper()
	var org model.Organization
	require.NoError(t, model.DB.Select("used_quota").Where("id = ?", id).First(&org).Error)
	return org.UsedQuota
}

// 组织账本收到的额度必须等于本次请求的实际消耗，且个人钱包分文未动。
func TestOrgMemberBillingChargesOrganizationLedgerExactly(t *testing.T) {
	cases := []struct {
		name          string
		preConsume    int
		actual        int
		expectedQuota int
	}{
		{"actual equals pre-consume", 1_000, 1_000, 1_000},
		{"actual above pre-consume", 1_000, 2_500, 2_500},
		{"actual below pre-consume", 2_000, 700, 700},
	}

	for i, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			truncate(t)
			orgId, userId, tokenId, channelId := 600+i, 700+i, 800+i, 900+i
			const wallet = 100_000
			seedOrganization(t, orgId, 1_000_000)
			seedOrgMember(t, userId, orgId, model.OrgRoleMember, wallet, 0)
			fx := newOrgFixture(t, userId, tokenId, channelId, 1_000_000)

			require.Nil(t, PreConsumeBilling(fx.ctx, testCase.preConsume, fx.relayInfo))

			// 与真实结算点一致：先记成员用量，再结算资金来源。
			model.UpdateUserUsedQuotaAndRequestCount(userId, testCase.actual)
			require.NoError(t, SettleBilling(fx.ctx, fx.relayInfo, testCase.actual))

			assert.Equal(t, int64(testCase.expectedQuota), getOrgUsedQuota(t, orgId),
				"组织账本必须收到本次请求的完整实际消耗")
			assert.Equal(t, wallet, getUserQuota(t, userId), "个人钱包不得被组织成员请求扣减")

			usedQuota, _ := getUserUsageAccounting(t, userId)
			assert.Equal(t, testCase.expectedQuota, usedQuota,
				"成员自身用量必须等于实际消耗（不得因结算再叠加一次 delta）")
		})
	}
}

// 请求失败退款必须把预扣额从组织账本上完整撤回。
func TestOrgMemberRefundRestoresOrganizationLedger(t *testing.T) {
	truncate(t)
	const orgId, userId, tokenId, channelId = 610, 710, 810, 910
	const preConsume = 3_000
	seedOrganization(t, orgId, 1_000_000)
	seedOrgMember(t, userId, orgId, model.OrgRoleMember, 50_000, 0)
	fx := newOrgFixture(t, userId, tokenId, channelId, 1_000_000)

	require.Nil(t, PreConsumeBilling(fx.ctx, preConsume, fx.relayInfo))
	require.Equal(t, int64(preConsume), getOrgUsedQuota(t, orgId), "预扣必须立刻落到组织账本")

	require.True(t, fx.relayInfo.Billing.NeedsRefund())
	fx.relayInfo.Billing.Refund(fx.ctx)

	waitForOrgUsedQuota(t, orgId, 0)
	assert.Equal(t, 50_000, getUserQuota(t, userId))
}

// Refund 是异步的，轮询等待组织账本回落到期望值。
func waitForOrgUsedQuota(t *testing.T, orgId int, want int64) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if getOrgUsedQuota(t, orgId) == want {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	assert.Equal(t, want, getOrgUsedQuota(t, orgId))
}

// 组织成员的个人钱包余额为 0 也必须能发起请求：出资方是组织预算。
func TestOrgMemberAdmissionUsesOrganizationBudgetNotPersonalWallet(t *testing.T) {
	truncate(t)
	const orgId, userId, tokenId, channelId = 620, 720, 820, 920
	const preConsume = 1_000
	seedOrganization(t, orgId, 10_000)
	seedOrgMember(t, userId, orgId, model.OrgRoleMember, 0, 0)
	fx := newOrgFixture(t, userId, tokenId, channelId, 1_000_000)

	apiErr := PreConsumeBilling(fx.ctx, preConsume, fx.relayInfo)

	require.Nil(t, apiErr, "个人钱包为 0 不应阻断组织成员：组织预算充足即应放行")
	assert.Equal(t, int64(preConsume), getOrgUsedQuota(t, orgId))
	assert.Equal(t, 0, getUserQuota(t, userId))
}

// 组织预算耗尽时必须拒绝；拒绝不得在账本上留下任何痕迹。
func TestOrgMemberAdmissionRejectedWhenOrgBudgetExhausted(t *testing.T) {
	truncate(t)
	const orgId, userId, tokenId, channelId = 630, 730, 830, 930
	seedOrganization(t, orgId, 1_500)
	seedOrgMember(t, userId, orgId, model.OrgRoleMember, 1_000_000, 0)
	fx := newOrgFixture(t, userId, tokenId, channelId, 1_000_000)

	apiErr := PreConsumeBilling(fx.ctx, 2_000, fx.relayInfo)

	require.NotNil(t, apiErr, "超出组织预算必须拒绝")
	assert.Equal(t, int64(0), getOrgUsedQuota(t, orgId), "准入失败不得扣减组织账本")
	assert.Equal(t, 1_000_000, getUserQuota(t, userId))
}

// 个人钱包余额高于信任阈值时，旧实现会走「信任旁路」把预扣额归零，从而整体跳过
// EnforceOrgQuota —— 组织预算与子额度一起失守。组织成员必须永远不走信任旁路。
func TestOrgMemberNeverTakesTrustBypass(t *testing.T) {
	truncate(t)
	const orgId, userId, tokenId, channelId = 640, 740, 840, 940
	seedOrganization(t, orgId, 1_200)
	seedOrgMember(t, userId, orgId, model.OrgRoleMember, orgTrustedHigh, 0)
	fx := newOrgFixture(t, userId, tokenId, channelId, 1_000_000)

	require.Nil(t, PreConsumeBilling(fx.ctx, 1_000, fx.relayInfo))
	assert.Equal(t, int64(1_000), getOrgUsedQuota(t, orgId),
		"高余额成员同样必须在组织账本上留下预扣（不得信任旁路）")

	second := newOrgFixture(t, userId, tokenId+1, channelId+1, 1_000_000)
	apiErr := PreConsumeBilling(second.ctx, 1_000, second.relayInfo)
	require.NotNil(t, apiErr, "组织预算仅剩 200 时必须拒绝 1000 的请求")
}

// 成员子额度上限按数据库权威值判定。
func TestOrgMemberSubQuotaLimitRejectedBeforeLedgerMove(t *testing.T) {
	truncate(t)
	const orgId, userId, tokenId, channelId = 650, 750, 850, 950
	seedOrganization(t, orgId, 1_000_000)
	seedOrgMember(t, userId, orgId, model.OrgRoleMember, 1_000_000, 2_000)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", userId).
		Update("used_quota", 1_500).Error)

	fx := newOrgFixture(t, userId, tokenId, channelId, 1_000_000)
	apiErr := PreConsumeBilling(fx.ctx, 1_000, fx.relayInfo)

	require.NotNil(t, apiErr, "已用 1500 + 预扣 1000 超过子额度 2000，必须拒绝")
	assert.Equal(t, int64(0), getOrgUsedQuota(t, orgId), "子额度拒绝不得扣减组织账本")
}

// 组织成员即使持有活跃订阅、且计费偏好为 subscription_first，也必须由组织出资。
func TestOrgMemberIgnoresSubscriptionBillingPreference(t *testing.T) {
	truncate(t)
	const orgId, userId, tokenId, channelId, subId = 660, 760, 860, 960, 1
	const preConsume, actual = 1_000, 1_500
	seedOrganization(t, orgId, 1_000_000)
	seedOrgMember(t, userId, orgId, model.OrgRoleMember, 0, 0)
	seedSubscription(t, subId, userId, 100_000, 40_000)
	fx := newOrgFixture(t, userId, tokenId, channelId, 1_000_000)
	fx.relayInfo.UserSetting = dto.UserSetting{BillingPreference: "subscription_first"}

	require.Nil(t, PreConsumeBilling(fx.ctx, preConsume, fx.relayInfo))
	model.UpdateUserUsedQuotaAndRequestCount(userId, actual)
	require.NoError(t, SettleBilling(fx.ctx, fx.relayInfo, actual))

	assert.Equal(t, int64(actual), getOrgUsedQuota(t, orgId), "组织成员必须由组织预算出资")
	assert.Equal(t, int64(40_000), getSubscriptionUsed(t, subId), "订阅额度不得被组织成员消耗")
}
