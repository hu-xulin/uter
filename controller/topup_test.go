package controller

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/model"
)

// 关闭微信支付 / 支付宝后，钱包不得再露出对应入口。基础 PayMethods 的默认值硬编码了
// 这两个官方直连入口，必须被剔除，改由 isAlipayTopUpEnabled / isWechatPayTopUpEnabled
// 判定后追加——否则 gated append 只增不去重，开关对钱包入口不生效。
func TestStripOfficialGatewayPayMethods(t *testing.T) {
	testCases := []struct {
		name     string
		input    []map[string]string
		expected []string
	}{
		{
			name: "drops hardcoded alipay and wechat entries",
			input: []map[string]string{
				{"name": "支付宝", "type": model.PaymentMethodAlipay},
				{"name": "微信支付", "type": model.PaymentMethodWechatPay},
			},
			expected: []string{},
		},
		{
			name: "keeps unrelated custom gateways",
			input: []map[string]string{
				{"name": "微信支付", "type": model.PaymentMethodWechatPay},
				{"name": "Epay", "type": "epay"},
				{"name": "支付宝", "type": model.PaymentMethodAlipay},
			},
			expected: []string{"epay"},
		},
		{
			name:     "empty input stays empty",
			input:    nil,
			expected: []string{},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got := stripOfficialGatewayPayMethods(tc.input)
			types := make([]string, 0, len(got))
			for _, m := range got {
				types = append(types, m["type"])
			}
			require.Equal(t, tc.expected, types)
		})
	}
}
