package common

import (
	"math"
	"strings"

	"github.com/shopspring/decimal"
)

// MaxTopUpAmountDecimals 是充值金额允许的最大小数位。
//
// 美元/人民币的最小货币单位是分，支付网关侧无法表达更小的金额；本地计价也
// 统一收敛到「分」（见 controller.roundPayMoneyToCent）。多出来的位数会让
// 「用户看到的金额」与「实际扣款」不一致，因此一律拒绝，不做静默四舍五入。
const MaxTopUpAmountDecimals = 2

// NormalizeTopUpAmount 校验并归一化一笔充值金额（金额单位由 QuotaDisplayType 决定：
// USD/CNY 为金额，TOKENS 为 token 数）。
//
// 拒绝 NaN/Inf 与超过两位小数的值。注意这里刻意不做四舍五入：0.001 这样的请求
// 若被悄悄抬成 0.01，用户看到的价格与实际扣款就永久对不上了。
func NormalizeTopUpAmount(amount float64) (decimal.Decimal, error) {
	if math.IsNaN(amount) || math.IsInf(amount, 0) {
		return decimal.Zero, NewMessage("Invalid top-up amount")
	}
	normalized := decimal.NewFromFloat(amount)
	if !normalized.Equal(normalized.Round(MaxTopUpAmountDecimals)) {
		return decimal.Zero, NewMessage("Top-up amount supports at most {{decimals}} decimal places", map[string]any{"decimals": MaxTopUpAmountDecimals})
	}
	return normalized.Round(MaxTopUpAmountDecimals), nil
}

// ParseTopUpAmountSetting 解析后台配置里的充值金额字符串（最低充值等）。
//
// 与 NormalizeTopUpAmount 同一口径（非负、最多两位小数），区别是接受字符串输入
// 并允许 0（表示不设下限）。解析失败必须由调用方向上返回错误——历史实现用
// strconv.Atoi 且丢弃 error，配置 "0.01" 会静默变成 0，把下限校验整个关掉。
func ParseTopUpAmountSetting(value string) (float64, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return 0, NewMessage("Amount cannot be empty")
	}
	parsed, err := decimal.NewFromString(trimmed)
	if err != nil {
		return 0, NewMessage("Invalid amount: {{value}}", map[string]any{"value": value})
	}
	if parsed.IsNegative() {
		return 0, NewMessage("Amount cannot be negative")
	}
	if !parsed.Equal(parsed.Round(MaxTopUpAmountDecimals)) {
		return 0, NewMessage("Amount supports at most {{decimals}} decimal places", map[string]any{"decimals": MaxTopUpAmountDecimals})
	}
	amount, _ := parsed.Float64()
	return amount, nil
}
