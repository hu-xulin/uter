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

For commercial licensing, please contact support@Uter.ai.com
*/

/**
 * Locale → docs-path prefix mapping.
 *
 * The bundled docs site (a Next.js static export in `web/dist/docs`)
 * ships Chinese (`zh`) and English (`en`) landing pages today. The
 * gateway SPA still serves a wider set of UI locales (zh-CN, zh-TW,
 * fr, ja, ru, vi) — this map is the single source of truth that
 * collapses them onto the docs locales we actually author content
 * for. Adding a new docs translation only requires editing this file.
 *
 * The SPA tags its own interface languages with non-standard camelCase
 * codes — `zhCN` / `zhTW`, see `i18n/languages.ts#INTERFACE_LANGUAGE_OPTIONS`
 * — and it is those codes, not BCP-47 ones, that reach us through
 * `i18n.language`. They are listed alongside the standard tags so a
 * Chinese UI resolves to the Chinese docs; without them every Chinese
 * reader was sent to the English site.
 */
export const DOCS_LOCALE_PAIRS = {
  zh: ['zh', 'zh-CN', 'zh-TW', 'zh-HK', 'zh-Hans', 'zh-Hant', 'zhCN', 'zhTW'],
  en: ['en', 'en-US', 'en-GB', 'en-AU', 'en-CA'],
} as const

export type DocsLocaleCode = keyof typeof DOCS_LOCALE_PAIRS

/**
 * Fallback docs locale when the UI locale is missing or not part of
 * the recognised UI set. English is the default — Chinese variants
 * resolve through {@link DOCS_LOCALE_PAIRS}; everything else (fr, ja,
 * ru, vi, unknown codes) lands here.
 */
export const DEFAULT_DOCS_LOCALE: DocsLocaleCode = 'en'

/**
 * Single entry path the UI links to for the bundled docs site.
 *
 * Visiting `/docs` renders the SPA's own shell — the shared public
 * header plus the statically exported docs site framed underneath —
 * so the docs read as part of the app instead of replacing it. The
 * route resolves the locale-matching landing (`/docs/zh/` for Chinese
 * variants, `/docs/en/` for everything else) from the active UI
 * language and, on later navigations inside the frame, mirrors the
 * docs page back into this route's `?p=` search param.
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
 * Entry path of the Uter docs site for a given locale. The docs
 * site is mounted at `/docs/<lang>/` by the Go gateway; the rest of
 * the path is just the `docs` prefix concatenated with the locale.
 *
 * `docs-web` is a Next.js static export copied into `web/dist/docs`
 * and served by the Go gateway at `/docs/<lang>/...`. We mirror the
 * supported-locale list there in `docs-web/src/lib/i18n.ts`; this
 * file is the SPA's counterpart so both sides agree.
 */
export function docsPathFor(locale: DocsLocaleCode): string {
  return `/docs/${locale}/`
}

/**
 * Path segment of the page the docs open on: 特性说明 (Features).
 *
 * The docs site has no landing page of its own any more — the
 * quick-start page that used to sit at `/docs/<lang>/` is gone and that
 * route now forwards here — so the entry has to name a real page. The
 * segment is locale-neutral, exactly like the slugs in the docs
 * sidebar, which is what lets a UI-language switch keep the reader on
 * the same page in the other language.
 */
export const DOCS_LANDING_SEGMENT =
  'guide/wiki/basic-concepts/features-introduction'

/**
 * Full path of the page the docs open on, for a given locale.
 *
 * Distinct from {@link docsPathFor}, which is only the locale prefix:
 * switching UI language keeps the reader where they are by swapping the
 * prefix and leaving the rest of the path alone, so that is the piece
 * callers doing a re-point need. This one is for opening the docs fresh.
 */
export function docsLandingPathFor(locale: DocsLocaleCode): string {
  return `${docsPathFor(locale)}${DOCS_LANDING_SEGMENT}`
}

/**
 * Path of a legal document in the bundled docs site, for a given
 * locale — e.g. `/docs/en/legal/recharge-agreement/`.
 *
 * The legal documents are authored once, in
 * `docs-web/content/legal/<locale>/<doc>.md`, and that docs page is the
 * one the SPA shows: the copy in System Settings, which `/api/<doc>`
 * serves, is a single untranslated text and is only kept as the fallback
 * for when `docs_link` points outside the bundled docs. Rendering the
 * configured text directly would show the same language to every reader,
 * because the settings copy has no per-language variants to switch
 * between.
 *
 * `docId` matches the docs filename and the `content/nav.json` entry
 * (`user-agreement`, `privacy-policy`, `recharge-agreement`); the ids
 * are locale-neutral, which is what lets a language switch land on the
 * same document in the other language.
 */
export function legalDocsPathFor(
  locale: DocsLocaleCode,
  docId: string
): string {
  return `${docsPathFor(locale)}legal/${docId}/`
}

/**
 * Entry path of the About page for a given locale.
 *
 * About is the second static page the gateway serves from the same
 * export (`docs-web`), mounted at `/about/<lang>/`. The SPA's `/about`
 * route frames it exactly the way `/docs` frames the docs site, so the
 * two share the locale resolution above and only differ in prefix.
 */
export function aboutPathFor(locale: DocsLocaleCode): string {
  return `/about/${locale}/`
}

/**
 * Resolve the docs landing URL for the current SPA locale.
 *
 * The SPA accepts many UI locales; we collapse them onto the
 * supported docs locale pairs via {@link DOCS_LOCALE_PAIRS}. Anything
 * that isn't a recognised UI code falls back to {@link DEFAULT_DOCS_LOCALE}.
 */
export function docsPathForSpaLocale(
  spaLocale: string | null | undefined
): string {
  return docsPathFor(resolveDocsLocaleCode(spaLocale))
}

/**
 * Pure classifier — given an arbitrary locale code, return the docs
 * locale we ship content for. Kept separate from `docsPathForSpaLocale`
 * so call sites that only need the code (analytics, log forwarding)
 * don't have to deal with path strings.
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
