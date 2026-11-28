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
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

func normalizeUterAPIKeys(keys []string) []string {
	out := make([]string, 0, len(keys))
	seen := make(map[string]bool, len(keys))
	for _, key := range keys {
		key = strings.TrimSpace(key)
		if key == "" || seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, key)
	}
	return out
}

// enabledUterAPIKeys returns every key the channel may actually route to.
// Pricing one key while the relay rotates among several would let a different
// group's multiplier bill the same model, so every pricing decision must see
// the same set of enabled keys.
func enabledUterAPIKeys(channel *model.Channel) []string {
	if channel == nil {
		return nil
	}
	keys := channel.GetKeys()
	if !channel.ChannelInfo.IsMultiKey {
		return normalizeUterAPIKeys(keys)
	}
	statuses := channel.ChannelInfo.MultiKeyStatusList
	enabled := make([]string, 0, len(keys))
	for index, key := range keys {
		status := common.ChannelStatusEnabled
		if statuses != nil {
			if value, ok := statuses[index]; ok {
				status = value
			}
		}
		if status == common.ChannelStatusEnabled {
			enabled = append(enabled, key)
		}
	}
	return normalizeUterAPIKeys(enabled)
}

func fetchUterAPIPricingPayloads(ctx context.Context, baseURL string, keys []string) ([]*GenericPricingPayload, error) {
	keys = normalizeUterAPIKeys(keys)
	if len(keys) == 0 {
		return nil, errors.New("Uter.api channel has no usable API key")
	}
	payloads := make([]*GenericPricingPayload, 0, len(keys))
	for index, key := range keys {
		payload, err := fetchCachedUterAPIPricingPayload(ctx, baseURL, key)
		if err != nil {
			// Never include the key itself in an error: logs and API responses
			// are readable by operators who should not need the secret.
			return nil, fmt.Errorf("Uter.api pricing failed for enabled key %d: %w", index+1, err)
		}
		payloads = append(payloads, payload)
	}
	return payloads, nil
}

func validateUterAPIGroupConsistency(payloads []*GenericPricingPayload, group string) (float64, error) {
	group = strings.TrimSpace(group)
	if group == "" {
		return 0, errors.New("billing group is required")
	}
	if len(payloads) == 0 {
		return 0, errors.New("Uter.api pricing payload is unavailable")
	}
	ratio := 0.0
	for index, payload := range payloads {
		if payload == nil {
			return 0, errors.New("Uter.api pricing payload is unavailable")
		}
		value, ok := payload.GroupRatio[group]
		if !ok || value <= 0 || math.IsNaN(value) || math.IsInf(value, 0) {
			return 0, fmt.Errorf("Uter.api group %q has no published ratio for enabled key %d", group, index+1)
		}
		if index == 0 {
			ratio = value
			continue
		}
		scale := math.Max(math.Abs(ratio), math.Abs(value))
		if math.Abs(value-ratio) > 1e-12*scale {
			return 0, fmt.Errorf("Uter.api group %q has inconsistent ratios across enabled keys", group)
		}
	}
	return ratio, nil
}

// authorizedUterAPIModelSet returns the intersection of model IDs whose
// enable_groups includes the selected group in every enabled key's pricing
// document. A missing declaration never grants access.
func authorizedUterAPIModelSet(payloads []*GenericPricingPayload, group string) map[string]bool {
	group = strings.TrimSpace(group)
	allowed := make(map[string]bool)
	for index, payload := range payloads {
		if payload == nil {
			return map[string]bool{}
		}
		current := make(map[string]bool)
		for _, entry := range payload.Data {
			name := strings.TrimSpace(entry.ModelName)
			if name == "" {
				continue
			}
			for _, enabled := range entry.EnableGroups {
				if strings.EqualFold(strings.TrimSpace(enabled), group) {
					current[name] = true
					break
				}
			}
		}
		if index == 0 {
			allowed = current
			continue
		}
		for name := range allowed {
			if !current[name] {
				delete(allowed, name)
			}
		}
	}
	return allowed
}

func discoverUterAPIModelIDsWithKeys(ctx context.Context, baseURL string, keys []string) ([]string, error) {
	keys = normalizeUterAPIKeys(keys)
	if len(keys) == 0 {
		return nil, errors.New("Uter.api channel has no usable API key")
	}
	var visible map[string]bool
	for index, key := range keys {
		ids, err := fetchCachedUterAPIModelIDs(ctx, baseURL, key)
		if err != nil {
			return nil, fmt.Errorf("Uter.api model discovery failed for enabled key %d: %w", index+1, err)
		}
		current := make(map[string]bool, len(ids))
		for _, id := range ids {
			if name := strings.TrimSpace(id); name != "" {
				current[name] = true
			}
		}
		if index == 0 {
			visible = current
			continue
		}
		for name := range visible {
			if !current[name] {
				delete(visible, name)
			}
		}
	}
	out := make([]string, 0, len(visible))
	for name := range visible {
		out = append(out, name)
	}
	sort.Strings(out)
	return out, nil
}

func fetchUterAPIAuthorizedCatalog(ctx context.Context, baseURL, group string, keys []string) ([]*GenericPricingPayload, float64, map[string]bool, error) {
	payloads, err := fetchUterAPIPricingPayloads(ctx, baseURL, keys)
	if err != nil {
		return nil, 0, nil, err
	}
	ratio, err := validateUterAPIGroupConsistency(payloads, group)
	if err != nil {
		return nil, 0, nil, err
	}
	return payloads, ratio, authorizedUterAPIModelSet(payloads, group), nil
}

type uterAPIKeySnapshot struct {
	Key     string
	Payload *GenericPricingPayload
	Models  []string
}

