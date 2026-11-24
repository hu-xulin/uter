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
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/shopspring/decimal"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/relaykit/dto"
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
	// Reason is the stable, authoritative code from the shared billing gate
	// explaining why the row cannot be charged (empty when billable). It comes
	// from the same function the Relay path uses, so the audit page cannot
	// claim a model is chargeable when the runtime would reject it.
	Reason   string `json:"reason,omitempty"`
	Conflict bool   `json:"conflict"`
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
//
// The authority MUST be derived from the same explicit pricing mode the billing
// path uses (ChannelScopedPricingRequired). Deriving it from row presence alone
// made the audit page show "global" for a channel that the runtime had already
// blocked under CHANNEL_SCOPED_PENDING/ACTIVE — operators were shown a source
// that could never actually be charged.
func BuildChannelPricingAudit(
	channelID int,
	channelName string,
	pricingMode string,
	rows []model.ChannelModelPricing,
) ChannelPricingAudit {
	audit := ChannelPricingAudit{
		ChannelID:   channelID,
		ChannelName: channelName,
		Models:      []ChannelPricingAuditModel{},
		Conflicts:   []ChannelPricingAuditConflict{},
		Authority:   "global",
	}
	scopedRequired := model.ChannelScopedPricingRequired(channelID, pricingMode)
	normalizedMode := strings.ToUpper(strings.TrimSpace(pricingMode))
	pending := normalizedMode == dto.ChannelPricingModeScopedPending
	if scopedRequired || len(rows) > 0 {
		audit.Authority = "channel_model_pricing"
	}
	if normalizedMode == dto.ChannelPricingModeGlobalLegacy {
		audit.Authority = "global"
	}
	if len(rows) == 0 {
		if scopedRequired {
			audit.Warnings = append(audit.Warnings,
				"channel-scoped pricing is required but no channel price rows exist; billing is blocked")
		}
		return audit
	}
	blocked := 0
	now := time.Now()
	for _, row := range rows {
		// Use the exact same eligibility gate as the Relay billing path. The
		// old check (status==configured && !pending) ignored lifecycle,
		// unparseable expressions and stale prices, so the page could report
		// a model billable that the runtime would refuse to charge.
		_ = pending // kept for the empty-rows authority logic above
		reason := model.ChannelPricingBillableReason(row, pricingMode, now)
		item := ChannelPricingAuditModel{
			ModelName:     row.ModelName,
			ChannelStatus: row.PricingStatus,
			BillingSource: "channel_model_pricing",
			Billable:      reason == "",
			Reason:        reason,
		}
		if reason != "" {
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
	audit := BuildChannelPricingAudit(channelID, channel.Name, channel.GetOtherSettings().PricingMode, rows)
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
			audits = append(audits, BuildChannelPricingAudit(channel.Id, channel.Name, channel.GetOtherSettings().PricingMode, rows))
		}
		if len(channels) < pageSize {
			break
		}
		start += len(channels)
	}
	return audits, nil
}

const (
	UpstreamParityFullyMatched       = "FULLY_MATCHED"
	UpstreamParityModelMismatch      = "MODEL_MISMATCH"
	UpstreamParityModelMissing       = "MODEL_MISSING"
	UpstreamParityPriceMismatch      = "PRICE_MISMATCH"
	UpstreamParityRuleMismatch       = "RULE_MISMATCH"
	UpstreamParityDiscountMismatch   = "DISCOUNT_MISMATCH"
	UpstreamParityIdentityMismatch   = "IDENTITY_MISMATCH"
	UpstreamParityPurchaseUnverified = "PURCHASE_UNVERIFIED"
	UpstreamParityUnsupported        = "UNSUPPORTED"
	UpstreamParityStale              = "STALE"
	UpstreamParitySyncFailed         = "SYNC_FAILED"
	UpstreamParityManualReview       = "MANUAL_REVIEW"
)

// upstreamParityStaleAfter matches the channel-pricing screen's freshness
// window so the audit and the operator view never disagree about staleness.
const upstreamParityStaleAfter = 48 * time.Hour

