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
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/relaykit/dto"
)

func parityRow(t *testing.T, name string, view model.ChannelOfficialPricing, fetchedAt int64) model.ChannelModelPricing {
	t.Helper()
	normalized, err := common.Marshal(view)
	require.NoError(t, err)
	internal, err := common.Marshal(model.ChannelInternalPricing{
		Mode:               model.ChannelPricingModePerMillionTokens,
		InputUSDPerMillion: model.MoneyFromFloatPtr(auditFloatPtr(3.3)),
		Source:             "bailian-official",
	})
	require.NoError(t, err)
	// A row can only be FULLY_MATCHED when its purchase cost is verified.
	// Fixtures representing a correctly reconciled model therefore carry an
	// operator-confirmed contract cost; unverified scenarios build rows by hand.
	purchase, err := common.Marshal(model.ChannelPurchaseCost{
		Pricing: model.ChannelInternalPricing{
			Mode: model.ChannelPricingModePerMillionTokens, InputUSDPerMillion: model.MoneyFromFloatPtr(auditFloatPtr(2)),
		},
		Verified: true, Source: "contract",
	})
	require.NoError(t, err)
	return model.ChannelModelPricing{
		ChannelId: 7, ModelName: name, PricingStatus: model.ChannelPricingStatusConfigured,
		PricingSource: "bailian-official", NormalizedPricing: string(normalized),
		InternalPricing: string(internal), PurchasePricing: string(purchase), FetchedAt: fetchedAt,
	}
}

func auditFloatPtr(value float64) *float64 { return &value }

// TestPricingAuditRespectsExplicitPricingMode proves the audit page reports the
// same pricing authority the billing path enforces. Previously it inferred
// authority from row presence, so a CHANNEL_SCOPED_PENDING/ACTIVE channel was
// shown as "global" while the runtime blocked every charge on it.
func TestPricingAuditRespectsExplicitPricingMode(t *testing.T) {
	validInternal, err := common.Marshal(model.ChannelInternalPricing{
		Mode:                model.ChannelPricingModePerMillionTokens,
		InputUSDPerMillion:  model.MoneyFromFloatPtr(auditFloatPtr(2)),
		OutputUSDPerMillion: model.MoneyFromFloatPtr(auditFloatPtr(4)),
	})
	require.NoError(t, err)
	configured := []model.ChannelModelPricing{{
		ModelName: "m1", PricingStatus: model.ChannelPricingStatusConfigured,
		InternalPricing: string(validInternal),
		LifecycleStatus: model.ChannelModelLifecycleActive,
	}}

	pending := BuildChannelPricingAudit(80, "pending", dto.ChannelPricingModeScopedPending, configured)
	assert.Equal(t, "channel_model_pricing", pending.Authority)
	require.Len(t, pending.Models, 1)
	assert.False(t, pending.Models[0].Billable, "PENDING must block every charge")

	active := BuildChannelPricingAudit(79, "active", dto.ChannelPricingModeScopedActive, configured)
	assert.Equal(t, "channel_model_pricing", active.Authority)
	assert.True(t, active.Models[0].Billable)

	legacy := BuildChannelPricingAudit(79, "legacy", dto.ChannelPricingModeGlobalLegacy, configured)
	assert.Equal(t, "global", legacy.Authority, "GLOBAL_LEGACY keeps pre-isolation behaviour")

	// Scoped channel with no rows must be visible as blocked, never as global.
	empty := BuildChannelPricingAudit(81, "empty-scoped", dto.ChannelPricingModeScopedActive, nil)
	assert.Equal(t, "channel_model_pricing", empty.Authority)
	assert.NotEmpty(t, empty.Warnings)
	assert.Empty(t, empty.Models)
}

