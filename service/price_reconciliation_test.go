package service

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Uter-AI/Uter/common"

	"github.com/Uter-AI/Uter/model"
	"github.com/Uter-AI/Uter/pkg/billingexpr"
	relaycommon "github.com/Uter-AI/Uter/relay/common"
	"github.com/Uter-AI/Uter/relaykit/dto"
	relaytypes "github.com/Uter-AI/Uter/relaykit/types"
	hosttypes "github.com/Uter-AI/Uter/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 需求 #2「官方价格、折扣价格、普通用户计费测试和核算」的对账证据。
//
// 定价链路上所有优惠（分组倍率、用户分组特殊倍率、渠道定价、用户定价）最终都折算成
// 同一个乘子 GroupRatio，再与 ModelRatio 相乘：
//
//	quota = (prompt + completion × CompletionRatio) × ModelRatio × GroupRatio
//
// 其中额度单位是 500000 额度 = 1 美元（common.QuotaPerUnit），故 ModelRatio 1
// 等价于 2 美元 / 1M tokens。
//
// 因此「折扣价 = 官方价 × 折扣系数」必须在**生产计费函数**上逐位成立，
// 而不能只在测试里重现一遍公式。本文件用 calculateTextQuotaSummary /
// PostTextConsumeQuota 做端到端核算，并断言资金不变量：
//
//	钱包初始余额 − 结算后余额 == consume 日志记录的 Quota

const priceTestModel = "gpt-4o-price-recon"

func priceContext() *gin.Context {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Set("token_name", "price_token")
	return ctx
}

// priceRelayInfo 固定 ModelRatio=2 / CompletionRatio=4，只让分组倍率变化，
// 使「官方价」与「折扣价」之间只差一个已知系数。
func priceRelayInfo(groupRatio float64) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayFormat:     relaytypes.RelayFormatOpenAI,
		OriginModelName: priceTestModel,
		UsingGroup:      "default",
		UserGroup:       "default",
		PriceData: hosttypes.PriceData{
			ModelRatio:      2,
			CompletionRatio: 4,
			GroupRatioInfo:  hosttypes.GroupRatioInfo{GroupRatio: groupRatio},
		},
		UserSetting: dto.UserSetting{BillingPreference: "wallet_only"},
		StartTime:   time.Now(),
	}
}

func textQuotaFor(groupRatio float64, prompt, completion int) int {
	return calculateTextQuotaSummary(priceContext(), priceRelayInfo(groupRatio),
		&dto.Usage{PromptTokens: prompt, CompletionTokens: completion}).Quota
}

// ---------------------------------------------------------------------------
// 官方价 vs 折扣价
// ---------------------------------------------------------------------------

// 折扣价必须等于官方价乘以折扣系数，且 prompt / completion 两个维度都被折扣。
func TestDiscountedPriceIsProportionalToOfficialPrice(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// 官方价（GroupRatio = 1）：1000 × ModelRatio 2 = 2000 额度。
	official := textQuotaFor(1.0, 1000, 0)
	require.Equal(t, 2000, official, "官方价：1000 prompt token × ModelRatio 2 应为 2000 额度")

	for _, testCase := range []struct {
		groupRatio float64
		want       int
	}{
		{0.8, 1600},
		{0.6, 1200},
		{0.5, 1000},
		{0.35, 700},
	} {
		t.Run(fmt.Sprintf("group_ratio_%v", testCase.groupRatio), func(t *testing.T) {
			got := textQuotaFor(testCase.groupRatio, 1000, 0)
			assert.Equal(t, testCase.want, got)
			assert.Equal(t, billingexpr.QuotaRound(float64(official)*testCase.groupRatio), got,
				"折扣价必须等于官方价 × 折扣系数")
		})
	}

	// completion 维度：官方价 = (1000 + 500×4) × 2 = 6000 额度。
	t.Run("completion_tokens_are_discounted_too", func(t *testing.T) {
		require.Equal(t, 6000, textQuotaFor(1.0, 1000, 500))
		assert.Equal(t, 3000, textQuotaFor(0.5, 1000, 500))
		// 折扣只作用于倍率，不改变 prompt / completion 的构成比例。
		assert.Equal(t, 1500, textQuotaFor(0.25, 1000, 500))
	})
}

// ---------------------------------------------------------------------------
// 普通用户端到端对账：余额变动必须等于日志 Quota
// ---------------------------------------------------------------------------