// UpstreamParityDimension records one compared price dimension. Amounts are
// serialized as decimal strings so the audit never hides a float round-trip.
type UpstreamParityDimension struct {
	Name               string `json:"name"`
	OfficialUSD        string `json:"official_usd,omitempty"`
	ExpectedChannelUSD string `json:"expected_channel_usd,omitempty"`
	ChannelUSD         string `json:"channel_usd,omitempty"`
	PurchaseUSD        string `json:"purchase_usd,omitempty"`
	ExpectedSaleUSD    string `json:"expected_sale_usd,omitempty"`
	SaleUSD            string `json:"sale_usd,omitempty"`
	Mismatch           bool   `json:"mismatch,omitempty"`
	Reason             string `json:"reason,omitempty"`
}

type UpstreamParityModel struct {
	ModelName           string                    `json:"model_name"`
	Provider            string                    `json:"provider,omitempty"`
	Region              string                    `json:"region,omitempty"`
	DeploymentID        string                    `json:"deployment_id,omitempty"`
	Status              string                    `json:"status"`
	LifecycleStatus     string                    `json:"lifecycle_status,omitempty"`
	PricingStatus       string                    `json:"pricing_status"`
	PricingSource       string                    `json:"pricing_source,omitempty"`
	PriceKind           string                    `json:"price_kind,omitempty"`
	Currency            string                    `json:"currency,omitempty"`
	Unit                string                    `json:"unit,omitempty"`
	DiscountGroup       string                    `json:"discount_group,omitempty"`
	DiscountRatio       *float64                  `json:"discount_ratio,omitempty"`
	FetchedAt           int64                     `json:"fetched_at,omitempty"`
	HasOfficial         bool                      `json:"has_official"`
	HasOfficialEstimate bool                      `json:"has_official_estimate"`
	HasChannelPrice     bool                      `json:"has_channel_price"`
	HasInternalPrice    bool                      `json:"has_internal_price"`
	HasPurchaseCost     bool                      `json:"has_purchase_cost"`
	PurchaseVerified    bool                      `json:"purchase_verified"`
	ExpressionStatus    string                    `json:"expression_status,omitempty"`
	ExpressionHash      string                    `json:"expression_hash,omitempty"`
	Stale               bool                      `json:"stale"`
	Dimensions          []UpstreamParityDimension `json:"dimensions,omitempty"`
	Reasons             []string                  `json:"reasons,omitempty"`
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
			ModelName: row.ModelName, Provider: row.Provider, Region: row.Region,
			DeploymentID: row.DeploymentId, LifecycleStatus: row.LifecycleStatus,
			PricingStatus: row.PricingStatus, PricingSource: row.PricingSource,
			FetchedAt: row.FetchedAt,
		}
		var official model.ChannelOfficialPricing
		if strings.TrimSpace(row.NormalizedPricing) != "" {
			_ = common.UnmarshalJsonStr(row.NormalizedPricing, &official)
		}
		item.PriceKind = official.PriceKind
		item.Currency = strings.ToUpper(strings.TrimSpace(official.NormalizedCurrency))
		if item.Currency == "" {
			item.Currency = strings.ToUpper(strings.TrimSpace(official.Currency))
		}
		item.Unit = official.Unit
		item.DiscountGroup = official.DiscountGroup
		item.DiscountRatio = official.DiscountRatio
		item.ExpressionStatus = official.ExpressionStatus
		item.ExpressionHash = official.ExpressionHash
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

		var internal model.ChannelInternalPricing
		if strings.TrimSpace(row.InternalPricing) != "" {
			_ = common.UnmarshalJsonStr(row.InternalPricing, &internal)
		}
		purchase := model.ParseChannelPurchaseCost(row.PurchasePricing)
		if purchase != nil {
			item.HasPurchaseCost = true
			item.PurchaseVerified = purchase.Verified
		}
		if item.HasInternalPrice && !item.PurchaseVerified {
			report.PurchaseUnverified++
		}
		autoDerived := model.IsAutoDerivedPricingRowFor(row.PricingOwner, row.PricingSource, row.InternalPricing)
		item.Stale = autoDerived && row.FetchedAt > 0 &&
			now.Sub(time.Unix(row.FetchedAt, 0)) > upstreamParityStaleAfter

		dimensions, dimensionMismatch := compareParityDimensions(official, internal, purchase, autoDerived)
		item.Dimensions = dimensions
		structureReasons := parityStructureReasons(official, internal)
		detailReasons := append(append([]string{}, structureReasons...), dimensionMismatch...)

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
		if item.Status == "" && len(structureReasons) > 0 {
			item.Status = UpstreamParityRuleMismatch
		}
		if item.Status == "" && len(dimensionMismatch) > 0 {
			// A configured sale price built from a mismatched quote must never
			// be reported as fully reconciled, even if a purchase cost exists.
			item.Status = UpstreamParityPriceMismatch
		}
		if item.Status == "" && item.HasInternalPrice && !item.PurchaseVerified {
			// A configured sale price without an operator-confirmed contract
			// cost must never be reported as fully matched: any margin figure
			// derived from it would be fabricated.
			item.Status = UpstreamParityPurchaseUnverified
		}
		if item.Status == "" && row.InternalPricing != "" {
			if internal.Mode == model.ChannelPricingModeTieredExpr || internal.Mode == model.ChannelPricingModeTieredTable {
				if expr := NormalizeUpstreamExpression(internal.BillingExpr); !expr.Executable && internal.BillingExpr != "" {
					item.Status = UpstreamParityRuleMismatch
					detailReasons = append(detailReasons, "internal billing expression is not executable")
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
			if reason := parityReason(item); reason != "" {
				item.Reasons = append(item.Reasons, reason)
			}
			item.Reasons = append(item.Reasons, detailReasons...)
		}
		report.Summary[item.Status]++
		report.Models = append(report.Models, item)
	}
	sort.Slice(report.Models, func(i, j int) bool { return report.Models[i].ModelName < report.Models[j].ModelName })
	return report
}

