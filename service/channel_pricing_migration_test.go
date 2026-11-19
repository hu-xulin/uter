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

	"github.com/uter-ai/uter/setting/custom_pricing"
)

func migrationPrice(v float64) *float64 { return &v }

func TestBuildLegacyQuoteMigrationPlan(t *testing.T) {
	config := &custom_pricing.ChannelPriceConfig{
		Enabled: true,
		Quotes: map[string]custom_pricing.ChannelQuote{
			"absolute": {
				ChannelPrice: migrationPrice(6), Unit: "per_1m_token",
			},
			"per-call": {
				ChannelPrice: migrationPrice(0.04), Unit: "per_call",
			},
			"discount-only": {
				Discount: migrationPrice(0.6), Unit: "per_1m_token",
			},
			"tiered": {
				ChannelPrice: migrationPrice(75), Unit: "per_1m_token",
				Status:      custom_pricing.ChannelQuoteStatusNeedsReview,
				BillingExpr: "tier(...)",
			},
			"bad-unit": {
				ChannelPrice: migrationPrice(1), Unit: "per_second",
			},
		},
	}

	plan := BuildLegacyQuoteMigrationPlan(config)
	require.Len(t, plan, 5)
	byName := map[string]LegacyQuoteMigrationItem{}
	for _, item := range plan {
		byName[item.ModelName] = item
	}
	assert.True(t, byName["absolute"].CanMigrate)
	assert.True(t, byName["per-call"].CanMigrate)
	assert.False(t, byName["discount-only"].CanMigrate)
	assert.Contains(t, byName["discount-only"].Reason, "no absolute")
	assert.False(t, byName["tiered"].CanMigrate)
	assert.False(t, byName["bad-unit"].CanMigrate)
}
