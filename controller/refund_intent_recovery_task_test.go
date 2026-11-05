package controller

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

func TestRefundIntentRecoveryHandlerIsIndependentlyScheduled(t *testing.T) {
	handler := refundIntentRecoveryHandler{}
	var scheduled service.ScheduledSystemTaskHandler = handler
	require.Equal(t, model.SystemTaskTypeRefundIntentRecovery, scheduled.Type())
	require.True(t, scheduled.Enabled())
	require.Equal(t, time.Minute, scheduled.Interval())
	require.Nil(t, scheduled.NewPayload())
}
