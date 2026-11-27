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
import type {
  ChannelOfficialPricingTier,
  ChannelOfficialPricingView,
} from '../types'

/**
 * Resolve the price tier a channel-management view may display as the
 * upstream official/reference price.
 *
 * `channel_price_tiers` is the upstream channel quote, not the vendor list
 * price. Bailian publishes vendor list prices only for Alibaba-owned models;
 * third-party models resold by Bailian publish a channel price and must leave
 * `tiers` empty. Never fall back to `channel_price_tiers` here.
 */
export function resolveOfficialDisplayTier(
  official: ChannelOfficialPricingView | undefined | null
): ChannelOfficialPricingTier | undefined {
  if (!official) return undefined
  return official.tiers?.[0]
}
