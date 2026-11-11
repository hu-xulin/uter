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
import type { ComponentType } from 'react'

import {
  DOCS_ENTRY_PATH,
  DOCS_LANDING_SEGMENT,
  DOCS_LOCALE_PAIRS,
  type DocsLocaleCode,
} from '@/lib/docs-link'

import {
  docRefForPagePath,
  docsModulePath,
  type NativeDocRef,
} from './docs-content'
import { UserGuideIndex } from './user-guide-index'

/**
 * The native docs loader — the content-source layer that replaces the
 * Next.js static export during the Path 2 convergence.
 *
 * Every Markdown file migrated into `web/src/docs-content/` is compiled
 * by Rsbuild's MDX pipeline and registered here through `import.meta.glob`
 * as a **lazy** import: a page's component loads only when a reader opens
 * it, so the 576-page corpus code-splits per document instead of weighing
 * down the entry bundle. Files not yet migrated are simply absent from
 * the map — the docs layout falls back to the iframe viewer for them,
 * which keeps the whole documentation reachable during the staged cutover.
 */
const modules = import.meta.glob('../../../docs-content/**/*.mdx')

/** Shape of a compiled MDX module. */
export type NativeDocModule = {
  default: ComponentType<Record<string, unknown>>
}

/**
 * Resolve the lazy loader for a doc, or `null` when that page has not
 * been migrated into `web/src/docs-content/` yet.
 */
export function loadNativeDoc(
  locale: DocsLocaleCode,
  ref: NativeDocRef
): (() => Promise<NativeDocModule>) | null {
  // The guide's landing is synthesised (chapter cards), not a Markdown
  // document — its "module" is always available.
  if (ref.set === 'user-guide' && ref.slug === 'index') {
    return () =>
      Promise.resolve({
        default: UserGuideIndex as unknown as ComponentType<
          Record<string, unknown>
        >,
      })
  }
  const suffix = `/docs-content/${docsModulePath(ref, locale)}`
  for (const [key, loader] of Object.entries(modules)) {
    if (key.endsWith(suffix)) {
      return loader as () => Promise<NativeDocModule>
    }
  }
  return null
}

/**
 * Decide whether the current `/docs` location can render natively.
 *
 * Returns the locale + page path to render, or `null` to let the layout
 * fall back to the iframe viewer. Accepted shapes:
 *
 * - `/docs` (or `/docs/`)            — the locale landing (特性说明)
 * - `/docs/<locale>`                 — that locale's landing
 * - `/docs/<locale>/<page path>`     — a specific page
 *
 * The first segment must be a shipped docs locale; anything else (e.g. a
 * stray `/docs/legacy/…`) goes to the iframe viewer, which already knows
 * how to recover from unknown splats.
 */
export function nativeDocsTarget(
  pathname: string,
  fallbackLocale: DocsLocaleCode
): { locale: DocsLocaleCode; pagePath: string } | null {
  let locale = fallbackLocale
  let pagePath = DOCS_LANDING_SEGMENT

  if (pathname.startsWith(`${DOCS_ENTRY_PATH}/`)) {
    const rest = pathname.slice(DOCS_ENTRY_PATH.length + 1).replace(/\/+$/, '')
    if (rest !== '') {
      const slash = rest.indexOf('/')
      const first = slash === -1 ? rest : rest.slice(0, slash)
      if (!Object.hasOwn(DOCS_LOCALE_PAIRS, first)) return null
      locale = first as DocsLocaleCode
      pagePath = slash === -1 ? DOCS_LANDING_SEGMENT : rest.slice(slash + 1)
    }
  }

  const ref = docRefForPagePath(pagePath)
  if (!ref) return null
  if (!loadNativeDoc(locale, ref)) return null
  return { locale, pagePath }
}
