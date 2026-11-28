package service

import (
	"fmt"
	"strings"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// NeedsReviewRow is one historical needs_review price row, classified for a
// remediation tool. It is read-only: the tool never rewrites a row that needs
// a human decision (tiered prices, missing channel price, unknown reasons).
type NeedsReviewRow struct {
	ModelName     string   `json:"model_name"`
	Provider      string   `json:"provider"`
	Reasons       []string `json:"reasons"`
	HasChannelPrice bool   `json:"has_channel_price"`
	Executable    bool     `json:"executable"`
	Remediable    bool     `json:"remediable"`
	Classification string  `json:"classification"`
	PricingSource string   `json:"pricing_source"`
	PricingOwner  string   `json:"pricing_owner"`
}

// NeedsReviewInspection is the exported, read-only result for one channel.
type NeedsReviewInspection struct {
	ChannelID  int              `json:"channel_id"`
	Scanned    int              `json:"scanned"`
	NeedsReview int             `json:"needs_review"`
	Remediable []NeedsReviewRow `json:"remediable"`
	Manual     []NeedsReviewRow `json:"needs_human_decision"`
}

// needsReviewClassifications explains why a row is safe or unsafe to auto-fix.
const (
	needsReviewClassRemediable = "remediable_known_false_positive"
	needsReviewClassTiered     = "manual_tiered_price"
	needsReviewClassNoChannel  = "manual_missing_channel_price"
	needsReviewClassUnknown    = "manual_unknown_reason"
)

// InspectNeedsReviewPricing builds a read-only classification of a channel's
// historical needs_review rows. Rows with multiple/tiered prices or no channel
// quote are explicitly parked for a human; only the single known cross-check
// false-positive reason on an authoritative list price is remediable, and even
// then this function never writes — it only reports what a confirmed apply
// would be allowed to touch.
func InspectNeedsReviewPricing(channelID int) (NeedsReviewInspection, error) {
	result := NeedsReviewInspection{ChannelID: channelID}
	if channelID <= 0 {
		return result, fmt.Errorf("channel id is required")
	}
	if model.DB == nil {
		return result, fmt.Errorf("pricing database is not initialized")
	}
	rows, err := model.ListChannelModelPricing(channelID)
	if err != nil {
		return result, err
	}
	result.Scanned = len(rows)
	for _, row := range rows {
		if row.PricingStatus != model.ChannelPricingStatusNeedsReview {
			continue
		}
		result.NeedsReview++
		item := NeedsReviewRow{
			ModelName: row.ModelName, Provider: row.Provider,
			PricingSource: row.PricingSource, PricingOwner: row.PricingOwner,
			Classification: needsReviewClassUnknown,
		}
		var view model.ChannelOfficialPricing
		if err := common.UnmarshalJsonStr(row.NormalizedPricing, &view); err == nil {
			item.Reasons = append([]string(nil), view.ReviewReasons...)
			item.HasChannelPrice = view.ChannelPrice != nil && len(view.Tiers) > 0
			switch {
			case authoritativeBailianFalsePositive(view):
				item.Classification = needsReviewClassRemediable
				item.Remediable = true
				item.Executable = true
			case len(view.Tiers) > 1:
				item.Classification = needsReviewClassTiered
			case !item.HasChannelPrice:
				item.Classification = needsReviewClassNoChannel
			}
		}
		if item.Remediable {
			result.Remediable = append(result.Remediable, item)
		} else {
			result.Manual = append(result.Manual, item)
		}
	}
	return result, nil
}

// authoritativeBailianFalsePositive mirrors the narrow rejudge constraint:
// one exact known reason, an authoritative vendor list price, no other reason.
func authoritativeBailianFalsePositive(view model.ChannelOfficialPricing) bool {
	if !model.IsAuthoritativeOfficialList(view) {
		return false
	}
	found := false
	for _, reason := range view.ReviewReasons {
		trimmed := strings.TrimSpace(reason)
		if trimmed == bailianCrossCheckInputDisagreementReason {
			found = true
			continue
		}
		if trimmed != "" {
			return false
		}
	}
	return found
}