// parityMoneyTolerance absorbs decimal-string normalization only; it is far
// smaller than one nano-dollar so eight-digit prices remain distinguishable.
var parityMoneyTolerance = decimal.RequireFromString("0.00000001")

type parityDimensionSpec struct {
	name     string
	official func(*model.ChannelPricingTier) *model.Money
	channel  func(*model.ChannelPricingTier) *model.Money
	internal func(*model.ChannelInternalPricingTier) *model.Money
}

var parityDimensionSpecs = []parityDimensionSpec{
	{"input", func(t *model.ChannelPricingTier) *model.Money { return t.InputPerMillionUSD },
		func(t *model.ChannelPricingTier) *model.Money { return t.InputPerMillionUSD },
		func(t *model.ChannelInternalPricingTier) *model.Money { return t.InputUSDPerMillion }},
	{"output", func(t *model.ChannelPricingTier) *model.Money { return t.OutputPerMillionUSD },
		func(t *model.ChannelPricingTier) *model.Money { return t.OutputPerMillionUSD },
		func(t *model.ChannelInternalPricingTier) *model.Money { return t.OutputUSDPerMillion }},
	{"cache", func(t *model.ChannelPricingTier) *model.Money { return t.CachePerMillionUSD },
		func(t *model.ChannelPricingTier) *model.Money { return t.CachePerMillionUSD },
		func(t *model.ChannelInternalPricingTier) *model.Money { return t.CacheUSDPerMillion }},
	{"cache_write", func(t *model.ChannelPricingTier) *model.Money { return t.CreateCachePerMillionUSD },
		func(t *model.ChannelPricingTier) *model.Money { return t.CreateCachePerMillionUSD },
		func(t *model.ChannelInternalPricingTier) *model.Money { return t.CreateCacheUSDPerMillion }},
	{"audio_input", func(t *model.ChannelPricingTier) *model.Money { return t.AudioInputPerMillionUSD },
		func(t *model.ChannelPricingTier) *model.Money { return t.AudioInputPerMillionUSD },
		func(t *model.ChannelInternalPricingTier) *model.Money { return t.AudioInputUSDPerMillion }},
	{"audio_output", func(t *model.ChannelPricingTier) *model.Money { return t.AudioOutputPerMillionUSD },
		func(t *model.ChannelPricingTier) *model.Money { return t.AudioOutputPerMillionUSD },
		func(t *model.ChannelInternalPricingTier) *model.Money { return t.AudioOutputUSDPerMillion }},
	{"image_input", func(t *model.ChannelPricingTier) *model.Money { return t.ImageInputPerMillionUSD },
		func(t *model.ChannelPricingTier) *model.Money { return t.ImageInputPerMillionUSD },
		func(t *model.ChannelInternalPricingTier) *model.Money { return t.ImageInputUSDPerMillion }},
	{"thinking_input", func(t *model.ChannelPricingTier) *model.Money { return t.ThinkingInputPerMillionUSD },
		func(t *model.ChannelPricingTier) *model.Money { return t.ThinkingInputPerMillionUSD },
		func(t *model.ChannelInternalPricingTier) *model.Money { return t.ThinkingInputUSDPerMillion }},
	{"thinking_output", func(t *model.ChannelPricingTier) *model.Money { return t.ThinkingOutputPerMillionUSD },
		func(t *model.ChannelPricingTier) *model.Money { return t.ThinkingOutputPerMillionUSD },
		func(t *model.ChannelInternalPricingTier) *model.Money { return t.ThinkingOutputUSDPerMillion }},
	{"thinking_cache", func(t *model.ChannelPricingTier) *model.Money { return t.ThinkingCachePerMillionUSD },
		func(t *model.ChannelPricingTier) *model.Money { return t.ThinkingCachePerMillionUSD },
		func(t *model.ChannelInternalPricingTier) *model.Money { return t.ThinkingCacheUSDPerMillion }},
	{"thinking_cache_write", func(t *model.ChannelPricingTier) *model.Money { return t.ThinkingCreateCachePerMillionUSD },
		func(t *model.ChannelPricingTier) *model.Money { return t.ThinkingCreateCachePerMillionUSD },
		func(t *model.ChannelInternalPricingTier) *model.Money { return t.ThinkingCreateCacheUSDPerMillion }},
	{"thinking_image_input", func(t *model.ChannelPricingTier) *model.Money { return t.ThinkingImageInputPerMillionUSD },
		func(t *model.ChannelPricingTier) *model.Money { return t.ThinkingImageInputPerMillionUSD },
		func(t *model.ChannelInternalPricingTier) *model.Money { return t.ThinkingImageInputUSDPerMillion }},
	{"multi_input_output", func(t *model.ChannelPricingTier) *model.Money { return t.MultiInputOutputPerMillionUSD },
		func(t *model.ChannelPricingTier) *model.Money { return t.MultiInputOutputPerMillionUSD },
		func(t *model.ChannelInternalPricingTier) *model.Money { return t.MultiInputOutputUSDPerMillion }},
	{"thinking_multi_input_output", func(t *model.ChannelPricingTier) *model.Money { return t.ThinkingMultiInputOutputPerMillionUSD },
		func(t *model.ChannelPricingTier) *model.Money { return t.ThinkingMultiInputOutputPerMillionUSD },
		func(t *model.ChannelInternalPricingTier) *model.Money { return t.ThinkingMultiInputOutputUSDPerMillion }},
	{"per_unit", func(t *model.ChannelPricingTier) *model.Money { return t.PerUnitUSD },
		func(t *model.ChannelPricingTier) *model.Money { return t.PerUnitUSD },
		func(t *model.ChannelInternalPricingTier) *model.Money { return t.PerUnitUSD }},
}

