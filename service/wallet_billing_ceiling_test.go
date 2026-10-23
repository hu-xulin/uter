package service

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
	"github.com/uter-ai/uter/types"
)

// ---------------------------------------------------------------------------
// DEF-6：钱包会话的计费硬闸门
//
// 复现缺陷时的现场：余额 100、单笔实扣 10000、无 max_tokens → 请求 200，
// 余额变 -9900，而 PreConsumedQuota 仅 500。准入只按「预扣估算额」校验余额，
// 真实成本结算时才可知；信任旁路（quota_setting.trust_quota_usd，默认 10 USD）
// 连估算额都不扣，结算补扣于是没有上界。
//
// 修复：准入时读到的余额（减去债务下限）延续为会话级计费上限，结算时对钱包
// 出资的会话硬截断，用量日志记截断后的生效额，「初始余额 − 最终余额 ==
// logs.Quota」不被打破。
// ---------------------------------------------------------------------------

func newCeilingTestRelayInfo(userID int, tokenKey string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		UserId:          userID,
		TokenId:         userID,
		TokenKey:        tokenKey,
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: 904},
		UsingGroup:      "default",
		UserGroup:       "default",
		OriginModelName: "gpt-4o",
		UserSetting:     dto.UserSetting{BillingPreference: "wallet_only"},
		StartTime:       time.Now(),
		PriceData: types.PriceData{
			ModelRatio:      1,
			CompletionRatio: 1,
			GroupRatioInfo:  types.GroupRatioInfo{GroupRatio: 1},
		},
	}
}

func newCeilingTestContext(tokenQuota int) *gin.Context {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Set("token_quota", tokenQuota)
	return ctx
}

func TestWalletSettlementClampedToAdmissionCeiling(t *testing.T) {
	truncate(t)

	const (
		userID      = 730
		balance     = 100_000
		preConsume  = 1_000
		actualQuota = 10_000_000 // 单笔实扣是余额的 100 倍（无 max_tokens 的流式请求）
	)
	seedUser(t, userID, balance)
	seedToken(t, userID, userID, "ceiling730", 1_000_000_000)
	seedChannel(t, 904)

	ctx := newCeilingTestContext(1_000_000_000)
	relayInfo := newCeilingTestRelayInfo(userID, "ceiling730")

	require.Nil(t, PreConsumeBilling(ctx, preConsume, relayInfo))
	require.NotNil(t, relayInfo.Billing)

	loggedQuota, settleFailed := SettleBillingForLog(ctx, relayInfo, actualQuota)
	require.False(t, settleFailed)

	// 生效额度被夹到准入余额（债务下限默认 0）：既不放任 -9900，也不把
	// 已经花掉的上游 token 记成 0。
	assert.Equal(t, balance, loggedQuota, "用量日志必须记真正扣到账上的额度")

	finalBalance, err := model.GetUserQuota(userID, true)
	require.NoError(t, err)
	assert.Equal(t, 0, finalBalance, "钱包不得被单笔请求打到债务下限以下")

	// P0 不变量：初始余额 − 最终余额 == logs.Quota。
	assert.Equal(t, balance-finalBalance, loggedQuota)

	reporter, ok := relayInfo.Billing.(settledQuotaReporter)
	require.True(t, ok, "BillingSession must report the settled quota")
	effective, clamped := reporter.SettledQuota()
	assert.True(t, clamped)
	assert.Equal(t, balance, effective)
}

