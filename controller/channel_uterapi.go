/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
package controller

import (
	"context"
	"errors"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

// uterapiKeySlot binds one upstream billing group to the keys that unlock it.
type uterapiKeySlot struct {
	Name  string   `json:"name"`
	Group string   `json:"group"`
	Keys  []string `json:"keys"`
}

// uterapiCreateRequest carries one entry per upstream billing group. Each group
// has its own key(s) because uterapi binds a key to exactly one group.
type uterapiCreateRequest struct {
	Slots  []uterapiKeySlot `json:"slots"`
	Group  string           `json:"group"`
	Status int              `json:"status"`
}

// uterapiBaseURLForTest lets tests point the single-group creation at a mock.
var uterapiBaseURLForTest string

func uterapiBaseURL() string {
	if value := strings.TrimSpace(uterapiBaseURLForTest); value != "" {
		return value
	}
	return service.UterAPIUpstreamBaseURL()
}

// CreateUterAPIChannels creates one NewAPI-compatible channel per supplied key and
// syncs its catalogue prices. Errors are reported per key so one bad key does
// not discard a working channel.
func CreateUterAPIChannels(c *gin.Context) {
	var req uterapiCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	group := strings.TrimSpace(req.Group)
	if group == "" {
		group = "default"
	}
	status := req.Status
	if status == 0 {
		status = common.ChannelStatusEnabled
	}

	base := uterapiBaseURL()
	if base == "" {
		common.ApiErrorMsg(c, "Uter.api upstream endpoint is not configured")
		return
	}
	results := make([]gin.H, 0, len(req.Slots))
	created := 0
	lastErr := ""
	for _, slot := range req.Slots {
		name := strings.TrimSpace(slot.Name)
		keys := normalizeUterAPIKeys(slot.Keys)
		if name == "" || len(keys) == 0 {
			continue
		}
		upstreamGroup := strings.TrimSpace(slot.Group)
		models, usableKeys, discoveryErr := discoverUterAPIModels(c.Request.Context(), keys)
		models = service.FilterModelNamesByUpstreamGroup(upstreamGroup, models)
		if len(usableKeys) == 0 {
			results = append(results, gin.H{"name": name, "group": upstreamGroup, "error": common.LogText("model discovery failed: %s", discoveryErr)})
			lastErr = discoveryErr
			continue
		}
		channel := model.Channel{
			Type: constant.ChannelTypeNewAPI, Name: name, BaseURL: &base, Key: strings.Join(usableKeys, "\n"),
			Models: strings.Join(models, ","), Group: group, Status: status,
			CreatedTime: common.GetTimestamp(),
		}
		if len(usableKeys) > 1 {
			channel.ChannelInfo.IsMultiKey = true
			channel.ChannelInfo.MultiKeySize = len(usableKeys)
			channel.ChannelInfo.MultiKeyMode = constant.MultiKeyModePolling
		}
		// Group keys keep changing their catalogue upstream; follow additions
		// automatically. collectPendingUpstreamModelChanges filters the answer
		// to this group's family, so the whole-account catalogue cannot leak in.
		channelSettings := channel.GetOtherSettings()
		channelSettings.UpstreamModelUpdateCheckEnabled = true
		channelSettings.UpstreamModelUpdateAutoSyncEnabled = true
		channel.SetOtherSettings(channelSettings)
		if err := validateChannel(&channel, true); err != nil {
			results = append(results, gin.H{"name": name, "group": upstreamGroup, "error": err.Error()})
			lastErr = err.Error()
			continue
		}
		batch := []model.Channel{channel}
		if err := model.BatchInsertChannels(batch); err != nil {
			results = append(results, gin.H{"name": name, "group": upstreamGroup, "error": err.Error()})
			lastErr = err.Error()
			continue
		}
		channel = batch[0]
		created++
		createdChannel, _ := model.GetChannelById(channel.Id, false)
		if createdChannel == nil || createdChannel.Key == "" {
			createdChannel = &channel
		}
		written := 0
		pricingErr := ""
		priceRatio := 1.0
		groupName := ""
		if count, ratio, resolvedGroup, syncErr := service.SyncUterAPIChannelPricing(c.Request.Context(), createdChannel, upstreamGroup); syncErr != nil {
			pricingErr = syncErr.Error()
			common.SysError(common.LogText("Uter.api price sync failed after create: channel_id=%d, error=%v", channel.Id, syncErr))
		} else {
			written = count
			priceRatio = ratio
			groupName = resolvedGroup
		}
		entry := gin.H{
			"channel_id": channel.Id, "name": name, "type": channel.Type,
			"base_url": base, "models": models, "pricing_written": written,
			"group": upstreamGroup, "group_name": groupName, "price_ratio": priceRatio,
			"keys": len(usableKeys),
		}
		if pricingErr != "" {
			entry["pricing_error"] = pricingErr
		}
		results = append(results, entry)
	}
	recordManageAudit(c, "channel.create.uterapi", map[string]any{
		"group": group, "created": created,
	})
	if created == 0 {
		if lastErr == "" {
			lastErr = "no Uter.api channel could be created"
		}
		common.ApiError(c, errors.New(lastErr))
		return
	}
	common.ApiSuccess(c, gin.H{"channels": results, "created": created})
}

func normalizeUterAPIKeys(list []string) []string {
	seen := make(map[string]bool)
	out := make([]string, 0, len(list))
	for _, raw := range list {
		key := strings.TrimSpace(raw)
		if key == "" || seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, key)
	}
	return out
}

// discoverUterAPIModels unions the model lists of every usable key in one box.
// A failing key is dropped; the box fails only when no key works.
func discoverUterAPIModels(ctx context.Context, keys []string) ([]string, []string, string) {
	seen := make(map[string]bool)
	models := make([]string, 0)
	usable := make([]string, 0, len(keys))
	lastErr := ""
	for _, key := range keys {
		found, err := service.OpenAIModelIDs(ctx, uterapiBaseURL(), key)
		if err != nil {
			lastErr = err.Error()
			continue
		}
		usable = append(usable, key)
		for _, model := range found {
			if seen[model] {
				continue
			}
			seen[model] = true
			models = append(models, model)
		}
	}
	sort.Strings(models)
	return models, usable, lastErr
}

// GetUterAPIPricingGroups lists the upstream billing groups and their price
// multipliers so the create flow can bind a key to the group it was issued for.
func GetUterAPIPricingGroups(c *gin.Context) {
	groups, err := service.FetchUterAPIPricingGroups(c.Request.Context())
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, gin.H{"groups": groups})
}
