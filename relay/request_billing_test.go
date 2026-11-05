package relay

import (
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	relaycommon "github.com/uter-ai/uter/relay/common"
)

type recordingRefundWaiter struct {
	events *[]string
}

func (r *recordingRefundWaiter) Settle(int) error { return nil }
func (r *recordingRefundWaiter) Refund(*gin.Context) {
	*r.events = append(*r.events, "refund")
}
func (r *recordingRefundWaiter) NeedsRefund() bool { return true }
func (r *recordingRefundWaiter) GetPreConsumedQuota() int { return 1 }
func (r *recordingRefundWaiter) Reserve(int) error { return nil }
func (r *recordingRefundWaiter) ReserveBeforeSubmit(int) error { return nil }
func (r *recordingRefundWaiter) WaitRefundDone() {
	*r.events = append(*r.events, "refund_done")
}

func TestRefundBillingWaitsBeforeSubsequentWalletMutation(t *testing.T) {
	events := []string{}
	info := &relaycommon.RelayInfo{Billing: &recordingRefundWaiter{events: &events}}

	refundBillingAndWait(&gin.Context{}, info)

	require.Equal(t, []string{"refund", "refund_done"}, events)
}
