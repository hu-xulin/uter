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
import apiNavEn from '@/docs-content/api/en/_nav.json'
import apiNavFr from '@/docs-content/api/fr/_nav.json'
// ── Data ───────────────────────────────────────────────────────────────
//
// The outline is **data**, not code — exactly as in `docs-web/content/
// nav.json`, which this module imports directly. The generated sections
// (`api` / `apps`) read their page lists from the `_nav.json` files the
// upstream sync scripts write, copied next to the (not yet migrated)
// Markdown so the sidebar can name pages before their bodies arrive.
import apiNavJa from '@/docs-content/api/ja/_nav.json'
import apiNavRu from '@/docs-content/api/ru/_nav.json'
import apiNavVi from '@/docs-content/api/vi/_nav.json'
import apiNavZhTw from '@/docs-content/api/zh-TW/_nav.json'
import apiNavZh from '@/docs-content/api/zh/_nav.json'
import appsNavEn from '@/docs-content/apps/en/_nav.json'
import appsNavFr from '@/docs-content/apps/fr/_nav.json'
import appsNavJa from '@/docs-content/apps/ja/_nav.json'
import appsNavRu from '@/docs-content/apps/ru/_nav.json'
import appsNavVi from '@/docs-content/apps/vi/_nav.json'
import appsNavZhTw from '@/docs-content/apps/zh-TW/_nav.json'
import appsNavZh from '@/docs-content/apps/zh/_nav.json'
import navManifestJson from '@/docs-content/nav.json'
import type { DocsLocaleCode } from '@/lib/docs-link'

import {
  userGuideChapterSlugs,
  USER_GUIDE_PATH,
  userGuideChapterTitle,
} from './user-guide-identity'

/** A string that has to exist in every locale the site ships. */
type Localized = Partial<Record<DocsLocaleCode, string>>

/** One page of a multi-page group under a `navigation` category. */
type ManifestPage = { id: string; label: Localized }

/** A group whose members are pages of their own. */
type ManifestGroup = { id: string; label: Localized; pages: ManifestPage[] }

/** A category shelf of the API reference. */
type ManifestCategory = {
  id: string
  label: Localized
  open?: boolean
  groups?: ManifestGroup[]
}

type ChildrenSource =
  | { source: 'chapters' }
  | {
      source: 'navigation'
      navigation: 'api' | 'apps'
      skip?: string[]
      shortenAt?: string
      categories?: ManifestCategory[]
      hidden?: string[]
    }

type ManifestSection = {
  id: string
  path: string
  label: Localized
  summary?: Localized
  noIndex?: boolean
  children?: ChildrenSource
}

const MANIFEST = navManifestJson as unknown as { sections: ManifestSection[] }

/** One entry of a generated section's `_nav.json`. */
type SectionNavItem = {
  id: string
  title: string
  description?: string
  category?: string
}

const SECTION_NAV: Record<
  'api' | 'apps',
  Partial<Record<DocsLocaleCode, SectionNavItem[]>>
> = {
  api: {
    zh: apiNavZh as unknown as SectionNavItem[],
    'zh-TW': apiNavZhTw as unknown as SectionNavItem[],
    en: apiNavEn as unknown as SectionNavItem[],
    fr: apiNavFr as unknown as SectionNavItem[],
    ja: apiNavJa as unknown as SectionNavItem[],
    ru: apiNavRu as unknown as SectionNavItem[],
    vi: apiNavVi as unknown as SectionNavItem[],
  },
  apps: {
    zh: appsNavZh as unknown as SectionNavItem[],
    'zh-TW': appsNavZhTw as unknown as SectionNavItem[],
    en: appsNavEn as unknown as SectionNavItem[],
    fr: appsNavFr as unknown as SectionNavItem[],
    ja: appsNavJa as unknown as SectionNavItem[],
    ru: appsNavRu as unknown as SectionNavItem[],
    vi: appsNavVi as unknown as SectionNavItem[],
  },
}

// ── Sidebar tree ───────────────────────────────────────────────────────

/**
 * One node of the native docs sidebar tree — the same shape
 * `docs-web/src/lib/nav.ts` hands to its `DocsShell`, so the rendering
 * conventions (folder disclosure, "keep ancestors of the current page
 * open") port over unchanged.
 */