// 普通用户（个人钱包）的完整计费链路：预扣 → 结算 → 落日志。
// 不变量：初始余额 − 最终余额 == consume 日志的 Quota == 按官方/折扣价算出的额度。
func TestWalletReconciliationMatchesLogQuota(t *testing.T) {
	cases := []struct {
		name       string
		groupRatio float64
		wantQuota  int
	}{
		{"official price (group ratio 1.0)", 1.0, 6000},
		{"discounted price (group ratio 0.5)", 0.5, 3000},
	}

	for i, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			truncate(t)
			userId, tokenId, channelId := 900+i, 910+i, 920+i
			const wallet = 1_000_000
			seedUser(t, userId, wallet)
			seedToken(t, tokenId, userId, fmt.Sprintf("pricekey%d", tokenId), 10_000_000)
			seedChannel(t, channelId)

			ctx := priceContext()
			relayInfo := priceRelayInfo(testCase.groupRatio)
			relayInfo.UserId = userId
			relayInfo.TokenId = tokenId
			relayInfo.TokenKey = fmt.Sprintf("pricekey%d", tokenId)
			// ChannelId 是从内嵌 *ChannelMeta 提升上来的字段，必须先初始化
			// ChannelMeta 再赋值，否则会解引用空指针。
			relayInfo.ChannelMeta = &relaycommon.ChannelMeta{ChannelId: channelId}

			// 预扣：用与真实 relay 路径一致的估算用量。
			estimated := calculateTextQuotaSummary(ctx, relayInfo,
				&dto.Usage{PromptTokens: 1000}).Quota
			require.Nil(t, PreConsumeBilling(ctx, estimated, relayInfo))

			// 结算：上游返回真实用量 1000 prompt + 500 completion。
			PostTextConsumeQuota(ctx, relayInfo, &dto.Usage{PromptTokens: 1000, CompletionTokens: 500}, nil)

			var consumeLog model.Log
			require.NoError(t, model.LOG_DB.
				Where("user_id = ? AND type = ?", userId, model.LogTypeConsume).
				Order("id DESC").First(&consumeLog).Error)

			assert.Equal(t, testCase.wantQuota, consumeLog.Quota,
				"日志 Quota 必须等于按该分组倍率算出的额度")
			assert.Equal(t, wallet-consumeLog.Quota, getUserQuota(t, userId),
				"钱包减少额必须逐位等于日志 Quota（初始余额 − 最终余额 == logs.Quota）")

			usedQuota, requestCount := getUserUsageAccounting(t, userId)
			assert.Equal(t, consumeLog.Quota, usedQuota, "成员用量账目必须与日志一致")
			assert.Equal(t, 1, requestCount)
		})
	}
}

// ---------------------------------------------------------------------------
// 扣费意外情况
// ---------------------------------------------------------------------------

// 上游报错 / 客户端中断：退款必须把预扣额完整还回钱包，账目归零。
func TestWalletRefundOnUpstreamFailureRestoresQuota(t *testing.T) {
	truncate(t)
	const userId, tokenId, channelId = 940, 950, 960
	const wallet = 500_000
	const preConsume = 4_000
	seedUser(t, userId, wallet)
	seedToken(t, tokenId, userId, "refundkey", 10_000_000)
	seedChannel(t, channelId)

	ctx := priceContext()
	relayInfo := priceRelayInfo(1.0)
	relayInfo.UserId = userId
	relayInfo.TokenId = tokenId
	relayInfo.TokenKey = "refundkey"
	relayInfo.ChannelMeta = &relaycommon.ChannelMeta{ChannelId: channelId}

	require.Nil(t, PreConsumeBilling(ctx, preConsume, relayInfo))
	require.Equal(t, wallet-preConsume, getUserQuota(t, userId), "预扣必须立刻从钱包扣除")

	require.True(t, relayInfo.Billing.NeedsRefund())
	relayInfo.Billing.Refund(ctx)

	waitForUserQuota(t, userId, wallet)
	assert.Equal(t, wallet, getUserQuota(t, userId), "退款必须把预扣额完整还回")
	assert.False(t, relayInfo.Billing.NeedsRefund(),
		"退款后必须标记为已退款，二次退款不得重复入账")
}

// Refund 的入账在后台 goroutine 中执行，轮询等待钱包回落到期望余额。
func waitForUserQuota(t *testing.T, userId, want int) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if getUserQuota(t, userId) == want {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	assert.Equal(t, want, getUserQuota(t, userId))
}

// 实际消耗小于预扣（上游提前结束 / 计费信息偏小）：差额必须退还，而非留下负账。
func TestWalletSettleBelowPreConsumeRefundsDifference(t *testing.T) {
	truncate(t)
	const userId, tokenId, channelId = 970, 980, 990
	const wallet = 200_000
	seedUser(t, userId, wallet)
	seedToken(t, tokenId, userId, "underkey", 10_000_000)
	seedChannel(t, channelId)

	ctx := priceContext()
	relayInfo := priceRelayInfo(1.0)
	relayInfo.UserId = userId
	relayInfo.TokenId = tokenId
	relayInfo.TokenKey = "underkey"
	relayInfo.ChannelMeta = &relaycommon.ChannelMeta{ChannelId: channelId}

	require.Nil(t, PreConsumeBilling(ctx, 5_000, relayInfo))
	require.NoError(t, SettleBilling(ctx, relayInfo, 1_200))

	assert.Equal(t, wallet-1_200, getUserQuota(t, userId),
		"实际消耗 1200 < 预扣 5000 时必须退还 3800，最终净扣 1200")
}

