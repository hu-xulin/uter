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

import { getLobeIconNames } from '../../../lib/lobe-icon'
import {
  canonicalVendorIcon,
  canonicalVendorName,
} from '../lib/vendor-normalize'

describe('vendor normalization', () => {
  it('maps upstream aliases to the canonical vendor shown on every channel', () => {
    const cases: Array<[string, string]> = [
      ['qwen', 'Alibaba'],
      ['Qwen', 'Alibaba'],
      ['qwen-domain-model', 'Alibaba'],
      ['zhipu-ai', 'Z.AI'],
      ['ZAI', 'Z.AI'],
      ['Z.AI', 'Z.AI'],
      ['moonshot-ai', 'Moonshot'],
      ['kimi', 'Moonshot'],
      ['mini-max', 'MiniMax'],
      ['stepfun', 'StepFun'],
      ['unisound', 'Unisound'],
      ['xiaomi', 'Xiaomi'],
      ['antdigital', 'Ant Group'],
      ['tencent-token-plan', 'Tencent'],
    ]
    for (const [raw, expected] of cases) {
      expect(canonicalVendorName(raw)).toBe(expected)
    }
    expect(canonicalVendorName('Custom Vendor')).toBe('Custom Vendor')
  })

  it('derives the same logo key from the canonical vendor', () => {
    expect(canonicalVendorIcon('Z.AI', 'Z.AI')).toBe('ZAI')
    expect(canonicalVendorIcon('MiniMax', 'MiniMax')).toBe('Minimax')
    expect(canonicalVendorIcon('stepfun', '')).toBe('Stepfun')
    expect(canonicalVendorIcon('antdigital', '')).toBe('AntGroup')
    expect(canonicalVendorIcon('qwen', 'Qwen')).toBe('Alibaba')
    // No guaranteed brand glyph: both channels fall back to the shared letter.
    expect(canonicalVendorIcon('xiaomi', '')).toBe('')
    expect(canonicalVendorIcon('unisound', '')).toBe('')
    // Unknown vendors keep their configured icon.
    expect(canonicalVendorIcon('Custom Vendor', 'custom')).toBe('custom')
  })

  it('resolves every canonical vendor logo key against the installed icon registry', () => {
    // Regression guard: a display name may differ from the icon id only by
    // case (e.g. display "StepFun" vs registry id "Stepfun"). ICON_METADATA is
    // case-sensitive, so a wrong-case key silently degrades to a letter
    // fallback even when the operator configured a vendor logo.
    const available = new Set(getLobeIconNames())
    const canonicalVendors = [
      'Alibaba',
      'Anthropic',
      'Ant Group',
      'Baidu',
      'ByteDance',
      'DeepSeek',
      'Google',
      'Meta',
      'MiniMax',
      'Moonshot',
      'OpenAI',
      'StepFun',
      'Tencent',
      'Z.AI',
      // Deliberately no brand glyphs; an empty key means letter fallback.
      'Xiaomi',
      'Unisound',
    ]
    const noGlyph = new Set(['Xiaomi', 'Unisound'])

    for (const vendor of canonicalVendors) {
      const key = canonicalVendorIcon(vendor, '')
      if (noGlyph.has(vendor)) {
        expect(key, `${vendor} should intentionally fall back`).toBe('')
        continue
      }
      expect(key, `${vendor} must resolve to a non-empty icon key`).not.toBe('')
      expect(
        available.has(key.split('.')[0]),
        `${vendor} icon key "${key}" is not present in @lobehub/icons registry`
      ).toBe(true)
    }
  })
})
