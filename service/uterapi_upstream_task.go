/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT WARRANTY OF ANY KIND, either expressed or implied, including
but not limited to the warranties of merchantability, fitness for a
particular purpose and noninfringement. In no event shall the authors or
copyright holders be liable for any claim, damages or other liability,
whether in an action of contract, tort or otherwise, arising from, out of
or in connection with the software or the use or other dealings in the
software.

For commercial licensing, please contact support@uter.ai
*/
package service

import (
	"context"
	"sort"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

const (
	uterAPIUpstreamSyncStateKey = "UterAPISyncState"
	uterAPIUpstreamBackoffKey   = "UterAPISyncBackoff"
)

func uterAPISyncStateFor(channelID int) int64 {
	return syncStateFor(uterAPIUpstreamSyncStateKey, channelID)
}

func setUterAPISyncState(channelID int, at int64) {
	setSyncState(uterAPIUpstreamSyncStateKey, channelID, at)
}

func uterAPIBackoffActive(channelID int, now time.Time) bool {
	return backoffActive(uterAPIUpstreamBackoffKey, channelID, now)
}

func recordUterAPISyncFailure(channelID int, now time.Time) {
	recordSyncFailure(uterAPIUpstreamBackoffKey, channelID, now)
}

func clearUterAPISyncFailure(channelID int) {
	clearSyncFailure(uterAPIUpstreamBackoffKey, channelID)
}

// UterAPIUpstreamSyncTask refreshes Uter.api channel prices on the same
// cadence contract as the other dedicated providers. The generic New API
// task deliberately excludes Uter-owned channels, so without this task
// Uter.api prices only moved at creation or manual refresh.
func UterAPIUpstreamSyncTask() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		runUterAPIUpstreamSync(context.Background(), false)
	}
}

func changedUterAPIModelNames(changes []UpstreamPriceChange) []string {
	seen := make(map[string]bool, len(changes))
	out := make([]string, 0, len(changes))
	for _, change := range changes {
		name := strings.TrimSpace(change.ModelID)
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true
		out = append(out, name)
	}
	sort.Strings(out)
	return out
}

func runUterAPIUpstreamSync(ctx context.Context, force bool) {
	ctx, _ = WithUterAPIUpstreamCache(ctx)
	releaseLock, acquired, err := acquireUpstreamSyncLock(ctx, "uterapi-upstream")
	if err != nil || !acquired {
		return
	}
	defer releaseLock()

	channels, err := model.GetAllChannels(0, -1, true, true)
	if err != nil {
		return
	}
	now := time.Now().UTC()
	for _, channel := range channels {
		if channel == nil || !isUterAPIPricingChannel(channel) {
			continue
		}
		group := GetGenericUpstreamBillingGroup(channel.Id)
		if group == "" {
			common.SysError(common.LogText("Uter.api scheduled sync skipped: channel_id=%d has no upstream billing group", channel.Id))
			continue
		}
		schedule, explicit := GetChannelPricingSchedule(channel.Id)
		if explicit && !schedule.Enabled {
			continue
		}
		if !explicit {
			schedule.Enabled = true
			schedule.ApplyOnSync = true
		}
		// One authenticated /api/pricing document carries both official and
		// channel quotes, so honor the stricter of the two configured cadences.
		_, officialInterval, channelInterval := schedule.EffectiveIntervals()
		interval := officialInterval
		if channelInterval > 0 && channelInterval < interval {
			interval = channelInterval
		}
		if !force && uterAPIBackoffActive(channel.Id, now) {
			continue
		}
		if !force && now.Unix()-uterAPISyncStateFor(channel.Id) < int64(interval)*60 {
			continue
		}

		startedAt := now.Unix()
		before := genericChannelPriceSnapshot(channel.Id)
		reportUterAPIExpiredPrices(channel.Id, channel.GetOtherSettings().PricingMode, now)
		written, _, _, _, syncErr := RefreshUterAPIChannelPricing(ctx, channel, group)
		if syncErr != nil {
			common.SysError(common.LogText("Uter.api scheduled price sync failed: channel_id=%d, error=%v", channel.Id, syncErr))
			AppendUterAPIObservabilityEvent(
				UterAPIEventSyncFailed, "error", channel.Id, group,
				syncErr.Error(), now,
			)
			recordUterAPISyncFailure(channel.Id, now)
			RecordChannelSyncOutcome(channel.Id, "uterapi", startedAt, 0, written, 0, 0, "", syncErr, model.ChannelSyncTypePrices)
			continue
		}
		changes := genericPriceChanges(channel.Id, before, genericChannelPriceSnapshot(channel.Id), now)
		if err := AppendGenericUpstreamHistory(changes); err != nil {
			common.SysError(common.LogText("append Uter.api upstream history failed: channel_id=%d, error=%v", channel.Id, err))
		}
		var reviews []ChannelPricingReviewEntry
		if schedule.ReviewMode == "manual" || schedule.ThresholdPercent > 0 {
			reviews = BuildChannelPricingReviews(changes, channel.Id, channel.GetModels(), schedule.ThresholdPercent)
		}
		if len(reviews) > 0 {
			if reviewErr := AppendChannelPricingReviews(reviews); reviewErr != nil {
				common.SysError(common.LogText("append Uter.api pricing reviews failed: channel_id=%d, error=%v", channel.Id, reviewErr))
			}
			RecordChannelSyncOutcome(channel.Id, "uterapi", startedAt, 0, written, 0, len(reviews), "", nil, model.ChannelSyncTypePrices)
			setUterAPISyncState(channel.Id, now.Unix())
		} else {
			applied := 0
			changedModels := changedUterAPIModelNames(changes)
			if schedule.ApplyOnSync && len(changedModels) > 0 && schedule.Mode != "" && schedule.Mode != BatchPricingModeNone {
				result, applyErr := ApplyChannelBatchPricingWithOptions(channel.Id, BatchPricingOptions{
					Models: changedModels,
					Basis:  schedule.Basis,
					Mode:   schedule.Mode,
					Value:  schedule.Value,
				})
				if applyErr != nil {
					common.SysError(common.LogText("apply Uter.api pricing schedule failed: channel_id=%d, error=%v", channel.Id, applyErr))
				} else {
					applied = result.Updated
				}
			}
			clearUterAPISyncFailure(channel.Id)
			RecordChannelSyncOutcome(channel.Id, "uterapi", startedAt, 0, written, applied, 0, "", nil, model.ChannelSyncTypePrices)
			setUterAPISyncState(channel.Id, now.Unix())
		}
		// One verification at the operation boundary, after any scheduled
		// repricing, so the persisted report describes the final price state.
		AutoVerifyChannelPricingWithContext(ctx, channel.Id)
	}
}

// RunUterAPIUpstreamSyncOnce exposes one synchronous cycle for system-task
// runners and tests. It must never be used to bypass the lock in production.
func RunUterAPIUpstreamSyncOnce(ctx context.Context) {
	runUterAPIUpstreamSync(ctx, true)
}
