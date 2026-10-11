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
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * These cover the code-split locale strategy: only `en` may live in the entry
 * chunk, and the other six must be fetched through `loadLocaleBundle` so a
 * visitor only pays for the language they actually read.
 */

const dynamicImports: string[] = []

vi.mock('@/i18n/locales/zh.json', () => {
  dynamicImports.push('zh.json')
  return { default: { translation: { 'Save changes': '保存更改' } } }
})
vi.mock('@/i18n/locales/zh-TW.json', () => {
  dynamicImports.push('zh-TW.json')
  return { default: { translation: { 'Save changes': '儲存變更' } } }
})
vi.mock('@/i18n/locales/fr.json', () => {
  dynamicImports.push('fr.json')
  return { default: { translation: { 'Save changes': 'Enregistrer' } } }
})
vi.mock('@/i18n/locales/ru.json', () => {
  dynamicImports.push('ru.json')
  return { default: { translation: { 'Save changes': 'Сохранить' } } }
})
vi.mock('@/i18n/locales/ja.json', () => {
  dynamicImports.push('ja.json')
  return { default: { translation: { 'Save changes': '保存' } } }
})
vi.mock('@/i18n/locales/vi.json', () => {
  dynamicImports.push('vi.json')
  return { default: { translation: { 'Save changes': 'Lưu' } } }
})

async function importFresh() {
  vi.resetModules()
  dynamicImports.length = 0
  return import('@/i18n/locale-loaders')
}

describe('loadLocaleBundle', () => {
  beforeEach(async () => {
    await importFresh()
  })

  it('returns null for English without importing any locale chunk', async () => {
    const { loadLocaleBundle } = await import('@/i18n/locale-loaders')

    await expect(loadLocaleBundle('en')).resolves.toBeNull()
    expect(dynamicImports).toEqual([])
  })

  it.each([
    ['zhCN', 'zh.json'],
    ['zhTW', 'zh-TW.json'],
    ['fr', 'fr.json'],
    ['ru', 'ru.json'],
    ['ja', 'ja.json'],
    ['vi', 'vi.json'],
  ] as const)(
    'loads %s from its own %s chunk',
    async (code, file) => {
      const { loadLocaleBundle } = await import('@/i18n/locale-loaders')

      const bundle = await loadLocaleBundle(code)

      expect(bundle?.translation['Save changes']).toBeTruthy()
      expect(dynamicImports).toEqual([file])
    }
  )

  it('imports a locale chunk only once across repeated calls', async () => {
    const { loadLocaleBundle } = await import('@/i18n/locale-loaders')

    // `loadLocaleBundle` memoizes per language, so all three callers must
    // observe the very same bundle — proof the dynamic import ran once.
    const [first, second] = await Promise.all([
      loadLocaleBundle('ja'),
      loadLocaleBundle('ja'),
    ])
    const third = await loadLocaleBundle('ja')

    expect(second).toBe(first)
    expect(third).toBe(first)
  })

  it('resolves to null instead of rejecting when the chunk fails to load', async () => {
    vi.doMock('@/i18n/locales/ru.json', () => {
      throw new Error('chunk load failed')
    })
    vi.resetModules()
    dynamicImports.length = 0

    const { loadLocaleBundle } = await import('@/i18n/locale-loaders')

    // A failed locale must never break rendering: the caller keeps `en`.
    await expect(loadLocaleBundle('ru')).resolves.toBeNull()
  })
})
