/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

package operation_setting

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
)

func preserveOrderTitlePrefix(t *testing.T) {
	t.Helper()
	original := paymentSetting.OrderTitlePrefix
	t.Cleanup(func() { paymentSetting.OrderTitlePrefix = original })
}

// TestPaymentOrderTitlePrefixFallsBackToBrandName 锁定未配置时的回退：
// 升级前订单标题用的是 common.EmailBrandName，配置项为空必须继续用它，
// 否则存量部署的收银台标题会在无人操作的情况下变空。
func TestPaymentOrderTitlePrefixFallsBackToBrandName(t *testing.T) {
	preserveOrderTitlePrefix(t)

	for _, blank := range []string{"", "   ", "\t\n"} {
		paymentSetting.OrderTitlePrefix = blank
		assert.Equal(t, common.EmailBrandName, PaymentOrderTitlePrefix(), "blank prefix %q", blank)
	}
}

// TestPaymentOrderTitlePrefixUsesOperatorValue 锁定运营配置生效（含首尾空格裁剪）。
func TestPaymentOrderTitlePrefixUsesOperatorValue(t *testing.T) {
	preserveOrderTitlePrefix(t)

	paymentSetting.OrderTitlePrefix = "  优特智能  "
	assert.Equal(t, "优特智能", PaymentOrderTitlePrefix())
}

// TestValidatePaymentOrderTitlePrefix 锁定前缀校验：
//   - 空值合法（回退品牌名）；
//   - 长度上限 100 字符——总标题受微信 127 字符限制，扣掉「 充值 68.80 元」后缀；
//   - 拒绝支付宝明确禁止、且会破坏表单编码的字符（/ = & 等）。
func TestValidatePaymentOrderTitlePrefix(t *testing.T) {
	valid := []string{
		"",
		"   ",
		"Uter.ai 优特智能",
		"优特智能",
		"Uter AI",
		"a.b-c_d",
		strings.Repeat("优", PaymentOrderTitlePrefixMaxLength),
	}
	for _, value := range valid {
		assert.NoError(t, ValidatePaymentOrderTitlePrefix(value), value)
	}

	invalid := map[string]string{
		"too long":       strings.Repeat("优", PaymentOrderTitlePrefixMaxLength+1),
		"slash":          "Uter/ai",
		"equals":         "Uter=ai",
		"ampersand":      "Uter&ai",
		"question":       "Uter?ai",
		"percent":        "Uter%ai",
		"plus":           "Uter+ai",
		"angle brackets": "Uter<ai>",
		"quote":          `Uter"ai`,
		"pipe":           "Uter|ai",
		"newline":        "Uter\nai",
	}
	for name, value := range invalid {
		assert.Error(t, ValidatePaymentOrderTitlePrefix(value), name)
	}
}

// TestPaymentOrderTitlePrefixMaxLengthFitsWechatLimit 是长度上限的算术证明：
// 最长的前缀 + 最长的金额后缀必须仍在微信 127 字符以内，否则下单会被微信拒绝。
func TestPaymentOrderTitlePrefixMaxLengthFitsWechatLimit(t *testing.T) {
	const longestSuffix = " 充值 123456789.99 元" // 18 个字符：金额最多 12 位
	require.LessOrEqual(t,
		PaymentOrderTitlePrefixMaxLength+len([]rune(longestSuffix)),
		PaymentOrderTitleMaxLength,
		"prefix cap must leave room for the amount suffix within the WeChat 127-character limit",
	)
}
