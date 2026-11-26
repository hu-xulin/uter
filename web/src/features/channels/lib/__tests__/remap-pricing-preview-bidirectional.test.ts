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

import {
  canonicalRedirectPairs,
  remapPricingRowsForPreview,
} from '../model-mapping-validation'

test.each([
  ['alias to upstream', (a: string, u: string) => [a, u] as const],
  ['upstream to alias', (a: string, u: string) => [u, a] as const],
])('saved upstream rows remap to the request alias for %s', (_label, pair) => {
  const mapping = JSON.stringify({
    [pair('claude-opus-4-6-xc0', 'claude-opus-4-6')[0]]: pair(
      'claude-opus-4-6-xc0',
      'claude-opus-4-6'
    )[1],
  })
  const remapped = remapPricingRowsForPreview(
    [{ model_name: 'claude-opus-4-6', pricing_status: 'configured' }],
    mapping,
    ['claude-opus-4-6-xc0']
  )
  expect(remapped.map((row) => row.model_name)).toEqual(['claude-opus-4-6-xc0'])
})

test('canonicalRedirectPairs decides direction from the published model list', () => {
  const mapping = {
    'claude-opus-4-6-xc0': 'claude-opus-4-6',
    'claude-sonnet-5': 'claude-sonnet-5-xc0',
  }
  const pairs = canonicalRedirectPairs(mapping, [
    'claude-opus-4-6-xc0',
    'claude-sonnet-5',
  ])
  expect(pairs).toEqual(
    expect.arrayContaining([
      { request: 'claude-opus-4-6-xc0', upstream: 'claude-opus-4-6' },
      { request: 'claude-sonnet-5', upstream: 'claude-sonnet-5-xc0' },
    ])
  )
  expect(pairs).toHaveLength(2)
})

test('an ambiguous pair (both or neither published) is not guessed', () => {
  const pairs = canonicalRedirectPairs({ a: 'b' }, ['a', 'b'])
  expect(pairs).toEqual([])
})