func TestBuildUpstreamParityReportSeparatesOfficialAndChannelPrices(t *testing.T) {
	now := time.Unix(10_000_000, 0)
	input := auditFloatPtr(3)
	rows := []model.ChannelModelPricing{
		parityRow(t, "official-only", model.ChannelOfficialPricing{
			PriceKind: "OFFICIAL_ABSOLUTE",
			Tiers:     []model.ChannelPricingTier{{RangeName: "base", InputPerMillionUSD: model.MoneyFromFloatPtr(input), Unit: "per_1m_token"}},
		}, now.Unix()),
		parityRow(t, "channel-quote", model.ChannelOfficialPricing{
			PriceKind:         "CHANNEL_QUOTE",
			ChannelPriceTiers: []model.ChannelPricingTier{{RangeName: "base", InputPerMillionUSD: model.MoneyFromFloatPtr(input), Unit: "per_1m_token"}},
		}, now.Unix()),
		parityRow(t, "ratio-estimate", model.ChannelOfficialPricing{
			PriceKind: "RATIO_ONLY",
			Tiers:     []model.ChannelPricingTier{{RangeName: "base", InputPerMillionUSD: model.MoneyFromFloatPtr(input), Unit: "per_1m_token"}},
		}, now.Unix()),
	}

	report := BuildUpstreamParityReport(7, "apiko", rows, now)
	byName := map[string]UpstreamParityModel{}
	for _, item := range report.Models {
		byName[item.ModelName] = item
	}

	assert.True(t, byName["official-only"].HasOfficial)
	assert.False(t, byName["official-only"].HasChannelPrice)
	assert.Equal(t, UpstreamParityFullyMatched, byName["official-only"].Status)

	assert.False(t, byName["channel-quote"].HasOfficial)
	assert.True(t, byName["channel-quote"].HasChannelPrice)
	assert.Equal(t, UpstreamParityFullyMatched, byName["channel-quote"].Status)

	assert.False(t, byName["ratio-estimate"].HasOfficial)
	assert.True(t, byName["ratio-estimate"].HasOfficialEstimate)
	assert.Equal(t, UpstreamParityPriceMismatch, byName["ratio-estimate"].Status)
}

func TestBuildUpstreamParityReportUses48HourFreshness(t *testing.T) {
	now := time.Unix(10_000_000, 0)
	input := auditFloatPtr(3)
	fresh := parityRow(t, "fresh", model.ChannelOfficialPricing{
		PriceKind: "OFFICIAL_ABSOLUTE",
		Tiers:     []model.ChannelPricingTier{{RangeName: "base", InputPerMillionUSD: model.MoneyFromFloatPtr(input), Unit: "per_1m_token"}},
	}, now.Add(-47*time.Hour).Unix())
	stale := parityRow(t, "stale", model.ChannelOfficialPricing{
		PriceKind: "OFFICIAL_ABSOLUTE",
		Tiers:     []model.ChannelPricingTier{{RangeName: "base", InputPerMillionUSD: model.MoneyFromFloatPtr(input), Unit: "per_1m_token"}},
	}, now.Add(-49*time.Hour).Unix())

	report := BuildUpstreamParityReport(7, "apiko", []model.ChannelModelPricing{fresh, stale}, now)
	byName := map[string]UpstreamParityModel{}
	for _, item := range report.Models {
		byName[item.ModelName] = item
	}
	assert.False(t, byName["fresh"].Stale)
	assert.Equal(t, UpstreamParityFullyMatched, byName["fresh"].Status)
	assert.True(t, byName["stale"].Stale)
	assert.Equal(t, UpstreamParityStale, byName["stale"].Status)
}

func TestBuildUpstreamParityReportWithCatalogFindsMissingModels(t *testing.T) {
	now := time.Unix(10_000_000, 0)
	input := auditFloatPtr(3)
	rows := []model.ChannelModelPricing{
		parityRow(t, "existing", model.ChannelOfficialPricing{
			PriceKind: "OFFICIAL_ABSOLUTE",
			Tiers:     []model.ChannelPricingTier{{RangeName: "base", InputPerMillionUSD: model.MoneyFromFloatPtr(input), Unit: "per_1m_token"}},
		}, now.Unix()),
	}

	report := BuildUpstreamParityReportWithCatalog(
		7, "apiko", rows, []string{"existing", "new-upstream-model"}, now,
	)
	require.True(t, report.CatalogCompared)
	assert.Equal(t, 2, report.UpstreamModelCount)
	assert.Equal(t, 1, report.Summary[UpstreamParityModelMissing])
	byName := map[string]UpstreamParityModel{}
	for _, item := range report.Models {
		byName[item.ModelName] = item
	}
	assert.Equal(t, UpstreamParityFullyMatched, byName["existing"].Status)
	assert.Equal(t, UpstreamParityModelMissing, byName["new-upstream-model"].Status)
}
