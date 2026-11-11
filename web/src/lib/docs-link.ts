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

/**
 * Locale → docs-path mapping for the **native** documentation.
 *
 * The docs are part of the SPA now: every page lives in
 * `web/src/docs-content/<set>/<locale>/…` as MDX, is compiled into the
 * bundle as a lazy chunk and is served by the gateway on the same origin
 * as the app — there is no separate static site and no iframe any more.
 * The seven supported locales — `zh`, `zh-TW`, `en`, `fr`, `ja`, `ru`,
 * `vi` — each ship their own translated content, and the gateway SPA
 * serves those same seven UI locales, so this map maps every UI language
 * onto its own docs locale rather than collapsing them onto `zh`/`en`.
 * Adding a new docs translation only requires editing this file.
 *
 * The SPA tags its own interface languages with non-standard camelCase
 * codes — `zhCN` / `zhTW`, see `i18n/languages.ts#INTERFACE_LANGUAGE_OPTIONS`
 * — and it is those codes, not BCP-47 ones, that reach us through
 * `i18n.language`. They are listed alongside the standard tags so a
 * Traditional-Chinese UI resolves to the Traditional-Chinese docs and a
 * French UI to the French docs; without the camelCase codes every reader
 * would be sent to the fallback locale.
 */
export const DOCS_LOCALE_PAIRS = {
  zh: ['zh', 'zh-CN', 'zh-Hans', 'zhCN'],
  'zh-TW': ['zh-TW', 'zh-HK', 'zh-Hant', 'zhTW'],
  en: ['en', 'en-US', 'en-GB', 'en-AU', 'en-CA'],
  fr: ['fr', 'fr-FR', 'fr-CA'],
  ru: ['ru', 'ru-RU'],
  ja: ['ja', 'ja-JP'],
  vi: ['vi', 'vi-VN'],
} as const

export type DocsLocaleCode = keyof typeof DOCS_LOCALE_PAIRS

/**
 * Fallback docs locale when the UI locale is missing or not part of
 * the recognised UI set. English is the default — every supported UI
 * locale (zh, zh-TW, en, fr, ja, ru, vi) resolves through
 * {@link DOCS_LOCALE_PAIRS}; only truly unknown codes (ko, es, de, …)
 * land here.
 */
export const DEFAULT_DOCS_LOCALE: DocsLocaleCode = 'en'

/**
 * Single entry path the UI links to for the documentation.
 *
 * `/docs` renders the SPA's own docs shell — the shared public header
 * plus the natively rendered page underneath — so the docs read as part
 * of the app instead of replacing it. A locale-qualified path
 * (`/docs/<lang>/<page>`) carries the exact page being shown, so a
 * reload or a shared link reopens the same page.
 *
 * Using a single, locale-free URL keeps the "View docs" button href
 * stable across the whole SPA and leaves the locale choice to whatever
 * language the user has the page set to — no manual prefixing
 * required.
 */
export const DOCS_ENTRY_PATH = '/docs'

/**
 * Whether an href resolves to the bundled docs entry the SPA renders
 * itself ({@link DOCS_ENTRY_PATH}) rather than an admin-configured
 * destination.
 *
 * Callers use this to decide between an SPA `<Link>` and a plain
 * anchor: only the bundled entry is an SPA route. A configured
 * `docs_link` may point anywhere (usually an external knowledge base),
 * and the SPA does not own that target.
 */
export function isBundledDocsHref(href: string): boolean {
  return href === DOCS_ENTRY_PATH
}

/**
 * Host path of one docs locale root — e.g. `/docs/zh`.
 *
 * The pages below a locale root are `<set>/<slug>`: `apps/<slug>` for an
 * AI application, `api/<slug>` for an API reference page, `legal/<docId>`
 * for a legal document, and the fixed features path for the landing page
 * ({@link DOCS_LANDING_SEGMENT}). The reader-facing URL is the host path
 * itself — the content is served by the same origin, so there is no
 * second prefix to translate between.
 */
export function docsPathFor(locale: DocsLocaleCode): string {
  return `${DOCS_ENTRY_PATH}/${locale}`
}

/**
 * Path segment of the page the docs open on: 特性说明 (Features).
 *
 * The docs have no separate landing page — the entry names a real page
 * instead — so it has to be spelled out. The segment is locale-neutral,
 * exactly like the slugs in the docs sidebar, which is what lets a
 * UI-language switch keep the reader on the same page in the other
 * language.
 */
export const DOCS_LANDING_SEGMENT =
  'guide/wiki/basic-concepts/features-introduction'

/**
 * Host path of a legal document in the bundled docs, for a given locale
 * — e.g. `/docs/zh/legal/recharge-agreement`.
 *
 * The legal documents are authored once, in
 * `web/src/docs-content/legal/<locale>/<doc>.mdx`, and that page is the
 * one the SPA shows: the copy in System Settings, which `/api/<doc>`
 * serves, is a single untranslated text and is only kept as the fallback
 * for when `docs_link` points outside the bundled docs. Rendering the
 * configured text directly would show the same language to every reader,
 * because the settings copy has no per-language variants to switch
 * between.
 *
 * `docId` matches the docs filename and the `nav.json` entry
 * (`user-agreement`, `privacy-policy`, `recharge-agreement`); the ids
 * are locale-neutral, which is what lets a language switch land on the
 * same document in the other language.
 */
export function legalDocsPathFor(
  locale: DocsLocaleCode,
  docId: string
): string {
  return `${docsPathFor(locale)}/legal/${docId}`
}

/**
 * Pure classifier — given an arbitrary locale code, return the docs
 * locale we ship content for. Call sites that only need the code
 * (analytics, log forwarding) don't have to deal with path strings.
 */
export function resolveDocsLocaleCode(
  spaLocale: string | null | undefined
): DocsLocaleCode {
  if (!spaLocale) return DEFAULT_DOCS_LOCALE
  const normalized = spaLocale.toLowerCase()
  for (const [docsLocale, spaAliases] of Object.entries(DOCS_LOCALE_PAIRS) as [
    DocsLocaleCode,
    readonly string[],
  ][]) {
    if (spaAliases.some((alias) => normalized === alias.toLowerCase())) {
      return docsLocale
    }
  }
  return DEFAULT_DOCS_LOCALE
}

/**
 * Resolve the docs target from the `docs_link` value in `/api/status`.
 *
 * Admins may point it at an external knowledge base instead; when the
 * value is blank, or the status payload has not loaded yet, fall back
 * to the locale-free entry path ({@link DOCS_ENTRY_PATH}). The SPA's
 * `/docs` route renders that entry as an in-app page (and picks the
 * locale-matching landing from the current UI language), so the
 * `docs_link` UI stays locale-free and the button stays a single href
 * regardless of language. Compare the result against
 * {@link DOCS_ENTRY_PATH} — or call {@link isBundledDocsHref} — before
 * rendering an SPA `<Link>`.
 */
export function resolveDocsHref(link: unknown): string {
  const configured = typeof link === 'string' ? link.trim() : ''
  if (configured) return configured
  return DOCS_ENTRY_PATH
}
