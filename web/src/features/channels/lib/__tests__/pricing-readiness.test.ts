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
    [
      record('billable-a', 'configured'),
      record('unselected-review', 'needs_review'),
    ],
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

// --- redirect-aware matching -------------------------------------------------

test('upstream name selected with an alias-keyed price row is billable', () => {
  // The reported bug: a batch redirect publishes "claude-xxx-dr" and syncs the
  // catalogue row under that alias, but the operator selected the raw upstream
  // "claude-xxx". Exact matching reported it as (missing).
  const summary = summarizeSelectedPricingReadiness(
    [record('claude-opus-4-6-dr', 'configured')],
    ['claude-opus-4-6'],
    JSON.stringify({ 'claude-opus-4-6-dr': 'claude-opus-4-6' })
  )

  expect(summary.configured).toBe(1)
  expect(summary.missing).toEqual([])
})

test('alias selected with an upstream-keyed price row is billable', () => {
  // The mirror case: unsaved redirect aliases in the model list, catalogues
  // still keyed by the upstream name.
  const summary = summarizeSelectedPricingReadiness(
    [record('claude-haiku-4-5', 'configured')],
    ['claude-haiku-4-5-dr'],
    JSON.stringify({ 'claude-haiku-4-5-dr': 'claude-haiku-4-5' })
  )

  expect(summary.configured).toBe(1)
  expect(summary.missing).toEqual([])
})

test('redirect readiness follows a chained mapping to the tail', () => {
  const summary = summarizeSelectedPricingReadiness(
    [record('gpt-4o', 'configured')],
    ['gpt-final'],
    JSON.stringify({ 'gpt-final': 'gpt-hop', 'gpt-hop': 'gpt-4o' })
  )

  expect(summary.configured).toBe(1)
  expect(summary.missing).toEqual([])
})

test('a redirected alias with no mapped price row is still missing', () => {
  const summary = summarizeSelectedPricingReadiness(
    [record('unrelated', 'configured')],
    ['claude-sonnet-5-dr'],
    JSON.stringify({ 'claude-sonnet-5-dr': 'claude-sonnet-5' })
  )

  expect(summary.configured).toBe(0)
  expect(summary.missing).toEqual(['claude-sonnet-5-dr (missing)'])
})

test('a non-configured row behind a redirect still blocks', () => {
  const summary = summarizeSelectedPricingReadiness(
    [record('claude-opus-5-dr', 'needs_review')],
    ['claude-opus-5'],
    JSON.stringify({ 'claude-opus-5-dr': 'claude-opus-5' })
  )

  expect(summary.configured).toBe(0)
  expect(summary.blocking).toEqual(['claude-opus-5 (needs_review)'])
})

test('a cyclic mapping does not invent a match', () => {
  const summary = summarizeSelectedPricingReadiness(
    [record('model-b', 'configured')],
    ['model-a'],
    JSON.stringify({ 'model-a': 'model-b', 'model-b': 'model-a' })
  )

  // resolveMappingTargetChain returns empty on a cycle; billingIdentity falls
  // back to the literal name, so "model-a" has no row.
  expect(summary.configured).toBe(0)
  expect(summary.missing).toEqual(['model-a (missing)'])
})

test('a malformed mapping falls back to exact-name matching', () => {
  const summary = summarizeSelectedPricingReadiness(
    [record('alias-dr', 'configured')],
    ['alias'],
    '{not valid json'
  )

  expect(summary.configured).toBe(0)
  expect(summary.missing).toEqual(['alias (missing)'])
})

test('without a mapping argument behavior is unchanged', () => {
  const summary = summarizeSelectedPricingReadiness(
    [record('claude-opus-4-6-dr', 'configured')],
    ['claude-opus-4-6']
  )

  expect(summary.configured).toBe(0)
  expect(summary.missing).toEqual(['claude-opus-4-6 (missing)'])
})

test('all 12 reported names become billable under a batch -dr mapping', () => {
  const names = [
    'claude-haiku-4-5',
    'claude-haiku-4-5-20251001',
    'claude-haiku-5-5',
    'claude-opus-4-5',
    'claude-opus-4-6',
    'claude-opus-4-7',
    'claude-opus-4-8',
    'claude-opus-5',
    'claude-opus-5-5',
    'claude-sonnet-4-6',
    'claude-sonnet-5',
    'claude-sonnet-5-5',
  ]
  const mapping = JSON.stringify(
    Object.fromEntries(names.map((name) => [`${name}-dr`, name]))
  )
  // Catalogue rows are keyed by the alias after the batch redirect.
  const summary = summarizeSelectedPricingReadiness(
    names.map((name) => record(`${name}-dr`, 'configured')),
    names,
    mapping
  )

  expect(summary.selected).toBe(12)
  expect(summary.configured).toBe(12)
  expect(summary.missing).toEqual([])
  expect(summary.blocking).toEqual([])
})

