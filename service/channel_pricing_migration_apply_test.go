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

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/custom_pricing"
)

func TestApplyLegacyQuoteMigrationPreservesOfficialAndInternalPrices(t *testing.T) {
	if common.OptionMap == nil {
		common.OptionMap = map[string]string{}
	}
	previousOption, hadOption := common.OptionMap[custom_pricing.ChannelPriceOptionKey]
	common.OptionMap[custom_pricing.ChannelPriceOptionKey] = `{
		"enabled": true,
		"channels": {"7": {"enabled": true, "quotes": {
			"gpt-a": {"channel_price": 6, "official_price": 10, "unit": "per_1m_token"},
			"discount-only": {"discount": 0.6, "unit": "per_1m_token"}
		}}}
	}`
	t.Cleanup(func() {
		if hadOption {
			common.OptionMap[custom_pricing.ChannelPriceOptionKey] = previousOption
			return
		}
		delete(common.OptionMap, custom_pricing.ChannelPriceOptionKey)
	})

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.ChannelModelPricing{}))
	previousDB := model.DB
	model.DB = db
	model.InvalidateChannelPricingCache()
	t.Cleanup(func() {
		model.DB = previousDB
		model.InvalidateChannelPricingCache()
	})

	_, err = model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{{
		ChannelId: 7, ModelName: "gpt-a", Currency: "USD", Source: "official",
		NormalizedPricing: `{"currency":"USD","unit":"per_1m_token","tiers":[{"range_name":"base","input_per_million_usd":10,"unit":"per_1m_token"}]}`,
	}})
	require.NoError(t, err)
	input, output := 2.0, 4.0
	require.NoError(t, model.SetChannelInternalPricing(7, "gpt-a", model.ChannelInternalPricing{
		Mode: model.ChannelPricingModePerMillionTokens, InputUSDPerMillion: &input, OutputUSDPerMillion: &output,
	}))

	dry, err := ApplyLegacyQuoteMigration(7, true)
	require.NoError(t, err)
	require.Len(t, dry.Migrated, 1)
	require.Len(t, dry.Pending, 1)
	row, err := model.GetChannelModelPricing(7, "gpt-a")
	require.NoError(t, err)
	assert.NotContains(t, row.NormalizedPricing, `"channel_price"`)

	applied, err := ApplyLegacyQuoteMigration(7, false)
	require.NoError(t, err)
	require.Len(t, applied.Migrated, 1)

	row, err = model.GetChannelModelPricing(7, "gpt-a")
	require.NoError(t, err)
	assert.Contains(t, row.NormalizedPricing, `"channel_price"`)
	assert.Contains(t, row.InternalPricing, `"input_per_million_usd":2`)
	assert.Equal(t, model.ChannelPricingStatusConfigured, row.PricingStatus)

	var view model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(row.NormalizedPricing, &view))
	require.NotNil(t, view.ChannelPrice)
	require.NotNil(t, view.ChannelPrice.InputPerMillionUSD)
	assert.InDelta(t, 6.0, *view.ChannelPrice.InputPerMillionUSD, 1e-9)
	assert.Equal(t, "legacy:ChannelPriceSetting", view.DiscountGroup)
}
