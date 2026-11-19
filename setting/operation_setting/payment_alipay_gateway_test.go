package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateAlipayGateway(t *testing.T) {
	require.NoError(t, ValidateAlipayGateway("https://openapi.alipay.com/gateway.do"))
	require.NoError(t, ValidateAlipayGateway("https://openapi-sandbox.dl.alipaydev.com/gateway.do"))
	require.Error(t, ValidateAlipayGateway(""))
	require.Error(t, ValidateAlipayGateway("http://openapi.alipay.com/gateway.do"))
	require.Error(t, ValidateAlipayGateway("https://user:pass@openapi.alipay.com/gateway.do"))
	require.Error(t, ValidateAlipayGateway("https://openapi.alipay.com/gateway.do#fragment"))
}
