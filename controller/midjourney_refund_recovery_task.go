package controller

import (
	"context"
	"errors"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

const (
	midjourneyRefundRecoveryInterval = time.Minute
	midjourneyRefundRecoveryBatchSize = 100
)

type midjourneyRefundRecoveryHandler struct{}

type midjourneyRefundRecoveryResult struct {
	Scanned int `json:"scanned"`
	Refunded int `json:"refunded"`
	ReconciliationRequired int `json:"reconciliation_required"`
	Failed int `json:"failed"`
}

func (midjourneyRefundRecoveryHandler) Type() string {
	return model.SystemTaskTypeMidjourneyRefundRecovery
}

func (midjourneyRefundRecoveryHandler) Enabled() bool { return true }
func (midjourneyRefundRecoveryHandler) Interval() time.Duration {
	return midjourneyRefundRecoveryInterval
}
func (midjourneyRefundRecoveryHandler) NewPayload() any { return nil }

// Run retries terminal failed tasks independently of upstream polling. Each
// refund is transactionally isolated; one bad task does not prevent the rest.
func (midjourneyRefundRecoveryHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	result := midjourneyRefundRecoveryResult{}
	taskIDs, err := model.FindPendingMidjourneyRefundTaskIDs(midjourneyRefundRecoveryBatchSize)
	if err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, result, err)
		return
	}
	result.Scanned = len(taskIDs)
	var firstErr error
	for _, taskID := range taskIDs {
		if err := ctx.Err(); err != nil {
			firstErr = errors.Join(firstErr, err)
			break
		}
		err := model.RefundMidjourneyTaskBilling(taskID, "scheduled Midjourney refund recovery")
		switch {
		case err == nil:
			result.Refunded++
		case errors.Is(err, model.ErrMidjourneyRefundReconciliationRequired):
			result.ReconciliationRequired++
		default:
			result.Failed++
			firstErr = errors.Join(firstErr, err)
		}
	}
	if firstErr != nil {
		common.SysError(common.LogText("Midjourney refund recovery incomplete: scanned=%d refunded=%d reconciliation_required=%d failed=%d error=%s",
			result.Scanned, result.Refunded, result.ReconciliationRequired, result.Failed, firstErr.Error()))
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, result, firstErr)
		return
	}
	finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusSucceeded, result, nil)
}
