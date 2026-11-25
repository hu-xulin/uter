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
	"context"
	"math"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/operation_setting"
)

func fxTestFloat(value float64) *float64 { return &value }

func fxTestRecord(
	t *testing.T,
	internal model.ChannelInternalPricing,
	official model.ChannelOfficialPricing,
) model.ChannelOfficialPricingRecord {
	t.Helper()
	internalRaw, err := common.Marshal(internal)
	require.NoError(t, err)
	officialRaw, err := common.Marshal(official)
	require.NoError(t, err)
	return model.ChannelOfficialPricingRecord{
		ModelName:         "test-model",
		InternalPricing:   string(internalRaw),
		NormalizedPricing: string(officialRaw),
	}
}

func withFXRate(t *testing.T, rate float64) {
	t.Helper()
	previous := operation_setting.USDExchangeRate
	operation_setting.USDExchangeRate = rate
	t.Cleanup(func() { operation_setting.USDExchangeRate = previous })
}

func TestApplyUterAPICreditExchangeRateScalesChannelPriceOnly(t *testing.T) {
	withFXRate(t, 5)

	record := fxTestRecord(t,
		model.ChannelInternalPricing{
			Mode:                model.ChannelPricingModePerMillionTokens,
			InputUSDPerMillion:  model.MoneyFromFloatPtr(fxTestFloat(10)),
			OutputUSDPerMillion: model.MoneyFromFloatPtr(fxTestFloat(50)),
			CacheUSDPerMillion:  model.MoneyFromFloatPtr(fxTestFloat(1)),
		},
		model.ChannelOfficialPricing{
			Currency: "USD", Unit: "per_1m_token",
			Tiers: []model.ChannelPricingTier{{
				RangeName: "base", Unit: "per_1m_token",
				InputPerMillionUSD: model.MoneyFromFloatPtr(fxTestFloat(2)),
			}},
			ChannelPrice: &model.ChannelPricingTier{
				InputPerMillionUSD: model.MoneyFromFloatPtr(fxTestFloat(0.8)),
			},
		},
	)
	records := []model.ChannelOfficialPricingRecord{record}
	require.NoError(t, applyUterAPICreditExchangeRate(records))

	var internal model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(records[0].InternalPricing, &internal))
	require.InDelta(t, 2, internal.InputUSDPerMillion.Float64(), 1e-12)
	require.InDelta(t, 10, internal.OutputUSDPerMillion.Float64(), 1e-12)
	require.InDelta(t, 0.2, internal.CacheUSDPerMillion.Float64(), 1e-12)

	var official model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(records[0].NormalizedPricing, &official))
	require.InDelta(t, 2, official.Tiers[0].InputPerMillionUSD.Float64(), 1e-12,
		"official reference price must stay as published")
	require.InDelta(t, 0.16, official.ChannelPrice.InputPerMillionUSD.Float64(), 1e-12)
}

func TestApplyUterAPICreditExchangeRateKeepsFixedExpressionsExecutable(t *testing.T) {
	withFXRate(t, 5)

	record := fxTestRecord(t,
		model.ChannelInternalPricing{
			Mode:        model.ChannelPricingModeTieredExpr,
			BillingExpr: `tier("standard", fixed(0.05)) * image_count`,
		},
		model.ChannelOfficialPricing{Currency: "USD", Unit: "per_image"},
	)
	records := []model.ChannelOfficialPricingRecord{record}
	require.NoError(t, applyUterAPICreditExchangeRate(records))

	var internal model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(records[0].InternalPricing, &internal))
	require.Contains(t, internal.BillingExpr, "fixed(0.01)")
	require.True(t, NormalizeUpstreamExpression(internal.BillingExpr).Executable)
}

func TestApplyUterAPICreditExchangeRateRejectsInvalidRate(t *testing.T) {
	previous := operation_setting.USDExchangeRate
	t.Cleanup(func() { operation_setting.USDExchangeRate = previous })

	record := fxTestRecord(t,
		model.ChannelInternalPricing{
			Mode:               model.ChannelPricingModePerMillionTokens,
			InputUSDPerMillion: model.MoneyFromFloatPtr(fxTestFloat(10)),
		},
		model.ChannelOfficialPricing{Currency: "USD", Unit: "per_1m_token"},
	)
	before := record.InternalPricing

	for _, rate := range []float64{0, -1, math.NaN(), math.Inf(1)} {
		operation_setting.USDExchangeRate = rate
		require.Error(t, applyUterAPICreditExchangeRate(
			[]model.ChannelOfficialPricingRecord{record},
		), "rate %v must be rejected", rate)
		require.Equal(t, before, record.InternalPricing,
			"invalid rate must leave prices untouched")
	}
}

// Each preview regenerates rows from the upstream document, so repeating it
// must not compound the credit-dollar conversion.
func TestPreviewUterAPIPriceCatalogFXIsIdempotent(t *testing.T) {
	raw, _ := loadXXAPIPricingFixture(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/pricing" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(raw)
	}))
	t.Cleanup(server.Close)

	previousOptions := common.OptionMap
	common.OptionMap = map[string]string{UterAPIUpstreamURLOption: server.URL}
	t.Cleanup(func() { common.OptionMap = previousOptions })
	withFXRate(t, 6.68)

	first, err := PreviewUterAPIPriceCatalog(context.Background(), "Codex Pro")
	require.NoError(t, err)
	second, err := PreviewUterAPIPriceCatalog(context.Background(), "Codex Pro")
	require.NoError(t, err)
	// Records carry a fetch timestamp, so compare the converted price itself.
	firstPrice := decodeXXAPIOfficial(t,
		findXXAPIRecord(t, first.Records, "gpt-6-astra"),
	).ChannelPrice.InputPerMillionUSD.Float64()
	secondPrice := decodeXXAPIOfficial(t,
		findXXAPIRecord(t, second.Records, "gpt-6-astra"),
	).ChannelPrice.InputPerMillionUSD.Float64()
	require.InDelta(t, firstPrice, secondPrice, 1e-12)
}
