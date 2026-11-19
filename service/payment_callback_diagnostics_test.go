package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPaymentCallbackDiagnosticsKeepsNewestFirst(t *testing.T) {
	RecordPaymentCallback("alipay", "trade-1", "received", "", "127.0.0.1")
	RecordPaymentCallback("alipay", "trade-1", "success", "", "127.0.0.1")
	RecordPaymentCallback("wechat", "trade-2", "rejected", "sign", "127.0.0.2")

	events := RecentPaymentCallbacks("alipay", 2)
	require.Len(t, events, 2)
	require.Equal(t, "success", events[0].Result)
	require.Equal(t, "trade-1", events[0].TradeNo)
	require.Equal(t, "received", events[1].Result)

	all := RecentPaymentCallbacks("", 10)
	require.GreaterOrEqual(t, len(all), 3)
}
