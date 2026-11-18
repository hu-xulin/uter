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

import { filterAndSortModels, filterByChannel } from '../lib/filters'
import type { PricingModel } from '../types'

function model(
  overrides: Partial<PricingModel> & { model_name: string }
): PricingModel {
  return {
    id: 1,
    vendor_name: 'Vendor A',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: ['default'],
    ...overrides,
  } as PricingModel
}

const models = [
  model({
    model_name: 'shared-model',
    channels: ['优特渠道', '聚合渠道'],
  }),
  model({ id: 2, model_name: 'aggregate-only', channels: ['聚合渠道'] }),
  model({ id: 3, model_name: 'no-channel' }),
]

const baseFilters = {
  search: '',
  vendor: 'all',
  quotaType: 'all',
  endpointType: 'all',
  tag: 'all',
  sortBy: 'name',
}

describe('pricing channel filter', () => {
  it('keeps only models served by the selected channel', () => {
    expect(
      filterByChannel(models, '优特渠道').map((item) => item.model_name)
    ).toEqual(['shared-model'])
    expect(
      filterByChannel(models, '聚合渠道').map((item) => item.model_name)
    ).toEqual(['shared-model', 'aggregate-only'])
  })

  it('returns every model for the "all" sentinel and drops unmatched channels', () => {
    expect(filterByChannel(models, 'all')).toBe(models)
    expect(filterByChannel(models, '不存在的渠道')).toEqual([])
  })

  it('uses the channel dimension instead of the legacy group field', () => {
    const channel = model({
      model_name: 'channel-model',
      enable_groups: ['default'],
      channels: ['优特渠道'],
    })
    const groupOnly = model({
      id: 2,
      model_name: 'group-only',
      enable_groups: ['VIP0'],
      channels: [],
    })

    expect(
      filterAndSortModels([channel, groupOnly], {
        ...baseFilters,
        channel: '优特渠道',
      }).map((item) => item.model_name)
    ).toEqual(['channel-model'])
    expect(
      filterAndSortModels([channel, groupOnly], {
        ...baseFilters,
        channel: 'VIP0',
      })
    ).toEqual([])
  })
})
