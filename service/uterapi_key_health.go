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
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

const (
	// UterAPIKeyHealthOption stores per-channel key health under a short key
	// fingerprint. Raw API keys are never persisted in health records.
	UterAPIKeyHealthOption = "UterAPIKeyHealth"
	// UterAPIKeyHealthEventPrefix stores the last refresh health event for a
	// channel so a degraded sync is auditable instead of silent.
	UterAPIKeyHealthEventPrefix = "UterAPIKeyHealthEvent:"

	uterAPIKeyHealthy   = "healthy"
	uterAPIKeyUnhealthy = "unhealthy"
)

type UterAPIKeyHealth struct {
	Status        string `json:"status"`
	Failures      int    `json:"failures"`
	LastSuccessAt int64  `json:"last_success_at,omitempty"`
	LastFailureAt int64  `json:"last_failure_at,omitempty"`
	Reason        string `json:"reason,omitempty"`
}

type UterAPIKeyHealthEvent struct {
	ChannelID   int                          `json:"channel_id"`
	CheckedAt   int64                        `json:"checked_at"`
	EnabledKeys int                          `json:"enabled_keys"`
	HealthyKeys int                          `json:"healthy_keys"`
	Degraded    bool                         `json:"degraded"`
	Unhealthy   []UterAPIKeyHealthEventEntry `json:"unhealthy,omitempty"`
}

type UterAPIKeyHealthEventEntry struct {
	Fingerprint string `json:"fingerprint"`
	Reason      string `json:"reason"`
}

func uterAPIKeyFingerprint(key string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(key)))
	return hex.EncodeToString(sum[:])[:12]
}

func loadUterAPIKeyHealth(channelID int) map[string]UterAPIKeyHealth {
	state := map[string]UterAPIKeyHealth{}
	raw := strings.TrimSpace(common.GetOption(UterAPIKeyHealthOption))
	if raw == "" {
		return state
	}
	var all map[string]map[string]UterAPIKeyHealth
	if err := common.UnmarshalJsonStr(raw, &all); err != nil {
		return state
	}
	if current, ok := all[fmt.Sprintf("%d", channelID)]; ok && current != nil {
		return current
	}
	return state
}

func saveUterAPIKeyHealth(channelID int, state map[string]UterAPIKeyHealth) {
	raw := strings.TrimSpace(common.GetOption(UterAPIKeyHealthOption))
	all := map[string]map[string]UterAPIKeyHealth{}
	if raw != "" {
		_ = common.UnmarshalJsonStr(raw, &all)
	}
	all[fmt.Sprintf("%d", channelID)] = state
	encoded, err := common.Marshal(all)
	if err != nil {
		return
	}
	if err := model.UpdateOption(UterAPIKeyHealthOption, string(encoded)); err != nil {
		common.SysError(common.LogText("persist Uter.api key health failed: channel_id=%d, error=%v", channelID, err))
	}
}

func markUterAPIKeyHealth(channelID int, key string, healthy bool, reason string, now time.Time) {
	state := loadUterAPIKeyHealth(channelID)
	id := uterAPIKeyFingerprint(key)
	entry := state[id]
	if healthy {
		entry.Status = uterAPIKeyHealthy
		entry.Failures = 0
		entry.LastSuccessAt = now.Unix()
		entry.Reason = ""
	} else {
		entry.Status = uterAPIKeyUnhealthy
		entry.Failures++
		entry.LastFailureAt = now.Unix()
		entry.Reason = truncateUterAPIKeyHealthReason(reason)
	}
	state[id] = entry
	saveUterAPIKeyHealth(channelID, state)
}

func pruneUterAPIKeyHealth(channelID int, keys []string) {
	state := loadUterAPIKeyHealth(channelID)
	active := make(map[string]bool, len(keys))
	for _, key := range keys {
		active[uterAPIKeyFingerprint(key)] = true
	}
	changed := false
	for id := range state {
		if !active[id] {
			delete(state, id)
			changed = true
		}
	}
	if changed {
		saveUterAPIKeyHealth(channelID, state)
	}
}

func recordUterAPIKeyHealthEvent(channelID int, enabled, healthy int, unhealthy []UterAPIKeyHealthEventEntry, now time.Time) {
	event := UterAPIKeyHealthEvent{
		ChannelID: channelID, CheckedAt: now.Unix(),
		EnabledKeys: enabled, HealthyKeys: healthy,
		Degraded: healthy < enabled, Unhealthy: unhealthy,
	}
	encoded, err := common.Marshal(event)
	if err != nil {
		return
	}
	key := UterAPIKeyHealthEventPrefix + fmt.Sprintf("%d", channelID)
	if err := model.UpdateOption(key, string(encoded)); err != nil {
		common.SysError(common.LogText("persist Uter.api key health event failed: channel_id=%d, error=%v", channelID, err))
	}
	if event.Degraded {
		common.SysError(common.LogText(
			"Uter.api refresh degraded to a healthy key subset: channel_id=%d healthy=%d/%d",
			channelID, healthy, enabled,
		))
	}
}

func truncateUterAPIKeyHealthReason(reason string) string {
	reason = strings.TrimSpace(reason)
	if len(reason) <= 200 {
		return reason
	}
	return reason[:200]
}
