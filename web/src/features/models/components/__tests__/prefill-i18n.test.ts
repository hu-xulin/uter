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

import en from '@/i18n/locales/en.json'
import fr from '@/i18n/locales/fr.json'
import ja from '@/i18n/locales/ja.json'
import ru from '@/i18n/locales/ru.json'
import vi from '@/i18n/locales/vi.json'
import zhTW from '@/i18n/locales/zh-TW.json'
import zh from '@/i18n/locales/zh.json'

import { PREFILL_GROUP_TYPES } from '../prefill-group-shared'

const LOCALES = {
  en: en.translation,
  zh: zh.translation,
  'zh-TW': zhTW.translation,
  fr: fr.translation,
  ru: ru.translation,
  ja: ja.translation,
  vi: vi.translation,
}

// 这些文案在组件里经 t(label) / t(description) 变量形式消费，
// check-i18n-keys.mjs 的静态 t('...') 扫描覆盖不到。缺键时中文界面会
// 直接回退显示英文原文，因此必须由本测试守住。
const DYNAMIC_KEYS = [
  ...PREFILL_GROUP_TYPES.flatMap((type) => [type.label, type.description]),
  'No description provided',
  '{{count}} item(s)',
  'No endpoint mappings configured.',
  'No items configured yet.',
]

describe('prefill group dynamic i18n keys', () => {
  it('exists in all 7 locales', () => {
    const missing: string[] = []
    for (const key of DYNAMIC_KEYS) {
      for (const [language, bundle] of Object.entries(LOCALES)) {
        if (!(key in bundle)) missing.push(`${key} [${language}]`)
      }
    }
    expect(missing).toEqual([])
  })

  it('is translated to non-English in zh', () => {
    const zhBundle: Record<string, string> = LOCALES.zh
    const untranslated = DYNAMIC_KEYS.filter((key) => zhBundle[key] === key)
    expect(untranslated).toEqual([])
  })
})
