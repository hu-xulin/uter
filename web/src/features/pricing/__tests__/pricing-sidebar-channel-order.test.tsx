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
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PricingSidebar } from '../components/pricing-sidebar'
import type { PricingFacetModels, PricingModel } from '../types'

vi.mock('@/context/theme-provider', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

const CHANNEL_ORDER = [
  '优特-精选',
  '优特-百炼',
  'Claude-Basic',
  'Claude-Pro',
  'Claude-Max',
  'Claude-Ultra',
  'GPT-Pro',
  'GPT-Max',
  'GPT-Ultra',
] as const

// 故意让模型数与目标顺序不一致：旧逻辑按模型数降序会给出不同排列。
const CHANNEL_COUNTS: Record<string, number> = {
  '优特-精选': 3,
  '优特-百炼': 9,
  'Claude-Basic': 8,
  'Claude-Pro': 7,
  'Claude-Max': 6,
  'Claude-Ultra': 5,
  'GPT-Pro': 4,
  'GPT-Max': 2,
  'GPT-Ultra': 1,
}

function buildModels(): PricingModel[] {
  const models: PricingModel[] = []
  for (const [index, channel] of CHANNEL_ORDER.entries()) {
    for (let item = 0; item < CHANNEL_COUNTS[channel]; item += 1) {
      models.push({
        id: index * 100 + item,
        model_name: `${channel}-model-${item}`,
        vendor_name: 'Vendor A',
        quota_type: 0,
        model_ratio: 1,
        completion_ratio: 1,
        enable_groups: ['default'],
        channels: [channel],
      } as PricingModel)
    }
  }
  return models
}

function renderedChannelOrder(): string[] {
  return [...document.querySelectorAll('button')]
    .map((button) => button.textContent?.trim() ?? '')
    .reduce<string[]>((order, text) => {
      const channel = CHANNEL_ORDER.find((candidate) =>
        text.startsWith(candidate)
      )
      if (channel) order.push(channel)
      return order
    }, [])
}

describe('PricingSidebar 渠道排序', () => {
  it('按指定的九个渠道顺序展示，忽略模型数降序', () => {
    const models = buildModels()
    const facetModels: PricingFacetModels = {
      channel: models,
      vendor: [],
      tag: [],
      quotaType: [],
      endpointType: [],
    }

    render(
      <PricingSidebar
        quotaTypeFilter='all'
        endpointTypeFilter='all'
        vendorFilter='all'
        channelFilter='all'
        tagFilter='all'
        onQuotaTypeChange={vi.fn()}
        onEndpointTypeChange={vi.fn()}
        onVendorChange={vi.fn()}
        onChannelChange={vi.fn()}
        onTagChange={vi.fn()}
        vendors={[]}
        channels={[...CHANNEL_ORDER].reverse()}
        models={models}
        facetModels={facetModels}
        hasActiveFilters={false}
        onClearFilters={vi.fn()}
      />
    )

    expect(renderedChannelOrder()).toEqual([...CHANNEL_ORDER])
  })
})
