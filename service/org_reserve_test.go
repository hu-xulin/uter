package service

import (
	"sync"
	"testing"

	"github.com/uter-ai/uter/model"
	relaycommon "github.com/uter-ai/uter/relay/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Reserve 路径的组织成员原子性回归。
//
// 这组用例针对的是一个已修复的严重缺陷：reserveFunding 的组织分支曾经
// 直接调 IncrOrgUsedQuota（裸 `used_quota = used_quota + ?`，无 WHERE 条件），
// 绕过了 ReserveOrgQuota 的双层原子闸门。后果有两层：
//
//  1. 组织预算可被并发击穿：N 条请求各自无条件累加，used_quota 远超 quota。
//     防线本应落在 ReserveOrgQuota 的单条条件 UPDATE 上，旧代码等于绕过它。
//  2. 成员 users.used_quota 从未被写，而 rollbackFundingReserve 却去减它，
//     形成「正向不写、反向减」的镜像 bug：一次失败的 Reserve 会凭空抹掉
//     成员的历史用量，sub_quota_limit 的有效额度被系统性放大。
//
// 触发面很宽：reserveFunding 的软分支仅在「非图片请求」时命中，而
// PreWssConsumeQuota（Realtime）、PrepareTieredBillingForSelectedGroup（阶梯计费）、
// relay 重试补扣都会走 Reserve，且都是文本请求。

// TestOrgMemberReserveCannotExceedOrgBudgetConcurrency 并发预留不得击穿组织预算。
func TestOrgMemberReserveCannotExceedOrgBudgetConcurrency(t *testing.T) {
	truncate(t)
	const orgId, userId = 700, 701
	const orgBudget = 1_000_000
	const subQuotaLimit = 1_000_000
	// 每条预留的额度都远小于预算，但 N 条并发之和必须被预算挡住一部分。
	const delta = 300_000
	const concurrency = 10 // 10 × 300000 = 3,000,000 >> 1,000,000

	seedOrganization(t, orgId, orgBudget)
	seedOrgMember(t, userId, orgId, model.OrgRoleMember, 0, subQuotaLimit)

	var wg sync.WaitGroup
	var mu sync.Mutex
	var succeeded int
	for range concurrency {
		wg.Add(1)
		go func() {
			defer wg.Done()
			// 每个 goroutine 用独立的 BillingSession —— 这才对应真实的并发模型：
			// 每个 HTTP 请求有自己的 session，共享的是组织与成员那两份账本。
			// 共用同一个 session 反而是错的（reserveFunding 在真实调用链里由
			// BillingSession.mu 保护，session 不跨请求），且会让 funding.consumed
			// 变成真正的 data race，掩盖我们真正要验证的东西。
			session := &BillingSession{
				funding: &WalletFunding{userId: userId},
				relayInfo: &relaycommon.RelayInfo{
					UserId: userId,
					// 非图片请求：旧实现在这里会走软分支（绕过原子闸门）。
					Request: nil,
				},
			}
			if err := session.reserveFunding(delta, false); err == nil {
				mu.Lock()
				succeeded++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()

	orgUsed := getOrgUsedQuota(t, orgId)

	// 不变量一：组织账本绝不能超过预算。
	assert.LessOrEqual(t, orgUsed, int64(orgBudget),
		"并发预留把组织 used_quota 推到 %d，超过预算 %d —— 原子闸门被绕过", orgUsed, orgBudget)

	// 不变量二：成功的预留数必须与账本增量严格对应（一笔 delta 对应一次记账）。
	assert.Equal(t, int64(succeeded*delta), orgUsed,
		"账本增量(%d) 与成功预留数(%d)×delta(%d) 不匹配：存在漏记或重复记账",
		orgUsed, succeeded, delta)

	// 不变量三：不可能全部成功——预算只够 3 笔多一点。
	assert.Less(t, succeeded, concurrency,
		"%d 条并发预留全部成功，说明预算闸门完全失效", concurrency)
}

// TestOrgMemberReserveRollbackIsSymmetric 回滚必须与正向预留严格对称。
//
// 修复前：正向 reserveFunding 的组织分支只写 organizations.used_quota，
// 回滚却同时减 organizations.used_quota 与 members.used_quota。
// 那次「减了一个从未写过的字段」会把成员的历史用量凭空抹掉。
func TestOrgMemberReserveRollbackIsSymmetric(t *testing.T) {
	truncate(t)
	const orgId, userId = 710, 711
	seedOrganization(t, orgId, 1_000_000)
	seedOrgMember(t, userId, orgId, model.OrgRoleMember, 0, 1_000_000)

	// 成员已有历史用量，回滚绝不能把它一并抹掉。
	const historicalUsed = 7_000
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", userId).
		Update("used_quota", historicalUsed).Error)

	funding := &WalletFunding{userId: userId}
	session := &BillingSession{funding: funding}
	session.relayInfo = &relaycommon.RelayInfo{UserId: userId}

	const delta = 123_456
	require.NoError(t, session.reserveFunding(delta, false))

	assert.Equal(t, int64(delta), getOrgUsedQuota(t, orgId), "预留应记入组织账本")
	assert.Equal(t, int64(historicalUsed+delta), getMemberUsedQuota(t, userId),
		"预留应同时记入成员子额度账本（闸门与记账必须是同一次原子预留）")

	session.rollbackFundingReserve(delta)

	assert.Equal(t, int64(0), getOrgUsedQuota(t, orgId), "回滚后组织账本应归零")
	assert.Equal(t, int64(historicalUsed), getMemberUsedQuota(t, userId),
		"回滚只应撤销本次预留(%d)，成员历史用量(%d)必须完好", delta, historicalUsed)
}

// TestOrgMemberReserveRejectsWhenSubQuotaExhausted 成员子额度是独立于组织预算的
// 第二道闸门，不能因为组织预算充足就放行。
func TestOrgMemberReserveRejectsWhenSubQuotaExhausted(t *testing.T) {
	truncate(t)
	const orgId, userId = 720, 721
	seedOrganization(t, orgId, 10_000_000)                          // 组织预算充足
	seedOrgMember(t, userId, orgId, model.OrgRoleMember, 0, 50_000) // 子额度很小

	funding := &WalletFunding{userId: userId}
	session := &BillingSession{funding: funding}
	session.relayInfo = &relaycommon.RelayInfo{UserId: userId}

	err := session.reserveFunding(100_000, false)
	require.Error(t, err, "成员子额度 50000 不足以预留 100000，必须拒绝")

	assert.Equal(t, int64(0), getOrgUsedQuota(t, orgId),
		"子额度拒绝不得扣减组织账本")
	assert.Equal(t, int64(0), getMemberUsedQuota(t, userId),
		"子额度拒绝不得记账")
	assert.Zero(t, funding.consumed, "预留失败不得累加 consumed，否则 Refund 会退出一笔从未扣过的钱")
}

// TestOrgMemberReserveRejectedWhenOrgBudgetExhausted 组织预算耗尽时必须拒绝，
// 且个人钱包余额充足也不得放行（出资方是组织，不是个人）。
func TestOrgMemberReserveRejectedWhenOrgBudgetExhausted(t *testing.T) {
	truncate(t)
	const orgId, userId = 730, 731
	seedOrganization(t, orgId, 0) // 预算 0 = 不限制上界，用 used_quota 卡死
	seedOrgMember(t, userId, orgId, model.OrgRoleMember, 9_999_999, 0)
	require.NoError(t, model.DB.Model(&model.Organization{}).Where("id = ?", orgId).
		Update("used_quota", 5_000).Error)

	funding := &WalletFunding{userId: userId}
	session := &BillingSession{funding: funding}
	session.relayInfo = &relaycommon.RelayInfo{UserId: userId}

	// 把组织 status 置为停用，触发 ReserveOrgQuota 的第二条条件。
	require.NoError(t, model.DB.Model(&model.Organization{}).Where("id = ?", orgId).
		Update("status", model.OrgStatusDisabled).Error)

	err := session.reserveFunding(1_000, false)
	require.Error(t, err, "组织已停用，预留必须拒绝")

	var org model.Organization
	require.NoError(t, model.DB.Select("used_quota", "quota").Where("id = ?", orgId).First(&org).Error)
	assert.Equal(t, int64(5_000), org.UsedQuota, "被拒绝的预留不得改动组织账本")
	assert.Zero(t, funding.consumed)
}

func getMemberUsedQuota(t *testing.T, id int) int64 {
	t.Helper()
	var user model.User
	require.NoError(t, model.DB.Select("used_quota").Where("id = ?", id).First(&user).Error)
	return int64(user.UsedQuota)
}
