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
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

type syncDiagnosticCheck struct {
	Status     string         `json:"status"`
	Source     string         `json:"source,omitempty"`
	Count      int            `json:"count"`
	Message    string         `json:"message,omitempty"`
	Error      string         `json:"error,omitempty"`
	FetchedAt  int64          `json:"fetched_at,omitempty"`
	DurationMS int64          `json:"duration_ms,omitempty"`
	Details    map[string]any `json:"details,omitempty"`
}

type channelSyncDiagnostics struct {
	ChannelID    int                      `json:"channel_id"`
	ChannelName  string                   `json:"channel_name"`
	Provider     service.UpstreamProvider `json:"provider"`
	CheckedAt    int64                    `json:"checked_at"`
	Models       syncDiagnosticCheck      `json:"models"`
	Official     syncDiagnosticCheck      `json:"official_pricing"`
	ChannelPrice syncDiagnosticCheck      `json:"channel_pricing"`
	Warnings     []string                 `json:"warnings,omitempty"`
}

// ChannelSyncDiagnostics probes the real model and price sources of one
// channel without writing prices. Each source reports independently so a
// pricing failure never hides a successful model discovery.
//
// POST /api/channel/:id/sync_diagnostics
func ChannelSyncDiagnostics(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	channel, err := model.GetChannelById(id, true)
	if err != nil || channel == nil {
		common.ApiErrorT(c, "Channel not found")
		return
	}
	baseURL := ""
	if channel.BaseURL != nil {
		baseURL = strings.TrimSpace(*channel.BaseURL)
	}
	provider := service.UpstreamProviderForChannel(channel.Type, baseURL)
	result := channelSyncDiagnostics{
		ChannelID:   channel.Id,
		ChannelName: channel.Name,
		Provider:    provider,
		CheckedAt:   time.Now().Unix(),
	}

	started := time.Now()
	modelIDs, modelErr := fetchChannelUpstreamModelIDs(channel)
	result.Models = syncDiagnosticCheck{
		Source:     "/v1/models",
		Count:      len(modelIDs),
		DurationMS: time.Since(started).Milliseconds(),
	}
	if modelErr != nil {
		result.Models.Status = "FAILED"
		result.Models.Error = sanitizeFetchModelsError(modelErr, channel.Key).Error()
	} else {
		result.Models.Status = "FETCHED"
		result.Models.Message = fmt.Sprintf("Discovered %d upstream model(s)", len(modelIDs))
		sample := modelIDs
		if len(sample) > 20 {
			sample = sample[:20]
		}
		result.Models.Details = map[string]any{"sample": sample}
	}

	switch provider.ID {
	case "dreamrouter":
		result.Official, result.ChannelPrice = dreamRouterDiagnostics()
	case "alibaba-bailian":
		result.Official, result.ChannelPrice = bailianDiagnostics(channel.Id)
	default:
		result.Official, result.ChannelPrice = genericPriceDiagnostics(c, channel)
	}
	if records := channelPricingCheck(channel.Id); records != nil {
		result.ChannelPrice.Details = records
		applyChannelPricingStatus(&result.ChannelPrice, records)
	}

	if result.Models.Status == "FAILED" {
		result.Warnings = append(result.Warnings, "Model discovery failed; check Base URL, key and channel type.")
	}
	if result.Official.Status == "UNSUPPORTED" || result.Official.Status == "FAILED" {
		result.Warnings = append(result.Warnings, "Official pricing is unavailable; do not treat it as verified.")
	}
	if result.ChannelPrice.Status == "FAILED" {
		result.Warnings = append(result.Warnings, "Channel pricing failed; existing prices were not changed.")
	}
	common.ApiSuccess(c, result)
}

func dreamRouterDiagnostics() (syncDiagnosticCheck, syncDiagnosticCheck) {
	official := syncDiagnosticCheck{Source: "dreamrouter:/api/pricing"}
	channel := syncDiagnosticCheck{Source: "channel_model_pricing"}
	snapshot := service.LoadDreamRouterUpstreamSnapshot()
	if snapshot == nil {
		official.Status = "NOT_CONFIGURED"
		official.Message = "No DreamRouter catalog synced yet."
		return official, channel
	}
	withPrice := 0
	derived := 0
	for _, item := range snapshot.Models {
		if item.OfficialPrice != nil {
			withPrice++
		}
		if item.PriceStatus == "DERIVED_FROM_RATIOS" {
			derived++
		}
	}
	official.Status = "FETCHED"
	official.Count = withPrice
	official.FetchedAt = snapshot.FetchedAt.Unix()
	official.Message = fmt.Sprintf("%d of %d models expose an official price", withPrice, len(snapshot.Models))
	official.Details = map[string]any{"derived_from_ratios": derived}
	return official, channel
}

