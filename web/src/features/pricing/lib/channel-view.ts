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
import type { PricingChannelPrice, PricingModel } from '../types'

export type OfficialPrices = Record<string, Record<string, number>>

/**
 * Select the price shown for one channel filter. The model list keeps the
 * cheapest channel price for the all-channels view; a specific channel must
 * show its own configured price and official basis instead.
 */
export function applyChannelView(
  models: PricingModel[],
  channelFilter: string,
  officialPrices: OfficialPrices | undefined,
  allChannels: string
): { models: PricingModel[]; officialPrices: OfficialPrices } {
  if (channelFilter === allChannels) {
    return { models, officialPrices: officialPrices ?? {} }
  }
  const official: OfficialPrices = { ...officialPrices }
  const viewed = models.map((model) => {
    const channelPrice = model.channel_prices?.[channelFilter]
    if (!channelPrice) {
      if (model.channels?.includes(channelFilter)) {
        return { ...model, channel_pricing_status: 'missing' }
      }
      return model
    }
    const merged = applyChannelPrice(model, channelPrice)
    // The official basis belongs to the same channel row as the sale price.
    // Skipping this for tiered expressions made the card compare a discounted
    // channel expression against an unrelated public catalogue price.
    const entry = officialEntry(channelPrice)
    if (Object.keys(entry).length > 0) {
      official[model.model_name] = entry
    }
    return merged
  })
  return { models: viewed, officialPrices: official }
}

function applyChannelPrice(
  model: PricingModel,
  price: PricingChannelPrice
): PricingModel {
  const merged = { ...model }
  if (merged.channel_prices) delete merged.channel_prices
  if (price.status) merged.channel_pricing_status = price.status

  // official_only / needs_review rows carry no billable price. Keep the
  // catalogue price untouched and only surface the review status/basis.
  if (price.quota_type < 0) {
    return merged
  }

  // A configured tiered expression is the channel's billable price. It must
  // win over any global expression and stay in the token bucket so the plaza's
  // token/request facets keep working.
  if (price.billing_expr) {
    merged.quota_type = 0
    merged.billing_mode = price.billing_mode || 'tiered_expr'
    merged.billing_expr = price.billing_expr
    merged.model_ratio = 0
    merged.model_price = 0
    merged.completion_ratio = 0
    merged.channel_internal_per_second_usd = undefined
    return merged
  }

  if (price.quota_type === 2) {
    merged.quota_type = 2
    merged.channel_internal_per_second_usd = price.per_second_usd
    merged.model_ratio = 0
    merged.model_price = 0
    merged.billing_expr = ''
    merged.billing_mode = ''
    return merged
  }
  if (price.quota_type === 3) {
    merged.quota_type = 3
    merged.model_ratio = 0
    merged.model_price = 0
    merged.billing_expr = ''
    merged.billing_mode = ''
    return merged
  }
  if (price.quota_type === 1) {
    merged.quota_type = 1
    merged.model_price = price.model_price ?? 0
    merged.model_ratio = 0
    merged.completion_ratio = 0
    merged.channel_internal_per_second_usd = undefined
    merged.billing_expr = ''
    merged.billing_mode = ''
    return merged
  }
  merged.quota_type = 0
  merged.model_ratio = price.model_ratio ?? 0
  merged.completion_ratio = price.completion_ratio ?? 1
  merged.model_price = 0
  merged.billing_expr = ''
  merged.billing_mode = ''
  merged.channel_internal_per_second_usd = undefined
  merged.cache_ratio = price.cache_ratio || undefined
  merged.create_cache_ratio = price.create_cache_ratio || undefined
  merged.audio_ratio = price.audio_ratio || undefined
  merged.audio_completion_ratio = price.audio_completion_ratio || undefined
  return merged
}

function officialEntry(price: PricingChannelPrice): Record<string, number> {
  return {
    ...(price.official_model_ratio
      ? {
          model_ratio: price.official_model_ratio,
          completion_ratio: price.official_completion_ratio ?? 0,
          cache_ratio: price.official_cache_ratio ?? 0,
          create_cache_ratio: price.official_create_cache_ratio ?? 0,
        }
      : {}),
    ...(price.official_model_price
      ? { model_price: price.official_model_price }
      : {}),
    ...(price.official_per_second_usd
      ? { official_price_per_second: price.official_per_second_usd }
      : {}),
  }
}
