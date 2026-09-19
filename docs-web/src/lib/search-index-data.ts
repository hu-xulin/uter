import type {
  SearchIndex,
  SearchIndexEntry,
  SearchIndexPage,
} from '@/lib/docs-search-index';
import { aboutSectionUrl, getAboutContent } from '@/lib/content/about';
import { inlineText, type Block } from '@/lib/content/blocks';
import {
  loadMarkdownPage,
  loadSectionNav,
  type MarkdownPage,
} from '@/lib/content/markdown-page';
import { listUserGuideChapters } from '@/lib/content/user-guide-chapter';
import {
  USER_GUIDE_PATH,
  getUserGuideContent,
  userGuideChapterUrl,
} from '@/lib/content/user-guide';
import { planHeadings } from '@/lib/docs-toc';
import { SUPPORTED_DOCS_LOCALES, type DocsLocale } from '@/lib/i18n';

/**
 * Builds the static search index the docs site ships with.
 *
 * The pages under `/docs/` are not authored as MDX — each one renders a
 * structured content object from `src/lib/content/` — so the index is
 * built from those same objects rather than by scraping the exported
 * HTML. That keeps the index and the rendered page in lockstep: a
 * heading's anchor comes from the same `planHeadings()` call the page
 * uses for its `id`, so a hit can never point at an element that does
 * not exist.
 *
 * The About page is indexed too. Both sites share one index (`docs-search.tsx`
 * loads the same `/search-index.json` from either), so a search box on the
 * docs site can surface the company profile and vice versa — which is what a
 * reader expects from a search box on the same site.
 *
 * Server-only. It pulls in every page's full text, so importing it from
 * a component would ship the whole docs site inside the browser bundle;
 * only the `search-index.json` route handler imports it.
 *
 * Page URLs carry a trailing slash because that is the canonical form the
 * export uses (`trailingSlash: true` in `next.config.mjs`) and the form
 * every link the site renders already uses. A result row navigates the
 * same way the sidebar does, and the Go static handler resolves the
 * directory index without needing a redirect.
 */

/** Shape shared by every content module's `sections` array. */
type Section = {
  heading: string;
  paragraphs?: string[];
  list?: string[];
  subSections?: {
    heading: string;
    paragraphs?: string[];
    list?: string[];
  }[];
};

/** The docs site's own name in the breadcrumb trail, per locale. */
const DOCS_LABEL: Record<DocsLocale, string> = { zh: '文档', en: 'Docs' };

/** The `guide/wiki/basic-concepts/` grouping, spelled as it reads. */
const BASIC_CONCEPTS_LABEL: Record<DocsLocale, string> = {
  zh: '基础概念',
  en: 'Basic Concepts',
};

/**
 * Flatten a page's sections into index entries.
 *
 * Every entry carries the anchor of the heading it sits under, so a hit
 * on a paragraph still links to the section that explains it rather than
 * to the page root.
 */
function sectionEntries(
  sections: Section[],
  sectionIds: string[],
  subSectionIds: string[][]
): SearchIndexEntry[] {
  const entries: SearchIndexEntry[] = [];

  sections.forEach((section, i) => {
    const anchor = sectionIds[i];
    entries.push({ kind: 'heading', text: section.heading, anchor });
    for (const paragraph of section.paragraphs ?? []) {
      entries.push({ kind: 'text', text: paragraph, anchor });
    }
    for (const item of section.list ?? []) {
      entries.push({ kind: 'text', text: item, anchor });
    }

    (section.subSections ?? []).forEach((sub, j) => {
      const subAnchor = subSectionIds[i]?.[j] ?? anchor;
      entries.push({ kind: 'heading', text: sub.heading, anchor: subAnchor });
      for (const paragraph of sub.paragraphs ?? []) {
        entries.push({ kind: 'text', text: paragraph, anchor: subAnchor });
      }
      for (const item of sub.list ?? []) {
        entries.push({ kind: 'text', text: item, anchor: subAnchor });
      }
    });
  });

  return entries;
}

