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
	"fmt"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

// xxapiCreateRequest carries the two upstream keys separately: one unlocks the
// Claude pool, the other the GPT/Codex pool. A single channel cannot rotate
// between them, so each key becomes its own channel with its own model list.
type xxapiCreateRequest struct {
	ClaudeKey  string   `json:"claude_key"`
	GPTKey     string   `json:"gpt_key"`
	ClaudeKeys []string `json:"claude_keys"`
	GPTKeys    []string `json:"gpt_keys"`
	// ClaudeGroup/GPTGroup are the upstream billing groups each key belongs to.
	// A key's group decides both its price multiplier and visible models.
	ClaudeGroup string `json:"claude_group"`
	GPTGroup    string `json:"gpt_group"`
	Group       string `json:"group"`
	Status      int    `json:"status"`
}

const xxapiBaseURL = "https://xxapi.ai"

// xxapiBaseURLForTest lets tests point the dual-key creation at a local mock.
var xxapiBaseURLForTest = xxapiBaseURL

// CreateXXAPIChannels creates one NewAPI-compatible channel per supplied key and
// syncs its catalogue prices. Errors are reported per key so one bad key does
// not discard a working channel.
func CreateXXAPIChannels(c *gin.Context) {
	var req xxapiCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	claudeKeys := normalizeXXAPIKeys(req.ClaudeKeys, req.ClaudeKey)
	gptKeys := normalizeXXAPIKeys(req.GPTKeys, req.GPTKey)
	if len(claudeKeys) == 0 && len(gptKeys) == 0 {
		common.ApiErrorMsg(c, "At least one xxapi key is required")
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

	specs := []struct {
		suffix string
		keys   []string
		group  string
	}{
		{"claude", claudeKeys, strings.TrimSpace(req.ClaudeGroup)},
		{"gpt", gptKeys, strings.TrimSpace(req.GPTGroup)},
	}
	results := make([]gin.H, 0, len(specs))
	created := 0
	lastErr := ""
	for _, spec := range specs {
		if len(spec.keys) == 0 {
			continue
		}
		name := fmt.Sprintf("xxapi-%s", spec.suffix)
		models, usableKeys, discoveryErr := discoverXXAPIModels(c.Request.Context(), spec.keys)
		if len(usableKeys) == 0 {
			results = append(results, gin.H{"name": name, "error": common.LogText("model discovery failed: %s", discoveryErr)})
			lastErr = discoveryErr
			continue
		}
		base := xxapiBaseURLForTest
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
		if err := validateChannel(&channel, true); err != nil {
			results = append(results, gin.H{"name": name, "error": err.Error()})
			lastErr = err.Error()
			continue
		}
		batch := []model.Channel{channel}
		if err := model.BatchInsertChannels(batch); err != nil {
			results = append(results, gin.H{"name": name, "error": err.Error()})
			lastErr = err.Error()
			continue
		}
		channel = batch[0]
		created++
		// GetChannelById(selectAll=false) blanks the key; the sync needs it.
		createdChannel, _ := model.GetChannelById(channel.Id, false)
		if createdChannel == nil || createdChannel.Key == "" {
			createdChannel = &channel
		}
		written := 0
		pricingErr := ""
		priceRatio := 1.0
		groupName := ""
		if count, ratio, resolvedGroup, syncErr := service.SyncXXAPIChannelPricing(c.Request.Context(), createdChannel, spec.group); syncErr != nil {
			pricingErr = syncErr.Error()
			common.SysError(common.LogText("xxapi price sync failed after create: channel_id=%d, error=%v", channel.Id, syncErr))
		} else {
			written = count
			priceRatio = ratio
			groupName = resolvedGroup
		}
		entry := gin.H{
			"channel_id": channel.Id, "name": name, "type": channel.Type,
			"base_url": base, "models": models, "pricing_written": written,
			"group": spec.group, "group_name": groupName, "price_ratio": priceRatio,
			"keys": len(usableKeys),
		}
		if pricingErr != "" {
			entry["pricing_error"] = pricingErr
		}
		results = append(results, entry)
	}
	recordManageAudit(c, "channel.create.xxapi", map[string]any{
		"group": group, "created": created,
	})
	if created == 0 {
		if lastErr == "" {
			lastErr = "no xxapi channel could be created"
		}
		common.ApiError(c, errors.New(lastErr))
		return
	}
	common.ApiSuccess(c, gin.H{"channels": results, "created": created})
}

// GetXXAPIPricingGroups lists the upstream billing groups and their price
// multipliers so the create flow can let the operator pick the key's group.
func GetXXAPIPricingGroups(c *gin.Context) {
	groups, err := service.FetchXXAPIPricingGroups(c.Request.Context())
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, gin.H{"groups": groups})
}
func normalizeXXAPIKeys(list []string, single string) []string {
	seen := make(map[string]bool)
	out := make([]string, 0, len(list)+1)
	for _, raw := range append(append([]string{}, list...), single) {
		key := strings.TrimSpace(raw)
		if key == "" || seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, key)
	}
	return out
}

// discoverXXAPIModels unions the model lists of every usable key in one box.
// A failing key is dropped; the box fails only when no key works.
func discoverXXAPIModels(ctx context.Context, keys []string) ([]string, []string, string) {
	seen := make(map[string]bool)
	models := make([]string, 0)
	usable := make([]string, 0, len(keys))
	lastErr := ""
	for _, key := range keys {
		found, err := service.OpenAIModelIDs(ctx, xxapiBaseURLForTest, key)
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
