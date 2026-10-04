import fs from 'node:fs';
import path from 'node:path';

import { aboutSectionUrl, getAboutContent } from '@/lib/content/about';
import { loadSectionNav } from '@/lib/content/markdown-page';
import {
  USER_GUIDE_CHAPTER_SLUGS,
  userGuideChapterTitle,
  userGuideChapterUrl,
} from '@/lib/content/user-guide';
import type { DocsLocale } from '@/lib/i18n';

/**
 * Sidebar navigation for the docs site.
 *
 * The outline is **data**, not code. Everything below this comment is a
 * generic builder: it knows how to turn a node into a Fumadocs page-tree
 * entry and how to expand each kind of `source`, and it knows no page,
 * section, group or label of its own. What the sidebar actually contains
 * is declared in `content/nav.json` — see that file for the outline and
 * its schema, and edit it rather than this file to add a page, a section
 * or an API group.
 *
 * The shape handed to `DocsShell` (`SidebarNode`) is unchanged, so the
 * rendering and interaction layer — folder disclosure, "keep the
 * ancestors of the current page open", anchor matching in
 * `docs-sidebar-tree` — is untouched by where the outline comes from.
 *
 * Slugs are locale-neutral: only labels change between locales, so the
 * URL of a page is identical in `zh` and `en`. That is what lets the
 * SPA's language switch keep the reader on the same page (see
 * `docs-viewer.tsx` in `web/`).
 *
 * ## `content/nav.json`
 *
 * ```jsonc
 * {
 *   "sections": [        // top-level rows, in sidebar order
 *     {
 *       "id": "…",       // stable key (also the child slug under `navigation`)
 *       "path": "…",     // URL path under `/docs/<locale>/`
 *       "label": { "zh": "…", "en": "…" },     // required in every locale
 *       "summary": { … },// present ⇒ also a card on the docs landing page
 *       "noIndex": true, // the label is a disclosure trigger, not a link
 *       "children": { … }// see below; absent ⇒ a leaf page
 *     }
 *   ]
 * }
 * ```
 *
 * `children.source` is one of:
 *
 * | `source`     | children come from                                                    |
 * |--------------|-----------------------------------------------------------------------|
 * | `chapters`   | the user guide's chapter list (`USER_GUIDE_CHAPTER_SLUGS`)            |
 * | `navigation` | `content/<navigation>/<locale>/_nav.json`, written by the sync script |
 *
 * `navigation` additionally reads:
 *
 * - `skip`      — ids from `_nav.json` to leave out entirely;
 * - `shortenAt` — cut every label at this separator (the AI-app catalog
 *   names an app "`<app> — <what it is>`", which overruns a sidebar
 *   column; only the part ahead of the separator is shown);
 * - `categories` — for `api`, the category shelves to build, each with an
 *   optional `groups` list of multi-page groups;
 * - `hidden`    — ids that exist as pages but stay out of the sidebar.
 *
 * Leaf order under `navigation` is the order of `_nav.json` — upstream's
 * own order — with groups placed at the position of their earliest
 * member, which is what interleaves 音频 / 聊天 / 图像 with the flat
 * single-page groups.
*/

/** A string that has to exist in every locale the site ships. */
type Localized = Record<DocsLocale, string>;

/** One page of a multi-page group under a `navigation` category. */
type ManifestPage = { id: string; label: Localized };

/** A group whose members are pages of their own (音频 → 原生OpenAI格式 …). */
type ManifestGroup = { id: string; label: Localized; pages: ManifestPage[] };

/** A category shelf of the API reference (AI 模型接口 / 管理接口). */
type ManifestCategory = {
  id: string;
  label: Localized;
  /** Show this shelf's children on arrival. */
  open?: boolean;
  groups?: ManifestGroup[];
};

/**
 * Source of a section's children:
 *
 * - `chapters`   — the user guide's chapter list (`USER_GUIDE_CHAPTER_SLUGS`);
 * - `navigation` — `content/<navigation>/<locale>/_nav.json`, written by
 *   the sync script, optionally grouped into category shelves.
 */
