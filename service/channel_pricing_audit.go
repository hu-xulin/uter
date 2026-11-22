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
	"time"

	"github.com/uter-ai/uter/common"
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

const (
	UpstreamParityFullyMatched  = "FULLY_MATCHED"
	UpstreamParityModelMismatch = "MODEL_MISMATCH"
	UpstreamParityModelMissing  = "MODEL_MISSING"
	UpstreamParityPriceMismatch = "PRICE_MISMATCH"
	UpstreamParityRuleMismatch  = "RULE_MISMATCH"
	UpstreamParityUnsupported   = "UNSUPPORTED"
	UpstreamParityStale         = "STALE"
	UpstreamParitySyncFailed    = "SYNC_FAILED"
	UpstreamParityManualReview  = "MANUAL_REVIEW"
)

// upstreamParityStaleAfter matches the channel-pricing screen's freshness
// window so the audit and the operator view never disagree about staleness.
const upstreamParityStaleAfter = 48 * time.Hour

type UpstreamParityModel struct {
	ModelName           string   `json:"model_name"`
	Status              string   `json:"status"`
	LifecycleStatus     string   `json:"lifecycle_status,omitempty"`
	PricingStatus       string   `json:"pricing_status"`
	PriceKind           string   `json:"price_kind,omitempty"`
	HasOfficial         bool     `json:"has_official"`
	HasOfficialEstimate bool     `json:"has_official_estimate"`
	HasChannelPrice     bool     `json:"has_channel_price"`
	HasInternalPrice    bool     `json:"has_internal_price"`
	HasPurchaseCost     bool     `json:"has_purchase_cost"`
	PurchaseVerified    bool     `json:"purchase_verified"`
	ExpressionStatus    string   `json:"expression_status,omitempty"`
	Stale               bool     `json:"stale"`
	Reasons             []string `json:"reasons,omitempty"`
}

type UpstreamParityReport struct {
	ChannelID   int    `json:"channel_id"`
	ChannelName string `json:"channel_name"`
	GeneratedAt int64  `json:"generated_at"`
	// CatalogCompared is true only when the complete upstream catalog was read
	// and compared against Uter's rows in this report.
	CatalogCompared    bool                  `json:"catalog_compared"`
	CatalogError       string                `json:"catalog_error,omitempty"`
	UpstreamModelCount int                   `json:"upstream_model_count,omitempty"`
	PurchaseUnverified int                   `json:"purchase_unverified"`
	Summary            map[string]int        `json:"summary"`
	Models             []UpstreamParityModel `json:"models"`
}

