package controller

import (
	"context"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

const (
	refundIntentRecoveryInterval                = time.Minute
	refundIntentRecoveryStaleAfterSeconds int64 = 60
	refundIntentRecoveryBatchSize               = 200
)

type refundIntentRecoveryHandler struct{}

type refundIntentRecoveryResult struct {
	Recovered         int   `json:"recovered"`
	BatchSize         int   `json:"batch_size"`
	StaleAfterSeconds int64 `json:"stale_after_seconds"`
}

func (refundIntentRecoveryHandler) Type() string { return model.SystemTaskTypeRefundIntentRecovery }

// Always schedule the durable scan; it must not depend on upstream task polling.
func (refundIntentRecoveryHandler) Enabled() bool           { return true }
func (refundIntentRecoveryHandler) Interval() time.Duration { return refundIntentRecoveryInterval }
func (refundIntentRecoveryHandler) NewPayload() any         { return nil }

func (refundIntentRecoveryHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	if err := ctx.Err(); err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, nil, err)
		return
	}
	recovered, err := model.SweepPendingRefundIntents(refundIntentRecoveryStaleAfterSeconds, refundIntentRecoveryBatchSize)
	result := refundIntentRecoveryResult{Recovered: recovered, BatchSize: refundIntentRecoveryBatchSize, StaleAfterSeconds: refundIntentRecoveryStaleAfterSeconds}
	if err != nil {
		common.SysError(common.LogText("refund intent recovery pass incomplete: recovered=%d batch_size=%d error=%s", recovered, refundIntentRecoveryBatchSize, err.Error()))
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, result, err)
		return
	}
	finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusSucceeded, result, nil)
}
