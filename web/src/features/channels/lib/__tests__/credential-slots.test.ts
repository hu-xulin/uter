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

import {
  buildCredentialSlots,
  createCredentialSlot,
  splitCredentialKeys,
  type CredentialSlot,
} from '../credential-slots'

const groups = new Map([
  ['eco', { name: 'Uter.api-Claude-ecode', group: 'Claude-ecode' }],
  ['std', { name: 'Uter.api-Claude-max', group: 'Claude-max' }],
])
const resolveGroup = (name: string) => groups.get(name) ?? null

function row(
  groupName: string,
  mode: CredentialSlot['mode'],
  keysText: string
): CredentialSlot {
  return { ...createCredentialSlot(groupName, mode), keysText }
}

describe('splitCredentialKeys', () => {
  test('one key per line, blanks removed and duplicates collapsed', () => {
    expect(splitCredentialKeys(' sk-a \n\nsk-b\nsk-a\n  ')).toEqual([
      'sk-a',
      'sk-b',
    ])
  })
})

describe('buildCredentialSlots', () => {
  test('single mode keeps only the first key for one channel', () => {
    const result = buildCredentialSlots(
      [row('eco', 'single', 'sk-a\nsk-b')],
      resolveGroup,
      false
    )
    expect(result.slots).toEqual([
      { name: 'Uter.api-Claude-ecode', group: 'Claude-ecode', keys: ['sk-a'] },
    ])
    expect(result.empty).toBe(false)
  })

  test('batch mode creates one channel per key', () => {
    const result = buildCredentialSlots(
      [row('eco', 'batch', 'sk-a\nsk-b\nsk-c')],
      resolveGroup,
      false
    )
    expect(result.slots).toEqual([
      {
        name: 'Uter.api-Claude-ecode 1',
        group: 'Claude-ecode',
        keys: ['sk-a'],
      },
      {
        name: 'Uter.api-Claude-ecode 2',
        group: 'Claude-ecode',
        keys: ['sk-b'],
      },
      {
        name: 'Uter.api-Claude-ecode 3',
        group: 'Claude-ecode',
        keys: ['sk-c'],
      },
    ])
  })

  test('multi_to_single puts all keys on one channel for rotation', () => {
    const result = buildCredentialSlots(
      [row('eco', 'multi_to_single', 'sk-a\nsk-b')],
      resolveGroup,
      false
    )
    expect(result.slots).toEqual([
      {
        name: 'Uter.api-Claude-ecode',
        group: 'Claude-ecode',
        keys: ['sk-a', 'sk-b'],
      },
    ])
  })

  test('different groups can use different key modes in one submission', () => {
    const result = buildCredentialSlots(
      [
        row('eco', 'multi_to_single', 'sk-a\nsk-b'),
        row('std', 'single', 'sk-c'),
      ],
      resolveGroup,
      false
    )
    expect(result.slots).toEqual([
      {
        name: 'Uter.api-Claude-ecode',
        group: 'Claude-ecode',
        keys: ['sk-a', 'sk-b'],
      },
      { name: 'Uter.api-Claude-max', group: 'Claude-max', keys: ['sk-c'] },
    ])
  })

  test('empty keys fall back to saved server key; no saved key is an error', () => {
    const withFallback = buildCredentialSlots(
      [row('eco', 'single', '')],
      resolveGroup,
      true
    )
    expect(withFallback.slots).toEqual([
      { name: 'Uter.api-Claude-ecode', group: 'Claude-ecode', keys: [] },
    ])
    expect(withFallback.hasMissingKey).toBe(false)
    expect(withFallback.empty).toBe(false)

    const withoutFallback = buildCredentialSlots(
      [row('eco', 'single', '')],
      resolveGroup,
      false
    )
    expect(withoutFallback.hasMissingKey).toBe(true)
    expect(withoutFallback.empty).toBe(false)
  })

  test('rows without a chosen group are ignored', () => {
    const result = buildCredentialSlots(
      [row('', 'single', 'sk-a')],
      resolveGroup,
      false
    )
    expect(result.empty).toBe(true)
    expect(result.slots).toEqual([])
  })
})
