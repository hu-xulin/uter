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
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

const (
	UterAPIObservabilityEventsOption = "UterAPIObservabilityEvents"
	uterAPIObservabilityEventLimit   = 200

	UterAPIEventSyncFailed           = "SYNC_FAILED"
	UterAPIEventGroupRatioMismatch   = "GROUP_RATIO_MISMATCH"
	UterAPIEventAuthorizationRemoved = "AUTHORIZATION_REMOVED"
	UterAPIEventModelDiscovered      = "MODEL_DISCOVERED"
	UterAPIEventPriceExpired         = "PRICE_EXPIRED"
	UterAPIEventKeyDegraded          = "KEY_DEGRADED"
)

type UterAPIObservabilityEvent struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	Severity  string `json:"severity"`
	ChannelID int    `json:"channel_id"`
	Subject   string `json:"subject,omitempty"`
	Message   string `json:"message"`
	Count     int    `json:"count"`
	FirstSeen int64  `json:"first_seen_at"`
	LastSeen  int64  `json:"last_seen_at"`
}

// AppendUterAPIObservabilityEvent records one bounded, deduplicated event.
// Events live in an option rather than a package-level buffer so every node
// can read the same alerting evidence after a restart.
func AppendUterAPIObservabilityEvent(
	eventType, severity string,
	channelID int,
	subject, message string,
	now time.Time,
) {
	if strings.TrimSpace(eventType) == "" {
		return
	}
	severity = strings.ToLower(strings.TrimSpace(severity))
	if severity == "" {
		severity = "info"
	}
	subject = truncateUterAPIKeyHealthReason(subject)
	message = truncateUterAPIKeyHealthReason(message)
	id := fmt.Sprintf("%s:%d:%s", eventType, channelID, subject)

	events := loadUterAPIObservabilityEvents()
	found := false
	for index := range events {
		if events[index].ID != id {
			continue
		}
		events[index].Severity = severity
		events[index].Message = message
		events[index].Count++
		events[index].LastSeen = now.Unix()
		found = true
		break
	}
	if !found {
		events = append(events, UterAPIObservabilityEvent{
			ID: id, Type: eventType, Severity: severity, ChannelID: channelID,
			Subject: subject, Message: message, Count: 1,
			FirstSeen: now.Unix(), LastSeen: now.Unix(),
		})
	}
	if len(events) > uterAPIObservabilityEventLimit {
		events = events[len(events)-uterAPIObservabilityEventLimit:]
	}
	sort.Slice(events, func(i, j int) bool { return events[i].LastSeen > events[j].LastSeen })
	encoded, err := common.Marshal(events)
	if err == nil {
		if err := model.UpdateOption(UterAPIObservabilityEventsOption, string(encoded)); err != nil {
			common.SysError(common.LogText("persist Uter.api observability events failed: %v", err))
		}
	}
	logFields := common.LogText(
		"Uter.api event: type=%s severity=%s channel_id=%d subject=%s count=%d message=%s",
		eventType, severity, channelID, subject, countUterAPIEvent(events, id), message,
	)
	if severity == "error" {
		common.SysError(logFields)
		return
	}
	common.SysLog(logFields)
}

func countUterAPIEvent(events []UterAPIObservabilityEvent, id string) int {
	for _, event := range events {
		if event.ID == id {
			return event.Count
		}
	}
	return 0
}

func loadUterAPIObservabilityEvents() []UterAPIObservabilityEvent {
	raw := strings.TrimSpace(common.GetOption(UterAPIObservabilityEventsOption))
	if raw == "" {
		return []UterAPIObservabilityEvent{}
	}
	var events []UterAPIObservabilityEvent
	if err := common.UnmarshalJsonStr(raw, &events); err != nil {
		return []UterAPIObservabilityEvent{}
	}
	return events
}

// reportUterAPIExpiredPrices emits one deduplicated event for auto-derived
// prices that the shared billing gate already considers expired. The same
// PRICE_EXPIRED reason drives billing fail-closed, so alerts cannot drift.
func reportUterAPIExpiredPrices(channelID int, pricingMode string, now time.Time) {
	rows, err := model.ListChannelModelPricing(channelID)
	if err != nil {
		return
	}
	expired := make([]string, 0)
	for _, row := range rows {
		if model.ChannelPricingBillableReason(row, pricingMode, now) == "PRICE_EXPIRED" {
			expired = append(expired, strings.TrimSpace(row.ModelName))
		}
	}
	if len(expired) == 0 {
		return
	}
	sort.Strings(expired)
	subject := strings.Join(expired, ",")
	message := fmt.Sprintf("%d Uter.api model price(s) are expired and not billable", len(expired))
	AppendUterAPIObservabilityEvent(UterAPIEventPriceExpired, "warn", channelID, subject, message, now)
}