// ---------------------------------------------------------------------------
// 组织角色计费一致性
// ---------------------------------------------------------------------------

// 组织内四种角色（owner / admin / department_admin / member）的请求一律由组织预算出资，
// 且组织账本的增量必须逐位等于该请求的实际消耗。
func TestOrganizationBillingIsIdenticalAcrossRoles(t *testing.T) {
	for i, orgRole := range []string{
		model.OrgRoleOwner,
		model.OrgRoleAdmin,
		model.OrgRoleDepartmentAdmin,
		model.OrgRoleMember,
	} {
		t.Run(orgRole, func(t *testing.T) {
			truncate(t)
			orgId, userId, tokenId, channelId := 1000+i, 1010+i, 1020+i, 1030+i
			const preConsume, actual = 1_000, 2_500
			seedOrganization(t, orgId, 1_000_000)
			// 个人钱包刻意留高余额：组织成员的准入与扣减都不得使用它。
			seedOrgMember(t, userId, orgId, orgRole, 999_999, 0)
			fx := newOrgFixture(t, userId, tokenId, channelId, 10_000_000)

			require.Nil(t, PreConsumeBilling(fx.ctx, preConsume, fx.relayInfo))
			model.UpdateUserUsedQuotaAndRequestCount(userId, actual)
			require.NoError(t, SettleBilling(fx.ctx, fx.relayInfo, actual))

			assert.Equal(t, int64(actual), getOrgUsedQuota(t, orgId),
				"组织账本增量必须等于实际消耗，与请求者角色无关")
			assert.Equal(t, 999_999, getUserQuota(t, userId), "组织成员的个人钱包不得被扣减")

			usedQuota, _ := getUserUsageAccounting(t, userId)
			assert.Equal(t, actual, usedQuota, "成员用量必须等于实际消耗（不得重复叠加 delta）")
		})
	}
}

// 组织预算恰好能覆盖 N 次请求时，必须放行恰好 N 次、拒绝第 N+1 次，
// 且账本落在恰好 N × 单次预扣上 —— 预算边界不得被跨越。
func TestOrganizationBudgetBoundaryIsExact(t *testing.T) {
	truncate(t)
	const orgId = 1100
	const perRequest = 1_000
	const capacity = 3
	seedOrganization(t, orgId, perRequest*capacity)

	accepted := 0
	for i := range capacity + 2 {
		userId, tokenId, channelId := 1110+i, 1120+i, 1130+i
		seedOrgMember(t, userId, orgId, model.OrgRoleMember, 0, 0)
		fx := newOrgFixture(t, userId, tokenId, channelId, 10_000_000)

		if PreConsumeBilling(fx.ctx, perRequest, fx.relayInfo) == nil {
			accepted++
		}
	}

	assert.Equal(t, capacity, accepted, "预算只够 3 次时必须恰好放行 3 次")
	assert.Equal(t, int64(perRequest*capacity), getOrgUsedQuota(t, orgId),
		"账本必须恰好落在预算上，不得超扣")
}

// 组织预算耗尽后，后续请求必须在准入阶段被拒绝且不在账本上留下任何痕迹。
func TestOrganizationBudgetExhaustionRejectsWithoutLedgerResidue(t *testing.T) {
	truncate(t)
	const orgId, userId, tokenId, channelId = 1200, 1210, 1220, 1230
	seedOrganization(t, orgId, 1_000)
	seedOrgMember(t, userId, orgId, model.OrgRoleMember, 0, 0)
	fx := newOrgFixture(t, userId, tokenId, channelId, 10_000_000)

	require.Nil(t, PreConsumeBilling(fx.ctx, 1_000, fx.relayInfo))
	require.Equal(t, int64(1_000), getOrgUsedQuota(t, orgId))

	second := newOrgFixture(t, userId, tokenId+1, channelId+1, 10_000_000)
	apiErr := PreConsumeBilling(second.ctx, 1, second.relayInfo)
	require.NotNil(t, apiErr, "预算耗尽后必须拒绝")
	assert.Equal(t, int64(1_000), getOrgUsedQuota(t, orgId), "拒绝不得改变账本")

	// 拒绝后也不得残留未结算的计费会话，否则会虚增预扣额。
	assert.Nil(t, second.relayInfo.Billing, "准入失败不得建立计费会话")
}

// 额度单位口径：normalize 到「500000 额度 = 1 美元」，避免前端金额换算与后端脱节。
func TestQuotaPerUnitIsFiveHundredThousand(t *testing.T) {
	assert.Equal(t, 500_000.0, common.QuotaPerUnit,
		"500000 额度 = 1 美元；改动此常量会使全部金额展示与真实计价脱节")
}