func compareParityDimensions(
	official model.ChannelOfficialPricing,
	internal model.ChannelInternalPricing,
	purchase *model.ChannelPurchaseCost,
	autoDerived bool,
) ([]UpstreamParityDimension, []string) {
	channelTiers := official.ChannelPriceTiers
	if len(channelTiers) == 0 && official.ChannelPrice != nil {
		channelTiers = []model.ChannelPricingTier{*official.ChannelPrice}
	}
	internalTiers := parityInternalTiers(internal)
	purchaseTiers := []model.ChannelInternalPricingTier{}
	if purchase != nil {
		purchaseTiers = parityInternalTiers(purchase.Pricing)
	}
	count := len(official.Tiers)
	if len(channelTiers) > count {
		count = len(channelTiers)
	}
	if count == 0 {
		count = 1
	}
	factor := parityDiscountFactor(official)
	dimensions := make([]UpstreamParityDimension, 0, count*len(parityDimensionSpecs))
	reasons := []string{}
	for i := 0; i < count; i++ {
		suffix := ""
		if count > 1 {
			suffix = fmt.Sprintf("[%d]", i)
		}
		officialTier := parityOfficialTierAt(official.Tiers, i)
		channelTier := parityOfficialTierAt(channelTiers, i)
		internalTier := parityInternalTierAt(internalTiers, i)
		purchaseTier := parityInternalTierAt(purchaseTiers, i)
		dims, mismatches := compareParityTierPair(
			officialTier, channelTier, internalTier, purchaseTier,
			factor, autoDerived, suffix,
		)
		dimensions = append(dimensions, dims...)
		reasons = append(reasons, mismatches...)
	}
	return dimensions, reasons
}

