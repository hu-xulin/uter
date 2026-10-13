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

import {
  activeInterfaceLanguage,
  normalizeInterfaceLanguage,
} from '../languages'

describe('normalizeInterfaceLanguage', () => {
  it('maps the spellings the API and the browser produce', () => {
    expect(normalizeInterfaceLanguage('zh-CN')).toBe('zhCN')
    expect(normalizeInterfaceLanguage('zhCN')).toBe('zhCN')
    expect(normalizeInterfaceLanguage('zh-TW')).toBe('zhTW')
    expect(normalizeInterfaceLanguage('zh-HK')).toBe('zhTW')
  })

  it('falls back to English for anything unsupported', () => {
    expect(normalizeInterfaceLanguage(undefined)).toBe('en')
    expect(normalizeInterfaceLanguage('de')).toBe('en')
  })
})

describe('activeInterfaceLanguage', () => {
  it('reports the chosen language, not the language its strings came from', () => {
    /*
     * The exact state i18next is in at startup for a Chinese reader: only `en`
     * is registered, so the strings in hand come from the fallback while the
     * chosen language is `zhCN`. Resolving the fallback here is what made the
     * app fetch `en.json`, never load the `zhCN` chunk, and render the whole
     * interface in English.
     */
    expect(
      activeInterfaceLanguage({ language: 'zhCN', resolvedLanguage: 'en' })
    ).toBe('zhCN')
  })

  it('normalizes whatever the detector hands over', () => {
    expect(activeInterfaceLanguage({ language: 'zh-CN' })).toBe('zhCN')
    expect(activeInterfaceLanguage({ language: 'en-US' })).toBe('en')
    expect(activeInterfaceLanguage({})).toBe('en')
  })
})