type ChildrenSource =
  | { source: 'chapters' }
  | {
      source: 'navigation';
      navigation: 'api' | 'apps';
      skip?: string[];
      shortenAt?: string;
      categories?: ManifestCategory[];
      hidden?: string[];
    };

type ManifestSection = {
  id: string;
  path: string;
  label: Localized;
  summary?: Localized;
  noIndex?: boolean;
  /**
   * Name of a document collection this section belongs to, for the routes
   * that have to enumerate those sections (`legal/[doc]`, the search
   * index). The legal documents are sections of the outline and pages of
   * their own, and the collection is how both stay one list.
   */
  collection?: string;
  children?: ChildrenSource;
};

type Manifest = { sections: ManifestSection[] };

/**
 * One node of the sidebar tree.
 *
 * A node carrying `children` renders as a collapsible folder whose own
 * `url` is the folder's index page (clicking the label opens it, the
 * chevron expands the children). A node without `children` renders as a
 * leaf page. The type is recursive, so folders may nest arbitrarily
 * deep — the API reference nests its groups under two category folders
 * (AI 模型接口 / 管理接口), with audio as a further sub-folder — and the
 * custom folder renderer in `docs-sidebar-tree` keeps every ancestor open
 * while a descendant is the current page.
 */
export type SidebarNode = {
  title: string;
  url: string;
  /**
   * Headings nested inside the page this node opens. A link to one of
   * them still means "reading this node", so they travel with it and the
   * sidebar counts them as the same location. Only meaningful on leaves.
   */
  anchors?: string[];
  /** Present on folder nodes. */
  children?: SidebarNode[];
  /**
   * Show the children on arrival instead of waiting for a click.
   */
  defaultOpen?: boolean;
  /**
   * Folder without its own page: the label is a disclosure trigger only
   * (no link). Used for the two API top categories (AI 模型接口 /
   * 管理接口) and the format shelves under them, which are organisational
   * with no page of their own.
   */
  noIndex?: boolean;
};

export type SidebarEntry = SidebarNode;
export type SidebarSection = SidebarNode;

/** One card of the docs landing page (`/docs/<lang>/`). */
export type LandingCard = { title: string; url: string; teaser?: string };

// ── The manifest ───────────────────────────────────────────────────────

const MANIFEST_FILE = path.join(process.cwd(), 'content', 'nav.json');

let cached: Manifest | undefined;

/**
 * Read `content/nav.json`.
 *
 * Server-only: it reads the filesystem, so it may only be reached from
 * server components and the static-export routes. Cached because the
 * sidebar is rebuilt once per page during the export, and a parse per
 * page for a file that cannot change mid-build buys nothing.
 */
function manifest(): Manifest {
  if (!cached) {
    cached = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8')) as Manifest;
  }
  return cached;
}

/**
 * A label in one locale.
 *
 * Failing loudly is deliberate: a section added with only one language
 * written would otherwise render a blank row in the other locale, which
 * looks like a layout bug rather than a missing translation.
 */
function text(label: Localized, locale: DocsLocale, what: string): string {
  const value = label?.[locale];
  if (value) return value;
  // New locales are authored in `zh`/`en` only for now; fall back through
  // the supported pair instead of throwing a blank sidebar row. `zh-TW`
  // reads Simplified Chinese first (closer than English), everyone else
  // reads English.
  if (locale === 'zh-TW' && label.zh) return label.zh;
  if (label.en) return label.en;
  if (label.zh) return label.zh;
  throw new Error(`nav.json: missing label for ${what} (no fallback)`);
}

/** `shortenAt` — the part of a label ahead of the separator. */
function shorten(title: string, separator: string): string {
  const at = title.indexOf(separator);
  return at === -1 ? title : title.slice(0, at);
}

// ── Sources ────────────────────────────────────────────────────────────

