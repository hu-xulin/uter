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
package service

import (
	"fmt"
	"sort"
	"strings"

	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/custom_pricing"
)

// ChannelPricingAudit reports which price source actually wins for one channel.
// It is read-only and intentionally never resolves prices; it only exposes the
// coexistence of ChannelPriceSetting and ChannelModelPricing.
type ChannelPricingAudit struct {
	ChannelID   int                           `json:"channel_id"`
	ChannelName string                        `json:"channel_name"`
	Authority   string                        `json:"authority"`
	Models      []ChannelPricingAuditModel    `json:"models"`
	Conflicts   []ChannelPricingAuditConflict `json:"conflicts"`
	Warnings    []string                      `json:"warnings,omitempty"`
}

type ChannelPricingAuditModel struct {
	ModelName     string `json:"model_name"`
	LegacyStatus  string `json:"legacy_status,omitempty"`
	ChannelStatus string `json:"channel_status,omitempty"`
	BillingSource string `json:"billing_source"`
	Billable      bool   `json:"billable"`
	Conflict      bool   `json:"conflict"`
}

type ChannelPricingAuditConflict struct {
	ModelName     string `json:"model_name"`
	LegacyStatus  string `json:"legacy_status"`
	ChannelStatus string `json:"channel_status"`
	BillingSource string `json:"billing_source"`
	Reason        string `json:"reason"`
}

// BuildChannelPricingAudit compares the legacy option quote sheet with the
// per-channel pricing table. ChannelModelPricing is the current authority:
// an existing row wins even when it is not billable, which blocks the charge
// instead of silently falling back to the legacy quote.
func BuildChannelPricingAudit(
	channelID int,
	channelName string,
	legacy *custom_pricing.ChannelPriceConfig,
	rows []model.ChannelModelPricing,
) ChannelPricingAudit {
	audit := ChannelPricingAudit{
		ChannelID:   channelID,
		ChannelName: channelName,
		Models:      []ChannelPricingAuditModel{},
		Conflicts:   []ChannelPricingAuditConflict{},
		Authority:   "global",
	}
	legacyStatus := map[string]string{}
	if legacy != nil {
		for name, quote := range legacy.Quotes {
			legacyStatus[name] = legacyQuoteStatus(quote)
		}
		for name := range legacy.Models {
			if _, exists := legacyStatus[name]; !exists {
				legacyStatus[name] = "model_rule"
			}
		}
		if len(legacyStatus) > 0 || legacy.Ratio != nil {
			audit.Authority = "legacy_channel_price_setting"
		}
	}
	channelStatus := make(map[string]string, len(rows))
	for _, row := range rows {
		channelStatus[row.ModelName] = row.PricingStatus
	}
	if len(channelStatus) > 0 {
		audit.Authority = "channel_model_pricing"
	}

	names := make(map[string]struct{}, len(legacyStatus)+len(channelStatus))
	for name := range legacyStatus {
		names[name] = struct{}{}
	}
	for name := range channelStatus {
		names[name] = struct{}{}
	}
	ordered := make([]string, 0, len(names))
	for name := range names {
		ordered = append(ordered, name)
	}
	sort.Strings(ordered)

	conflicts := 0
	blocked := 0
	for _, name := range ordered {
		item := ChannelPricingAuditModel{ModelName: name}
		item.LegacyStatus = legacyStatus[name]
		item.ChannelStatus = channelStatus[name]
		switch {
		case item.ChannelStatus != "":
			item.BillingSource = "channel_model_pricing"
			item.Billable = item.ChannelStatus == model.ChannelPricingStatusConfigured
			if !item.Billable {
				blocked++
			}
		case item.LegacyStatus != "":
			item.BillingSource = "legacy_channel_price_setting"
			item.Billable = item.LegacyStatus != "needs_review"
		default:
			item.BillingSource = "global"
			item.Billable = true
		}
		if item.LegacyStatus != "" && item.ChannelStatus != "" {
			item.Conflict = true
			conflicts++
			reason := "The channel pricing table shadows the legacy quote."
			if !item.Billable {
				reason = "The channel pricing row is not billable and blocks the legacy quote."
			}
			audit.Conflicts = append(audit.Conflicts, ChannelPricingAuditConflict{
				ModelName:     name,
				LegacyStatus:  item.LegacyStatus,
				ChannelStatus: item.ChannelStatus,
				BillingSource: item.BillingSource,
				Reason:        reason,
			})
		}
		audit.Models = append(audit.Models, item)
	}
	if conflicts > 0 {
		audit.Warnings = append(audit.Warnings, fmt.Sprintf(
			"%d model(s) exist in both price systems; channel_model_pricing is authoritative.",
			conflicts,
		))
	}
	if blocked > 0 {
		audit.Warnings = append(audit.Warnings, fmt.Sprintf(
			"%d channel price row(s) are not billable and block fallback.",
			blocked,
		))
	}
	return audit
}

func legacyQuoteStatus(quote custom_pricing.ChannelQuote) string {
	if quote.Status != "" {
		return quote.Status
	}
	if strings.TrimSpace(quote.BillingExpr) != "" {
		return custom_pricing.ChannelQuoteStatusNeedsReview
	}
	if quote.ChannelPrice == nil && quote.Discount == nil {
		return "official_only"
	}
	return "configured"
}

// AuditChannelPricing loads one channel and compares both price systems.
func AuditChannelPricing(channelID int) (*ChannelPricingAudit, error) {
	channel, err := model.GetChannelById(channelID, false)
	if err != nil || channel == nil {
		return nil, fmt.Errorf("channel not found")
	}
	rows, err := model.ListChannelModelPricing(channelID)
	if err != nil {
		return nil, err
	}
	config, _ := custom_pricing.GetChannelConfig(channelID)
	var legacy *custom_pricing.ChannelPriceConfig
	if config.Enabled {
		legacy = &config
	}
	audit := BuildChannelPricingAudit(channelID, channel.Name, legacy, rows)
	return &audit, nil
}

// AuditAllChannelPricing compares both price systems for every channel.
func AuditAllChannelPricing() ([]ChannelPricingAudit, error) {
	const pageSize = 200
	audits := make([]ChannelPricingAudit, 0)
	for start := 0; ; {
		channels, err := model.GetAllChannels(start, pageSize, false, true)
		if err != nil {
			return nil, err
		}
		if len(channels) == 0 {
			break
		}
		for _, channel := range channels {
			rows, err := model.ListChannelModelPricing(channel.Id)
			if err != nil {
				return nil, err
			}
			config, _ := custom_pricing.GetChannelConfig(channel.Id)
			var legacy *custom_pricing.ChannelPriceConfig
			if config.Enabled {
				legacy = &config
			}
			audits = append(audits, BuildChannelPricingAudit(channel.Id, channel.Name, legacy, rows))
		}
		if len(channels) < pageSize {
			break
		}
		start += len(channels)
	}
	return audits, nil
}
