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

import { FILTER_ALL, QUOTA_TYPES, ENDPOINT_TYPES } from '../constants'
import { buildFacetModels } from '../lib/filters'
import type { PricingModel } from '../types'

function model(
  id: number,
  vendor: string,
  channel: string,
  tag: string,
  quotaType: number,
  endpoint: string
): PricingModel {
  return {
    id,
    model_name: `model-${id}`,
    vendor_name: vendor,
    quota_type: quotaType,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: ['default'],
    channels: [channel],
    tags: tag,
    supported_endpoint_types: [endpoint],
  }
}

const models = [
  model(1, 'Vendor A', '优特渠道', 'chat', 0, 'openai'),
  model(2, 'Vendor B', '优特渠道', 'image', 1, 'image-generation'),
  model(3, 'Vendor B', '聚合渠道', 'video', 0, 'openai'),
]

const emptyFilters = {
  search: '',
  vendor: FILTER_ALL,
  channel: FILTER_ALL,
  quotaType: QUOTA_TYPES.ALL,
  endpointType: ENDPOINT_TYPES.ALL,
  tag: FILTER_ALL,
}

describe('faceted pricing filters', () => {
  it('keeps every dimension available when no filter is active', () => {
    const facets = buildFacetModels(models, emptyFilters)
    for (const set of Object.values(facets)) {
      expect(set).toHaveLength(3)
    }
  })

  it('narrows vendors, tags, pricing types and endpoints to the selected channel', () => {
    const facets = buildFacetModels(models, {
      ...emptyFilters,
      channel: '优特渠道',
    })

    // The channel list itself is not narrowed by the channel filter.
    expect(facets.channel).toHaveLength(3)
    expect(new Set(facets.vendor.map((m) => m.vendor_name))).toEqual(
      new Set(['Vendor A', 'Vendor B'])
    )
    expect(facets.tag.map((m) => m.tags)).toEqual(['chat', 'image'])
    expect(facets.quotaType.map((m) => m.quota_type)).toEqual([0, 1])
    expect(
      facets.endpointType.map((m) => m.supported_endpoint_types?.[0])
    ).toEqual(['openai', 'image-generation'])
  })

  it('combines channel and vendor filters for the other dimensions', () => {
    const facets = buildFacetModels(models, {
      ...emptyFilters,
      channel: '优特渠道',
      vendor: 'Vendor A',
    })

    expect(new Set(facets.channel.map((m) => m.channels?.[0]))).toEqual(
      new Set(['优特渠道'])
    )
    expect(new Set(facets.vendor.map((m) => m.vendor_name))).toEqual(
      new Set(['Vendor A', 'Vendor B'])
    )
    expect(facets.tag.map((m) => m.tags)).toEqual(['chat'])
    expect(facets.quotaType.map((m) => m.quota_type)).toEqual([0])
    expect(
      facets.endpointType.map((m) => m.supported_endpoint_types?.[0])
    ).toEqual(['openai'])
  })
})
