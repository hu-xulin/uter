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
 * The bundled docs site (a Next.js static export in `web/dist/docs-content`)
 * ships all seven supported locales — `zh`, `zh-TW`, `en`, `fr`, `ja`,
 * `ru`, `vi` — each with its own translated content (API reference, user
 * guide, about pages, legal docs). The gateway SPA serves the same seven
 * UI locales, so this map maps every UI language onto its own docs
 * locale rather than collapsing them onto `zh`/`en`. Adding a new docs
 * translation only requires editing this file.
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
 * Single entry path the UI links to for the bundled docs site.
 *
 * Visiting `/docs` renders the SPA's own shell — the shared public
 * header plus the statically exported docs site framed underneath —
 * so the docs read as part of the app instead of replacing it. The
 * shell is mounted at `/docs` (see `routes/docs.tsx`) and the clean,
 * encoding-free path `/docs/<lang>/<page>` (handled by
 * `routes/docs/$.tsx`) carries the exact page being shown, so a reload
 * or a shared link reopens the same page. The framed content itself
 * lives under {@link DOCS_CONTENT_PREFIX} (`/docs-content/docs/...`),
 * deliberately distinct from this host route so the reader-facing URL
 * stays legible.
 *
 * Using a single, locale-free URL keeps the "View docs" button href
 * stable across the whole SPA and leaves the locale choice to whatever
 * language the user has the page set to — no manual prefixing
 * required.
 */
export const DOCS_ENTRY_PATH = '/docs'

/**
 * Mount prefix the *bundled docs content* is served from.
 *
 * The docs site is a Next.js static export copied into `web/dist/docs-content`
 * (see `docs-web/scripts/copy-to-web.mjs`) and mounted at `/docs-content/…` by
 * the Go gateway, so the framed content lives under
 * `/docs-content/docs/<lang>/…`. The SPA's own docs route is `/docs` (see
 * `routes/docs.tsx` + `routes/docs/$.tsx`); the two are deliberately distinct
 * so a clean, encoding-free host URL like `/docs/zh/api/…` can be the SPA
 * route while the iframe loads the real static page from
 * `/docs-content/docs/zh/api/…`.
 */
export const DOCS_CONTENT_PREFIX = '/docs-content/docs'

/** Convert a host docs path (`/docs/<lang>/…`) to its content path. */
export function hostToContent(hostPath: string): string {
  if (!hostPath.startsWith(`${DOCS_ENTRY_PATH}/`)) return `${DOCS_CONTENT_PREFIX}${hostPath}`
  return `${DOCS_CONTENT_PREFIX}${hostPath.slice(DOCS_ENTRY_PATH.length)}`
}

/** Convert a content path (`/docs-content/docs/<lang>/…`) back to the host path. */
export function contentToHost(contentPath: string): string {
  if (!contentPath.startsWith(`${DOCS_CONTENT_PREFIX}/`)) return `${DOCS_ENTRY_PATH}${contentPath}`
  return `${DOCS_ENTRY_PATH}${contentPath.slice(DOCS_CONTENT_PREFIX.length)}`
}

/**
 * Normalise an arbitrary path coming from the framed docs site (or from a
 * stored host URL) into a trusted content path, or `null` if it cannot be
 * derived. Accepts three shapes the bridge / route may produce:
 *  - `/docs-content/docs/<lang>/…` — already a content path
 *  - `/docs/<lang>/…`            — a host path (stripped and re-prefixed)
 *  - `/<lang>/…`                 — a bare locale path (prefixed)
 * The locale segment must be one we actually ship (`zh`, `zh-TW`, `en`,
 * `fr`, `ja`, `ru`, `vi`); anything else — empty, or a non-locale segment
 * like `/docs/legacy/…` — is rejected so the viewer can fall back to the
 * locale landing instead of framing a missing page.
 */
const DOCS_LOCALE_RE = /^(zh|zh-TW|en|fr|ja|ru|vi)$/

export function coerceToContent(raw: string | undefined): string | null {
  if (!raw) return null
  let path = raw
  if (path.startsWith(`${DOCS_CONTENT_PREFIX}/`)) {
    // already a content path
  } else if (path.startsWith(`${DOCS_ENTRY_PATH}/`)) {
    path = hostToContent(path)
  } else if (/^\/(zh|zh-TW|en|fr|ja|ru|vi)\//.test(path)) {
    path = `${DOCS_CONTENT_PREFIX}${path}`
  } else {
    return null
  }
  const m = new RegExp(`^${DOCS_CONTENT_PREFIX}/([^/]+)/`).exec(path)
  if (!m || !DOCS_LOCALE_RE.test(m[1])) return null
  return path
}

/**
 * Convert a docs path the bridge / a caller produces into the `?/$` splat
 * for the SPA `/docs/$` route (e.g. `zh/api/audio-openai/`), or `null`
 * when the input can't be resolved to a real docs page. The path may be a
 * content path (`/docs-content/docs/…`) or a host path (`/docs/…`) — both
 * normalise to the same splat.
 */
export function toDocsSplat(raw: string | undefined): string | null {
  const content = coerceToContent(raw)
  if (!content) return null
  const host = contentToHost(content)
  if (!host.startsWith(`${DOCS_ENTRY_PATH}/`)) return null
  return host.slice(DOCS_ENTRY_PATH.length + 1)
}

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
 * Content path of the Uter docs site for a given locale — i.e. the URL the
 * iframe actually loads. The static export is served by the Go gateway
 * under {@link DOCS_CONTENT_PREFIX}, so the real content lives at
 * `/docs-content/docs/<lang>/` while the host route the reader sees is the
 * locale-free `/docs` (or the clean `/docs/<lang>/<page>`). Use
 * {@link hostToContent} / {@link contentToHost} to cross between the two.
 *
 * `docs-web` is a Next.js static export (built with
 * `basePath: '/docs-content'`) copied into `web/dist/docs-content` and
 * served by the Go gateway at `/docs-content/docs/<lang>/...`. We mirror
 * the supported-locale list there in `docs-web/src/lib/i18n.ts`; this
 * file is the SPA's counterpart so both sides agree.
 */
export function docsPathFor(locale: DocsLocaleCode): string {
  return `${DOCS_CONTENT_PREFIX}/${locale}/`
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
 * Full content path of the page the docs open on, for a given locale.
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
 * locale — e.g. `/docs-content/docs/en/legal/recharge-agreement/`.
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
 * Mount prefix the *bundled About content* is served from.
 *
 * About shares the `docs-web` static export with the docs site; under the
 * `basePath: '/docs-content'` it is emitted at `out/docs-content/about/<lang>/…`
 * and mounted by the Go gateway at `/docs-content/about/…`. The SPA's own
 * `/about` route (see `routes/about/index.tsx`) frames this content, so the
 * reader-facing URL stays the locale-free `/about` while the iframe loads
 * the real static page from `/docs-content/about/<lang>/…`.
 */
export const ABOUT_CONTENT_PREFIX = '/docs-content/about'

export function aboutPathFor(locale: DocsLocaleCode): string {
  return `${ABOUT_CONTENT_PREFIX}/${locale}/`
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