const CLAUDE_12 = [
  'claude-haiku-4-5',
  'claude-haiku-4-5-20251001',
  'claude-haiku-5-5',
  'claude-opus-4-5',
  'claude-opus-4-6',
  'claude-opus-4-7',
  'claude-opus-4-8',
  'claude-opus-5',
  'claude-opus-5-5',
  'claude-sonnet-4-6',
  'claude-sonnet-5',
  'claude-sonnet-5-5',
]

test('all 12 -xc0 aliases in the Uter.api wizard are billable from preview rows', () => {
  // The reported bug: the wizard selects -xc0 request names while the read-only
  // price preview still contains upstream names. Readiness must resolve both
  // sides through model_mapping and report 12/12 configured.
  const aliases = CLAUDE_12.map((name) => `${name}-xc0`)
  const mapping = JSON.stringify(
    Object.fromEntries(aliases.map((alias, index) => [alias, CLAUDE_12[index]]))
  )
  const summary = summarizeSelectedPricingReadiness(
    CLAUDE_12.map((name) => record(name, 'configured', 'uterapi')),
    aliases,
    mapping
  )

  expect(summary.selected).toBe(12)
  expect(summary.configured).toBe(12)
  expect(summary.missing).toEqual([])
  expect(summary.blocking).toEqual([])
})

// --- bidirectional mapping direction ---------------------------------------
// Batch "add suffix" can write model_mapping in either direction depending on
// the dialog choice:
//   alias -> upstream : {"claude-x-xc0": "claude-x"}   ("create aliases")
//   upstream -> alias : {"claude-x": "claude-x-xc0"}   ("change upstream name")
// Readiness is shared by every channel type, so both directions must match a
// price row keyed by either the alias or the upstream name.

test.each([
  ['alias to upstream', (n: string, a: string) => [a, n] as const],
  ['upstream to alias', (n: string, a: string) => [n, a] as const],
])(
  '12 -xc0 models are billable when mapping is %s (alias selected, upstream-keyed rows)',
  (_label, pair) => {
    const aliases = CLAUDE_12.map((name) => `${name}-xc0`)
    const mapping = JSON.stringify(
      Object.fromEntries(CLAUDE_12.map((name, i) => pair(name, aliases[i])))
    )
    const summary = summarizeSelectedPricingReadiness(
      CLAUDE_12.map((name) => record(name, 'configured')),
      aliases,
      mapping
    )
    expect(summary.configured).toBe(12)
    expect(summary.missing).toEqual([])
  }
)

test.each([
  ['alias to upstream', (n: string, a: string) => [a, n] as const],
  ['upstream to alias', (n: string, a: string) => [n, a] as const],
])(
  '12 -xc0 models are billable when mapping is %s (upstream selected, alias-keyed rows)',
  (_label, pair) => {
    const aliases = CLAUDE_12.map((name) => `${name}-xc0`)
    const mapping = JSON.stringify(
      Object.fromEntries(CLAUDE_12.map((name, i) => pair(name, aliases[i])))
    )
    const summary = summarizeSelectedPricingReadiness(
      aliases.map((alias) => record(alias, 'configured')),
      CLAUDE_12,
      mapping
    )
    expect(summary.configured).toBe(12)
    expect(summary.missing).toEqual([])
  }
)

test('a mixed-direction mapping still groups alias and upstream into one identity', () => {
  // Operators sometimes hand-edit part of the JSON. Every pair, in whichever
  // direction, must still unify the two names.
  const mapping = JSON.stringify({
    'claude-opus-4-6-xc0': 'claude-opus-4-6',
    'claude-sonnet-5': 'claude-sonnet-5-xc0',
  })
  const summary = summarizeSelectedPricingReadiness(
    [
      record('claude-opus-4-6', 'configured'),
      record('claude-sonnet-5-xc0', 'configured'),
    ],
    ['claude-opus-4-6-xc0', 'claude-sonnet-5'],
    mapping
  )
  expect(summary.configured).toBe(2)
  expect(summary.missing).toEqual([])
})

test('a two-way mapping cycle is still rejected (no invented match)', () => {
  // {"a":"b","b":"a"} is a real cycle, not two independent one-way aliases.
  // It must not collapse the two names into one billable identity.
  const summary = summarizeSelectedPricingReadiness(
    [record('model-b', 'configured')],
    ['model-a'],
    JSON.stringify({ 'model-a': 'model-b', 'model-b': 'model-a' })
  )
  expect(summary.configured).toBe(0)
  expect(summary.missing).toEqual(['model-a (missing)'])
})