func compareParityTierPair(
	officialTier, channelTier *model.ChannelPricingTier,
	internalTier, purchaseTier *model.ChannelInternalPricingTier,
	discountFactor decimal.Decimal,
	autoDerived bool,
	suffix string,
) ([]UpstreamParityDimension, []string) {
	dimensions := make([]UpstreamParityDimension, 0, len(parityDimensionSpecs))
	reasons := []string{}
	for _, spec := range parityDimensionSpecs {
		officialValue, channelValue, saleValue, purchaseValue := (*model.Money)(nil), (*model.Money)(nil), (*model.Money)(nil), (*model.Money)(nil)
		if officialTier != nil {
			officialValue = spec.official(officialTier)
		}
		if channelTier != nil {
			channelValue = spec.channel(channelTier)
		}
		if internalTier != nil {
			saleValue = spec.internal(internalTier)
		}
		if purchaseTier != nil {
			purchaseValue = spec.internal(purchaseTier)
		}
		if officialValue == nil && channelValue == nil && saleValue == nil && purchaseValue == nil {
			continue
		}
		dimension := UpstreamParityDimension{
			Name:        spec.name + suffix,
			OfficialUSD: parityMoneyString(officialValue),
			ChannelUSD:  parityMoneyString(channelValue),
			PurchaseUSD: parityMoneyString(purchaseValue),
			SaleUSD:     parityMoneyString(saleValue),
		}
		if officialValue != nil && channelValue != nil {
			expected := parityScaleMoney(officialValue, discountFactor)
			dimension.ExpectedChannelUSD = parityMoneyString(expected)
			if !parityMoneyEqual(channelValue, expected) {
				dimension.Mismatch = true
				dimension.Reason = fmt.Sprintf("channel %s=%s but official %s=%s × discount=%s",
					dimension.Name, dimension.ChannelUSD, dimension.Name, dimension.OfficialUSD, dimension.ExpectedChannelUSD)
			}
		}
		if autoDerived && channelValue != nil && saleValue != nil {
			expectedSale := parityScaleMoney(channelValue, defaultUterSaleMarkupDecimal)
			dimension.ExpectedSaleUSD = parityMoneyString(expectedSale)
			if !parityMoneyEqual(saleValue, expectedSale) {
				dimension.Mismatch = true
				dimension.Reason = fmt.Sprintf("auto sale %s=%s but channel %s × default markup=%s",
					dimension.Name, dimension.SaleUSD, dimension.ChannelUSD, dimension.ExpectedSaleUSD)
			}
		}
		if dimension.Mismatch {
			reasons = append(reasons, dimension.Reason)
		}
		dimensions = append(dimensions, dimension)
	}
	return dimensions, reasons
}