/**
 * Index a page whose body is a Markdown file.
 *
 * These pages are not built from the structured content objects, so
 * there is no `planHeadings()` to share: the anchors come from
 * `loadMarkdownPage()`, which is also what writes the `id` into the
 * rendered heading — the same one-call arrangement the structured pages
 * have, so a hit still cannot point at an element that does not exist.
 *
 * Body text is attached to the heading it sits under by splitting the
 * rendered HTML on those headings. It is indexed whole rather than in
 * slices because matching is a plain substring test: a query that
 * straddles two slices would otherwise miss.
 *
 * `headingsOnly` is for the API reference. Its pages are tables of field
 * names, and indexing every cell would multiply the index several times
 * over for terms nobody searches for; the endpoint names and their
 * `METHOD /path` lines are what a reader looks up.
 */
function markdownPageEntries(
  page: MarkdownPage,
  options?: { headingsOnly?: boolean }
): SearchIndexEntry[] {
  const entries: SearchIndexEntry[] = [
    { kind: 'heading', text: page.title, anchor: '' },
  ];
  for (const heading of page.headings) {
    entries.push({ kind: 'heading', text: heading.text, anchor: `#${heading.id}` });
  }
  if (options?.headingsOnly) return entries;

  const segments: { anchor: string; html: string }[] = [];
  const headingTag = /<h([23])\b[^>]*\bid="([^"]*)"[^>]*>/g;
  let cursor = 0;
  let current = { anchor: '', html: '' };
  let match: RegExpExecArray | null;
  while ((match = headingTag.exec(page.html)) !== null) {
    current.html += page.html.slice(cursor, match.index);
    segments.push(current);
    current = { anchor: `#${match[2]}`, html: '' };
    cursor = match.index + match[0].length;
  }
  current.html += page.html.slice(cursor);
  segments.push(current);

  for (const segment of segments) {
    const text = stripTags(segment.html);
    if (text) entries.push({ kind: 'text', text, anchor: segment.anchor });
  }
  return entries;
}

