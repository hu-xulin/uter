/*
Copyright (C) 2023-2026 QuantumNous:

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

For commercial licensing, please contact support@quantumnous.com
*/
import { describe, expect, test } from 'vitest'

import {
  DEFAULT_DOCS_LOCALE,
  DOCS_ENTRY_PATH,
  DOCS_LANDING_SEGMENT,
  DOCS_LOCALE_PAIRS,
  docsLandingPathFor,
  docsPathFor,
  docsPathForSpaLocale,
  isBundledDocsHref,
  resolveDocsHref,
  resolveDocsLocaleCode,
} from '../docs-link'

describe('docs-link helpers', () => {
  test('DEFAULT_DOCS_LOCALE is English so unknown UI locales land on /docs/en/', () => {
    // The "View docs" button resolves to /docs (the SPA entry path),
    // and the SPA route picks the landing by UI locale. Anything not
    // recognised as Chinese should default to the English docs site.
    expect(DEFAULT_DOCS_LOCALE).toBe('en')
  })

  test('DOCS_ENTRY_PATH is the locale-free /docs entry', () => {
    expect(DOCS_ENTRY_PATH).toBe('/docs')
  })

  test('DOCS_LOCALE_PAIRS covers the Chinese variants under zh and English variants under en', () => {
    expect(DOCS_LOCALE_PAIRS.zh).toEqual(
      expect.arrayContaining(['zh', 'zh-CN', 'zh-TW', 'zh-HK'])
    )
    expect(DOCS_LOCALE_PAIRS.en).toEqual(
      expect.arrayContaining(['en', 'en-US', 'en-GB'])
    )
  })

  test('DOCS_LOCALE_PAIRS carries the SPA’s own zhCN / zhTW interface codes', () => {
    // `i18n.language` holds these camelCase codes, never a BCP-47 tag,
    // so omitting them made every Chinese reader fall through to the
    // English docs site.
    expect(DOCS_LOCALE_PAIRS.zh).toEqual(
      expect.arrayContaining(['zhCN', 'zhTW'])
    )
  })

  test('docsLandingPathFor opens the docs on 特性说明, not on a landing page', () => {
    // The quick-start landing is gone from the docs site; the entry has
    // to name a real page, and 特性说明 is the first entry in the
    // sidebar.
    expect(docsLandingPathFor('zh')).toBe(
      `/docs/zh/${DOCS_LANDING_SEGMENT}`
    )
    expect(docsLandingPathFor('en')).toBe(
      `/docs/en/${DOCS_LANDING_SEGMENT}`
    )
    expect(DOCS_LANDING_SEGMENT).toBe(
      'guide/wiki/basic-concepts/features-introduction'
    )
  })

  test('resolveDocsLocaleCode maps i18next language codes onto docs locales', () => {
    expect(resolveDocsLocaleCode('zhCN')).toBe('zh')
    expect(resolveDocsLocaleCode('zhTW')).toBe('zh')
    expect(resolveDocsLocaleCode('en')).toBe('en')
    expect(resolveDocsLocaleCode('fr')).toBe('en')
  })

  test('docsPathFor returns the locale-suffixed landing with a trailing slash', () => {
    expect(docsPathFor('zh')).toBe('/docs/zh/')
    expect(docsPathFor('en')).toBe('/docs/en/')
  })

  test('resolveDocsLocaleCode maps Chinese UI locales to zh and the rest to en', () => {
    const zhCases = [
      'zh',
      'zh-CN',
      'zh-TW',
      'zh-HK',
      'zh-Hans',
      'zh-Hant',
      'ZH-cn',
    ]
    for (const code of zhCases) {
      expect(resolveDocsLocaleCode(code)).toBe('zh')
    }

    const enCases = ['en', 'en-US', 'en-GB', 'EN-au']
    for (const code of enCases) {
      expect(resolveDocsLocaleCode(code)).toBe('en')
    }

    // Other UI languages the SPA ships (fr, ja, ru, vi) fall back to
    // the English docs site because we only author zh/en content.
    const fallbackCases = ['fr', 'ja', 'ru', 'vi', 'ko', 'es', 'de']
    for (const code of fallbackCases) {
      expect(resolveDocsLocaleCode(code)).toBe('en')
    }

    expect(resolveDocsLocaleCode(null)).toBe('en')
    expect(resolveDocsLocaleCode(undefined)).toBe('en')
    expect(resolveDocsLocaleCode('')).toBe('en')
  })

  test('docsPathForSpaLocale returns /docs/zh/ for Chinese UI codes', () => {
    // Aliases are BCP-47 tags because they're used to map browser-detected
    // locales (and persisted UI preferences stored as BCP-47). i18next
    // itself uses camelCase (`zhCN`/`zhTW`) internally; that conversion
    // happens in `languages.ts#convertDetectedLanguage` before the value
    // reaches `i18n.language`, so by the time we read it for resolve,
    // it has already been normalized back to a BCP-47 form for matching
    // — see the SPA's i18n config (`web/src/i18n/config.ts`).
    expect(docsPathForSpaLocale('zh-CN')).toBe('/docs/zh/')
    expect(docsPathForSpaLocale('zh-TW')).toBe('/docs/zh/')
    expect(docsPathForSpaLocale('zh-HK')).toBe('/docs/zh/')
    expect(docsPathForSpaLocale('zh-Hans')).toBe('/docs/zh/')
  })

  test('docsPathForSpaLocale falls back to /docs/en/ for non-Chinese UI codes', () => {
    expect(docsPathForSpaLocale('en')).toBe('/docs/en/')
    expect(docsPathForSpaLocale('fr')).toBe('/docs/en/')
    expect(docsPathForSpaLocale('ja')).toBe('/docs/en/')
    expect(docsPathForSpaLocale(null)).toBe('/docs/en/')
  })
})

describe('resolveDocsHref', () => {
  test('returns an admin-configured external URL verbatim when set', () => {
    expect(resolveDocsHref('https://docs.example.com')).toBe(
      'https://docs.example.com'
    )
    expect(resolveDocsHref('  https://docs.example.com  ')).toBe(
      'https://docs.example.com'
    )
  })

  test('falls back to the locale-free /docs entry path when no admin link is configured', () => {
    // The button href stays stable regardless of the active UI locale
    // — the SPA's `/docs` route resolves the locale-specific landing
    // when the user actually clicks the button.
    expect(resolveDocsHref('')).toBe(DOCS_ENTRY_PATH)
    expect(resolveDocsHref('   ')).toBe(DOCS_ENTRY_PATH)
    expect(resolveDocsHref(null)).toBe(DOCS_ENTRY_PATH)
    expect(resolveDocsHref(undefined)).toBe(DOCS_ENTRY_PATH)
  })

  test('ignores non-string configured values', () => {
    expect(resolveDocsHref(42)).toBe(DOCS_ENTRY_PATH)
    expect(resolveDocsHref({ url: '/foo' })).toBe(DOCS_ENTRY_PATH)
  })
})

describe('isBundledDocsHref', () => {
  test('is true only for the SPA-owned /docs entry', () => {
    // Only the bundled entry is an SPA route that can render the docs
    // export in-app; every other target has to leave the app.
    expect(isBundledDocsHref(DOCS_ENTRY_PATH)).toBe(true)
    expect(isBundledDocsHref('/docs/zh/')).toBe(false)
    expect(isBundledDocsHref('https://docs.example.com')).toBe(false)
    expect(isBundledDocsHref('/knowledge-base')).toBe(false)
    expect(isBundledDocsHref('')).toBe(false)
  })
})