func parityStructureReasons(official model.ChannelOfficialPricing, internal model.ChannelInternalPricing) []string {
	reasons := []string{}
	currency := strings.ToUpper(strings.TrimSpace(official.NormalizedCurrency))
	if currency == "" {
		currency = strings.ToUpper(strings.TrimSpace(official.Currency))
	}
	if currency != "" && currency != "USD" {
		reasons = append(reasons, fmt.Sprintf("price currency %s is not normalized to USD", currency))
	}
	if official.DiscountRatio != nil {
		value := *official.DiscountRatio
		if math.IsNaN(value) || math.IsInf(value, 0) || value <= 0 {
			reasons = append(reasons, "channel discount ratio is not finite and positive")
		}
	}
	units := map[string]struct{}{}
	addUnit := func(unit string) {
		normalized := parityNormalizeUnit(unit)
		if normalized != "" {
			units[normalized] = struct{}{}
		}
	}
	addUnit(official.Unit)
	for _, tier := range official.Tiers {
		addUnit(tier.Unit)
	}
	for _, tier := range official.ChannelPriceTiers {
		addUnit(tier.Unit)
	}
	if official.ChannelPrice != nil {
		addUnit(official.ChannelPrice.Unit)
	}
	if len(units) > 1 {
		listed := make([]string, 0, len(units))
		for unit := range units {
			listed = append(listed, unit)
		}
		sort.Strings(listed)
		reasons = append(reasons, "official and channel tiers use inconsistent units: "+strings.Join(listed, ", "))
	}
	channelUnit := parityNormalizeUnit(official.Unit)
	for _, tier := range official.ChannelPriceTiers {
		if normalized := parityNormalizeUnit(tier.Unit); normalized != "" {
			channelUnit = normalized
			break
		}
	}
	if official.ChannelPrice != nil && channelUnit == "" {
		channelUnit = parityNormalizeUnit(official.ChannelPrice.Unit)
	}
	if channelUnit != "" && !parityUnitsCompatible(channelUnit, internal.Mode) {
		reasons = append(reasons, fmt.Sprintf("channel unit %s cannot bill as internal mode %s", channelUnit, internal.Mode))
	}
	if len(official.Tiers) > 1 {
		if len(official.ChannelPriceTiers) == 0 && official.ChannelPrice != nil {
			reasons = append(reasons, "multi-tier official price was collapsed into a single channel tier")
		} else if len(official.ChannelPriceTiers) > 0 && len(official.ChannelPriceTiers) != len(official.Tiers) {
			reasons = append(reasons, fmt.Sprintf("channel tier count %d does not match official tier count %d",
				len(official.ChannelPriceTiers), len(official.Tiers)))
		}
	}
	if strings.TrimSpace(official.BillingExpr) != "" && official.ExpressionStatus != "" &&
		official.ExpressionStatus != UpstreamExpressionExecutable {
		reasons = append(reasons, "upstream expression status is "+official.ExpressionStatus)
	}
	return reasons
}

func parityInternalTiers(pricing model.ChannelInternalPricing) []model.ChannelInternalPricingTier {
	if len(pricing.Tiers) > 0 {
		return pricing.Tiers
	}
	tier := model.ChannelInternalPricingTier{
		InputUSDPerMillion:                    pricing.InputUSDPerMillion,
		OutputUSDPerMillion:                   pricing.OutputUSDPerMillion,
		CacheUSDPerMillion:                    pricing.CacheUSDPerMillion,
		CreateCacheUSDPerMillion:              pricing.CreateCacheUSDPerMillion,
		AudioInputUSDPerMillion:               pricing.AudioInputUSDPerMillion,
		AudioOutputUSDPerMillion:              pricing.AudioOutputUSDPerMillion,
		ImageInputUSDPerMillion:               pricing.ImageInputUSDPerMillion,
		ThinkingInputUSDPerMillion:            pricing.ThinkingInputUSDPerMillion,
		ThinkingOutputUSDPerMillion:           pricing.ThinkingOutputUSDPerMillion,
		ThinkingCacheUSDPerMillion:            pricing.ThinkingCacheUSDPerMillion,
		ThinkingCreateCacheUSDPerMillion:      pricing.ThinkingCreateCacheUSDPerMillion,
		ThinkingImageInputUSDPerMillion:       pricing.ThinkingImageInputUSDPerMillion,
		MultiInputOutputUSDPerMillion:         pricing.MultiInputOutputUSDPerMillion,
		ThinkingMultiInputOutputUSDPerMillion: pricing.ThinkingMultiInputOutputUSDPerMillion,
		Unit:                                  pricing.Mode,
	}
	switch pricing.Mode {
	case model.ChannelPricingModePerCall:
		tier.PerUnitUSD = pricing.PerCallUSD
	case model.ChannelPricingModePerSecond:
		tier.PerUnitUSD = pricing.PerSecondUSD
	case model.ChannelPricingModePerMinute:
		tier.PerUnitUSD = pricing.PerMinuteUSD
	}
	return []model.ChannelInternalPricingTier{tier}
}

func parityOfficialTierAt(tiers []model.ChannelPricingTier, index int) *model.ChannelPricingTier {
	if index < 0 || index >= len(tiers) {
		return nil
	}
	return &tiers[index]
}

