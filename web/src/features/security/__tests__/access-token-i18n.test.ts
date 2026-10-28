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
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * The Access tokens card renders permission names through `t()`, but those
 * names do not live in the React tree:
 *
 *   - group headings come from `GROUP_LABELS` in `../lib/access-token-catalog`
 *   - resource/action names come from the **Go backend**
 *     (`service/access_token_scope.go` → `label_key` / `description_key`)
 *
 * Both sides ship English source strings, so a key that never made it into
 * `i18n/locales/*.json` silently falls back to English and the card looks
 * untranslated — which is exactly the bug this test pins down.
 *
 * The backend literals are read straight from the Go source so adding a new
 * permission without its translations fails here instead of in production.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = resolve(HERE, '../../../..')
const REPO_ROOT = resolve(WEB_ROOT, '..')

const LOCALES = ['en', 'zh', 'zh-TW', 'ja', 'fr', 'ru', 'vi'] as const
const NON_ENGLISH = LOCALES.filter((locale) => locale !== 'en')

/** Group headings rendered by `PermissionMatrix` via `t(labelKey)`. */
const GROUP_LABELS = ['Personal', 'Administration', 'System']

/**
 * Strings that are intentionally identical in every locale: brand names,
 * protocol names and copy-paste examples. Translating these would be wrong.
 */
const UNTRANSLATABLE = new Set([
  'GitHub',
  'Discord',
  'Telegram',
  'WeChat',
  'LinuxDO',
  'OIDC',
  'OAuth',
  'Passkey',
  'Email',
  'https://example.com/webhook',
  'https://gotify.example.com',
  'https://api.day.app/yourkey/{{title}}/{{content}}',
])

/** The Access tokens card files whose UI strings must be localized. */
const ACCESS_TOKEN_SOURCES = [
  'src/features/security/components/access-tokens-card.tsx',
  'src/features/security/components/access-token-item.tsx',
  'src/features/security/components/dialogs/access-token-create-dialog.tsx',
  'src/features/security/components/dialogs/access-token-edit-dialog.tsx',
  'src/features/security/components/dialogs/access-token-dialog.tsx',
  'src/features/security/hooks/use-access-tokens.ts',
]

/**
 * Every user-visible string the Access tokens card can render.
 *
 * Two sources, and both matter:
 *   1. `t('...')` called inline by the components
 *   2. `labelKey: '...'` in the catalog/schema tables, which the component
 *      later passes to `t()` — these are invisible to a `t(` search, and the
 *      expiry presets (`30 days`, `1 year`) were missing from every locale
 *      because of exactly that blind spot.
 */
function accessTokenUiKeys(): string[] {
  const files = [
    ...ACCESS_TOKEN_SOURCES,
    'src/features/security/lib/access-token-schema.ts',
    'src/features/security/lib/access-token-catalog.ts',
  ]
  const keys = new Set<string>()
  for (const relative of files) {
    const source = readFileSync(resolve(WEB_ROOT, relative), 'utf8')
    for (const match of source.matchAll(/\bt\(\s*'([^']+)'/g)) {
      keys.add(match[1])
    }
    for (const match of source.matchAll(
      /\b(?:labelKey|descriptionKey|titleKey)\s*:\s*'([^']+)'/g
    )) {
      keys.add(match[1])
    }
  }
  return [...keys]
}

function backendPermissionKeys(): string[] {
  const source = readFileSync(
    resolve(REPO_ROOT, 'service/access_token_scope.go'),
    'utf8'
  )
  const keys = new Set<string>()
  for (const match of source.matchAll(
    /(?:LabelKey|DescriptionKey):\s*"([^"]+)"/g
  )) {
    keys.add(match[1])
  }
  return [...keys]
}

function translationsFor(locale: string): Record<string, string> {
  const raw = JSON.parse(
    readFileSync(resolve(WEB_ROOT, `src/i18n/locales/${locale}.json`), 'utf8')
  ) as { translation: Record<string, string> }
  return raw.translation
}

describe('access token permission i18n coverage', () => {
  const keys = [...GROUP_LABELS, ...backendPermissionKeys()]

  it('finds the backend permission strings it is meant to guard', () => {
    // Guards against the regex silently matching nothing (e.g. the Go file
    // being reformatted), which would make every other assertion vacuous.
    expect(keys.length).toBeGreaterThan(20)
    expect(keys).toContain('API keys')
    expect(keys).toContain('View')
  })

  it.each(LOCALES)('translates every permission name in %s', (locale) => {
    const translation = translationsFor(locale)
    const missing = keys.filter((key) => !(key in translation))
    expect(missing).toEqual([])
  })

  it.each(LOCALES)('has no untranslated placeholder in %s', (locale) => {
    // A key mapped to its own English text is a real gap for non-English
    // locales: it renders as English in an otherwise translated UI.
    if (locale === 'en') return
    const translation = translationsFor(locale)
    const untranslated = keys.filter(
      (key) =>
        key in translation &&
        translation[key] === key &&
        !UNTRANSLATABLE.has(key)
    )
    expect(untranslated).toEqual([])
  })
})

/**
 * The permission matrix is only half of the card. The card chrome — title,
 * empty state, token metadata, dialogs — is translated separately, and that is
 * where the original "Access tokens 没做多语言" report came from: every key
 * existed in every locale but still held the English source string.
 */
describe('access token card UI i18n coverage', () => {
  const keys = accessTokenUiKeys()

  it('finds the card strings it is meant to guard', () => {
    expect(keys.length).toBeGreaterThan(30)
    // These are the exact strings that used to render as English in the
    // Chinese UI even though the key existed in zh.json.
    expect(keys).toContain('Access tokens')
    expect(keys).toContain('Create access token')
    expect(keys).toContain('Never used')
    expect(keys).toContain('No access tokens')
    // Indirect keys from the schema table — absent from every locale until the
    // scanner looked at `labelKey` as well.
    expect(keys).toContain('30 days')
    expect(keys).toContain('1 year')
  })

  it.each(LOCALES)('defines every card string in %s', (locale) => {
    const translation = translationsFor(locale)
    const missing = keys.filter((key) => !(key in translation))
    expect(missing).toEqual([])
  })

  it.each(NON_ENGLISH)(
    'actually translates every card string in %s',
    (locale) => {
      const translation = translationsFor(locale)
      const untranslated = keys.filter(
        (key) =>
          key in translation &&
          translation[key] === key &&
          !UNTRANSLATABLE.has(key)
      )
      expect(untranslated).toEqual([])
    }
  )

  it.each(NON_ENGLISH)('keeps interpolation tokens intact in %s', (locale) => {
    // A translation that drops or renames `{{count}}` silently renders a
    // literal placeholder-less sentence, or throws at render time.
    const translation = translationsFor(locale)
    const broken: string[] = []
    for (const key of keys) {
      const value = translation[key]
      if (value === undefined) continue
      const expected = [...key.matchAll(/\{\{(\w+)\}\}/g)]
        .map((match) => match[1])
        .sort()
      const actual = [...value.matchAll(/\{\{(\w+)\}\}/g)]
        .map((match) => match[1])
        .sort()
      if (expected.join(',') !== actual.join(',')) {
        broken.push(`${key} -> ${value}`)
      }
    }
    expect(broken).toEqual([])
  })
})
