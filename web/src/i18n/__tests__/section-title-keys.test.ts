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
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import en from '@/i18n/locales/en.json'
import fr from '@/i18n/locales/fr.json'
import ja from '@/i18n/locales/ja.json'
import ru from '@/i18n/locales/ru.json'
import vi from '@/i18n/locales/vi.json'
import zhTW from '@/i18n/locales/zh-TW.json'
import zh from '@/i18n/locales/zh.json'

const LOCALES = {
  en: en.translation,
  zh: zh.translation,
  'zh-TW': zhTW.translation,
  fr: fr.translation,
  ru: ru.translation,
  ja: ja.translation,
  vi: vi.translation,
}

const FEATURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'features'
)

function findSectionRegistries(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      found.push(...findSectionRegistries(full))
    } else if (entry.name === 'section-registry.tsx') {
      found.push(full)
    }
  }
  return found
}

/** 收集所有 section-registry 里字面量写死的 titleKey（即 `t(section.titleKey)` 的入参）。 */
function collectTitleKeys(files: string[]): string[] {
  const keys = new Set<string>()
  for (const file of files) {
    const source = readFileSync(file, 'utf-8')
    for (const match of source.matchAll(/titleKey:\s*'([^']+)'/g)) {
      keys.add(match[1])
    }
  }
  return [...keys].sort()
}

describe('section registry title keys', () => {
  const files = findSectionRegistries(FEATURES_DIR)
  const keys = collectTitleKeys(files)

  it('actually discovers the registries it guards', () => {
    // 路径写错或文件被移走时，下面的存在性断言会空转而失去意义，这里先兜底。
    expect(files.length).toBeGreaterThan(0)
    expect(keys.length).toBeGreaterThan(0)
  })

  it('exists in all 7 locales', () => {
    /*
     * titleKey 经 t(section.titleKey) 动态消费，check-i18n-keys.mjs 的静态
     * t() 扫描覆盖不到。漏一个键的症状就是侧边栏/页头在所有语言里都显示英文
     * 原文（曾出现：Sessions and retries 7 份语言包全部缺失）。
     */
    const missing: string[] = []
    for (const key of keys) {
      for (const [language, bundle] of Object.entries(LOCALES)) {
        if (!(key in bundle)) {
          missing.push(`${key} [${language}]`)
        }
      }
    }
    expect(missing).toEqual([])
  })
})