func bailianDiagnostics(channelID int) (syncDiagnosticCheck, syncDiagnosticCheck) {
	official := syncDiagnosticCheck{Source: "bailian-catalog"}
	channel := syncDiagnosticCheck{Source: "channel_model_pricing"}
	catalog := service.LoadBailianCatalogSnapshotForChannel(channelID)
	if catalog == nil {
		catalog = service.LoadBailianCatalogSnapshot()
	}
	if catalog == nil {
		official.Status = "NOT_CONFIGURED"
		official.Message = "No Bailian catalog synced yet."
		return official, channel
	}
	official.Status = "FETCHED"
	official.Count = len(catalog.Models)
	official.FetchedAt = catalog.FetchedAt.Unix()
	official.Message = fmt.Sprintf("Catalog contains %d model(s)", len(catalog.Models))
	return official, channel
}

func genericPriceDiagnostics(c *gin.Context, channel *model.Channel) (syncDiagnosticCheck, syncDiagnosticCheck) {
	official := syncDiagnosticCheck{Source: "generic:/api/pricing"}
	channelCheck := syncDiagnosticCheck{Source: "generic:/api/pricing"}
	baseURL := ""
	if channel.BaseURL != nil {
		baseURL = strings.TrimRight(strings.TrimSuffix(strings.TrimSpace(*channel.BaseURL), "/v1"), "/")
	}
	if baseURL == "" || len(channel.GetKeys()) == 0 {
		channelCheck.Status = "NOT_CONFIGURED"
		channelCheck.Message = "Base URL and API key are required for pricing sync."
		official.Status = "NOT_CONFIGURED"
		official.Message = channelCheck.Message
		return official, channelCheck
	}
	started := time.Now()
	payload, err := fetchUpstreamPricing(c.Request.Context(), baseURL+"/api/pricing", channel.GetKeys())
	channelCheck.DurationMS = time.Since(started).Milliseconds()
	if err != nil {
		channelCheck.Status = "FAILED"
		channelCheck.Error = err.Error()
		official.Status = "FAILED"
		official.Error = err.Error()
		return official, channelCheck
	}
	channelCheck.Status = "FETCHED"
	channelCheck.Count = len(payload.Data)
	channelCheck.Message = fmt.Sprintf("Fetched %d pricing entries", len(payload.Data))
	officialCount := 0
	for _, item := range payload.Data {
		if item.OfficialPrice != nil || item.OfficialRatio != nil {
			officialCount++
		}
	}
	official.Status = "FETCHED"
	official.Count = officialCount
	official.Message = fmt.Sprintf("%d of %d entries expose an official price", officialCount, len(payload.Data))
	if officialCount == 0 {
		official.Status = "UNSUPPORTED"
		official.Message = "The upstream pricing payload has no official_price/official_ratio."
	}
	return official, channelCheck
}

func channelPricingCheck(channelID int) map[string]any {
	rows, err := model.ListChannelModelPricing(channelID)
	if err != nil {
		return map[string]any{"error": err.Error()}
	}
	configured := 0
	officialOnly := 0
	needsReview := 0
	for _, row := range rows {
		switch row.PricingStatus {
		case model.ChannelPricingStatusConfigured:
			configured++
		case model.ChannelPricingStatusNeedsReview:
			needsReview++
		default:
			officialOnly++
		}
	}
	return map[string]any{
		"total":         len(rows),
		"configured":    configured,
		"official_only": officialOnly,
		"needs_review":  needsReview,
	}
}

func applyChannelPricingStatus(check *syncDiagnosticCheck, details map[string]any) {
	total, _ := details["total"].(int)
	configured, _ := details["configured"].(int)
	officialOnly, _ := details["official_only"].(int)
	needsReview, _ := details["needs_review"].(int)
	check.Count = total
	check.Message = fmt.Sprintf(
		"%d records: %d configured, %d official-only, %d needs review",
		total, configured, officialOnly, needsReview,
	)
	switch {
	case total == 0:
		check.Status = "NOT_CONFIGURED"
	case needsReview > 0:
		check.Status = "NEEDS_REVIEW"
	case configured > 0:
		check.Status = "FETCHED"
	default:
		check.Status = "OFFICIAL_ONLY"
	}
}
