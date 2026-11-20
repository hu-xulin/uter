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

	"github.com/uter-ai/uter/model"
)

// ChannelPricingAudit reports which price source actually wins for one channel.
// ChannelModelPricing is the only per-model price store; a missing row falls
// back to the global model price.
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
	ChannelStatus string `json:"channel_status,omitempty"`
	BillingSource string `json:"billing_source"`
	Billable      bool   `json:"billable"`
	Conflict      bool   `json:"conflict"`
}

type ChannelPricingAuditConflict struct {
	ModelName     string `json:"model_name"`
	ChannelStatus string `json:"channel_status"`
	BillingSource string `json:"billing_source"`
	Reason        string `json:"reason"`
}

// BuildChannelPricingAudit reports the resolved source for every stored row.
// Rows that exist but are not configured are blocking: they never silently fall
// back to a global price.
func BuildChannelPricingAudit(
	channelID int,
	channelName string,
	rows []model.ChannelModelPricing,
) ChannelPricingAudit {
	audit := ChannelPricingAudit{
		ChannelID:   channelID,
		ChannelName: channelName,
		Models:      []ChannelPricingAuditModel{},
		Conflicts:   []ChannelPricingAuditConflict{},
		Authority:   "global",
	}
	if len(rows) == 0 {
		return audit
	}
	audit.Authority = "channel_model_pricing"
	blocked := 0
	for _, row := range rows {
		item := ChannelPricingAuditModel{
			ModelName:     row.ModelName,
			ChannelStatus: row.PricingStatus,
			BillingSource: "channel_model_pricing",
			Billable:      row.PricingStatus == model.ChannelPricingStatusConfigured,
		}
		if !item.Billable {
			blocked++
		}
		audit.Models = append(audit.Models, item)
	}
	sort.Slice(audit.Models, func(i, j int) bool {
		return audit.Models[i].ModelName < audit.Models[j].ModelName
	})
	if blocked > 0 {
		audit.Warnings = append(audit.Warnings, fmt.Sprintf(
			"%d channel price row(s) are not billable.", blocked,
		))
	}
	return audit
}

// AuditChannelPricing loads one channel's pricing rows.
func AuditChannelPricing(channelID int) (*ChannelPricingAudit, error) {
	channel, err := model.GetChannelById(channelID, false)
	if err != nil || channel == nil {
		return nil, fmt.Errorf("channel not found")
	}
	rows, err := model.ListChannelModelPricing(channelID)
	if err != nil {
		return nil, err
	}
	audit := BuildChannelPricingAudit(channelID, channel.Name, rows)
	return &audit, nil
}

// AuditAllChannelPricing reports every channel's pricing rows.
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
			audits = append(audits, BuildChannelPricingAudit(channel.Id, channel.Name, rows))
		}
		if len(channels) < pageSize {
			break
		}
		start += len(channels)
	}
	return audits, nil
}
