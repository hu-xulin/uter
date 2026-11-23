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
import { describe, expect, it } from 'vitest'

import { applyChannelView } from '../lib/channel-view'
import type { PricingModel } from '../types'

const ALL = 'all'

function model(overrides: Partial<PricingModel> = {}): PricingModel {
  return {
    id: 1,
    model_name: 'text-model',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 2,
    enable_groups: ['default'],
    channels: ['阿里百炼', '优特渠道'],
    ...overrides,
  }
}

describe('applyChannelView', () => {
  it('keeps the aggregated view when no channel is selected', () => {
    const input = [model()]
    const result = applyChannelView(input, ALL, {}, ALL)
    expect(result.models).toBe(input)
  })

  it('uses the selected channel token price, cache and audio ratios', () => {
    const input = [
      model({
        channel_prices: {
          阿里百炼: {
            name: '阿里百炼',
            quota_type: 0,
            model_ratio: 0.15,
            completion_ratio: 5,
            cache_ratio: 0.1,
            audio_ratio: 8,
            audio_completion_ratio: 4,
            official_model_ratio: 0.25,
            official_completion_ratio: 5,
            official_cache_ratio: 0.1,
          },
        },
      }),
    ]
    const result = applyChannelView(input, '阿里百炼', {}, ALL)
    const viewed = result.models[0]
    expect(viewed.model_ratio).toBe(0.15)
    expect(viewed.completion_ratio).toBe(5)
    expect(viewed.cache_ratio).toBe(0.1)
    expect(viewed.audio_ratio).toBe(8)
    expect(viewed.audio_completion_ratio).toBe(4)
    expect(viewed.channel_prices).toBeUndefined()
    expect(result.officialPrices['text-model']).toMatchObject({
      model_ratio: 0.25,
      completion_ratio: 5,
    })
  })

  it('keeps a channel tiered expression instead of a flat ratio', () => {
    const expr =
      'len <= 131072 ? tier("short", p * 1 + c * 2) : tier("long", p * 3)'
    const input = [
      model({
        channel_prices: {
          阿里百炼: {
            name: '阿里百炼',
            quota_type: 4,
            billing_expr: expr,
            official_model_ratio: 1,
          },
        },
      }),
    ]
    const result = applyChannelView(input, '阿里百炼', {}, ALL)
    expect(result.models[0].billing_expr).toBe(expr)
    expect(result.models[0].quota_type).toBe(4)
    expect(result.models[0].billing_mode).toBe('tiered_expr')
    expect(result.models[0].model_ratio).toBe(0)
    expect(result.officialPrices['text-model']).toBeUndefined()
  })

  it('shows a per-second channel price and its official basis', () => {
    const input = [
      model({
        quota_type: 1,
        model_price: 99,
        channel_prices: {
          阿里百炼: {
            name: '阿里百炼',
            quota_type: 2,
            per_second_usd: 0.05,
            official_per_second_usd: 0.08,
          },
        },
      }),
    ]
    const result = applyChannelView(input, '阿里百炼', {}, ALL)
    expect(result.models[0].quota_type).toBe(2)
    expect(result.models[0].model_price).toBe(0)
    expect(result.models[0].model_ratio).toBe(0)
    expect(result.models[0].channel_internal_per_second_usd).toBe(0.05)
    expect(result.officialPrices['text-model']).toEqual({
      official_price_per_second: 0.08,
    })
  })

  it('marks a channel model without any price row as missing', () => {
    const result = applyChannelView([model()], '阿里百炼', {}, ALL)
    expect(result.models[0].channel_pricing_status).toBe('missing')
    expect(result.models[0].model_ratio).toBe(1)
  })

  it('surfaces a review-only row without pretending the global price is the channel price', () => {
    const input = [
      model({
        channel_prices: {
          阿里百炼: {
            name: '阿里百炼',
            quota_type: -1,
            status: 'needs_review',
            official_model_ratio: 3,
            official_completion_ratio: 2,
          },
        },
      }),
    ]
    const result = applyChannelView(input, '阿里百炼', {}, ALL)
    expect(result.models[0].channel_pricing_status).toBe('needs_review')
    expect(result.officialPrices['text-model']).toMatchObject({
      model_ratio: 3,
      completion_ratio: 2,
    })
  })
})

it('keeps the catalogue official price when a channel row has no official basis', () => {
  const input = [
    model({
      channel_prices: {
        阿里百炼: {
          name: '阿里百炼',
          quota_type: -1,
          status: 'needs_review',
        },
      },
    }),
  ]
  const preset = { 'text-model': { model_ratio: 1.5, completion_ratio: 3 } }
  const result = applyChannelView(input, '阿里百炼', preset, ALL)
  expect(result.officialPrices['text-model']).toEqual(preset['text-model'])
})
