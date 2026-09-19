import type { SortedResult } from 'fumadocs-core/search';

import { SUPPORTED_DOCS_LOCALES } from '@/lib/i18n';

/**
 * Client-side search over a statically generated index.
 *
 * The docs site is a Next.js static export served by the Go gateway, so
 * there is no server route to query — Fumadocs' default dialog asks
 * `/api/search`, which on this deployment belongs to the gateway's relay
 * namespace and answers 404. The index is therefore built at build time
 * by the `search-index.json` route handler (see `search-index-data.ts`)
 * and ranked in the browser by this module.
 *
 * It is served from the origin root, not from under `/docs/`: the
 * gateway mounts the docs export directory (`web/dist/docs/`) at `/`, so
 * the export's `out/docs/zh/...` becomes `/docs/zh/...` and its
 * `out/search-index.json` becomes `/search-index.json`. The path is
 * derived rather than hard-coded so a future mount under a prefix keeps
 * working.
 *
 * Ranking is deliberately simple: every query term must appear somewhere
 * in a page for it to match, headings weigh more than body text, and the
 * page title weighs more than both. Chinese is handled by substring
 * matching rather than a tokenizer, which is what makes `用户` match
 * `用户管理` and `用户访问令牌` without any segmentation.
 */

export type SearchIndexEntry = {
  /** `heading` renders with a `#` marker in the dialog, `text` is indented. */
  kind: 'heading' | 'text';
  text: string;
  /** Anchor fragment of the heading this entry belongs to, without `#`. */
  anchor: string;
};

export type SearchIndexPage = {
  title: string;
  url: string;
  breadcrumbs: string[];
  entries: SearchIndexEntry[];
};

export type SearchIndex = {
  version: number;
  locales: Record<string, SearchIndexPage[]>;
};

/** How many pages and how many matching lines per page to return. */
const MAX_PAGES = 8;
const MAX_ENTRIES_PER_PAGE = 4;
/** Characters of context kept on each side of a match in body text. */
const SNIPPET_BEFORE = 40;
const SNIPPET_AFTER = 140;

/**
 * Origin-relative prefix the docs site is mounted at, derived from the
 * current pathname.
 *
 * `/docs/zh/...` is served from the export directory mounted at the site
 * root, so this returns `''`. Deriving it (instead of hard-coding `/`)
 * keeps the search index reachable if the docs are ever served under a
 * prefix.
 */
export function docsRootFromPath(pathname: string): string {
  const i = pathname.indexOf('/docs/');
  return i === -1 ? '' : pathname.slice(0, i);
}

/**
 * Locale segment of a localised pathname.
 *
 * Both localised roots put the locale straight after the section, so it
 * is always the second segment: `/docs/zh/guide` → `zh`, `/about/en/` →
 * `en`. Segment-position rather than a `docs`-anchored pattern, because
 * the About page loads this same index and must resolve its own locale
 * from its own URL. Anything that isn't a segment we ship returns null,
 * which callers read as "use the default".
 */
export function localeFromPath(pathname: string): string | null {
  const segment = pathname.split('/')[2];
  return segment !== undefined &&
    (SUPPORTED_DOCS_LOCALES as readonly string[]).includes(segment)
    ? segment
    : null;
}

let cached: { url: string; promise: Promise<SearchIndex> } | null = null;

/**
 * Fetch and cache the index. One fetch per page load, shared by every
 * subsequent query; a failure resolves to an empty index rather than
 * throwing, because a thrown error leaves the dialog with no data at all
 * (not even the "no results" state) and the user with no explanation.
 */
export function loadSearchIndex(docsRoot: string): Promise<SearchIndex> {
  const url = `${docsRoot}/search-index.json`;
  if (cached?.url === url) return cached.promise;

  const promise = fetch(url, { credentials: 'same-origin' })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<SearchIndex>;
    })
    .catch((err) => {
      console.warn('[docs-search] search index unavailable:', err);
      return { version: 0, locales: {} } satisfies SearchIndex;
    });

  cached = { url, promise };
  return promise;
}