func TestWalletSettlementClampCoversTrustBypass(t *testing.T) {
	truncate(t)

	// 信任旁路的命中条件：令牌余额与钱包余额都超过 trust_quota_usd
	// （默认 10 USD = 10 * QuotaPerUnit）。旁路命中时预扣为 0，
	// 结算补扣是唯一的扣费点——正是缺陷复现的路径。
	trustThreshold := int(10 * common.QuotaPerUnit)
	const (
		userID      = 731
		balance     = 6_000_000 // > trustThreshold
		tokenQuota  = 10_000_000
		preConsume  = 1_000
		actualQuota = 20_000_000
	)
	require.Greater(t, balance, trustThreshold)
	seedUser(t, userID, balance)
	seedToken(t, userID, userID, "ceiling731", tokenQuota)
	seedChannel(t, 904)

	ctx := newCeilingTestContext(tokenQuota)
	relayInfo := newCeilingTestRelayInfo(userID, "ceiling731")

	require.Nil(t, PreConsumeBilling(ctx, preConsume, relayInfo))
	require.NotNil(t, relayInfo.Billing)
	assert.Equal(t, 0, relayInfo.Billing.GetPreConsumedQuota(), "信任旁路下不应发生预扣")

	balanceAfterPreConsume, err := model.GetUserQuota(userID, true)
	require.NoError(t, err)
	assert.Equal(t, balance, balanceAfterPreConsume, "信任旁路下预扣不得动钱包")

	loggedQuota, settleFailed := SettleBillingForLog(ctx, relayInfo, actualQuota)
	require.False(t, settleFailed)

	assert.Equal(t, balance, loggedQuota)
	finalBalance, err := model.GetUserQuota(userID, true)
	require.NoError(t, err)
	assert.Equal(t, 0, finalBalance, "信任旁路 + 无上界实扣不得把钱包打到任意深度")
	assert.Equal(t, balance-finalBalance, loggedQuota, "计费不变量必须在截断后依然成立")
}

func TestWalletSettlementBelowCeilingIsNotClamped(t *testing.T) {
	truncate(t)

	const (
		userID      = 732
		balance     = 1_000_000
		preConsume  = 200_000
		actualQuota = 500_000
	)
	seedUser(t, userID, balance)
	seedToken(t, userID, userID, "ceiling732", 1_000_000_000)
	seedChannel(t, 904)

	ctx := newCeilingTestContext(1_000_000_000)
	relayInfo := newCeilingTestRelayInfo(userID, "ceiling732")

	require.Nil(t, PreConsumeBilling(ctx, preConsume, relayInfo))

	loggedQuota, settleFailed := SettleBillingForLog(ctx, relayInfo, actualQuota)
	require.False(t, settleFailed)
	assert.Equal(t, actualQuota, loggedQuota, "未触上限的结算必须记原值")

	finalBalance, err := model.GetUserQuota(userID, true)
	require.NoError(t, err)
	assert.Equal(t, balance-actualQuota, finalBalance)

	reporter, ok := relayInfo.Billing.(settledQuotaReporter)
	require.True(t, ok)
	effective, clamped := reporter.SettledQuota()
	assert.False(t, clamped)
	assert.Equal(t, actualQuota, effective)
}

func TestWalletSettlementClampRespectsConfiguredDebtFloor(t *testing.T) {
	truncate(t)
	t.Setenv("WALLET_DEBT_FLOOR_QUOTA", "5000")

	const (
		userID      = 733
		balance     = 100_000
		preConsume  = 10_000
		actualQuota = 1_000_000
	)
	seedUser(t, userID, balance)
	seedToken(t, userID, userID, "ceiling733", 1_000_000_000)
	seedChannel(t, 904)

	ctx := newCeilingTestContext(1_000_000_000)
	relayInfo := newCeilingTestRelayInfo(userID, "ceiling733")

	require.Nil(t, PreConsumeBilling(ctx, preConsume, relayInfo))

	loggedQuota, settleFailed := SettleBillingForLog(ctx, relayInfo, actualQuota)
	require.False(t, settleFailed)

	// 上限 = 可用额度 − 债务下限 = 95_000：钱包被允许落到债务下限，但不更低。
	assert.Equal(t, balance-5_000, loggedQuota)
	finalBalance, err := model.GetUserQuota(userID, true)
	require.NoError(t, err)
	assert.Equal(t, 5_000, finalBalance)
	assert.Equal(t, balance-finalBalance, loggedQuota, "计费不变量必须在截断后依然成立")
}
