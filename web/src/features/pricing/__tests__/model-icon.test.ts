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

import { pricingModelIconKey } from '../lib/model-helpers'

describe('pricingModelIconKey', () => {
  it('uses the transparent OpenAI glyph for bare and color/avatar keys', () => {
    expect(pricingModelIconKey('OpenAI')).toBe('OpenAI.Mono')
    expect(pricingModelIconKey('OpenAI.Avatar')).toBe('OpenAI.Mono')
    expect(pricingModelIconKey('OpenAI.Color')).toBe('OpenAI.Mono')
  })

  it('uses the transparent OpenAI glyph for chained and mixed-case keys', () => {
    expect(pricingModelIconKey(`OpenAI.Avatar.type={'platform'}`)).toBe(
      'OpenAI.Mono'
    )
    expect(pricingModelIconKey(' openai.avatar ')).toBe('OpenAI.Mono')
  })

  it('keeps other product logos in their brand-color variant', () => {
    expect(pricingModelIconKey('Claude')).toBe('Claude.Color')
    expect(pricingModelIconKey('Qwen')).toBe('Qwen.Color')
  })

  it('keeps an empty icon empty so the card renders its initial', () => {
    expect(pricingModelIconKey('')).toBe('')
    expect(pricingModelIconKey(undefined)).toBe('')
  })
})
