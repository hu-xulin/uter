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
import { MDXProvider } from '@mdx-js/react'
import { useNavigate } from '@tanstack/react-router'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react'
import { useTranslation } from 'react-i18next'

import { resolveDocsLocaleCode, type DocsLocaleCode } from '@/lib/docs-link'

import { Callout } from './callout'
import { docRefForPagePath } from './docs-content'
import { loadNativeDoc } from './docs-loader'
import { NativeDocsShell, type TocItem } from './docs-shell'

/*
 * Markdown prose scale — the same explicit descendant selectors the app's
 * `components/ui/markdown.tsx` pins, per design-spec §1.2: Markdown
 * headings sit one to two steps *below* the interface scale (h1 24/32,
 * h2 18/28, h3 16/24), body copy `text-long` 16/26, code `text-mono`.
 * Anchored headings get `scroll-mt` so a TOC click clears the fixed
 * public header.
 */
const PROSE_CLASSES = [
  'max-w-none text-long',
  '[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:scroll-mt-20',
  '[&_h2]:mt-5 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:scroll-mt-20',
  '[&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:scroll-mt-20',
  '[&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:text-sm [&_h4]:font-semibold',
  '[&_p]:my-2 [&_p]:text-long [&_strong]:font-semibold [&_em]:italic',
  '[&_a]:text-fg-link hover:[&_a]:text-fg-link',
  '[&_ol]:my-2 [&_ul]:my-2 [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-5 [&_ul]:pl-5 [&_li]:my-1 [&_li]:pl-1 [&_li]:text-long',
  '[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:bg-muted/50 [&_blockquote]:py-1 [&_blockquote]:pl-4',
  '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-mono',
  '[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-mono',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-sm',
  '[&_table]:my-4 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_thead]:bg-muted [&_th]:border [&_td]:border [&_th]:px-3 [&_td]:px-3 [&_th]:py-2 [&_td]:py-2 [&_th]:text-left [&_td]:text-sm',
  '[&_figcaption]:text-xs',
  '[&_hr]:my-6 [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-lg',
  '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
  '[overflow-wrap:anywhere]',
].join(' ')

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

  return (
    <NativeDocsShell locale={locale} pagePath={pagePath} toc={toc}>
      <div ref={articleRef} className={PROSE_CLASSES}>
        {Doc ? (
          <MDXProvider components={{ Callout }}>
            <Doc />
          </MDXProvider>
        ) : null}
      </div>
    </NativeDocsShell>
  )
}
