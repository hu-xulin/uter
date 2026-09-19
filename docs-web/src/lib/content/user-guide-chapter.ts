/**
 * Resolving one user-guide chapter to the blocks a page renders.
 *
 * A chapter has two possible bodies:
 *
 *  1. Markdown at `content/user-guide/<locale>/<slug>.md` — the form the
 *     guide is being migrated to, and the only one that can carry images,
 *     fenced code, tables and callouts.
 *  2. The structured object in `user-guide.ts` — the form the guide was
 *     originally written in, kept as the fallback.
 *
 * The fallback is what makes the migration incremental: a chapter moves
 * to Markdown the moment its file appears, and the chapters that have not
 * been converted yet keep rendering exactly as before instead of going
 * blank. Both are normalised into `blocks.ts`'s model here, so the page,
 * the table of contents and the search index see one shape.
 *
 * **Server-only** — it reads the content directory, so it may only be
 * imported by Server Components and by the `search-index.json` route.
 * The sidebar deliberately does not import it; its labels come from
 * `user-guide.ts`, which is free of I/O.
 */
import {
  type Block,
  type BlockGroup,
  firstProseText,
} from '@/lib/content/blocks';
import { loadUserGuideMarkdown } from '@/lib/content/user-guide-markdown';
import {
  USER_GUIDE_CHAPTER_SLUGS,
  getUserGuideContent,
  userGuideChapterIndex,
  userGuideChapterTitle,
  type UserGuideChapterSlug,
} from '@/lib/content/user-guide';
import type { DocsLocale } from '@/lib/i18n';

/** A chapter, ready to render. */
export type UserGuideChapter = {
  slug: UserGuideChapterSlug;
  title: string;
  /**
   * The chapter's own opening — everything before its first `##` heading.
   * Rendered above the groups, and the first place the card teaser looks.
   */
  lead: Block[];
  /** Body groups; the page renders these as its `h2`s. */
  groups: { heading: string; blocks: Block[]; subSections: BlockGroup[] }[];
  /** Which body the chapter came from. Surfaced for diagnostics. */
  source: 'markdown' | 'structured';
};

/** One paragraph run as a block, for the structured fallback. */
function paragraph(text: string): Block {
  return { kind: 'paragraph', children: [{ kind: 'text', value: text }] };
}

/** Turn a structured sub-section into the shared block shape. */
function structuredSubSection(sub: {
  heading: string;
  paragraphs: string[];
  list?: string[];
}): BlockGroup {
  const blocks: Block[] = sub.paragraphs.map(paragraph);
  if (sub.list) {
    blocks.push({
      kind: 'list',
      ordered: false,
      items: sub.list.map((item) => [{ kind: 'text' as const, value: item }]),
    });
  }
  return { heading: sub.heading, blocks };
}

/** Turn a structured section — the pre-Markdown form — into the block shape. */
function structuredGroups(locale: DocsLocale, index: number): UserGuideChapter['groups'] {
  const section = getUserGuideContent(locale).sections[index];
  if (!section) return [];

  const blocks: Block[] = section.paragraphs.map(paragraph);
  if (section.list) {
    blocks.push({
      kind: 'list',
      ordered: false,
      items: section.list.map((item) => [{ kind: 'text' as const, value: item }]),
    });
  }

  return [
    {
      heading: section.heading,
      blocks,
      subSections: (section.subSections ?? []).map(structuredSubSection),
    },
  ];
}

/**
 * Resolve a chapter, Markdown first.
 *
 * `undefined` means the slug is not one of the guide's chapters, which
 * the route turns into a 404 rather than rendering an empty page.
 */
export function getUserGuideChapter(
  locale: DocsLocale,
  slug: string
): UserGuideChapter | undefined {
  const index = userGuideChapterIndex(slug);
  if (index === -1) return undefined;

  const typed = USER_GUIDE_CHAPTER_SLUGS[index];
  const title = userGuideChapterTitle(locale, slug) ?? typed;

  const markdown = loadUserGuideMarkdown(locale, slug);
  if (markdown) {
    /*
     * Markdown chapters carry their prose under `##` headings. A file
     * with no `##` at all — every paragraph directly under its `#` — is
     * still valid; its lead becomes one anonymous group so the page has
     * something to render and the TOC stays consistent.
     */
    const groups =
      markdown.groups.length > 0
        ? markdown.groups
        : [{ heading: title, blocks: markdown.lead, subSections: [] }];

    return {
      slug: typed,
      title,
      /*
       * A file with no `##` has already folded its lead into that single
       * group, so keeping it here too would draw the opening twice.
       */
      lead: markdown.groups.length > 0 ? markdown.lead : [],
      groups,
      source: 'markdown',
    };
  }

  return {
    slug: typed,
    title,
    lead: [],
    groups: structuredGroups(locale, index),
    source: 'structured',
  };
}

/** Every chapter of the guide, in sidebar order. */
export function listUserGuideChapters(locale: DocsLocale): UserGuideChapter[] {
  return USER_GUIDE_CHAPTER_SLUGS.map((slug) => getUserGuideChapter(locale, slug)).filter(
    (chapter): chapter is UserGuideChapter => chapter !== undefined
  );
}

/**
 * A one-line summary of a chapter, for its card on the landing page.
 *
 * The first line of its own prose — a chapter's opening sentence is its
 * own best summary, and deriving it keeps the card from having to be
 * maintained alongside the content.
 *
 * The lead is tried first because that is where a Markdown chapter states
 * its premise; the groups follow, in reading order, for a chapter that
 * starts straight into a `##` or that has no lead at all.
 */
export function userGuideChapterTeaser(locale: DocsLocale, slug: string): string | undefined {
  const chapter = getUserGuideChapter(locale, slug);
  if (!chapter) return undefined;

  const candidates: Block[][] = [
    chapter.lead,
    ...chapter.groups.flatMap((group) => [
      group.blocks,
      ...group.subSections.map((sub) => sub.blocks),
    ]),
  ];

  let teaser: string | undefined;
  for (const blocks of candidates) {
    teaser = firstProseText(blocks);
    if (teaser) break;
  }
  if (!teaser) return undefined;

  // Cards are one or two lines; a long opening sentence is cut rather
  // than allowed to push the grid rows apart.
  return teaser.length > 72 ? `${teaser.slice(0, 72).trimEnd()}…` : teaser;
}