/**
 * The user guide's chapters.
 *
 * A chapter is a page of its own (`/docs/<lang>/guide/wiki/user-guide/<slug>/`),
 * so each child names a real pathname. Membership and order come from
 * `user-guide.ts`, which the chapter route also reads — the sidebar must
 * not carry a second copy of that list, and must be able to label a
 * chapter whose Markdown has not been written yet.
 */
function chapterChildren(locale: DocsLocale): SidebarNode[] {
  return USER_GUIDE_CHAPTER_SLUGS.map((slug) => ({
    title: userGuideChapterTitle(locale, slug) ?? slug,
    url: userGuideChapterUrl(locale, slug),
    anchors: [],
  }));
}

/**
 * The API reference.
 *
 * Two category shelves, each holding multi-page groups (declared in
 * `nav.json`, because `_nav.json` cannot name them reliably: its English
 * titles are upstream directory names, "Audio" reads as "AI Model API ·
 * Native Gemini Format" there) interleaved with the flat single-page
 * groups that come straight from `_nav.json`.
 *
 * Position is `_nav.json`'s own order, a group standing at the position
 * of its earliest member — that is what puts 音频 / 聊天 / 图像 between
 * the flat groups rather than after them. A group whose directory has no
 * overview page (`ai-model-images`) has no entry of its own and takes its
 * position from its members.
 *
 * Every shelf and every group is `noIndex`: both are organisational, so
 * their labels are disclosure triggers rather than links. Leaf pages
 * carry `anchors: []` — an endpoint is an `h2` inside its group page, and
 * an endpoint never leaves the sidebar today, so there are no nested
 * anchors to fold in.
 */
function apiChildren(
  locale: DocsLocale,
  apiRoot: string,
  source: Extract<ChildrenSource, { source: 'navigation' }>
): SidebarNode[] {
  const nav = loadSectionNav('api', locale);
  const hidden = new Set(source.hidden ?? []);
  const groupIds = new Set((source.categories ?? []).flatMap((c) => (c.groups ?? []).map((g) => g.id)));
  const pageIds = new Set(
    (source.categories ?? []).flatMap((c) => (c.groups ?? []).flatMap((g) => g.pages.map((p) => p.id)))
  );

  // Position of an id in `_nav.json`; ids it does not list sort last.
  const orderOf = (id: string): number => {
    const at = nav.findIndex((item) => item.id === id);
    return at < 0 ? Number.MAX_SAFE_INTEGER : at;
  };

  return (source.categories ?? [])
    .map((category) => {
      const entries: { pos: number; node: SidebarNode }[] = [];

      for (const group of category.groups ?? []) {
        const positions = [orderOf(group.id), ...group.pages.map((page) => orderOf(page.id))];
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
              anchors: [],
            })),
          },
        });
      }

      for (const item of nav) {
        if (item.id === 'index') continue;
        if (hidden.has(item.id)) continue;
        if (groupIds.has(item.id)) continue; // declared above, as a group
        if (pageIds.has(item.id)) continue; // a member of one of those groups
        // An entry without a category belongs to the AI-model shelf.
        if ((item.category === 'management' ? 'management' : 'ai-model') !== category.id) continue;
        entries.push({
          pos: orderOf(item.id),
          node: { title: item.title, url: `${apiRoot}/${item.id}`, anchors: [] },
        });
      }

      entries.sort((a, b) => a.pos - b.pos);

      return {
        title: text(category.label, locale, category.id),
        url: apiRoot,
        noIndex: true,
        defaultOpen: category.open ?? false,
        children: entries.map((entry) => entry.node),
      };
    })
    .filter((category) => category.children.length > 0);
}

/**
 * A generated section (`_nav.json`), used flat by the AI-app catalog.
 *
 * Titles and order come from `_nav.json` — the sync script derives them
 * from the upstream page sources' front matter, which is also where each
 * page's own `h1` comes from, so the sidebar cannot name a page
 * differently from the page itself.
 */