export type SidebarNode = {
  title: string
  /** Full host URL, e.g. `/docs/zh/api/…`. */
  url: string
  children?: SidebarNode[]
  defaultOpen?: boolean
  noIndex?: boolean
}

/** A label in one locale, falling back through the supported pair. */
function text(label: Localized, locale: DocsLocaleCode, what: string): string {
  const value = label?.[locale]
  if (value) return value
  // New locales are authored in `zh`/`en` only for now; fall back through
  // the supported pair instead of rendering a blank sidebar row.
  if (locale === 'zh-TW' && label.zh) return label.zh
  if (label.en) return label.en
  if (label.zh) return label.zh
  throw new Error(`docs nav: missing label for ${what} (no fallback)`)
}

/** `shortenAt` — the part of a label ahead of the separator. */
function shorten(title: string, separator: string): string {
  const at = title.indexOf(separator)
  return at === -1 ? title : title.slice(0, at)
}

/** The user guide's chapters, from the identity table above. */
function chapterChildren(locale: DocsLocaleCode): SidebarNode[] {
  return userGuideChapterSlugs(locale).map((slug) => ({
    title: userGuideChapterTitle(locale, slug) ?? slug,
    url: `/docs/${locale}/${USER_GUIDE_PATH}/${slug}`,
  }))
}

/**
 * The API reference: two category shelves from `nav.json`, interleaved
 * with the flat single-page groups from `_nav.json` at the position of
 * their earliest member. A faithful port of `docs-web`'s `apiChildren`.
 */
function apiChildren(
  locale: DocsLocaleCode,
  apiRoot: string,
  source: Extract<ChildrenSource, { source: 'navigation' }>
): SidebarNode[] {
  const nav = SECTION_NAV.api[locale] ?? []
  const hidden = new Set(source.hidden ?? [])
  const groupIds = new Set(
    (source.categories ?? []).flatMap((c) => (c.groups ?? []).map((g) => g.id))
  )
  const pageIds = new Set(
    (source.categories ?? []).flatMap((c) =>
      (c.groups ?? []).flatMap((g) => g.pages.map((p) => p.id))
    )
  )

  // Position of an id in `_nav.json`; ids it does not list sort last.
  const orderOf = (id: string): number => {
    const at = nav.findIndex((item) => item.id === id)
    return at < 0 ? Number.MAX_SAFE_INTEGER : at
  }

  return (source.categories ?? [])
    .map((category) => {
      const entries: { pos: number; node: SidebarNode }[] = []

      for (const group of category.groups ?? []) {
        const positions = [
          orderOf(group.id),
          ...group.pages.map((page) => orderOf(page.id)),
        ]
        entries.push({
          pos: Math.min(...positions),
          node: {
            title: text(group.label, locale, group.id),
            url: `${apiRoot}/${group.id}`,
            noIndex: true,
            defaultOpen: false,
            children: group.pages.map((page) => ({
              title: text(page.label, locale, page.id),
              url: `${apiRoot}/${page.id}`,
            })),
          },
        })
      }

      for (const item of nav) {
        if (item.id === 'index') continue
        if (hidden.has(item.id)) continue
        if (groupIds.has(item.id)) continue // declared above, as a group
        if (pageIds.has(item.id)) continue // a member of one of those groups
        // An entry without a category belongs to the AI-model shelf.
        if (
          (item.category === 'management' ? 'management' : 'ai-model') !==
          category.id
        ) {
          continue
        }
        entries.push({
          pos: orderOf(item.id),
          node: { title: item.title, url: `${apiRoot}/${item.id}` },
        })
      }

      entries.sort((a, b) => a.pos - b.pos)

      return {
        title: text(category.label, locale, category.id),
        url: apiRoot,
        noIndex: true,
        defaultOpen: category.open ?? false,
        children: entries.map((entry) => entry.node),
      }
    })
    .filter((category) => category.children.length > 0)
}

/** A generated section (`_nav.json`), used flat by the AI-app catalog. */
function navigationChildren(
  locale: DocsLocaleCode,
  root: string,
  source: Extract<ChildrenSource, { source: 'navigation' }>
): SidebarNode[] {
  const skip = new Set(source.skip ?? [])
  return (SECTION_NAV[source.navigation][locale] ?? [])
    .filter((item) => !skip.has(item.id))
    .map((item) => ({
      title: source.shortenAt
        ? shorten(item.title, source.shortenAt)
        : item.title,
      url: `${root}/${item.id}`,
    }))
}