func parityInternalTierAt(tiers []model.ChannelInternalPricingTier, index int) *model.ChannelInternalPricingTier {
	if index < 0 || index >= len(tiers) {
		return nil
	}
	return &tiers[index]
}

func parityDiscountFactor(official model.ChannelOfficialPricing) decimal.Decimal {
	if official.DiscountRatio == nil {
		return decimal.NewFromInt(1)
	}
	value := *official.DiscountRatio
	if math.IsNaN(value) || math.IsInf(value, 0) || value <= 0 {
		return decimal.NewFromInt(1)
	}
	return decimal.RequireFromString(strconv.FormatFloat(value, 'f', -1, 64))
}

func parityScaleMoney(value *model.Money, factor decimal.Decimal) *model.Money {
	if value == nil {
		return nil
	}
	scaled := value.MulDecimal(factor)
	return &scaled
}

func parityMoneyEqual(a, b *model.Money) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	delta := a.Decimal().Sub(b.Decimal()).Abs()
	return delta.LessThanOrEqual(parityMoneyTolerance)
}

func parityMoneyString(value *model.Money) string {
	if value == nil {
		return ""
	}
	return value.Decimal().String()
}

func parityNormalizeUnit(unit string) string {
	switch strings.ToLower(strings.TrimSpace(unit)) {
	case "per_1m_tokens", "per_1m_token", "per_million_token", "per_million_tokens":
		return "per_1m_token"
	case "per_second", "per_s":
		return "per_second"
	case "per_minute", "per_m":
		return "per_minute"
	case "per_call", "per_request":
		return "per_call"
	default:
		return strings.ToLower(strings.TrimSpace(unit))
	}
}

func parityUnitsCompatible(channelUnit, internalMode string) bool {
	normalizedMode := parityNormalizeUnit(internalMode)
	if normalizedMode == model.ChannelPricingModeTieredExpr || normalizedMode == model.ChannelPricingModeTieredTable {
		return true
	}
	if channelUnit == "" || normalizedMode == "" {
		return true
	}
	return channelUnit == normalizedMode
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
		if item.HasChannelPrice && !item.HasInternalPrice {
			return "channel quote exists but no configured sale price"
		}
		return "channel price and sale price are inconsistent"
	case UpstreamParityUnsupported:
		return "upstream billing expression is unsupported by Uter"
	case UpstreamParityManualReview:
		return "price shape or source needs operator review"
	case UpstreamParityRuleMismatch:
		return "internal billing expression is not executable"
	case UpstreamParityPurchaseUnverified:
		return "sale price is configured but the purchase cost is not operator-verified; margin is unavailable"
	case UpstreamParityDiscountMismatch:
		return "channel discount differs from the upstream group ratio"
	case UpstreamParityIdentityMismatch:
		return "pricing identity does not match the upstream model identity"
	case UpstreamParityStale:
		return "upstream price is older than the freshness window"
	default:
		return ""
	}
}

// OrphanPricingAudit reports pricing rows whose channel no longer exists.
type OrphanPricingAudit struct {
	Total    int64                        `json:"total"`
	Channels []model.ChannelPricingOrphan `json:"channels"`
}

// AuditOrphanChannelPricing lists orphaned channel pricing rows. It is
// read-only; production cleanup requires a separate backup-and-preview step.
func AuditOrphanChannelPricing() (OrphanPricingAudit, error) {
	rows, err := model.ListOrphanChannelPricing()
	if err != nil {
		return OrphanPricingAudit{}, err
	}
	audit := OrphanPricingAudit{Channels: rows}
	for _, row := range rows {
		audit.Total += row.Count
	}
	return audit, nil
}

// OrphanPricingExport is the read-only backup/preview payload for orphan rows.
type OrphanPricingExport struct {
	GeneratedAt int64                       `json:"generated_at"`
	Total       int64                       `json:"total"`
	Rows        []model.ChannelModelPricing `json:"rows"`
}

// ExportOrphanChannelPricing returns every orphan row for backup. It never
// deletes or modifies production data.
func ExportOrphanChannelPricing(now time.Time) (OrphanPricingExport, error) {
	rows, err := model.ListOrphanChannelPricingRows()
	if err != nil {
		return OrphanPricingExport{}, err
	}
	return OrphanPricingExport{GeneratedAt: now.Unix(), Total: int64(len(rows)), Rows: rows}, nil
}
