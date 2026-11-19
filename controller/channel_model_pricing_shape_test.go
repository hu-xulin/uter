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
package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/uter-ai/uter/model"
)

func shapePrice(v float64) *float64 { return &v }

func TestClassifyOfficialPricingShape(t *testing.T) {
	cases := []struct {
		name      string
		official  *model.ChannelOfficialPricing
		shape     string
		supported bool
	}{
		{
			name: "token",
			official: &model.ChannelOfficialPricing{Tiers: []model.ChannelPricingTier{{
				Unit: "per_1m_token", InputPerMillionUSD: shapePrice(2),
			}}},
			shape:     "per_1m_token",
			supported: true,
		},
		{
			name: "per call",
			official: &model.ChannelOfficialPricing{Tiers: []model.ChannelPricingTier{{
				Unit: "per_call", PerUnitUSD: shapePrice(0.04),
			}}},
			shape:     "per_call",
			supported: true,
		},
		{
			name: "multi tier",
			official: &model.ChannelOfficialPricing{Tiers: []model.ChannelPricingTier{
				{Unit: "per_1m_token", InputPerMillionUSD: shapePrice(1)},
				{Unit: "per_1m_token", InputPerMillionUSD: shapePrice(2)},
			}},
			shape:     "multi_tier",
			supported: false,
		},
		{
			name: "per image",
			official: &model.ChannelOfficialPricing{Tiers: []model.ChannelPricingTier{{
				Unit: "per_image", PerUnitUSD: shapePrice(0.04),
			}}},
			shape:     "per_image",
			supported: true,
		},
		{
			name: "per second",
			official: &model.ChannelOfficialPricing{Tiers: []model.ChannelPricingTier{{
				Unit: "per_second", PerUnitUSD: shapePrice(0.08),
			}}},
			shape:     "per_second",
			supported: false,
		},
		{
			name:      "missing",
			official:  nil,
			shape:     "",
			supported: false,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			shape, supported := classifyOfficialPricingShape(tc.official)
			assert.Equal(t, tc.shape, shape)
			assert.Equal(t, tc.supported, supported)
		})
	}
}