function stripTags(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Index the pages that are Markdown files: AI 应用、API 参考、用户协议、
 * 隐私政策 and 特性说明.
 */
function markdownPages(locale: DocsLocale, prefix: string, docsLabel: string): SearchIndexPage[] {
  const pages: SearchIndexPage[] = [];

  const features = loadMarkdownPage(`features/${locale}.md`);
  if (features) {
    pages.push({
      title: features.title,
      url: `${prefix}/guide/wiki/basic-concepts/features-introduction/`,
      breadcrumbs: [docsLabel, BASIC_CONCEPTS_LABEL[locale]],
      entries: markdownPageEntries(features),
    });
  }

  const apps = loadSectionNav('apps', locale);
  const appsIndex = apps.find((item) => item.id === 'index');
  if (appsIndex) {
    pages.push({
      title: appsIndex.title,
      url: `${prefix}/apps/`,
      breadcrumbs: [docsLabel],
      entries: [
        { kind: 'heading', text: appsIndex.title, anchor: '' },
        ...apps
          .filter((item) => item.id !== 'index')
          .map((item) => ({
            kind: 'text' as const,
            text: `${item.title} — ${item.description ?? ''}`,
            anchor: '',
          })),
      ],
    });
  }
  for (const item of apps.filter((entry) => entry.id !== 'index')) {
    const page = loadMarkdownPage(`apps/${locale}/${item.id}.md`);
    if (!page) continue;
    pages.push({
      title: page.title,
      url: `${prefix}/apps/${item.id}/`,
      breadcrumbs: [docsLabel, appsIndex?.title ?? ''],
      entries: markdownPageEntries(page),
    });
  }

  const apiRoot = loadMarkdownPage(`api/${locale}/index.md`);
  const groups = loadSectionNav('api', locale);
  if (apiRoot) {
    pages.push({
      title: apiRoot.title,
      url: `${prefix}/api/`,
      breadcrumbs: [docsLabel],
      entries: [
        ...markdownPageEntries(apiRoot),
        ...groups.map((group) => ({
          kind: 'text' as const,
          text: group.title,
          anchor: '',
        })),
      ],
    });
  }
  for (const group of groups) {
    const page = loadMarkdownPage(`api/${locale}/${group.id}.md`);
    if (!page) continue;
    pages.push({
      title: page.title,
      url: `${prefix}/api/${group.id}/`,
      breadcrumbs: [docsLabel, apiRoot?.title ?? ''],
      entries: markdownPageEntries(page, { headingsOnly: true }),
    });
  }

  for (const [doc, label] of [
    ['user-agreement', '用户协议'],
    ['privacy-policy', '隐私政策'],
  ] as const) {
    const page = loadMarkdownPage(`legal/${locale}/${doc}.md`);
    if (!page) continue;
    pages.push({
      title: page.title,
      url: `${prefix}/legal/${doc}/`,
      breadcrumbs: [docsLabel, label],
      entries: markdownPageEntries(page),
    });
  }

  return pages;
}

/**
 * Index the block model a chapter renders from — Markdown or the
 * structured fallback, whichever the chapter resolved to.
 *
 * Every entry carries the anchor of the heading it sits under, so a hit
 * on a paragraph links to the section that explains it rather than to the
 * page root. Callout bodies are walked in place: their text belongs to
 * the heading above them, not to a section of its own.
 */
function pushBlockEntries(entries: SearchIndexEntry[], blocks: Block[], anchor: string): void {
  for (const block of blocks) {
    switch (block.kind) {
      case 'paragraph':
        entries.push({ kind: 'text', text: inlineText(block.children), anchor });
        break;
      case 'list':
        for (const item of block.items) {
          entries.push({ kind: 'text', text: inlineText(item), anchor });
        }
        break;
      case 'image':
        // The alt text is the only description of the picture there is.
        if (block.alt) entries.push({ kind: 'text', text: block.alt, anchor });
        break;
      case 'code':
        // Snippets are what someone hunting for a request example types.
        entries.push({ kind: 'text', text: block.value, anchor });
        break;
      case 'table':
        for (const cell of [...block.head, ...block.rows.flat()]) {
          entries.push({ kind: 'text', text: inlineText(cell), anchor });
        }
        break;
      case 'callout':
        pushBlockEntries(entries, block.children, anchor);
        break;
    }
  }
}

/**
 * Index the user guide (`/docs/<lang>/guide/wiki/user-guide/…`).
 *
 * The guide is one page per chapter, so it contributes the landing page
 * plus one indexed page per chapter. Anchors are planned per chapter —
 * `planHeadings(chapter.groups)` for the one chapter being indexed — which
 * is what the chapter route does too; planning the whole guide at once
 * would number a heading that repeats across chapters differently in the
 * two places and send hits to the wrong anchor.
 */
function userGuidePages(locale: DocsLocale, prefix: string, docsLabel: string): SearchIndexPage[] {
  const content = getUserGuideContent(locale);
  const chapters = listUserGuideChapters(locale);

  const landing: SearchIndexPage = {
    title: content.title,
    url: `${prefix}/${USER_GUIDE_PATH}/`,
    breadcrumbs: [docsLabel],
    // The landing page is a card grid, so its own content is the blurb and
    // the card titles — all of them pointing at the page top.
    entries: [
      { kind: 'heading', text: content.title, anchor: '' },
      { kind: 'text', text: content.description, anchor: '' },
      ...chapters.map((chapter) => ({ kind: 'text' as const, text: chapter.title, anchor: '' })),
    ],
  };

  const pages = chapters.map((chapter): SearchIndexPage => {
    const { sectionIds, subSectionIds } = planHeadings(chapter.groups);
    // The chapter's title is the page's `h1`, which carries no id.
    const entries: SearchIndexEntry[] = [
      { kind: 'heading', text: chapter.title, anchor: '' },
    ];

    // The chapter's opening prose sits under that `h1`, so it is searchable
    // but carries no anchor of its own.
    pushBlockEntries(entries, chapter.lead, '');

    chapter.groups.forEach((group, i) => {
      const anchor = sectionIds[i];
      entries.push({ kind: 'heading', text: group.heading, anchor });
      pushBlockEntries(entries, group.blocks, anchor);

      group.subSections.forEach((sub, j) => {
        const subAnchor = subSectionIds[i]?.[j] ?? anchor;
        entries.push({ kind: 'heading', text: sub.heading, anchor: subAnchor });
        pushBlockEntries(entries, sub.blocks, subAnchor);
      });
    });

    return {
      title: chapter.title,
      url: userGuideChapterUrl(locale, chapter.slug),
      breadcrumbs: [docsLabel, content.title, chapter.title],
      entries,
    };
  });

  return [landing, ...pages];
}

function pagesForLocale(locale: DocsLocale): SearchIndexPage[] {
  const prefix = `/docs/${locale}`;
  const docsLabel = DOCS_LABEL[locale];
  const basicConcepts = [docsLabel, BASIC_CONCEPTS_LABEL[locale]];

  /*
   * No entry for `/docs/<lang>/`: that route is a redirect to 特性说明
   * now that the quick-start landing is gone, and indexing it would put
   * a hit on a page that has nothing to read.
   */
  return [
    ...userGuidePages(locale, prefix, docsLabel),
    ...markdownPages(locale, prefix, docsLabel),
  ];
}

/**
 * Index the company profile (`/about/<lang>/…`).
 *
 * The profile is one page per chapter, so it contributes one indexed
 * page per chapter plus its landing page. Each chapter's body is a
 * `subSections` list rather than a `sections` array of prose, and it
 * carries the three value fields the profile uses (`profile`, `entries`,
 * `email`) — so the walk is its own rather than `pageFromSections`.
 *
 * Anchors come from `planHeadings([section])`, planned chapter by
 * chapter. That has to match the chapter route exactly: it plans the one
 * chapter it is rendering, and a heading that collides with one in
 * another chapter would otherwise be numbered differently in the two
 * places.
 */
function aboutPages(locale: DocsLocale): SearchIndexPage[] {
  const content = getAboutContent(locale);

  const landing: SearchIndexPage = {
    title: content.title,
    url: `/about/${locale}/`,
    breadcrumbs: [content.title],
    // The landing page is a card grid: title and tagline, then the card
    // titles, all pointing at the page top — a card title leads to the
    // chapter below it, not to an anchor on this page.
    entries: [
      { kind: 'heading', text: content.title, anchor: '' },
      { kind: 'text', text: content.description, anchor: '' },
      ...content.sections.map((section) => ({ kind: 'text' as const, text: section.heading, anchor: '' })),
    ],
  };

  const chapters = content.sections.map((section, index): SearchIndexPage => {
    const { subSectionIds } = planHeadings([section]);
    const subIds = subSectionIds[0] ?? [];
    const entries: SearchIndexEntry[] = [
      // The chapter's title is the page's `h1`, which has no id.
      { kind: 'heading', text: section.heading, anchor: '' },
    ];

    (section.subSections ?? []).forEach((sub, j) => {
      const anchor = subIds[j] ?? '';
      entries.push({ kind: 'heading', text: sub.heading, anchor });
      if (sub.profile) {
        entries.push({
          kind: 'text',
          text: `${sub.profile.name} — ${sub.profile.role}`,
          anchor,
        });
      }
      for (const paragraph of sub.paragraphs ?? []) {
        entries.push({ kind: 'text', text: paragraph, anchor });
      }
      for (const entry of sub.entries ?? []) {
        entries.push({ kind: 'text', text: `${entry.label} — ${entry.value}`, anchor });
      }
      if (sub.email) {
        entries.push({ kind: 'text', text: sub.email, anchor });
      }
    });

    // Rendered after the sub-sections, so indexed after them too.
    for (const line of section.closing ?? []) {
      entries.push({ kind: 'text', text: line, anchor: '' });
    }
    /*
     * The partner wall names the models the platform connects, which is
     * what someone searching for a provider is most likely to type. They
     * sit at the foot of the page, so they carry no anchor.
     */
    for (const partner of section.partnerWall ?? []) {
      entries.push({
        kind: 'text',
        text: `${partner.name[locale]} — ${partner.company[locale]}`,
        anchor: '',
      });
    }

    return {
      title: section.heading,
      url: aboutSectionUrl(locale, index),
      breadcrumbs: [content.title, section.heading],
      entries,
    };
  });

  return [landing, ...chapters];
}

export function buildSearchIndex(): SearchIndex {
  const locales: Record<string, SearchIndexPage[]> = {};
  for (const locale of SUPPORTED_DOCS_LOCALES) {
    locales[locale] = [...pagesForLocale(locale), ...aboutPages(locale)];
  }
  return { version: 1, locales };
}
