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

import { sortUterapiGroupSlots } from '../channel-utils'

const familyOf = (label: string) => label.split('·')[0]?.trim() ?? ''

describe('sortUterapiGroupSlots', () => {
  test('groups every model family together and sorts families alphabetically', () => {
    const labels = [
      'Grok · 经济（测试中，偶发不稳）',
      'Codex · 标准（稳定）',
      'Grok · 标准（稳定快速）',
      'Codex · 高级（稳定快速）',
      'DeepSeek 官方',
      'Claude Code · 经济（不稳定）',
      'Codex · 企业（稳定快速）',
      '生图 · Nano Banana 4K',
      '生图 · 标准',
      'Claude Code · 福利（无 Fable 模型）',
      'Claude Code · 标准（稳定）',
      'Claude Code · 高级（稳定快速）',
      'Gemini · 标准',
      '生图 · 4K',
    ]

    const sorted = sortUterapiGroupSlots(labels.map((label) => ({ label })))

    expect(sorted.map((slot) => familyOf(slot.label))).toEqual([
      'Claude Code',
      'Claude Code',
      'Claude Code',
      'Claude Code',
      'Codex',
      'Codex',
      'Codex',
      'DeepSeek 官方',
      'Gemini',
      'Grok',
      'Grok',
      '生图',
      '生图',
      '生图',
    ])
  })

  test('falls back to the whole label when no model separator is present', () => {
    const sorted = sortUterapiGroupSlots([
      { label: 'Grok · 标准' },
      { label: 'Alpha' },
      { label: 'Codex · 高级' },
    ])

    expect(sorted.map((slot) => slot.label)).toEqual([
      'Alpha',
      'Codex · 高级',
      'Grok · 标准',
    ])
  })

  test('does not mutate the input list', () => {
    const input = [{ label: 'Grok · 标准' }, { label: 'Claude Code · 标准' }]

    sortUterapiGroupSlots(input)

    expect(input.map((slot) => slot.label)).toEqual([
      'Grok · 标准',
      'Claude Code · 标准',
    ])
  })
})
