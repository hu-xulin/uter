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
import { describe, expect, test } from 'vitest'

import { SORT_OPTIONS } from '../constants'
import { sortModels } from '../lib/filters'
import type { PricingModel } from '../types'

function pricingModel(
  modelName: string,
  overrides: Partial<PricingModel>
): PricingModel {
  return {
    id: 1,
    model_name: modelName,
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: ['default'],
    ...overrides,
  }
}

const models = [
  pricingModel('legacy-ratio', { model_ratio: 1, completion_ratio: 4 }),
  pricingModel('legacy-per-call', { quota_type: 1, model_price: 0.05 }),
  pricingModel('expr-tokens', {
    billing_mode: 'tiered_expr',
    billing_expr: 'tier("base", p * 1 + c * 10)',
  }),
  pricingModel('expr-long-context', {
    billing_mode: 'tiered_expr',
    billing_expr:
      'len <= 200000 ? tier("standard", p * 3 + c * 15) : tier("long", p * 6 + c * 22.5)',
  }),
  pricingModel('expr-input-only', {
    billing_mode: 'tiered_expr',
    billing_expr: 'tier("base", p * 0.1)',
  }),
  pricingModel('expr-fixed', {
    billing_mode: 'tiered_expr',
    billing_expr: 'tier("request", fixed(0.02))',
  }),
  pricingModel('expr-task', {
    billing_mode: 'tiered_expr',
    billing_expr: 'tier("base", u("seconds") * 0.1)',
    billing_usage_schema: { seconds: { type: 'number', unit: 'second' } },
    billing_usage_examples: [{ label: '5s', facts: { seconds: 5 } }],
  }),
]

// 折扣/时间排序的官方价基准：model_ratio 是平台价倍率，official_prices 给出
// 官方基准，getDiscountInfo 的 ratio = 平台/官方。0.2 = 2 折，0.3 = 3 折。
function discountModel(
  name: string,
  ratio: number,
  releaseDate?: string
): PricingModel {
  return pricingModel(name, { model_ratio: ratio, release_date: releaseDate })
}

describe('discount & time composite sorting', () => {
  const pool = [
    discountModel('claude-3', 0.2, '2026-01'), // 2 折，旧
    discountModel('claude-5-5', 0.2, '2026-09'), // 2 折，新，大版本
    discountModel('alpha-9', 0.3, '2026-09'), // 3 折
    discountModel('beta-5', 0.2, '2026-09'), // 2 折，新，字母靠后，小版本
    discountModel('no-official', 1, '2026-10'), // 无官方参照，折算不出折扣
  ]
  const officialWithoutF = Object.fromEntries(
    pool
      .filter((m) => m.model_name !== 'no-official')
      .map((m) => [m.model_name, { model_ratio: 1 }])
  )

  test('默认折扣从低到高：2 折在 3 折之前，无折扣参照排最后', () => {
    const names = sortModels(
      pool,
      SORT_OPTIONS.DISCOUNT_LOW_TO_HIGH,
      officialWithoutF
    ).map((m) => m.model_name)
    // 2 折组内部按「发布新→旧 → 字母 → 版本大→小」：claude-5-5(09) 与
    // beta-5(09) 同年，按字母 alpha<beta，但 claude-3 是 01 更早。
    // claude-5-5 与 beta-5 都是 09：claude-5-5 字母 c > beta b，故 beta 先。
    expect(names.slice(0, 3)).toEqual(['beta-5', 'claude-5-5', 'claude-3'])
    expect(names[3]).toBe('alpha-9')
    expect(names[4]).toBe('no-official')
  })

  test('折扣从高到低：3 折在 2 折之前，无折扣参照仍排最后', () => {
    const names = sortModels(
      pool,
      SORT_OPTIONS.DISCOUNT_HIGH_TO_LOW,
      officialWithoutF
    ).map((m) => m.model_name)
    expect(names[0]).toBe('alpha-9')
    expect(names.slice(1, 4)).toEqual(['beta-5', 'claude-5-5', 'claude-3'])
    expect(names[4]).toBe('no-official')
  })

  test('同折扣内部严格按发布时间新→旧、同时间按字母、同字母按版本大→小', () => {
    const tied = [
      discountModel('gpt-5', 0.5, '2026-05'),
      discountModel('gpt-5-5', 0.5, '2026-05'),
      discountModel('gpt-4-8', 0.5, '2026-05'),
      discountModel('zeta-7', 0.5, '2026-03'),
    ]
    const official = Object.fromEntries(
      tied.map((m) => [m.model_name, { model_ratio: 1 }])
    )
    // 同日期 2026-05：按字母 gpt<zeta；gpt 组内版本号 5-5>5>4-8。
    expect(
      sortModels(tied, SORT_OPTIONS.DISCOUNT_LOW_TO_HIGH, official).map(
        (m) => m.model_name
      )
    ).toEqual(['gpt-5-5', 'gpt-5', 'gpt-4-8', 'zeta-7'])
  })

  test('时间从最新到最旧：release_date 降序', () => {
    expect(
      sortModels(pool, SORT_OPTIONS.TIME_NEWEST_TO_OLDEST).map(
        (m) => m.model_name
      )
    ).toEqual(['no-official', 'alpha-9', 'beta-5', 'claude-5-5', 'claude-3'])
  })

  test('时间从最旧到最新：release_date 升序', () => {
    expect(
      sortModels(pool, SORT_OPTIONS.TIME_OLDEST_TO_NEWEST).map(
        (m) => m.model_name
      )
    ).toEqual(['claude-3', 'alpha-9', 'beta-5', 'claude-5-5', 'no-official'])
  })
})

