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
import { useState } from 'react'

import { PublicLayout } from '@/components/layout'
import type { DocsLocaleCode } from '@/lib/docs-link'

import { sidebarEntries, type SidebarNode } from './docs-content'

/** One entry of the in-page table of contents. */
export type TocItem = { depth: 2 | 3; text: string; id: string }

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
  const splat = splatOf(node.url)
  const [open, setOpen] = useState(
    subtreeContains(node, activeSplat) || node.defaultOpen === true
  )
  const hasChildren = (node.children?.length ?? 0) > 0
  const isActive = splat === activeSplat
  const indent = { paddingLeft: `${8 + depth * 12}px` }

  if (!hasChildren) {
    return (
      <Link
        to='/docs/$'
        params={{ _splat: splat }}
        className={`block rounded-md py-1.5 pr-2 text-dense no-underline transition-colors hover:bg-muted ${
          isActive
            ? 'bg-accent font-medium text-accent-foreground'
            : 'text-fg-secondary'
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
        className='flex items-center rounded-md py-1.5 pr-2 transition-colors hover:bg-muted'
        style={indent}
      >
        {node.noIndex ? (
          <button
            type='button'
            onClick={() => setOpen((v) => !v)}
            className='flex min-w-0 flex-1 items-center gap-1 bg-transparent text-left text-dense font-medium text-fg-secondary'
          >
            <span className='min-w-0 truncate'>{node.title}</span>
          </button>
        ) : (
          <Link
            to='/docs/$'
            params={{ _splat: splat }}
            className={`flex min-w-0 flex-1 items-center no-underline ${
              isActive
                ? 'font-medium text-accent-foreground'
                : 'text-fg-secondary'
            }`}
          >
            <span className='min-w-0 truncate'>{node.title}</span>
          </Link>
        )}
        <button
          type='button'
          aria-expanded={open}
          aria-label={node.title}
          onClick={() => setOpen((v) => !v)}
          className='ml-1 shrink-0 text-fg-secondary opacity-70 transition-opacity hover:opacity-100'
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
          <TreeItem
            key={child.url}
            node={child}
            depth={depth + 1}
            activeSplat={activeSplat}
          />
        ))}
    </div>
  )
}

function DocsToc({ items }: { items: TocItem[] }) {
  if (items.length === 0) return null
  return (
    <nav aria-label='Table of contents' className='text-dense'>
      <p className='mb-2 px-2 font-medium text-fg-secondary'>目录</p>
      <ul className='space-y-1'>
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`block rounded px-2 py-1 text-fg-secondary no-underline transition-colors hover:bg-muted hover:text-fg-primary ${
                item.depth === 3 ? 'pl-5' : ''
              }`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
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
  const entries = sidebarEntries(locale)
  const activeSplat = `${locale}/${pagePath}`

  return (
    <PublicLayout showMainContainer={false}>
      <div className='h-16 shrink-0' aria-hidden='true' />
      <div className='mx-auto flex w-full max-w-[1440px] items-start'>
        <aside className='sticky top-16 hidden h-[calc(100svh-4rem)] w-64 shrink-0 overflow-y-auto border-r py-6 pr-3 pl-2 lg:block'>
          <nav aria-label='Docs'>
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
          <article className='mx-auto max-w-3xl px-6 py-10'>{children}</article>
        </main>
        <aside className='sticky top-16 hidden h-[calc(100svh-4rem)] w-56 shrink-0 overflow-y-auto py-6 xl:block'>
          <DocsToc items={toc} />
        </aside>
      </div>
    </PublicLayout>
  )
}
