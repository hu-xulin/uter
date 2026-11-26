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
  compareModelVersionDesc,
  sortModelsByVersionDesc,
} from '../model-version-sort'

describe('compareModelVersionDesc', () => {
  test('major version wins over a smaller major with a minor segment', () => {
    // The operator's example: Qwen4 is newer than Qwen3.8.
    expect(compareModelVersionDesc('Qwen4-Max', 'Qwen3.8-Max')).toBeLessThan(0)
    expect(compareModelVersionDesc('Qwen3.8-Max', 'Qwen4-Max')).toBeGreaterThan(
      0
    )
  })

  test('later release date wins, including zero-padded dates', () => {
    expect(
      compareModelVersionDesc(
        'DeepSeek-v4-flash-1017',
        'DeepSeek-v4-flash-0916'
      )
    ).toBeLessThan(0)
    expect(
      compareModelVersionDesc(
        'DeepSeek-v4-flash-260910',
        'DeepSeek-v4-flash-250911'
      )
    ).toBeLessThan(0)
  })

  test('compares numeric value, not string length or digits', () => {
    expect(compareModelVersionDesc('model-100', 'model-99')).toBeLessThan(0)
    expect(compareModelVersionDesc('v4.10', 'v4.9')).toBeLessThan(0)
    expect(compareModelVersionDesc('v4.9', 'v4.10')).toBeGreaterThan(0)
  })

  test('missing numeric segments are treated as zero', () => {
    // Qwen4 [4] vs Qwen3.8 [3,8]: first segment decides.
    expect(compareModelVersionDesc('Qwen4', 'Qwen3.8')).toBeLessThan(0)
    // A bare major is older than the same major with a minor.
    expect(compareModelVersionDesc('Qwen3.8', 'Qwen3')).toBeLessThan(0)
  })

  test('identical numbers compare equal regardless of surrounding text or case', () => {
    expect(compareModelVersionDesc('Qwen4-Max', 'qwen4-max')).toBe(0)
    expect(compareModelVersionDesc('v4', 'gpt-4')).toBe(0)
  })

  test('a name with no numeric segment is older than one with a version', () => {
    expect(compareModelVersionDesc('gpt', 'gpt-4')).toBeGreaterThan(0)
    expect(compareModelVersionDesc('gpt-4', 'gpt')).toBeLessThan(0)
    expect(compareModelVersionDesc('gpt', 'claude')).toBe(0)
  })
})

describe('sortModelsByVersionDesc', () => {
  test('puts the newest models first within each vendor family', () => {
    // The picker groups models by vendor, so the operator-visible guarantee is
    // that each vendor's versions run newest-first after sorting a mixed list.
    const models = [
      'deepseek-v4-flash-0916',
      'Qwen3.8-Max',
      'claude-opus-4-5',
      'DeepSeek-v4-flash-1017',
      'Qwen4-Max',
      'claude-opus-4-6',
      'legacy-model',
    ]
    const sorted = sortModelsByVersionDesc(models)
    expect(sorted.filter((model) => /^qwen/i.test(model))).toEqual([
      'Qwen4-Max',
      'Qwen3.8-Max',
    ])
    expect(sorted.filter((model) => /deepseek/i.test(model))).toEqual([
      'DeepSeek-v4-flash-1017',
      'deepseek-v4-flash-0916',
    ])
    expect(sorted.filter((model) => /claude/i.test(model))).toEqual([
      'claude-opus-4-6',
      'claude-opus-4-5',
    ])
    expect(sorted.at(-1)).toBe('legacy-model')
  })

  test('orders full version chains newest-first', () => {
    expect(
      sortModelsByVersionDesc([
        'Qwen3.8-Max',
        'Qwen3.10-Max',
        'Qwen3-Max',
        'Qwen4-Max',
      ])
    ).toEqual(['Qwen4-Max', 'Qwen3.10-Max', 'Qwen3.8-Max', 'Qwen3-Max'])
  })

  test('is stable for names with identical numeric segments', () => {
    expect(
      sortModelsByVersionDesc(['gpt-4o-pro', 'gpt-4o', 'gpt-4o-mini'])
    ).toEqual(['gpt-4o-pro', 'gpt-4o', 'gpt-4o-mini'])
  })

  test('handles empty and single-element lists', () => {
    expect(sortModelsByVersionDesc([])).toEqual([])
    expect(sortModelsByVersionDesc(['Qwen4-Max'])).toEqual(['Qwen4-Max'])
  })

  test('does not mutate the input array', () => {
    const models = ['v3', 'v4', 'v1']
    const snapshot = [...models]
    expect(sortModelsByVersionDesc(models)).toEqual(['v4', 'v3', 'v1'])
    expect(models).toEqual(snapshot)
  })
})
