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
import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import type { DocsLocaleCode } from '@/lib/docs-link'

import { sidebarEntries, type SidebarNode } from './docs-content'
import { DocsPageFooter } from './docs-page-footer'
import { DocsSearchButton, DocsSearchDialog } from './docs-search'
import { DocsToc, DocsTocInline, type TocItem } from './docs-toc'

export type { TocItem }

/** Host splat (`<locale>/<page path>`) of a sidebar node URL. */
function splatOf(url: string): string {
  return url.replace(/^\/docs\//, '')
}

/** Whether a node's subtree contains the given splat. */
function subtreeContains(node: SidebarNode, splat: string): boolean {
  if (splatOf(node.url) === splat) return true
  return (node.children ?? []).some((child) => subtreeContains(child, splat))
}

function TreeItem({
  node,
  depth,
  activeSplat,
}: {
  node: SidebarNode
  depth: number
  activeSplat: string
}) {
  const { t } = useTranslation()
  const splat = splatOf(node.url)
  const [open, setOpen] = useState(
    subtreeContains(node, activeSplat) || node.defaultOpen === true
  )
  const hasChildren = (node.children?.length ?? 0) > 0
  const isActive = splat === activeSplat
  const indent = { paddingLeft: `${8 + depth * 12}px` }

  // When navigation lands on this section's own landing page (or a page
  // inside its subtree), open it — SPA transitions keep the component
  // mounted, so the useState initialiser alone would leave it collapsed.
  useEffect(() => {
    if (isActive && hasChildren) setOpen(true)
  }, [isActive, hasChildren])

  if (!hasChildren) {
    return (
      <Link
        to='/docs/$'
        params={{ _splat: splat }}
        aria-current={isActive ? 'page' : undefined}
        className={`block rounded-md py-1.5 pr-2 text-sm no-underline transition-colors ${
          isActive
            ? 'bg-primary-subtle text-sidebar-active-foreground font-medium'
            : 'text-fg-secondary hover:bg-muted hover:text-fg-primary'
        }`}
        style={indent}
      >
        {node.title}
      </Link>
    )
  }

  return (
    <div>
      <div
        className={`flex items-center rounded-md py-1.5 pr-2 transition-colors ${
          isActive ? 'bg-primary-subtle' : 'hover:bg-muted'
        }`}
        style={indent}
      >
        <Link
          to='/docs/$'
          params={{ _splat: splat }}
          aria-current={isActive ? 'page' : undefined}
          className={`flex min-w-0 flex-1 items-center gap-1 text-left text-sm no-underline ${
            isActive
              ? 'text-sidebar-active-foreground font-medium'
              : 'text-fg-secondary hover:text-fg-primary'
          }`}
        >
          <span className='min-w-0 truncate'>{node.title}</span>
        </Link>
        <button
          type='button'
          aria-expanded={open}
          aria-label={`${t(open ? 'Collapse' : 'Expand')} ${node.title}`}
          onClick={() => setOpen((v) => !v)}
          className='text-fg-secondary relative ml-1 shrink-0 opacity-70 transition-opacity after:absolute after:-inset-2 after:content-[""] hover:opacity-100'
        >
          <svg
            width='12'
            height='12'
            viewBox='0 0 12 12'
            fill='none'
            aria-hidden='true'
            className={`transition-transform ${open ? 'rotate-90' : ''}`}
          >
            <path
              d='M4 2.5L8 6L4 9.5'
              stroke='currentColor'
              strokeWidth='1.4'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
        </button>
      </div>
      {open &&
        node.children?.map((child) => (
          // Two sibling folders can legitimately share a URL (both API
          // category shelves point at `/docs/<locale>/api`), so the URL
          // alone is not a unique key. Their labels differ, and using the
          // label keeps the key data-derived rather than index-derived.
          <TreeItem
            key={`${child.url}#${child.title}`}
            node={child}
            depth={depth + 1}
            activeSplat={activeSplat}
          />
        ))}
    </div>
  )
}

/**
 * Layout for the native docs — sidebar, article and table of contents,
 * the same three-column shape the framed docs export renders, drawn with
 * the app's own components so the docs read as part of the SPA instead
 * of a separate site.
 *
 * The sidebar tree comes from `sidebarEntries(locale)` — the same data
 * the framed export builds server-side — and links stay on the SPA's
 * `/docs/<locale>/<page>` routes, so deep links, reloads and the
 * UI-language switch all keep working unchanged.
 *
 * 两侧都有选中态：左栏标当前页（品牌色浅底 + 品牌前景），右栏标当前小节
 * （品牌色竖线 + 品牌前景），与 Clerk 的文档站同一套读法。
 */
export function NativeDocsShell({
  locale,
  pagePath,
  toc,
  children,
}: {
  locale: DocsLocaleCode
  pagePath: string
  toc: TocItem[]
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const entries = sidebarEntries(locale)
  const activeSplat = `${locale}/${pagePath}`
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <PublicLayout showMainContainer={false}>
      <div className='h-16 shrink-0' aria-hidden='true' />
      <div className='mx-auto flex w-full max-w-7xl items-start px-4 md:px-6'>
        <aside className='border-border sticky top-16 hidden h-[calc(100svh-4rem)] w-64 shrink-0 overflow-y-auto border-r py-6 pr-3 pl-2 lg:block'>
          <DocsSearchButton onOpen={() => setSearchOpen(true)} />
          <nav aria-label={t('Docs')}>
            {entries.map((entry) => (
              <TreeItem
                key={entry.url}
                node={entry}
                depth={0}
                activeSplat={activeSplat}
              />
            ))}
          </nav>
        </aside>
        <main className='min-w-0 flex-1'>
          <div className='mx-auto max-w-3xl px-6 py-10'>
            <DocsTocInline items={toc} />
            <article>{children}</article>
            <DocsPageFooter locale={locale} pagePath={pagePath} />
          </div>
        </main>
        <aside className='sticky top-16 hidden h-[calc(100svh-4rem)] w-56 shrink-0 overflow-y-auto py-6 xl:block'>
          <DocsToc items={toc} />
        </aside>
      </div>
      <DocsSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </PublicLayout>
  )
}