// fetchUterAPIRefreshCatalogWithKeyHealth is the refresh-only catalog path.
// Creation and automatic model adoption keep the strict all-key contract; an
// established channel may refresh from a healthy subset only when that subset
// still agrees on the billing group and on the models it can call. Every key
// outcome is persisted as health state and as a per-channel event so a
// downgrade can never be mistaken for a complete refresh.
func fetchUterAPIRefreshCatalogWithKeyHealth(
	ctx context.Context,
	channelID int,
	baseURL, group string,
	keys []string,
	now time.Time,
) ([]*GenericPricingPayload, float64, map[string]bool, []string, error) {
	keys = normalizeUterAPIKeys(keys)
	pruneUterAPIKeyHealth(channelID, keys)
	snapshots := make([]uterAPIKeySnapshot, 0, len(keys))
	unhealthy := make([]UterAPIKeyHealthEventEntry, 0)
	for _, key := range keys {
		payload, err := fetchCachedUterAPIPricingPayload(ctx, baseURL, key)
		if err == nil {
			_, err = validateUterAPIGroupConsistency([]*GenericPricingPayload{payload}, group)
			if err != nil {
				AppendUterAPIObservabilityEvent(
					UterAPIEventGroupRatioMismatch, "warn", channelID, group,
					err.Error(), now,
				)
			}
		}
		if err == nil {
			var models []string
			models, err = fetchCachedUterAPIModelIDs(ctx, baseURL, key)
			if err == nil && len(models) == 0 {
				err = errors.New("upstream returned an empty model catalogue")
			}
			if err == nil {
				markUterAPIKeyHealth(channelID, key, true, "", now)
				snapshots = append(snapshots, uterAPIKeySnapshot{Key: key, Payload: payload, Models: models})
				continue
			}
		}
		markUterAPIKeyHealth(channelID, key, false, err.Error(), now)
		unhealthy = append(unhealthy, UterAPIKeyHealthEventEntry{
			Fingerprint: uterAPIKeyFingerprint(key), Reason: truncateUterAPIKeyHealthReason(err.Error()),
		})
	}
	if len(snapshots) == 0 {
		recordUterAPIKeyHealthEvent(channelID, len(keys), 0, unhealthy, now)
		return nil, 0, nil, nil, errors.New("no healthy Uter.api key can supply a billing group catalogue")
	}

	payloads := make([]*GenericPricingPayload, 0, len(snapshots))
	for _, snapshot := range snapshots {
		payloads = append(payloads, snapshot.Payload)
	}
	ratio, err := validateUterAPIGroupConsistency(payloads, group)
	if err != nil {
		AppendUterAPIObservabilityEvent(
			UterAPIEventGroupRatioMismatch, "error", channelID, group,
			err.Error(), now,
		)
		// A disagreement cannot be resolved by guessing which key is wrong.
		// Mark every candidate unhealthy so the next cycle re-probes all keys.
		for _, key := range keys {
			markUterAPIKeyHealth(channelID, key, false, err.Error(), now)
			unhealthy = append(unhealthy, UterAPIKeyHealthEventEntry{
				Fingerprint: uterAPIKeyFingerprint(key), Reason: truncateUterAPIKeyHealthReason(err.Error()),
			})
		}
		recordUterAPIKeyHealthEvent(channelID, len(keys), 0, unhealthy, now)
		return nil, 0, nil, nil, err
	}
	allowed := authorizedUterAPIModelSet(payloads, group)
	visible := intersectUterAPIKeySnapshotModels(snapshots)
	recordUterAPIKeyHealthEvent(channelID, len(keys), len(snapshots), unhealthy, now)
	if len(unhealthy) > 0 {
		subjects := make([]string, 0, len(unhealthy))
		for _, entry := range unhealthy {
			subjects = append(subjects, entry.Fingerprint)
		}
		AppendUterAPIObservabilityEvent(
			UterAPIEventKeyDegraded, "warn", channelID, strings.Join(subjects, ","),
			fmt.Sprintf("Uter.api refresh used %d/%d healthy key(s)", len(snapshots), len(keys)), now,
		)
	}
	return payloads, ratio, allowed, visible, nil
}

func intersectUterAPIKeySnapshotModels(snapshots []uterAPIKeySnapshot) []string {
	if len(snapshots) == 0 {
		return nil
	}
	visible := make(map[string]bool)
	for _, id := range snapshots[0].Models {
		if name := strings.TrimSpace(id); name != "" {
			visible[name] = true
		}
	}
	for _, snapshot := range snapshots[1:] {
		current := make(map[string]bool, len(snapshot.Models))
		for _, id := range snapshot.Models {
			if name := strings.TrimSpace(id); name != "" {
				current[name] = true
			}
		}
		for name := range visible {
			if !current[name] {
				delete(visible, name)
			}
		}
	}
	out := make([]string, 0, len(visible))
	for name := range visible {
		out = append(out, name)
	}
	sort.Strings(out)
	return out
}

// DiscoverAuthorizedUterAPIModels is the single authorization contract used by
// creation, model auto-update, preview and catalog parity. A model is accepted
// only when every enabled key can call it and every key's pricing document
// declares the selected group for it.
func DiscoverAuthorizedUterAPIModels(ctx context.Context, baseURL, group string, keys []string) ([]string, error) {
	keys = normalizeUterAPIKeys(keys)
	_, _, allowed, err := fetchUterAPIAuthorizedCatalog(ctx, baseURL, group, keys)
	if err != nil {
		return nil, err
	}
	discovered, err := discoverUterAPIModelIDsWithKeys(ctx, baseURL, keys)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(discovered))
	for _, name := range discovered {
		if allowed[name] {
			out = append(out, name)
		}
	}
	sort.Strings(out)
	return out, nil
}
