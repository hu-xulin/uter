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

import type { DocsLocaleCode } from '@/lib/docs-link'
import { cn } from '@/lib/utils'

import { sidebarEntries, type SidebarNode } from './docs-content'
import { PAGE_NAV_CARD_CLASS, PageNav, PageNavCardContent } from './page-nav'

/**
 * Previous / next page cards for a native docs page.
 *
 * A direct port of the retired `docs-web` `DocsPageFooter`: the reading
 * order comes from our own sidebar outline, not from a page tree, so the
 * anchors and no-page folders are filtered by exactly the rules the
 * sidebar uses. `noIndex` folders (the API category shelves) have no
 * page of their own and are skipped; `#fragment` children point back
 * into a page that is already listed and are skipped too.
 *
 * Renders nothing when the current URL is not an outline entry.
 */
type FlatPage = { title: string; splat: string }

function flattenPages(entries: SidebarNode[]): FlatPage[] {
  const out: FlatPage[] = []
  for (const entry of entries) {
    if (entry.url.includes('#')) continue
    if (!entry.noIndex) {
      out.push({
        title: entry.title,
        splat: entry.url.replace(/^\/docs\//, ''),
      })
    }
    if (entry.children) out.push(...flattenPages(entry.children))
  }
  return out
}

export function DocsPageFooter({
  locale,
  pagePath,
}: {
  locale: DocsLocaleCode
  pagePath: string
}) {
  const pages = flattenPages(sidebarEntries(locale))
  const current = `${locale}/${pagePath.replace(/\/+$/, '')}`
  const index = pages.findIndex((page) => page.splat === current)
  if (index === -1) return null

  const previous = index > 0 ? pages[index - 1] : undefined
  const next = index < pages.length - 1 ? pages[index + 1] : undefined
  if (!previous && !next) return null

  return (
    <PageNav
      previous={
        previous ? (
          <Link
            to='/docs/$'
            params={{ _splat: previous.splat }}
            className={PAGE_NAV_CARD_CLASS}
          >
            <PageNavCardContent direction='previous' title={previous.title} />
          </Link>
        ) : undefined
      }
      next={
        next ? (
          <Link
            to='/docs/$'
            params={{ _splat: next.splat }}
            className={cn(PAGE_NAV_CARD_CLASS, 'items-end text-right')}
          >
            <PageNavCardContent direction='next' title={next.title} />
          </Link>
        ) : undefined
      }
    />
  )
}
