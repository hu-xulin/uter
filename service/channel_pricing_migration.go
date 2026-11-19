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
	"sort"
	"strings"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/custom_pricing"
)

// LegacyQuoteMigrationItem is one read-only migration decision. The plan never
// writes prices; it only states whether a legacy quote has an unambiguous
// absolute amount that can be represented by the new channel pricing table.
type LegacyQuoteMigrationItem struct {
	ModelName     string   `json:"model_name"`
	Unit          string   `json:"unit,omitempty"`
	ChannelPrice  *float64 `json:"channel_price,omitempty"`
	OfficialPrice *float64 `json:"official_price,omitempty"`
	Status        string   `json:"status,omitempty"`
	CanMigrate    bool     `json:"can_migrate"`
	Reason        string   `json:"reason,omitempty"`
}

// BuildLegacyQuoteMigrationPlan evaluates every legacy quote in one channel
// config. Discount-only and expression-based quotes stay manual because a
// single absolute amount would lose their pricing shape.
func BuildLegacyQuoteMigrationPlan(config *custom_pricing.ChannelPriceConfig) []LegacyQuoteMigrationItem {
	if config == nil || len(config.Quotes) == 0 {
		return []LegacyQuoteMigrationItem{}
	}
	names := make([]string, 0, len(config.Quotes))
	for name := range config.Quotes {
		names = append(names, name)
	}
	sort.Strings(names)
	items := make([]LegacyQuoteMigrationItem, 0, len(names))
	for _, name := range names {
		quote := config.Quotes[name]
		item := LegacyQuoteMigrationItem{
			ModelName: name, Unit: quote.Unit, ChannelPrice: quote.ChannelPrice,
			OfficialPrice: quote.OfficialPrice, Status: legacyQuoteStatus(quote),
		}
		switch {
		case quote.Status == custom_pricing.ChannelQuoteStatusNeedsReview || strings.TrimSpace(quote.BillingExpr) != "":
			item.Reason = "tiered or reviewable quote cannot be flattened"
		case quote.ChannelPrice == nil:
			item.Reason = "legacy quote has no absolute channel price"
		case quote.Unit != "" && quote.Unit != "per_1m_token" && quote.Unit != "per_call":
			item.Reason = "unsupported legacy price unit"
		case quote.ChannelPrice != nil && *quote.ChannelPrice < 0:
			item.Reason = "negative channel price"
		default:
			item.CanMigrate = true
			item.Reason = "absolute channel price can be stored as a channel quote"
		}
		items = append(items, item)
	}
	return items
}

// LegacyQuoteMigrationResult reports a dry-run or applied migration.
type LegacyQuoteMigrationResult struct {
	ChannelID int                        `json:"channel_id"`
	DryRun    bool                       `json:"dry_run"`
	Migrated  []LegacyQuoteMigrationItem `json:"migrated"`
	Pending   []LegacyQuoteMigrationItem `json:"pending"`
}

// ApplyLegacyQuoteMigration copies migratable legacy quotes into the new
// normalized channel-price block. Official list prices and internal sale prices
// are not changed.
func ApplyLegacyQuoteMigration(channelID int, dryRun bool) (*LegacyQuoteMigrationResult, error) {
	config, ok := custom_pricing.GetChannelConfig(channelID)
	if !ok {
		return &LegacyQuoteMigrationResult{ChannelID: channelID, DryRun: dryRun}, nil
	}
	plan := BuildLegacyQuoteMigrationPlan(&config)
	result := &LegacyQuoteMigrationResult{
		ChannelID: channelID, DryRun: dryRun,
		Migrated: []LegacyQuoteMigrationItem{}, Pending: []LegacyQuoteMigrationItem{},
	}
	for _, item := range plan {
		if !item.CanMigrate {
			result.Pending = append(result.Pending, item)
			continue
		}
		quote := config.Quotes[item.ModelName]
		if !dryRun {
			view := model.ChannelOfficialPricing{Currency: "USD", Source: "legacy:ChannelPriceSetting"}
			if existing, err := model.GetChannelModelPricing(channelID, item.ModelName); err == nil && strings.TrimSpace(existing.NormalizedPricing) != "" {
				_ = common.UnmarshalJsonStr(existing.NormalizedPricing, &view)
			}
			tier := model.ChannelPricingTier{RangeName: "legacy", Unit: quote.Unit}
			if quote.Unit == "per_call" {
				tier.Unit = "per_call"
				tier.PerUnitUSD = item.ChannelPrice
			} else {
				tier.Unit = "per_1m_token"
				tier.InputPerMillionUSD = item.ChannelPrice
			}
			view.ChannelPrice = &tier
			view.DiscountGroup = "legacy:ChannelPriceSetting"
			if err := model.UpdateChannelOfficialPricingView(channelID, item.ModelName, view); err != nil {
				item.CanMigrate = false
				item.Reason = err.Error()
				result.Pending = append(result.Pending, item)
				continue
			}
		}
		result.Migrated = append(result.Migrated, item)
	}
	return result, nil
}
