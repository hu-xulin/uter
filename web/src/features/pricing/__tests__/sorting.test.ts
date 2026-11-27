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

describe('card model ordering (NAME sort)', () => {
  test('release date descends first; undated models sort after dated ones', () => {
    const named = [
      pricingModel('claude-opus-4-8', { release_date: '2026-05' }),
      pricingModel('zeta-undated', {}),
      pricingModel('claude-opus-5', { release_date: '2026-07' }),
      pricingModel('alpha-undated', {}),
      pricingModel('claude-opus-5-5', { release_date: '2026-09' }),
    ]
    expect(sortModels(named, SORT_OPTIONS.NAME).map((m) => m.model_name)).toEqual(
      [
        'claude-opus-5-5',
        'claude-opus-5',
        'claude-opus-4-8',
        'alpha-undated',
        'zeta-undated',
      ]
    )
  })

  test('same release date falls back to alphabetical, then larger version first', () => {
    const named = [
      pricingModel('beta-5', { release_date: '2026-01' }),
      pricingModel('beta-5.5', { release_date: '2026-01' }),
      pricingModel('alpha-9', { release_date: '2026-01' }),
      pricingModel('beta-5-5', { release_date: '2026-01' }),
    ]
    expect(sortModels(named, SORT_OPTIONS.NAME).map((m) => m.model_name)).toEqual(
      ['alpha-9', 'beta-5-5', 'beta-5.5', 'beta-5']
    )
  })

  test('undated models with same letters put 5-5 and 5.5 before 5', () => {
    const named = [
      pricingModel('gpt-5', {}),
      pricingModel('gpt-5.5', {}),
      pricingModel('gpt-5-5', {}),
      pricingModel('gpt-4-8', {}),
    ]
    expect(sortModels(named, SORT_OPTIONS.NAME).map((m) => m.model_name)).toEqual(
      ['gpt-5-5', 'gpt-5.5', 'gpt-5', 'gpt-4-8']
    )
  })
})
