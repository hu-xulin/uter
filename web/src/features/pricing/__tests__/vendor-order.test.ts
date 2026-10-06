/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of
the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
import { describe, expect, it } from 'vitest'

import { orderVendorsByModelCount } from '../lib/vendor-order'
import type { PricingModel, PricingVendor } from '../types'

function model(vendorName: string): PricingModel {
  return {
    id: 1,
    model_name: `${vendorName}-m`,
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 3,
    enable_groups: ['default'],
    vendor_name: vendorName,
  }
}

function vendor(name: string): PricingVendor {
  return { id: 1, name }
}

describe('orderVendorsByModelCount', () => {
  it('orders vendors by model count, most models first', () => {
    const models = [
      ...Array.from({ length: 5 }, () => model('OpenAI')),
      ...Array.from({ length: 3 }, () => model('Anthropic')),
      ...Array.from({ length: 3 }, () => model('Google')),
      model('DeepSeek'),
    ]
    const vendors = [
      vendor('Anthropic'),
      vendor('Google'),
      vendor('OpenAI'),
      vendor('DeepSeek'),
      vendor('NoModels'),
    ]

    const ordered = orderVendorsByModelCount(models, vendors)

    expect(ordered.map((v) => v.name)).toEqual([
      'OpenAI',
      'Anthropic',
      'Google',
      'DeepSeek',
    ])
    expect(ordered.find((v) => v.name === 'OpenAI')?.count).toBe(5)
    expect(ordered.find((v) => v.name === 'DeepSeek')?.count).toBe(1)
  })

  it('breaks model-count ties alphabetically by vendor name', () => {
    const models = [model('Google'), model('Google'), model('Anthropic'), model('Anthropic')]
    const vendors = [vendor('Google'), vendor('Anthropic')]

    const ordered = orderVendorsByModelCount(models, vendors)

    expect(ordered.map((v) => v.name)).toEqual(['Anthropic', 'Google'])
  })

  it('drops vendors that publish no models', () => {
    const models = [model('OpenAI')]
    const vendors = [vendor('OpenAI'), vendor('DeepSeek')]

    const ordered = orderVendorsByModelCount(models, vendors)

    expect(ordered.map((v) => v.name)).toEqual(['OpenAI'])
  })

  it('does not emit the "All Vendors" pseudo-option', () => {
    const models = [model('OpenAI')]
    const vendors = [vendor('OpenAI')]

    const ordered = orderVendorsByModelCount(models, vendors)

    expect(ordered.map((v) => v.name)).not.toContain('All Vendors')
  })

  it('prefers the backend model_count over the locally derived count', () => {
    // 后端 model_count 使用与管理页一致的口径（models 表 + 按名称规则归因的
    // 合成默认品牌），应优先于本地从展示 models 数组重算的结果。
    const models = [model('OpenAI'), model('OpenAI')] // 本地重算 = 2
    const vendors: PricingVendor[] = [
      { id: 1, name: 'OpenAI', model_count: 7 },
      { id: 2, name: 'Anthropic', model_count: 4 },
    ]

    const ordered = orderVendorsByModelCount(models, vendors)

    expect(ordered.map((v) => v.name)).toEqual(['OpenAI', 'Anthropic'])
    expect(ordered.find((v) => v.name === 'OpenAI')?.count).toBe(7)
    expect(ordered.find((v) => v.name === 'Anthropic')?.count).toBe(4)
  })

  it('falls back to the local count when model_count is absent', () => {
    const models = [model('OpenAI'), model('OpenAI'), model('OpenAI')]
    const vendors: PricingVendor[] = [{ id: 1, name: 'OpenAI' }]

    const ordered = orderVendorsByModelCount(models, vendors)

    expect(ordered.find((v) => v.name === 'OpenAI')?.count).toBe(3)
  })

  it('surfaces synthetic default-brand vendors via backend model_count even without local models', () => {
    // 合成默认品牌（如字节跳动，-1016）在 models 表没有对应 vendor_id 行，
    // 本地重算为 0；但后端按名称规则归因给出管理页同口径的 model_count，
    // 因此应被纳入侧边栏并保持次数一致，这正是 Req 3 要解决的一致性问题。
    const models: PricingModel[] = [model('OpenAI')]
    const vendors: PricingVendor[] = [
      { id: -1016, name: 'ByteDance', model_count: 9 },
      { id: 1, name: 'OpenAI' },
    ]

    const ordered = orderVendorsByModelCount(models, vendors)

    expect(ordered.map((v) => v.name)).toEqual(['ByteDance', 'OpenAI'])
    expect(ordered.find((v) => v.name === 'ByteDance')?.count).toBe(9)
  })
})
