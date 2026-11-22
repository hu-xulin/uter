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
	"errors"
	"fmt"
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
	ClaudeKey string `json:"claude_key"`
	GPTKey    string `json:"gpt_key"`
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
	req.ClaudeKey = strings.TrimSpace(req.ClaudeKey)
	req.GPTKey = strings.TrimSpace(req.GPTKey)
	if req.ClaudeKey == "" && req.GPTKey == "" {
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
		key    string
		group  string
	}{
		{"claude", req.ClaudeKey, strings.TrimSpace(req.ClaudeGroup)},
		{"gpt", req.GPTKey, strings.TrimSpace(req.GPTGroup)},
	}
	results := make([]gin.H, 0, len(specs))
	created := 0
	lastErr := ""
	for _, spec := range specs {
		if spec.key == "" {
			continue
		}
		name := fmt.Sprintf("xxapi-%s", spec.suffix)
		models, err := service.OpenAIModelIDs(c.Request.Context(), xxapiBaseURLForTest, spec.key)
		if err != nil {
			results = append(results, gin.H{"name": name, "error": common.LogText("model discovery failed: %s", err.Error())})
			lastErr = err.Error()
			continue
		}
		base := xxapiBaseURLForTest
		channel := model.Channel{
			Type: constant.ChannelTypeNewAPI, Name: name, BaseURL: &base, Key: spec.key,
			Models: strings.Join(models, ","), Group: group, Status: status,
			CreatedTime: common.GetTimestamp(),
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
