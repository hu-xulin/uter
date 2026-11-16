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
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'

import { resolveDocsLocaleCode, type DocsLocaleCode } from '@/lib/docs-link'
import { labelTaskListCheckboxes } from '@/lib/task-checkbox-a11y'

import { Callout } from './callout'
import { DocsCodeBlock } from './docs-code-block'
import { docRefForPagePath, NATIVE_USER_GUIDE_PATH } from './docs-content'
import { loadNativeDoc } from './docs-loader'
import { NativeDocsShell, type TocItem } from './docs-shell'
import { DocsTable } from './docs-table'
import { PROSE_CLASSES } from './prose-classes'

/**
 * A natively rendered docs page — no iframe, no fumadocs.
 *
 * The page component is resolved through {@link loadNativeDoc} and loaded
 * lazily (one chunk per document). The layout route only mounts this view
 * when the requested page has actually been migrated into
 * `web/src/docs-content/`, so an unmigrated page still reaches the framed
 * export and the documentation never goes dark during the cutover.
 *
 * Switching the UI language re-points the URL at the same page in the
 * other locale — both locales ship the same page tree — mirroring what
 * the iframe viewer does over `postMessage`.
 */
export function NativeDocsView({
  locale,
  pagePath,
}: {
  locale: DocsLocaleCode
  pagePath: string
}) {
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const docsLocale = resolveDocsLocaleCode(i18n.language)

  const loader = useMemo(() => {
    const ref = docRefForPagePath(pagePath)
    return ref ? loadNativeDoc(locale, ref) : null
  }, [locale, pagePath])

  const [Doc, setDoc] = useState<ComponentType<Record<string, unknown>> | null>(
    null
  )

  useEffect(() => {
    setDoc(null)
    if (!loader) return
    let alive = true
    loader()
      .then((module) => {
        if (alive) setDoc(() => module.default)
      })
      .catch(() => {
        // A failed chunk load leaves the article empty; the sidebar and
        // the rest of the shell stay up, which is better than a white page.
      })
    return () => {
      alive = false
    }
  }, [loader])

  // Keep the reader on the same page when the UI language changes: swap
  // only the locale segment of the splat and mirror it into the URL.
  //
  // The ref starts at the *UI* locale (not the URL's), so a direct visit
  // to a shared link like `/docs/en` keeps its locale — only an actual
  // switch of the UI language re-points the URL, mirroring the iframe
  // viewer's postMessage behaviour.
  const previousLocale = useRef(docsLocale)
  useEffect(() => {
    if (previousLocale.current === docsLocale) return
    previousLocale.current = docsLocale
    navigate({
      to: '/docs/$',
      params: { _splat: `${docsLocale}/${pagePath}` },
      replace: true,
    })
  }, [docsLocale, pagePath, navigate])

  // The table of contents: read the anchored h2/h3 the rendered MDX
  // produced (ids come from `rehype-slug` in the MDX pipeline).
  const articleRef = useRef<HTMLDivElement>(null)
  const [toc, setToc] = useState<TocItem[]>([])
  useEffect(() => {
    if (!Doc) return
    const container = articleRef.current
    if (!container) return
    // remark-gfm renders checklist items as disabled checkboxes without a
    // label; give each one the item text as its accessible name so the docs
    // page has no critical axe `label` violation.
    labelTaskListCheckboxes(container)
    const items: TocItem[] = []
    container.querySelectorAll('h2, h3').forEach((heading) => {
      if (!heading.id) return
      items.push({
        depth: heading.tagName === 'H2' ? 2 : 3,
        text: heading.textContent ?? '',
        id: heading.id,
      })
    })
    setToc(items)
  }, [Doc, locale])

  // The guide's landing is a synthesised card page, not a Markdown
  // document. Applying the prose scale here would override its `page-title`
  // (30/38/600, §1.8) with the Markdown h1 rule (20/28) and restyle the
  // cards' own type. The 72ch reading width of §1.12 would also clip the
  // multi-column chapter grid.
  const isSyntheticIndex =
    pagePath.replace(/\/+$/, '') === NATIVE_USER_GUIDE_PATH

  return (
    <NativeDocsShell locale={locale} pagePath={pagePath} toc={toc}>
      <div
        ref={articleRef}
        className={isSyntheticIndex ? 'max-w-none' : PROSE_CLASSES}
      >
        {Doc ? (
          // The compiled MDX resolves `_components` from `props.components`
          // first, so the Callout is passed explicitly — the `MDXProvider`
          // context is unreliable across the CJS/ESM boundary of the lazy
          // chunks.
          <Doc
            components={{ Callout, pre: DocsCodeBlock, table: DocsTable }}
            locale={locale}
          />
        ) : null}
      </div>
    </NativeDocsShell>
  )
}
