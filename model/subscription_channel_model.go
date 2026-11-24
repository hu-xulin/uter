package model

import (
	"encoding/json"
	"slices"
	"sort"
	"strconv"
	"strings"
)

// NormalizeAllowedChannelModels validates and canonicalizes a plan's
// channel/model restriction. The accepted shape is a JSON object whose keys
// are numeric channel ids and whose values are arrays of model names:
//
//	{"12": ["gpt-4o", "claude-sonnet"], "30": ["gemini-pro"]}
//
// Invalid, empty or empty-result input returns "" (unrestricted). Valid input
// is returned as stable JSON (sorted keys via json.Marshal, sorted model
// names, de-duplicated) so storage and comparisons are deterministic.
func NormalizeAllowedChannelModels(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "{}" || raw == "null" {
		return ""
	}
	var parsed map[string][]string
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil || len(parsed) == 0 {
		return ""
	}
	clean := make(map[string][]string, len(parsed))
	for channelKey, models := range parsed {
		channelID, err := strconv.Atoi(strings.TrimSpace(channelKey))
		if err != nil || channelID <= 0 {
			continue
		}
		seen := make(map[string]struct{}, len(models))
		names := make([]string, 0, len(models))
		for _, name := range models {
			name = strings.TrimSpace(name)
			if name == "" {
				continue
			}
			if _, exists := seen[name]; exists {
				continue
			}
			seen[name] = struct{}{}
			names = append(names, name)
		}
		if len(names) == 0 {
			continue
		}
		sort.Strings(names)
		clean[strconv.Itoa(channelID)] = names
	}
	if len(clean) == 0 {
		return ""
	}
	out, err := json.Marshal(clean)
	if err != nil {
		return ""
	}
	return string(out)
}

// ParseAllowedChannelModels parses a stored restriction into a typed map.
// A nil result means unrestricted.
func ParseAllowedChannelModels(raw string) map[int][]string {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "{}" || raw == "null" {
		return nil
	}
	var parsed map[string][]string
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil
	}
	out := make(map[int][]string, len(parsed))
	for channelKey, models := range parsed {
		channelID, err := strconv.Atoi(strings.TrimSpace(channelKey))
		if err != nil || channelID <= 0 || len(models) == 0 {
			continue
		}
		out[channelID] = append([]string(nil), models...)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// GetActiveSubscriptionChannelModels returns the merged channel/model
// restriction across the user's active subscriptions. A nil result means the
// user has no restriction and may use every eligible channel/model.
func GetActiveSubscriptionChannelModels(userID int) map[int][]string {
	if userID <= 0 || DB == nil {
		return nil
	}
	var rows []struct {
		AllowedChannelModels string `gorm:"column:allowed_channel_models"`
	}
	err := DB.Model(&UserSubscription{}).
		Where("user_id = ? AND status = ? AND end_time > ? AND allowed_channel_models <> ''",
			userID, "active", GetDBTimestamp()).
		Select("allowed_channel_models").
		Find(&rows).Error
	if err != nil {
		return nil
	}
	merged := make(map[int][]string)
	for _, row := range rows {
		for channelID, models := range ParseAllowedChannelModels(row.AllowedChannelModels) {
			for _, modelName := range models {
				if !slices.Contains(merged[channelID], modelName) {
					merged[channelID] = append(merged[channelID], modelName)
				}
			}
		}
	}
	if len(merged) == 0 {
		return nil
	}
	return merged
}
