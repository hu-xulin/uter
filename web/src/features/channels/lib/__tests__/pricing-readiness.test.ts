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
import { expect, test } from 'vitest'

import type { ChannelModelPricingRecord } from '../../types'
import { summarizeSelectedPricingReadiness } from '../pricing-readiness'

function record(
  modelName: string,
  pricingStatus: string,
  provider = 'uterroute'
): ChannelModelPricingRecord {
  return {
    channel_id: 7,
    model_name: modelName,
    provider,
    region: '',
    deployment_id: '',
    currency: 'USD',
    pricing_source: 'uterroute-official',
    pricing_status: pricingStatus,
    pricing_version: 'v1',
    price_supported: true,
    fetched_at: 1,
    updated_at: 2,
    stale: false,
    fetched_age_hours: 0,
  }
}

test('only selected models count toward publish readiness', () => {
  const summary = summarizeSelectedPricingReadiness(
    [record('billable-a', 'configured'), record('unselected-review', 'needs_review')],
    ['billable-a']
  )

  expect(summary).toEqual({
    selected: 1,
    configured: 1,
    blocking: [],
    missing: [],
    pending: [],
  })
})

test('selected models with a non-configured row are reported as blocking', () => {
  const summary = summarizeSelectedPricingReadiness(
    [record('billable-a', 'configured'), record('review-a', 'needs_review')],
    ['billable-a', 'review-a']
  )

  expect(summary).toEqual({
    selected: 2,
    configured: 1,
    blocking: ['review-a (needs_review)'],
    missing: [],
    pending: ['review-a (needs_review)'],
  })
})

test('a selected model without a pricing row is pending but not blocking', () => {
  const summary = summarizeSelectedPricingReadiness(
    [record('billable-a', 'configured')],
    ['billable-a', 'no-row']
  )

  // The server only inspects existing rows, so a missing row never blocks a
  // publish; it is still reported because the model cannot bill.
  expect(summary.blocking).toEqual([])
  expect(summary.missing).toEqual(['no-row (missing)'])
  expect(summary.pending).toContain('no-row (missing)')
})

test('a review-only duplicate row blocks a model that also has a configured row', () => {
  const summary = summarizeSelectedPricingReadiness(
    [
      record('model-a', 'configured', 'uterroute'),
      record('model-a', 'needs_review', 'newapi-compatible'),
    ],
    ['model-a']
  )

  // The server walks rows one by one and blocks on the first non-configured
  // row, so the summary must not let the configured duplicate hide it.
  expect(summary.configured).toBe(0)
  expect(summary.blocking).toEqual(['model-a (needs_review)'])
})

test('no selected models means nothing is pending', () => {
  const summary = summarizeSelectedPricingReadiness(
    [record('review-a', 'needs_review')],
    []
  )

  expect(summary).toEqual({
    selected: 0,
    configured: 0,
    blocking: [],
    missing: [],
    pending: [],
  })
})