const ENTITY: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (c) => ENTITY[c]);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Wrap every occurrence of every term in `<mark>`.
 *
 * The dialog renders this string as markdown with raw HTML enabled, so
 * the text is HTML-escaped first and then matched in a single pass — a
 * second replace over an already-marked string would happily match
 * inside the `<mark>` tags it just inserted.
 */
function highlight(text: string, terms: string[]): string {
  if (terms.length === 0) return escapeHtml(text);
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
  return text
    .split(pattern)
    .map((part, i) => (i % 2 === 1 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)))
    .join('');
}

/** Count non-overlapping occurrences of `term`, case-insensitively. */
function countOccurrences(haystack: string, term: string): number {
  if (!term) return 0;
  const lower = haystack.toLowerCase();
  const needle = term.toLowerCase();
  let count = 0;
  let from = 0;
  for (;;) {
    const at = lower.indexOf(needle, from);
    if (at === -1) break;
    count += 1;
    from = at + needle.length;
  }
  return count;
}

/** Trim a long paragraph down to the neighbourhood of the first match. */
function snippet(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  let at = -1;
  for (const term of terms) {
    const found = lower.indexOf(term.toLowerCase());
    if (found !== -1 && (at === -1 || found < at)) at = found;
  }
  if (at === -1) return text;

  const start = Math.max(0, at - SNIPPET_BEFORE);
  const end = Math.min(text.length, at + SNIPPET_AFTER);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

type ScoredEntry = {
  entry: SearchIndexEntry;
  score: number;
};

/**
 * Rank the index against a query and shape the result the way Fumadocs'
 * dialog renders it: a `page` row carrying the breadcrumbs, followed by
 * the matching headings and lines of that page.
 */
export function querySearchIndex(
  index: SearchIndex,
  locale: string,
  query: string
): SortedResult[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const pages = index.locales[locale] ?? [];
  const ranked: { page: SearchIndexPage; score: number; entries: ScoredEntry[] }[] = [];

  for (const page of pages) {
    const lowerTitle = page.title.toLowerCase();
    const lowerEntries = page.entries.map((entry) => entry.text.toLowerCase());

    /*
     * AND semantics: a page is a hit only when *every* term appears
     * somewhere on it. Matching any single term buries the real result
     * under every page that happens to share one common word.
     */
    const covered = terms.filter(
      (term) => lowerTitle.includes(term) || lowerEntries.some((text) => text.includes(term))
    ).length;
    if (covered < terms.length) continue;

    const entries: ScoredEntry[] = [];
    for (const entry of page.entries) {
      const haystack = entry.text.toLowerCase();
      let score = 0;
      for (const term of terms) {
        const hits = countOccurrences(haystack, term);
        if (hits === 0) continue;
        score += entry.kind === 'heading' ? 8 + Math.min(hits, 3) * 2 : Math.min(hits, 4) * 2;
      }
      if (score > 0) entries.push({ entry, score });
    }

    entries.sort((a, b) => b.score - a.score || a.entry.text.length - b.entry.text.length);

    // Headings first: they tell the reader which section matched before
    // they read the surrounding prose.
    const picked = entries
      .filter((e) => e.entry.kind === 'heading')
      .slice(0, MAX_ENTRIES_PER_PAGE)
      .concat(
        entries
          .filter((e) => e.entry.kind === 'text')
          .slice(0, MAX_ENTRIES_PER_PAGE)
      );

    ranked.push({
      page,
      score:
        terms.filter((term) => lowerTitle.includes(term)).length * 10 +
        entries.reduce((sum, e) => sum + e.score, 0),
      entries: picked,
    });
  }

  ranked.sort((a, b) => b.score - a.score);

  const out: SortedResult[] = [];
  for (const { page, entries } of ranked.slice(0, MAX_PAGES)) {
    out.push({
      id: `page:${page.url}`,
      url: page.url,
      type: 'page',
      content: highlight(page.title, terms),
      breadcrumbs: page.breadcrumbs,
    });
    entries.forEach(({ entry }, i) => {
      const text = entry.kind === 'text' ? snippet(entry.text, terms) : entry.text;
      out.push({
        id: `${page.url}#${entry.anchor}:${i}`,
        url: entry.anchor ? `${page.url}#${entry.anchor}` : page.url,
        type: entry.kind,
        content: highlight(text, terms),
      });
    });
  }
  return out;
}
