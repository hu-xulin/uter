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
	require.Equal(t, 0, funding.resolveOrgId())
	require.True(t, funding.orgIdResolved, "a resolved organization id must be pinned so later calls skip the lookup")
	require.Equal(t, 0, funding.resolveOrgId())
	require.Equal(t, 0, funding.resolveOrgId())

	// 构造时注入的组织归属必须被直接采用：把 userId 换成一个不存在的值，
	// 若仍回查数据库就会得到 record-not-found。
	injected := &WalletFunding{userId: 999_999_998, orgId: 7, orgIdResolved: true}
	require.Equal(t, 7, injected.resolveOrgId())
	require.Equal(t, 7, injected.resolveOrgId())
}
