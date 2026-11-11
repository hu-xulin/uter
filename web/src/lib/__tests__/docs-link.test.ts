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
  docsPathFor,
  isBundledDocsHref,
  legalDocsPathFor,
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

  test('DOCS_LANDING_SEGMENT names the native features landing as a bare splat', () => {
    // The native `/docs/$` route and `nativeDocsTarget()` both treat this
    // as the page part of `/docs/<locale>/<page>`, so a leading or trailing
    // slash here would break the cold-open landing. Keep the contract pinned
    // now that the framed export (and its trailing-slash URLs) is gone.
    expect(DOCS_LANDING_SEGMENT).toBe(
      'guide/wiki/basic-concepts/features-introduction'
    )
    expect(DOCS_LANDING_SEGMENT.startsWith('/')).toBe(false)
    expect(DOCS_LANDING_SEGMENT.endsWith('/')).toBe(false)
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

  test('resolveDocsLocaleCode maps i18next language codes onto docs locales', () => {
    expect(resolveDocsLocaleCode('zhCN')).toBe('zh')
    expect(resolveDocsLocaleCode('zhTW')).toBe('zh-TW')
    expect(resolveDocsLocaleCode('en')).toBe('en')
    expect(resolveDocsLocaleCode('fr')).toBe('fr')
    expect(resolveDocsLocaleCode('ru')).toBe('ru')
    expect(resolveDocsLocaleCode('ja')).toBe('ja')
    expect(resolveDocsLocaleCode('vi')).toBe('vi')
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
})

describe('native docs paths', () => {
  test('docsPathFor points at the SPA locale root', () => {
    // The docs are native routes now: the content is served by the same
    // origin as the app, so the reader-facing URL IS the docs URL. A
    // second prefix (`/docs-content/…`) would send readers to a path
    // that no longer exists.
    expect(docsPathFor('zh')).toBe('/docs/zh')
    expect(docsPathFor('zh-TW')).toBe('/docs/zh-TW')
    expect(docsPathFor('en')).toBe('/docs/en')
  })

  test('legalDocsPathFor addresses the legal set under the locale root', () => {
    // `docRefForPagePath()` maps `legal/<docId>` to
    // `web/src/docs-content/legal/<locale>/<docId>.mdx`, so the host path
    // has to keep the same shape — no trailing slash, no extra prefix.
    expect(legalDocsPathFor('zh', 'user-agreement')).toBe(
      '/docs/zh/legal/user-agreement'
    )
    expect(legalDocsPathFor('en', 'privacy-policy')).toBe(
      '/docs/en/legal/privacy-policy'
    )
    expect(legalDocsPathFor('vi', 'recharge-agreement')).toBe(
      '/docs/vi/legal/recharge-agreement'
    )
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
    // Only the bundled entry is an SPA route that can render the native
    // docs in-app; every other target has to leave the app.
    expect(isBundledDocsHref(DOCS_ENTRY_PATH)).toBe(true)
    expect(isBundledDocsHref('/docs/zh/')).toBe(false)
    expect(isBundledDocsHref('https://docs.example.com')).toBe(false)
    expect(isBundledDocsHref('/knowledge-base')).toBe(false)
    expect(isBundledDocsHref('')).toBe(false)
  })
})
