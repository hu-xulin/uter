package controller

import (
	"context"
	"time"

	"github.com/uter-ai/uter/model"
)

type midjourneyRefundOutboxHandler struct{}

func (midjourneyRefundOutboxHandler) Type() string            { return model.SystemTaskTypeMidjourneyRefundOutbox }
func (midjourneyRefundOutboxHandler) Enabled() bool           { return model.HasPendingMidjourneyRefundOutbox() }
func (midjourneyRefundOutboxHandler) Interval() time.Duration { return time.Minute }
func (midjourneyRefundOutboxHandler) NewPayload() any         { return nil }

func (midjourneyRefundOutboxHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	result, err := model.ProcessMidjourneyRefundOutboxOnce(ctx, runnerID, 20)
	if err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, result, err)
		return
	}
	finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusSucceeded, result, nil)
}
