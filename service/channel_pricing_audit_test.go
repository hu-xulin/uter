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
)

func parityRow(t *testing.T, name string, view model.ChannelOfficialPricing, fetchedAt int64) model.ChannelModelPricing {
	t.Helper()
	normalized, err := common.Marshal(view)
	require.NoError(t, err)
	internal, err := common.Marshal(model.ChannelInternalPricing{
		Mode: model.ChannelPricingModePerMillionTokens, InputUSDPerMillion: auditFloatPtr(3),
	})
	require.NoError(t, err)
	return model.ChannelModelPricing{
		ChannelId: 7, ModelName: name, PricingStatus: model.ChannelPricingStatusConfigured,
		NormalizedPricing: string(normalized), InternalPricing: string(internal), FetchedAt: fetchedAt,
	}
}

func auditFloatPtr(value float64) *float64 { return &value }

func TestBuildUpstreamParityReportSeparatesOfficialAndChannelPrices(t *testing.T) {
	now := time.Unix(10_000_000, 0)
	input := auditFloatPtr(3)
	rows := []model.ChannelModelPricing{
		parityRow(t, "official-only", model.ChannelOfficialPricing{
			PriceKind: "OFFICIAL_ABSOLUTE",
			Tiers:     []model.ChannelPricingTier{{RangeName: "base", InputPerMillionUSD: input, Unit: "per_1m_token"}},
		}, now.Unix()),
		parityRow(t, "channel-quote", model.ChannelOfficialPricing{
			PriceKind:         "CHANNEL_QUOTE",
			ChannelPriceTiers: []model.ChannelPricingTier{{RangeName: "base", InputPerMillionUSD: input, Unit: "per_1m_token"}},
		}, now.Unix()),
		parityRow(t, "ratio-estimate", model.ChannelOfficialPricing{
			PriceKind: "RATIO_ONLY",
			Tiers:     []model.ChannelPricingTier{{RangeName: "base", InputPerMillionUSD: input, Unit: "per_1m_token"}},
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
		Tiers:     []model.ChannelPricingTier{{RangeName: "base", InputPerMillionUSD: input, Unit: "per_1m_token"}},
	}, now.Add(-47*time.Hour).Unix())
	stale := parityRow(t, "stale", model.ChannelOfficialPricing{
		PriceKind: "OFFICIAL_ABSOLUTE",
		Tiers:     []model.ChannelPricingTier{{RangeName: "base", InputPerMillionUSD: input, Unit: "per_1m_token"}},
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