describe('price sorting', () => {
  test.each([
    [
      SORT_OPTIONS.INPUT_PRICE_LOW,
      [
        'expr-input-only',
        'expr-tokens',
        'legacy-ratio',
        'expr-long-context',
        'legacy-per-call',
        'expr-fixed',
        'expr-task',
      ],
    ],
    [
      SORT_OPTIONS.INPUT_PRICE_HIGH,
      [
        'expr-long-context',
        'legacy-ratio',
        'expr-tokens',
        'expr-input-only',
        'legacy-per-call',
        'expr-fixed',
        'expr-task',
      ],
    ],
    [
      SORT_OPTIONS.OUTPUT_PRICE_LOW,
      [
        'legacy-ratio',
        'expr-tokens',
        'expr-long-context',
        'legacy-per-call',
        'expr-input-only',
        'expr-fixed',
        'expr-task',
      ],
    ],
    [
      SORT_OPTIONS.REQUEST_PRICE_HIGH,
      [
        'expr-task',
        'legacy-per-call',
        'expr-fixed',
        'legacy-ratio',
        'expr-tokens',
        'expr-long-context',
        'expr-input-only',
      ],
    ],
  ])(
    '%s compares base prices across legacy and expression billing and keeps unpriced models last',
    (sortBy, expected) => {
      expect(sortModels(models, sortBy).map((m) => m.model_name)).toEqual(
        expected
      )
    }
  )
})

describe('name sorting (alphabetical)', () => {
  const named = [
    pricingModel('zeta-undated', {}),
    pricingModel('claude-opus-4-8', { release_date: '2026-05' }),
    pricingModel('alpha-undated', {}),
    pricingModel('claude-opus-5', { release_date: '2026-07' }),
    pricingModel('beta-undated', {}),
  ]
  const ascending = [
    'alpha-undated',
    'beta-undated',
    'claude-opus-4-8',
    'claude-opus-5',
    'zeta-undated',
  ]

  test('name ascending sorts A to Z and ignores release date', () => {
    expect(
      sortModels(named, SORT_OPTIONS.NAME).map((m) => m.model_name)
    ).toEqual(ascending)
  })

  test('name descending reverses the same alphabetical order', () => {
    expect(
      sortModels(named, SORT_OPTIONS.NAME_DESC).map((m) => m.model_name)
    ).toEqual([...ascending].reverse())
  })

  test('name sorting is case-insensitive and uses natural number order', () => {
    const mixed = [
      pricingModel('gpt-10', {}),
      pricingModel('GPT-5', {}),
      pricingModel('gpt-2', {}),
      pricingModel('Alpha', {}),
    ]
    expect(
      sortModels(mixed, SORT_OPTIONS.NAME).map((m) => m.model_name)
    ).toEqual(['Alpha', 'gpt-2', 'GPT-5', 'gpt-10'])
    expect(
      sortModels(mixed, SORT_OPTIONS.NAME_DESC).map((m) => m.model_name)
    ).toEqual(['gpt-10', 'GPT-5', 'gpt-2', 'Alpha'])
  })
})
