import fs from 'node:fs';
import path from 'node:path';

import type { TOCItemType } from 'fumadocs-core/toc';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';

import { headingAnchor } from '@/lib/docs-toc';

/**
 * Pages whose body is a Markdown file under `content/`.
 *
 * The user guide is modelled as *blocks* (see `user-guide-markdown.ts`) so
 * its chapters can be split into sections and re-assembled. These pages
 * need none of that: an AI-application guide, an API reference group and a
 * legal document are each one document, and what they contain — nested
 * lists, tables, fenced code, images — is exactly what Markdown already
 * expresses. Converting them to HTML at build time keeps the whole of
 * CommonMark and GFM available without a second renderer to maintain.
 *
 * Server-only: it reads the filesystem and pulls in a processor that has
 * no business in a client bundle.
 */

/** One heading of a rendered page, for its table of contents. */
export type MarkdownHeading = { depth: number; text: string; id: string };

export type MarkdownPage = {
  /** The document's `h1`, promoted to the page title. */
  title: string;
  /** Body HTML, without the `h1`. */
  html: string;
  headings: MarkdownHeading[];
  /** Ready for `DocsPage`'s `toc` prop. */
  toc: TOCItemType[];
};

const CONTENT_ROOT = path.join(process.cwd(), 'content');

/** Plain text of a heading's inline content. */
function headingText(node: unknown): string {
  const anyNode = node as { type?: string; value?: string; children?: unknown[] };
  if (typeof anyNode.value === 'string') return anyNode.value;
  return (anyNode.children ?? []).map(headingText).join('');
}

/**
 * Give every `h2`/`h3` the anchor its TOC entry points at.
 *
 * The id comes from `headingAnchor()` — the same function the structured
 * pages use — rather than from a slugger of its own, so a heading's
 * fragment is built one way across the whole site. Ids are written into
 * the mdast as `hProperties`, which is how `mdast-util-to-hast` is told
 * to carry an attribute over to the element.
 */
function assignAnchors(tree: unknown, headings: MarkdownHeading[]): void {
  const used = new Set<string>();
  const walk = (nodes: unknown[]) => {
    for (const raw of nodes) {
      const node = raw as {
        type?: string;
        depth?: number;
        children?: unknown[];
        data?: { hProperties?: Record<string, string> };
      };
      if (node.type === 'heading' && (node.depth === 2 || node.depth === 3)) {
        const text = headingText(node).trim();
        const base = headingAnchor(text);
        let id = base;
        let n = 2;
        while (used.has(id)) id = `${base}-${n++}`;
        used.add(id);
        node.data = { ...(node.data ?? {}), hProperties: { id } };
        headings.push({ depth: node.depth as number, text, id });
      }
      if (Array.isArray(node.children)) walk(node.children);
    }
  };
  walk((tree as { children?: unknown[] }).children ?? []);
}

/** Parse one Markdown source into a page. */
export function renderMarkdown(source: string): MarkdownPage {
  const headings: MarkdownHeading[] = [];

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(() => (tree, file) => {
      /*
       * The `h1` is the page's title. `DocsShell` renders the title
       * itself, so it is taken out of the body rather than drawn twice;
       * anything before it (a front-matter leftover, a stray comment) is
       * dropped with it.
       */
      const children = (tree as { children?: Record<string, unknown>[] }).children ?? [];
      const at = children.findIndex(
        (node) => node.type === 'heading' && node.depth === 1
      );
      let title = '';
      if (at !== -1) {
        title = headingText(children[at]).trim();
        children.splice(0, at + 1);
      }
      file.data.title = title;
      assignAnchors(tree, headings);
    })
    .use(remarkRehype)
    .use(rehypeStringify);

  const file = processor.processSync(source);
  const title = String(file.data.title ?? '');

  return {
    title,
    html: String(file.value ?? ''),
    headings,
    toc: headings.map((heading) => ({
      title: heading.text,
      url: `#${heading.id}`,
      depth: heading.depth,
    })),
  };
}

/** Read `content/<rel>` and render it. `null` when the file is absent. */
export function loadMarkdownPage(rel: string): MarkdownPage | null {
  const file = path.join(CONTENT_ROOT, rel);
  if (!fs.existsSync(file)) return null;
  return renderMarkdown(fs.readFileSync(file, 'utf8'));
}

/** One entry of a section's generated `_nav.json`. */
export type SectionNavItem = {
  id: string;
  title: string;
  description?: string;
  category?: string;
};

/**
 * The order and titles of a generated section's pages.
 *
 * The sync script writes `_nav.json` next to the Markdown it produces:
 * a section's pages are discovered from the upstream tree, and their
 * titles come from that tree's `meta.json`, neither of which is
 * recoverable from the file names alone.
 */
export function loadSectionNav(
  section: 'apps' | 'api',
  locale: string
): SectionNavItem[] {
  const file = path.join(CONTENT_ROOT, section, locale, '_nav.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8')) as SectionNavItem[];
}