function childrenOf(
  locale: DocsLocaleCode,
  prefix: string,
  section: ManifestSection
): SidebarNode[] | undefined {
  const source = section.children
  if (!source) return undefined
  const root = `${prefix}/${section.path}`
  switch (source.source) {
    case 'chapters':
      return chapterChildren(locale)
    case 'navigation':
      return source.navigation === 'api'
        ? apiChildren(locale, root, source)
        : navigationChildren(locale, root, source)
  }
}

/**
 * Sidebar entries for one locale, in outline order. `prefix` is the
 * locale root (`/docs/<locale>`).
 */
export function sidebarEntries(locale: DocsLocaleCode): SidebarNode[] {
  const prefix = `/docs/${locale}`
  return MANIFEST.sections.map((section) => {
    const children = childrenOf(locale, prefix, section)
    return {
      title: text(section.label, locale, section.id),
      url: `${prefix}/${section.path}`,
      ...(section.noIndex ? { noIndex: true } : {}),
      ...(children ? { defaultOpen: false, children } : {}),
    }
  })
}

// ── Host path ↔ native document mapping ────────────────────────────────

/**
 * The doc sets that can render natively once their Markdown is migrated
 * into `web/src/docs-content/`. `features` maps one page per locale with
 * a fixed slug; every other set mirrors its `content/` directory layout.
 */
export type DocsSet = 'features' | 'user-guide' | 'api' | 'apps' | 'legal'

/** A native-renderable document, resolved from a host page path. */
export type NativeDocRef = { set: DocsSet; slug: string }

/** Fixed page path of the features page (the docs landing). */
export const FEATURES_PAGE_PATH =
  'guide/wiki/basic-concepts/features-introduction'

/** Fixed page path of the model-testing section (a peer of the guide). */
export const MODEL_TESTING_PAGE_PATH = 'guide/wiki/model-testing'

/** The user guide's path under a locale root. */
export const NATIVE_USER_GUIDE_PATH = USER_GUIDE_PATH

/**
 * Map a host page path (the part after `/docs/<locale>/`) to the doc it
 * names, or `null` when the path belongs to no set.
 */
export function docRefForPagePath(pagePath: string): NativeDocRef | null {
  const path = pagePath.replace(/\/+$/, '')
  if (path === FEATURES_PAGE_PATH) {
    return { set: 'features', slug: 'features-introduction' }
  }
  // 模型测试 is a top-level outline section (a peer of the guide) but
  // its body is the guide set's `model-testing.mdx`.
  if (path === MODEL_TESTING_PAGE_PATH) {
    return { set: 'user-guide', slug: 'model-testing' }
  }
  if (path === USER_GUIDE_PATH) return { set: 'user-guide', slug: 'index' }
  if (path.startsWith(`${USER_GUIDE_PATH}/`)) {
    return { set: 'user-guide', slug: path.slice(USER_GUIDE_PATH.length + 1) }
  }
  // The API reference and the AI-app catalog are shelves with an index
  // page of their own. `sidebarEntries()` links the section label straight
  // at the *bare* section URL (`/docs/<locale>/api`), so both spellings
  // have to resolve; without the two arms below `docRefForPagePath()`
  // returns null and `DocsRoute` bounces the reader back to the landing.
  if (path === 'api') return { set: 'api', slug: 'index' }
  if (path === 'apps') return { set: 'apps', slug: 'index' }
  if (path.startsWith('api/')) return { set: 'api', slug: path.slice(4) }
  if (path.startsWith('apps/')) return { set: 'apps', slug: path.slice(5) }
  if (path.startsWith('legal/')) return { set: 'legal', slug: path.slice(6) }
  return null
}

/**
 * Module path of a doc inside `web/src/docs-content/`, relative to the
 * content root. The features set authors one file per locale named for
 * the locale itself; every other set follows `<set>/<locale>/<slug>`.
 */
export function docsModulePath(
  ref: NativeDocRef,
  locale: DocsLocaleCode
): string {
  if (ref.set === 'features') return `features/${locale}.mdx`
  return `${ref.set}/${locale}/${ref.slug}.mdx`
}
