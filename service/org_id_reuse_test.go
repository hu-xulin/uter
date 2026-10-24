package service

import (
	"testing"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	relaycommon "github.com/uter-ai/uter/relay/common"

	"github.com/stretchr/testify/require"
)

// 计费热路径上组织归属会被反复查询（准入 / shouldTrust / 预扣 / 结算 / 退款 /
// 成员用量记账）。Redis 关闭时每次 model.OrgIdOfUser 都回落为一条
// SELECT * FROM users，单个组织成员请求最多 7 次全行查询，其中 NewBillingSession
// 外层与 tryWallet 内层是紧邻的重复。RelayInfo.OrganizationId 的契约本就是
// 「创建计费会话时解析一次并缓存于此，供请求路径后续判断复用」，本测试锁死该复用。
func TestResolveOrgIdForBillingReusesRequestScopedCache(t *testing.T) {
	// 已缓存时必须直接复用，不得回落查库：用一个不存在的 userId，若回落
	// 查库会得到 record-not-found 错误。
	cached := &relaycommon.RelayInfo{UserId: 999_999_999, OrganizationId: 42}
	orgId, err := resolveOrgIdForBilling(cached)
	require.NoError(t, err, "a cached organization id must not fall back to the database")
	require.Equal(t, 42, orgId)

	// 未缓存时必须回落到数据库查询，且能取到用户的真实组织归属。
	//
	// 这里不用 seedUser：它写入空的 aff_code，而该列有唯一索引，同一测试库里
	// 多个 seedUser 调用会互相冲突，也会连带弄坏后续依赖「空 aff_code 唯一」的用例。
	require.NoError(t, model.DB.Create(&model.User{
		Id:             910_001,
		Username:       "org_reuse_member",
		AffCode:        "orgreuse1",
		Quota:          1_000,
		Status:         common.UserStatusEnabled,
		OrganizationId: 7,
	}).Error)

	uncached := &relaycommon.RelayInfo{UserId: 910_001}
	orgId, err = resolveOrgIdForBilling(uncached)
	require.NoError(t, err)
	require.Equal(t, 7, orgId, "an uncached relay info must fall back to the database lookup")

	// 平台直管用户（organization_id = 0）必须原样返回 0，不能被误判为组织成员。
	// 不用 seedUser：它的 aff_code 为空串，而该列有唯一索引，同测试内建第二个
	// 用户会冲突。
	require.NoError(t, model.DB.Create(&model.User{
		Id:             910_002,
		Username:       "org_reuse_direct",
		AffCode:        "orgreuse2",
		Quota:          1_000,
		Status:         common.UserStatusEnabled,
		OrganizationId: 0,
	}).Error)
	orgId, err = resolveOrgIdForBilling(&relaycommon.RelayInfo{UserId: 910_002})
	require.NoError(t, err)
	require.Equal(t, 0, orgId)
}

// WalletFunding 在 PreConsume / Settle / Refund 三处都要判断「是否组织成员」。
// 组织归属在一次请求内不变，因此必须只查一次并定型：否则直管用户因为
// orgId==0 无法用「>0」判断是否已解析，会在每个资金操作点重复回查。
func TestWalletFundingResolvesOrgIdOnce(t *testing.T) {
	require.NoError(t, model.DB.Create(&model.User{
		Id:             910_010,
		Username:       "funding_member",
		AffCode:        "fundmember1",
		Quota:          1_000,
		Status:         common.UserStatusEnabled,
		OrganizationId: 0,
	}).Error)

	// 直管用户：首次解析后必须被标记为已定型，后续调用不再回查
	// （用不存在的 userId 构造同类对象来证明定型值不会回落查库）。
	funding := &WalletFunding{userId: 910_010}
	resolved, err := funding.resolveOrgId()
	require.NoError(t, err)
	require.Equal(t, 0, resolved)
	require.True(t, funding.orgIdResolved, "a resolved organization id must be pinned so later calls skip the lookup")
	for i := 0; i < 2; i++ {
		again, err := funding.resolveOrgId()
		require.NoError(t, err)
		require.Equal(t, 0, again)
	}

	// 构造时注入的组织归属必须被直接采用：把 userId 换成一个不存在的值，
	// 若仍回查数据库就会得到 record-not-found。
	injected := &WalletFunding{userId: 999_999_998, orgId: 7, orgIdResolved: true}
	for i := 0; i < 2; i++ {
		got, err := injected.resolveOrgId()
		require.NoError(t, err)
		require.Equal(t, 7, got)
	}
}

// 组织归属解析失败必须上抛，而不是回落成「0 = 平台直管用户」。
//
// 回落会让组织成员的预扣/Settle/Refund 全部改走个人钱包：组织账本少收一笔、
// 个人余额被凭空扣减或凭空退还，两本账同时错位且不可逆。fail-closed 是唯一
// 安全取向——宁可拒绝请求，也不能猜错出资方。
func TestWalletFundingFailsClosedWhenOrgLookupFails(t *testing.T) {
	// userId 不存在 → OrgIdOfUser 返回 record-not-found。
	funding := &WalletFunding{userId: 999_999_997}
	orgId, err := funding.resolveOrgId()
	require.Error(t, err, "a failed organization lookup must not be silently treated as a platform user")
	require.Zero(t, orgId)
	require.False(t, funding.orgIdResolved, "a failed lookup must not pin a guessed value")

	require.Error(t, funding.PreConsume(100), "预扣必须失败，而不是记到个人钱包")
	require.Error(t, funding.Settle(100), "结算必须失败，而不是调整个人钱包")
	require.Zero(t, funding.consumed, "解析失败时不得产生任何预扣记账")

	// Refund 只有在 consumed>0 时才真正回减；模拟「预扣成功、退款时归属查不到」
	// （例如用户行在请求期间被硬删除），此时必须上抛而不是退到个人钱包。
	funding.consumed = 100
	require.Error(t, funding.Refund(), "退款必须失败，而不是退到个人钱包")
	require.Equal(t, 100, funding.consumed, "退款未成功时不得清零预扣计数，否则额度永久丢失")
}
