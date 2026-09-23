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

For commercial licensing, please contact support@quantumnous.com
*/
import type { LinkProps } from '@tanstack/react-router'

import {
  DOCS_LOCALE_PAIRS,
  docsPathForSpaLocale,
  type DocsLocaleCode,
} from '@/lib/docs-link'

import type { NavItem, NavCollapsible } from '../types'

/**
 * Cache the docs-site prefixes so `isServerRenderedHref` doesn't have
 * to recompute them on every navigation call. The set is tiny (one
 * entry per supported docs locale) but the function runs on every
 * link render.
 */
const DOCS_PATH_PREFIXES: ReadonlySet<string> = (() => {
  const out = new Set<string>()
  for (const locale of Object.keys(DOCS_LOCALE_PAIRS) as DocsLocaleCode[]) {
    out.add(docsPathFor(locale))
  }
  return out
})()

function docsPathFor(locale: DocsLocaleCode): string {
  // Local mirror of `docs-link.ts#docsPathFor` — we keep it here so
  // url-utils stays free of the SPA's i18n instance and only depends
  // on the static locale map. The two implementations must agree.
  return docsPathForSpaLocale(locale)
}

/**
 * Convert LinkProps['to'] to string
 * Handles both string URLs and object URLs (e.g., { pathname, search })
 */
function urlToString(url: LinkProps['to'] | (string & {})): string | null {
  if (typeof url === 'string') {
    return url
  }
  if (url && typeof url === 'object' && !Array.isArray(url)) {
    // Handle object URLs like { pathname: string, search?: string }
    const urlObj = url as Record<string, unknown>
    const pathname = typeof urlObj.pathname === 'string' ? urlObj.pathname : ''
    const search = typeof urlObj.search === 'string' ? urlObj.search : ''
    return pathname + search
  }
  return null
}

/**
 * Normalize URL by removing query parameters and trailing slashes
 */
export function normalizeHref(href: string): string {
  const withoutQuery = href.split('?')[0]
  return withoutQuery.length > 1
    ? withoutQuery.replace(/\/+$/, '')
    : withoutQuery
}

/**
 * Whether an href points at another site (absolute HTTP/HTTPS URL).
 */
export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

/**
 * Anchor attributes for a link that leaves the SPA.
 *
 * Cross-origin targets open in a new tab. Same-origin targets that the
 * SPA router does not own — currently the statically exported docs
 * site at any `/docs/<lang>/` prefix — stay in the current tab and
 * must be plain anchors so the browser performs a full document load
 * instead of letting the SPA router resolve the path (which has no
 * matching route and renders 404).
 */
export function fullPageAnchorProps(href: string): {
  target?: '_blank'
  rel?: string
} {
  return isExternalHref(href)
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {}
}

/**
 * Whether an href is a same-origin path served outside the SPA router.
 *
 * Matches every supported docs locale — `/docs/zh/...`, `/docs/en/...`,
 * etc. — so a switch of language in the docs button doesn't sneak the
 * link past this classifier and into the SPA router, which has no
 * matching route.
 */
export function isServerRenderedHref(href: string): boolean {
  for (const prefix of DOCS_PATH_PREFIXES) {
    if (href === prefix || href.startsWith(`${prefix}/`)) return true
  }
  return false
}

/**
 * Check if a navigation item is active
 * @param href - Current URL
 * @param item - Navigation item
 * @param mainNav - Whether this is a main navigation item (matches first-level path)
 */
export function checkIsActive(
  href: string,
  item: NavItem,
  mainNav = false
): boolean {
  const hrefWithoutQuery = href.split('?')[0]

  if (item.activeUrls?.some((url) => urlToString(url) === hrefWithoutQuery)) {
    return true
  }

  // For collapsible items (NavCollapsible), check sub-items first
  if ('items' in item && item.items) {
    const collapsibleItem = item as NavCollapsible
    const items = collapsibleItem.items

    // Check if any sub-item matches
    if (
      items.some((i) => {
        if (!i?.url) return false
        const subItemUrl = urlToString(i.url)
        if (!subItemUrl) return false
        if (href === subItemUrl) return true
        const subItemUrlWithoutQuery = subItemUrl.split('?')[0]
        const subItemUrlHasQuery = subItemUrl.includes('?')
        if (subItemUrlWithoutQuery === hrefWithoutQuery) {
          // If sub-item URL has no query params, pathname match is enough (href may have query params)
          if (!subItemUrlHasQuery) return true
          // If sub-item URL has query params, they must match exactly
          if (subItemUrlHasQuery && href === subItemUrl) return true
        }
        return false
      })
    )
      return true
  }

  // For regular link items, check the item's URL
  if (!item.url) return false

  const itemUrl = urlToString(item.url)
  if (!itemUrl) return false

  // Exact match
  if (href === itemUrl) return true

  const itemUrlWithoutQuery = itemUrl.split('?')[0]
  const itemUrlHasQuery = itemUrl.includes('?')

  // If both URLs have the same base path
  if (hrefWithoutQuery === itemUrlWithoutQuery) {
    // If item.url has no query params, pathname match is enough (current URL may have query params)
    if (!itemUrlHasQuery) return true
    // If item.url has query params, they must match exactly
    if (itemUrlHasQuery && href === itemUrl) return true
  }

  // Main navigation match (matches first-level path)
  if (mainNav && href.split('/')[1] && itemUrl) {
    const hrefFirstPath = href.split('/')[1]
    const itemFirstPath = itemUrl.split('/')[1]
    return hrefFirstPath === itemFirstPath
  }

  return false
}
