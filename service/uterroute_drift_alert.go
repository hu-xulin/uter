package service

import (
	"sort"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
)

// DefaultUterRouteOfficialDriftPercent is the second line of defence for
// UterRoute official prices. The strict cross-check against Uter's sale-price
// baseline is deliberately exempted for `uterroute-` rows (the two are
// different measures), so an abnormal upstream unit price would otherwise be
// trusted without any numeric guard. A relative move above this threshold is
// escalated to a human pricing review instead of failing the sync outright.
const DefaultUterRouteOfficialDriftPercent = 50

// UterRouteOfficialPriceDriftChanges compares absolute official price tiers
// between two snapshots from the SAME provider. It intentionally does NOT
// compare against Uter's synchronized sale-price baseline: that baseline is a
// different measure and was the source of mass false positives.
//
// Only models present in both snapshots with a priced "before" row produce
// changes; a first-time price is a model_added event, not a drift. A positive
// price that disappears is reported with New=0 so the loss is fail-closed.
func UterRouteOfficialPriceDriftChanges(prev, next *UpstreamSnapshot) []UpstreamPriceChange {
	if next == nil {
		return nil
	}
	prevByName := make(map[string]UpstreamModelRecord)
	if prev != nil {
		for _, item := range prev.Models {
			prevByName[item.ModelName] = item
		}
	}
	now := time.Now().UTC()
	changes := make([]UpstreamPriceChange, 0)
	for _, item := range next.Models {
		before, ok := prevByName[item.ModelName]
		if !ok || before.OfficialPrice == nil {
			continue
		}
		after := item.OfficialPrice // nil means all tiers were lost
		tiers := []struct {
			field string
			old   *float64
			new   *float64
		}{
			{"official_input_usd", before.OfficialPrice.Input, priceLineValue(after, func(p *UpstreamPriceLine) *float64 { return p.Input })},
			{"official_output_usd", before.OfficialPrice.Output, priceLineValue(after, func(p *UpstreamPriceLine) *float64 { return p.Output })},
			{"official_cache_read_usd", before.OfficialPrice.CacheRead, priceLineValue(after, func(p *UpstreamPriceLine) *float64 { return p.CacheRead })},
			{"official_cache_write_usd", before.OfficialPrice.CacheWrite, priceLineValue(after, func(p *UpstreamPriceLine) *float64 { return p.CacheWrite })},
		}
		for _, tier := range tiers {
			if tier.old == nil || *tier.old <= 0 {
				continue
			}
			newValue := float64(0)
			if tier.new != nil {
				newValue = *tier.new
			}
			if *tier.old == newValue {
				continue
			}
			changes = append(changes, UpstreamPriceChange{
				ProviderID:     next.ProviderID,
				ModelID:        item.ModelName,
				Kind:           "price_changed",
				Field:          tier.field,
				Old:            tier.old,
				New:            &newValue,
				DetectedAt:     now,
				PricingVersion: next.PricingVersion,
			})
		}
	}
	sort.Slice(changes, func(i, j int) bool {
		if changes[i].ModelID != changes[j].ModelID {
			return changes[i].ModelID < changes[j].ModelID
		}
		return changes[i].Field < changes[j].Field
	})
	return changes
}

// priceLineValue reads one tier from a possibly absent price line.
func priceLineValue(line *UpstreamPriceLine, read func(*UpstreamPriceLine) *float64) *float64 {
	if line == nil {
		return nil
	}
	return read(line)
}

// expandUterRouteDriftToServedNames rewrites upstream model names in drift
// changes to the request aliases this channel actually serves. Price rows are
// keyed by the request alias (batch redirects replace the model list), so a
// review keyed by the upstream name would never match its price row.
func expandUterRouteDriftToServedNames(
	changes []UpstreamPriceChange,
	channelModels []string,
	modelMapping string,
) []UpstreamPriceChange {
	if len(changes) == 0 {
		return changes
	}
	var mapping map[string]string
	if strings.TrimSpace(modelMapping) != "" {
		if err := common.UnmarshalJsonStr(modelMapping, &mapping); err != nil {
			mapping = nil
		}
	}
	servedByUpstream := make(map[string][]string, len(channelModels))
	seen := make(map[string]bool, len(channelModels))
	for _, name := range channelModels {
		name = strings.TrimSpace(name)
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true
		upstream, cyclic := followUterRouteModelMapping(mapping, name)
		if cyclic || upstream == "" {
			upstream = name
		}
		servedByUpstream[upstream] = append(servedByUpstream[upstream], name)
	}

	out := make([]UpstreamPriceChange, 0, len(changes))
	for _, change := range changes {
		served := servedByUpstream[change.ModelID]
		if len(served) == 0 {
			// A model the channel does not serve must not raise a review for it.
			if len(channelModels) > 0 {
				continue
			}
			served = []string{change.ModelID}
		}
		for _, name := range served {
			expanded := change
			expanded.ModelID = name
			out = append(out, expanded)
		}
	}
	return out
}

// excludeModelsAwaitingReview removes models that have a pending pricing
// review from the automatic repricing set. A drift already escalated to a
// human must not be silently applied by the scheduled rule before that human
// confirms it — otherwise the "alert + confirm" guard is decorative.
func excludeModelsAwaitingReview(changed []string, pending []ChannelPricingReviewEntry) []string {
	if len(changed) == 0 || len(pending) == 0 {
		return changed
	}
	blocked := make(map[string]bool, len(pending))
	for _, entry := range pending {
		name := strings.TrimSpace(entry.ModelName)
		if name != "" {
			blocked[name] = true
		}
	}
	out := make([]string, 0, len(changed))
	for _, name := range changed {
		if !blocked[strings.TrimSpace(name)] {
			out = append(out, name)
		}
	}
	return out
}

// RecordUterRouteDriftReviews escalates absolute-price drift above the
// threshold into human pricing reviews. Reviews replace the pending entry for
// the same channel/model/field and notify administrators; delivery failures
// never block the sync. It returns the number of reviews raised.
func RecordUterRouteDriftReviews(
	prev, next *UpstreamSnapshot,
	channelID int,
	channelModels []string,
	modelMapping string,
	thresholdPercent float64,
) (int, error) {
	changes := UterRouteOfficialPriceDriftChanges(prev, next)
	changes = expandUterRouteDriftToServedNames(changes, channelModels, modelMapping)
	if thresholdPercent <= 0 {
		thresholdPercent = DefaultUterRouteOfficialDriftPercent
	}
	reviews := BuildChannelPricingReviews(changes, channelID, channelModels, thresholdPercent)
	if len(reviews) == 0 {
		return 0, nil
	}
	if err := AppendChannelPricingReviews(reviews); err != nil {
		return 0, err
	}
	return len(reviews), nil
}
