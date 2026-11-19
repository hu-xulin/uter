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

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/custom_pricing"
)

func auditPrice(v float64) *float64 { return &v }

func TestChannelPricingAuditPrefersChannelModelPricing(t *testing.T) {
	legacy := &custom_pricing.ChannelPriceConfig{
		Enabled: true,
		Quotes: map[string]custom_pricing.ChannelQuote{
			"gpt-a": {ChannelPrice: auditPrice(6), Unit: "per_1m_token"},
			"gpt-b": {ChannelPrice: auditPrice(4), Unit: "per_1m_token"},
		},
	}
	rows := []model.ChannelModelPricing{
		{ModelName: "gpt-a", PricingStatus: model.ChannelPricingStatusConfigured},
		{ModelName: "gpt-c", PricingStatus: model.ChannelPricingStatusOfficialOnly},
	}

	audit := BuildChannelPricingAudit(42, "test", legacy, rows)

	assert.Equal(t, "channel_model_pricing", audit.Authority)
	require.Len(t, audit.Conflicts, 1)
	assert.Equal(t, "gpt-a", audit.Conflicts[0].ModelName)
	assert.Equal(t, "channel_model_pricing", audit.Conflicts[0].BillingSource)

	billing := map[string]ChannelPricingAuditModel{}
	for _, item := range audit.Models {
		billing[item.ModelName] = item
	}
	assert.Equal(t, "legacy_channel_price_setting", billing["gpt-b"].BillingSource)
	assert.True(t, billing["gpt-b"].Billable)
	assert.Equal(t, "channel_model_pricing", billing["gpt-c"].BillingSource)
	assert.False(t, billing["gpt-c"].Billable)
	assert.NotEmpty(t, audit.Warnings)
}

func TestChannelPricingAuditBlocksWhenNewRowIsNotBillable(t *testing.T) {
	legacy := &custom_pricing.ChannelPriceConfig{
		Enabled: true,
		Quotes: map[string]custom_pricing.ChannelQuote{
			"gpt-a": {ChannelPrice: auditPrice(6), Unit: "per_1m_token"},
		},
	}
	rows := []model.ChannelModelPricing{
		{ModelName: "gpt-a", PricingStatus: model.ChannelPricingStatusNeedsReview},
	}

	audit := BuildChannelPricingAudit(7, "test", legacy, rows)

	require.Len(t, audit.Models, 1)
	assert.False(t, audit.Models[0].Billable)
	assert.Equal(t, "channel_model_pricing", audit.Models[0].BillingSource)
	require.Len(t, audit.Conflicts, 1)
	assert.Contains(t, audit.Conflicts[0].Reason, "blocks")
}

func TestChannelPricingAuditReportsLegacyAndGlobalSources(t *testing.T) {
	legacy := &custom_pricing.ChannelPriceConfig{
		Enabled: true,
		Quotes: map[string]custom_pricing.ChannelQuote{
			"gpt-a": {ChannelPrice: auditPrice(6), Unit: "per_1m_token"},
		},
	}
	audit := BuildChannelPricingAudit(9, "legacy", legacy, nil)
	assert.Equal(t, "legacy_channel_price_setting", audit.Authority)
	require.Len(t, audit.Models, 1)
	assert.True(t, audit.Models[0].Billable)

	empty := BuildChannelPricingAudit(9, "empty", nil, nil)
	assert.Equal(t, "global", empty.Authority)
	assert.Empty(t, empty.Models)
}