function navigationChildren(
  locale: DocsLocale,
  root: string,
  source: Extract<ChildrenSource, { source: 'navigation' }>
): SidebarNode[] {
  const skip = new Set(source.skip ?? []);
  return loadSectionNav(source.navigation, locale)
    .filter((item) => !skip.has(item.id))
    .map((item) => ({
      title: source.shortenAt ? shorten(item.title, source.shortenAt) : item.title,
      url: `${root}/${item.id}`,
      anchors: [],
    }));
}

function childrenOf(
  locale: DocsLocale,
  prefix: string,
  section: ManifestSection
): SidebarNode[] | undefined {
  const source = section.children;
  if (!source) return undefined;
  const root = `${prefix}/${section.path}`;
  switch (source.source) {
    case 'chapters':
      return chapterChildren(locale);
    case 'navigation':
      return source.navigation === 'api'
        ? apiChildren(locale, root, source)
        : navigationChildren(locale, root, source);
  }
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Sidebar entries for one locale. `prefix` is the locale root
 * (`/docs/<locale>`).
 */
export function sidebarEntries(locale: DocsLocale, prefix: string): SidebarEntry[] {
  return manifest().sections.map((section) => {
    const children = childrenOf(locale, prefix, section);
    return {
      title: text(section.label, locale, section.id),
      url: `${prefix}/${section.path}`,
      ...(section.noIndex ? { noIndex: true } : {}),
      ...(children ? { defaultOpen: false, children } : {}),
    };
  });
}

/**
 * Cards for the docs landing page, in outline order.
 *
 * Every section that declares a `summary` gets one: the summary is what
 * says the page is worth opening, so a section without one is reachable
 * from the sidebar only. Legal documents are sections of their own, which
 * is why they appear here alongside the larger sections.
 */
export function landingCards(locale: DocsLocale, prefix: string): LandingCard[] {
  const cards: LandingCard[] = [];
  for (const section of manifest().sections) {
    if (!section.summary) continue;
    cards.push({
      title: text(section.label, locale, section.id),
      url: `${prefix}/${section.path}`,
      teaser: text(section.summary, locale, section.id),
    });
  }
  return cards;
}

/**
 * A page a route has to enumerate for itself: its slug, its path under
 * `/docs/<locale>/`, and its label.
 */
export type NavDocument = { id: string; path: string; label: string };

/**
 * The outline's sections that belong to a named `collection`.
 *
 * The legal documents are listed in the outline like any other section —
 * they are rows of the sidebar and cards on the landing page — but they
 * are also pages a route has to enumerate (`generateStaticParams`) and a
 * search index has to visit. Querying the collection keeps that list in
 * one place: adding `content/legal/<locale>/<doc>.md` and a section with
 * `"collection": "legal"` is the whole job.
 */
export function collectionDocuments(collection: string, locale: DocsLocale): NavDocument[] {
  return manifest()
    .sections.filter((section) => section.collection === collection)
    .map((section) => ({
      id: section.id,
      path: section.path,
      label: text(section.label, locale, section.id),
    }));
}

/**
 * Sidebar entries for the About pages (`/about/<lang>/…`).
 *
 * One entry per chapter, all at the same level, each opening a page of
 * its own — the profile is a set of short pages rather than one long
 * scroll, so a chapter is a destination and not an anchor inside another
 * page. There is deliberately no entry for the profile's own landing
 * page: the panel lists the chapters, and `DocsHeader`'s 「关于」 link is
 * how the landing page is reached.
 *
 * The sidebar therefore carries no folders, which is also what keeps the
 * docs sidebar's anchor-matching machinery (`docs-sidebar-tree`) out of
 * the picture here: every entry names a distinct pathname.
 */
export function aboutSidebarEntries(locale: DocsLocale): SidebarEntry[] {
  return getAboutContent(locale).sections.map((section, index) => ({
    title: section.heading,
    url: aboutSectionUrl(locale, index),
  }));
}
