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

import { colorIconName, monoIconName } from '../lobe-icon'

describe('colorIconName', () => {
  test('upgrades a monochrome brand key to its color variant', () => {
    // Claude ships a ".Color" glyph, so the pricing cards get brand colors.
    expect(colorIconName('Claude')).toBe('Claude.Color')
    expect(colorIconName('Gemini')).toBe('Gemini.Color')
    expect(colorIconName('Qwen')).toBe('Qwen.Color')
  })

  test('falls back to the avatar variant for brands without a color glyph', () => {
    // OpenAI / Moonshot only ship ".Avatar" (brand background + glyph), which
    // is still a colored rendering rather than a currentColor silhouette.
    expect(['OpenAI.Avatar', 'OpenAI.Color']).toContain(colorIconName('OpenAI'))
    expect(['Moonshot.Avatar', 'Moonshot.Color']).toContain(
      colorIconName('Moonshot')
    )
  })

  test('leaves keys that already target a color rendering untouched', () => {
    expect(colorIconName('Claude.Color')).toBe('Claude.Color')
    expect(colorIconName('OpenAI.Avatar')).toBe('OpenAI.Avatar')
    expect(colorIconName(`Claude.Avatar.type={'platform'}`)).toBe(
      `Claude.Avatar.type={'platform'}`
    )
  })

  test('passes through empty and unknown keys', () => {
    expect(colorIconName('')).toBe('')
    expect(colorIconName('   ')).toBe('')
    expect(colorIconName('NotABrand')).toBe('NotABrand')
  })
})

describe('monoIconName', () => {
  test('strips a bare color variant so the icon follows currentColor', () => {
    expect(monoIconName('Gemini.Color')).toBe('Gemini')
    expect(monoIconName('  Qwen.Color ')).toBe('Qwen')
  })

  test('leaves monochrome and advanced chain forms untouched', () => {
    expect(monoIconName('OpenAI')).toBe('OpenAI')
    expect(monoIconName(`Claude.Avatar.type={'platform'}`)).toBe(
      `Claude.Avatar.type={'platform'}`
    )
  })

  test('handles empty input', () => {
    expect(monoIconName('')).toBe('')
    expect(monoIconName('   ')).toBe('')
  })
})
