package controller

import (
	"strconv"
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/setting/operation_setting"
)

// TestRoundPayMoneyToCentKeepsEveryConsumerInAgreement 锁死「同一个应付金额，
// 网关请求体、订单标题、回调比对三处必须给出同一个分位值」。
//
// 历史缺陷：金额未在下单时收敛到分，于是三个消费者各自取整：
//   - 请求体用 strconv.FormatFloat(…,'f',2,64)，四舍六入五取偶 → 6.885 写成 6.88
//   - 标题与回调比对用 decimal.Round(2)，四舍五入 → 6.885 读成 6.89
//
// 网关按 6.88 扣款、本地要求 6.89，回调永远判「金额不匹配」并返回 failure，
// 用户付了钱却拿不到额度，且支付宝会一直重试到超时。
func TestRoundPayMoneyToCentKeepsEveryConsumerInAgreement(t *testing.T) {
	// 这些取值的第三位小数恰好是 5，正是两种舍入规则会分叉的点。
	tieValues := []float64{6.885, 1.005, 2.675, 0.125, 33.7125, 123.455}
	for _, raw := range tieValues {
		rounded := roundPayMoneyToCent(raw)

		// 消费者 1：网关请求体（支付宝 total_amount / 微信 description 同源）
		wireAmount := strconv.FormatFloat(rounded, 'f', 2, 64)
		// 消费者 2：订单标题
		titleAmount := decimal.NewFromFloat(rounded).Round(2).StringFixed(2)
		// 消费者 3：回调比对
		matches := providerPaidAmountMatchesOrder(wireAmount, rounded)

		assert.Equal(t, wireAmount, titleAmount,
			"order title and gateway amount must agree for %v", raw)
		assert.True(t, matches,
			"callback must accept the amount we actually charged for %v (wire=%s)", raw, wireAmount)
	}
}

// TestRoundPayMoneyToCentIsIdempotent 验证收敛后的值再走一遍不会漂移，
// 否则「已存两位小数的订单」在重新计算时仍可能与网关不一致。
func TestRoundPayMoneyToCentIsIdempotent(t *testing.T) {
	for _, raw := range []float64{0.01, 6.88, 6.89, 999999.99, 0.005} {
		once := roundPayMoneyToCent(raw)
		twice := roundPayMoneyToCent(once)
		assert.Equal(t, once, twice, "rounding %v twice must be stable", raw)
	}
}

// TestRoundPayMoneyToCentNeverExceedsTwoDecimals 验证不产生第三位小数。
func TestRoundPayMoneyToCentNeverExceedsTwoDecimals(t *testing.T) {
	for _, raw := range []float64{6.885, 6.884999, 0.0049, 1.999, 2.005} {
		rounded := decimal.NewFromFloat(roundPayMoneyToCent(raw))
		assert.True(t, rounded.Equal(rounded.Round(2)),
			"%v must round to at most two decimals, got %v", raw, rounded)
	}
}

// TestTokensModeChargeMatchesCredit 锁死「收多少钱就入多少额度」：
// Tokens 展示模式下入账按 IntPart(amount/quotaPerUnit) 取整，计价若用精确商，
// 用户会为没到账的零头付钱（600000 tokens 收 1.2 美元、只入账 1.0 美元）。
func TestTokensModeChargeMatchesCredit(t *testing.T) {
	general := operation_setting.GetGeneralSetting()
	oldDisplayType := general.QuotaDisplayType
	oldPrice := operation_setting.Price
	t.Cleanup(func() {
		general.QuotaDisplayType = oldDisplayType
		operation_setting.Price = oldPrice
	})
	general.QuotaDisplayType = operation_setting.QuotaDisplayTypeTokens
	operation_setting.Price = 1

	// 金额模型已从 int64 迁到 float64（支持 $0.01 起充），这里同步类型。
	const amount = float64(600000) // 1.2 USD 等值 tokens
	storedAmount := alipayAmountForStorage(amount)
	creditedQuota, err := getTopUpQuota(amount)
	require.NoError(t, err)

	payMoney := getPayMoney(amount, "default")

	assert.EqualValues(t, 1, storedAmount, "stored order amount must be whole USD units")
	assert.Equal(t, int64(1)*int64(common.QuotaPerUnit), int64(creditedQuota),
		"credited quota must match the whole-unit amount")
	assert.Equal(t, 1.0, payMoney,
		"charge must be based on the same whole-unit amount as the credit")
}