// BuildUpstreamParityReport classifies every stored model. A model is fully
// matched only when its lifecycle allows traffic, its channel quote exists,
// its internal sale price is configured, and its rule is executable.
func BuildUpstreamParityReport(channelID int, channelName string, rows []model.ChannelModelPricing, now time.Time) UpstreamParityReport {
	report := UpstreamParityReport{
		ChannelID: channelID, ChannelName: channelName, GeneratedAt: now.Unix(),
		Summary: map[string]int{}, Models: make([]UpstreamParityModel, 0, len(rows)),
	}
	for _, row := range rows {
		item := UpstreamParityModel{
			ModelName: row.ModelName, LifecycleStatus: row.LifecycleStatus,
			PricingStatus: row.PricingStatus,
		}
		var official model.ChannelOfficialPricing
		if strings.TrimSpace(row.NormalizedPricing) != "" {
			_ = common.UnmarshalJsonStr(row.NormalizedPricing, &official)
		}
		item.PriceKind = official.PriceKind
		item.HasChannelPrice = len(official.ChannelPriceTiers) > 0 ||
			official.ChannelPrice != nil ||
			official.PriceKind == "CHANNEL_QUOTE"
		item.HasOfficial = len(official.Tiers) > 0 &&
			official.PriceKind != "RATIO_ONLY" &&
			official.PriceKind != "DERIVED_FROM_RATIOS" &&
			official.PriceKind != "HISTORICAL_SNAPSHOT" &&
			!item.HasChannelPrice
		item.HasOfficialEstimate = len(official.Tiers) > 0 &&
			(official.PriceKind == "RATIO_ONLY" || official.PriceKind == "DERIVED_FROM_RATIOS")
		item.HasInternalPrice = row.PricingStatus == model.ChannelPricingStatusConfigured && strings.TrimSpace(row.InternalPricing) != ""
		if cost := model.ParseChannelPurchaseCost(row.PurchasePricing); cost != nil {
			item.HasPurchaseCost = true
			item.PurchaseVerified = cost.Verified
		}
		if item.HasInternalPrice && !item.PurchaseVerified {
			report.PurchaseUnverified++
		}
		item.ExpressionStatus = official.ExpressionStatus
		item.Stale = row.FetchedAt > 0 && now.Sub(time.Unix(row.FetchedAt, 0)) > upstreamParityStaleAfter

		lifecycle := strings.ToUpper(strings.TrimSpace(row.LifecycleStatus))
		switch lifecycle {
		case model.ChannelModelLifecycleSyncFailed:
			item.Status = UpstreamParitySyncFailed
		case model.ChannelModelLifecycleDisabled, model.ChannelModelLifecycleNotFound:
			item.Status = UpstreamParityModelMismatch
		}
		if item.Status == "" && official.ExpressionStatus == UpstreamExpressionUnsupported {
			item.Status = UpstreamParityUnsupported
		}
		if item.Status == "" && row.PricingStatus == model.ChannelPricingStatusNeedsReview {
			item.Status = UpstreamParityManualReview
		}
		if item.Status == "" && !item.HasOfficial && !item.HasChannelPrice {
			item.Status = UpstreamParityPriceMismatch
		}
		if item.Status == "" && item.HasChannelPrice && !item.HasInternalPrice {
			item.Status = UpstreamParityPriceMismatch
		}
		if item.Status == "" && item.HasOfficialEstimate && !item.HasChannelPrice {
			// A ratio-derived estimate is not an official absolute price and
			// must not make the model look fully reconciled.
			item.Status = UpstreamParityPriceMismatch
		}
		if item.Status == "" && row.InternalPricing != "" {
			var internal model.ChannelInternalPricing
			if err := common.UnmarshalJsonStr(row.InternalPricing, &internal); err == nil &&
				(internal.Mode == model.ChannelPricingModeTieredExpr || internal.Mode == model.ChannelPricingModeTieredTable) {
				if expr := NormalizeUpstreamExpression(internal.BillingExpr); !expr.Executable && internal.BillingExpr != "" {
					item.Status = UpstreamParityRuleMismatch
				}
			}
		}
		if item.Status == "" && item.Stale {
			item.Status = UpstreamParityStale
		}
		if item.Status == "" {
			item.Status = UpstreamParityFullyMatched
		}
		if item.Status != UpstreamParityFullyMatched {
			item.Reasons = append(item.Reasons, parityReason(item))
		}
		report.Summary[item.Status]++
		report.Models = append(report.Models, item)
	}
	sort.Slice(report.Models, func(i, j int) bool { return report.Models[i].ModelName < report.Models[j].ModelName })
	return report
}

// BuildUpstreamParityReportWithCatalog adds models that exist upstream but
// have no Uter pricing row. Checking only stored rows can never prove catalog
// completeness, so callers must pass the freshly fetched upstream model IDs.
func BuildUpstreamParityReportWithCatalog(
	channelID int,
	channelName string,
	rows []model.ChannelModelPricing,
	upstreamModels []string,
	now time.Time,
) UpstreamParityReport {
	report := BuildUpstreamParityReport(channelID, channelName, rows, now)
	report.CatalogCompared = true
	report.UpstreamModelCount = len(upstreamModels)
	if len(upstreamModels) == 0 {
		return report
	}
	seen := make(map[string]struct{}, len(rows))
	for _, row := range rows {
		seen[row.ModelName] = struct{}{}
	}
	for _, name := range upstreamModels {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		report.Models = append(report.Models, UpstreamParityModel{
			ModelName: name,
			Status:    UpstreamParityModelMissing,
			Reasons:   []string{parityReason(UpstreamParityModel{Status: UpstreamParityModelMissing})},
		})
		report.Summary[UpstreamParityModelMissing]++
	}
	sort.Slice(report.Models, func(i, j int) bool { return report.Models[i].ModelName < report.Models[j].ModelName })
	return report
}

func parityReason(item UpstreamParityModel) string {
	switch item.Status {
	case UpstreamParitySyncFailed:
		return "last upstream sync failed; the last known state is retained"
	case UpstreamParityModelMismatch:
		return "model is no longer active upstream"
	case UpstreamParityModelMissing:
		return "upstream model has no Uter pricing row"
	case UpstreamParityPriceMismatch:
		if item.HasOfficialEstimate && !item.HasChannelPrice {
			return "official absolute price unavailable; only a ratio-derived estimate"
		}
		if !item.HasOfficial && !item.HasChannelPrice {
			return "no official or channel price"
		}
		return "channel quote exists but no configured sale price"
	case UpstreamParityUnsupported:
		return "upstream billing expression is unsupported by Uter"
	case UpstreamParityManualReview:
		return "price shape or source needs operator review"
	case UpstreamParityRuleMismatch:
		return "internal billing expression is not executable"
	case UpstreamParityStale:
		return "upstream price is older than the freshness window"
	default:
		return ""
	}
}
