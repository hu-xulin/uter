/*
Copyright (C) 2023-2026 Uter.ai:

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
  toDocsHostSplat,
  toDocsSplat,
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

  test('DOCS_LOCALE_PAIRS maps every supported UI locale onto its own docs locale', () => {
    // All seven UI languages now have a first-class docs locale, so the
    // docs/about/legal pages render in the reader's language instead of
    // collapsing onto zh/en.
    expect(DOCS_LOCALE_PAIRS.zh).toEqual(
      expect.arrayContaining(['zh', 'zh-CN', 'zh-Hans', 'zhCN'])
    )
    expect(DOCS_LOCALE_PAIRS['zh-TW']).toEqual(
      expect.arrayContaining(['zh-TW', 'zh-HK', 'zh-Hant', 'zhTW'])
    )
    expect(DOCS_LOCALE_PAIRS.en).toEqual(
      expect.arrayContaining(['en', 'en-US', 'en-GB'])
    )
    expect(DOCS_LOCALE_PAIRS.fr).toEqual(expect.arrayContaining(['fr']))
    expect(DOCS_LOCALE_PAIRS.ru).toEqual(expect.arrayContaining(['ru']))
    expect(DOCS_LOCALE_PAIRS.ja).toEqual(expect.arrayContaining(['ja']))
    expect(DOCS_LOCALE_PAIRS.vi).toEqual(expect.arrayContaining(['vi']))
  })

  test('DOCS_LOCALE_PAIRS carries the SPA’s own camelCase interface codes', () => {
    // `i18n.language` holds these camelCase codes, never a BCP-47 tag,
    // so omitting them made every reader fall through to the fallback
    // locale. zhCN → Simplified docs, zhTW → Traditional-Chinese docs.
    expect(DOCS_LOCALE_PAIRS.zh).toEqual(expect.arrayContaining(['zhCN']))
    expect(DOCS_LOCALE_PAIRS['zh-TW']).toEqual(expect.arrayContaining(['zhTW']))
  })

  test('docsLandingPathFor opens the docs on 特性说明, not on a landing page', () => {
    // The quick-start landing is gone from the docs site; the entry has
    // to name a real page, and 特性说明 is the first entry in the
    // sidebar. The returned value is the *content* path (the iframe
    // source), served under the `/docs-content` basePath. It ends with a
    // slash because the docs export sets `trailingSlash: true` and the Go
    // static handler resolves directories through their index file.
    expect(docsLandingPathFor('zh')).toBe(
      `/docs-content/docs/zh/${DOCS_LANDING_SEGMENT}/`
    )
    expect(docsLandingPathFor('en')).toBe(
      `/docs-content/docs/en/${DOCS_LANDING_SEGMENT}/`
    )
    expect(DOCS_LANDING_SEGMENT).toBe(
      'guide/wiki/basic-concepts/features-introduction'
    )
  })

  test('resolveDocsLocaleCode maps i18next language codes onto docs locales', () => {
    expect(resolveDocsLocaleCode('zhCN')).toBe('zh')
    expect(resolveDocsLocaleCode('zhTW')).toBe('zh-TW')
    expect(resolveDocsLocaleCode('en')).toBe('en')
    expect(resolveDocsLocaleCode('fr')).toBe('fr')
    expect(resolveDocsLocaleCode('ru')).toBe('ru')
    expect(resolveDocsLocaleCode('ja')).toBe('ja')
    expect(resolveDocsLocaleCode('vi')).toBe('vi')
  })

  test('docsPathFor returns the content path (iframe source) under /docs-content', () => {
    expect(docsPathFor('zh')).toBe('/docs-content/docs/zh/')
    expect(docsPathFor('en')).toBe('/docs-content/docs/en/')
  })

  test('resolveDocsLocaleCode maps every supported UI locale to its own docs locale', () => {
    const zhCases = ['zh', 'zh-CN', 'zh-Hans', 'zhCN', 'ZH-cn']
    for (const code of zhCases) {
      expect(resolveDocsLocaleCode(code)).toBe('zh')
    }

    const zhTwCases = ['zh-TW', 'zh-HK', 'zh-Hant', 'zhTW']
    for (const code of zhTwCases) {
      expect(resolveDocsLocaleCode(code)).toBe('zh-TW')
    }

    const enCases = ['en', 'en-US', 'en-GB', 'EN-au']
    for (const code of enCases) {
      expect(resolveDocsLocaleCode(code)).toBe('en')
    }

    // Each supported non-Chinese UI language resolves to its own docs
    // locale so the docs/about/legal pages render in that language.
    expect(resolveDocsLocaleCode('fr')).toBe('fr')
    expect(resolveDocsLocaleCode('ja')).toBe('ja')
    expect(resolveDocsLocaleCode('ru')).toBe('ru')
    expect(resolveDocsLocaleCode('vi')).toBe('vi')

    // Truly unknown codes (not shipped as UI locales) fall back to English.
    const fallbackCases = ['ko', 'es', 'de', 'xx']
    for (const code of fallbackCases) {
      expect(resolveDocsLocaleCode(code)).toBe('en')
    }

    expect(resolveDocsLocaleCode(null)).toBe('en')
    expect(resolveDocsLocaleCode(undefined)).toBe('en')
    expect(resolveDocsLocaleCode('')).toBe('en')
  })

  test('docsPathForSpaLocale returns the per-locale content path for every UI language', () => {
    // Aliases are BCP-47 tags because they're used to map browser-detected
    // locales (and persisted UI preferences stored as BCP-47). i18next
    // itself uses camelCase (`zhCN`/`zhTW`) internally; that conversion
    // happens in `languages.ts#convertDetectedLanguage` before the value
    // reaches `i18n.language`, so by the time we read it for resolve,
    // it has already been normalized back to a BCP-47 form for matching
    // — see the SPA's i18n config (`web/src/i18n/config.ts`).
    // The value is the *content* path (iframe source) under /docs-content.
    expect(docsPathForSpaLocale('zh-CN')).toBe('/docs-content/docs/zh/')
    expect(docsPathForSpaLocale('zh-TW')).toBe('/docs-content/docs/zh-TW/')
    expect(docsPathForSpaLocale('zh-HK')).toBe('/docs-content/docs/zh-TW/')
    expect(docsPathForSpaLocale('zh-Hans')).toBe('/docs-content/docs/zh/')
    expect(docsPathForSpaLocale('fr')).toBe('/docs-content/docs/fr/')
    expect(docsPathForSpaLocale('ja')).toBe('/docs-content/docs/ja/')
    expect(docsPathForSpaLocale('ru')).toBe('/docs-content/docs/ru/')
    expect(docsPathForSpaLocale('vi')).toBe('/docs-content/docs/vi/')
  })

  test('docsPathForSpaLocale falls back to /docs-content/docs/en/ for unknown UI codes', () => {
    expect(docsPathForSpaLocale('en')).toBe('/docs-content/docs/en/')
    expect(docsPathForSpaLocale('ko')).toBe('/docs-content/docs/en/')
    expect(docsPathForSpaLocale(null)).toBe('/docs-content/docs/en/')
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

describe('host vs frame splat', () => {
  // The export is built with `trailingSlash: true`, so the framed site and
  // every path it reports over postMessage carry a trailing slash. The
  // address bar must NOT keep it — the SPA route is not a directory — while
  // the frame's src MUST, because the content mount resolves directory
  // indexes and 301s the unslashed form.
  test('toDocsSplat keeps the trailing slash the static mount needs', () => {
    expect(toDocsSplat('/docs/zh/guide/wiki/model-testing/')).toBe(
      'zh/guide/wiki/model-testing/'
    )
    expect(toDocsSplat('/docs-content/docs/zh/guide/wiki/model-testing/')).toBe(
      'zh/guide/wiki/model-testing/'
    )
  })

  test('toDocsHostSplat strips it for the address bar', () => {
    expect(toDocsHostSplat('/docs/zh/guide/wiki/model-testing/')).toBe(
      'zh/guide/wiki/model-testing'
    )
    expect(toDocsHostSplat('/docs/zh/guide/wiki/model-testing')).toBe(
      'zh/guide/wiki/model-testing'
    )
    expect(
      toDocsHostSplat('/docs-content/docs/zh/guide/wiki/model-testing/')
    ).toBe('zh/guide/wiki/model-testing')
  })

  test('toDocsHostSplat leaves the locale root bare', () => {
    // Stripping would empty the splat, and `/docs/zh` is already shortest.
    expect(toDocsHostSplat('/docs/zh/')).toBe('zh')
  })

  test('toDocsHostSplat still rejects a non-docs path', () => {
    expect(toDocsHostSplat('/docs/legacy/x/')).toBeNull()
    expect(toDocsHostSplat(undefined)).toBeNull()
  })
})
