import fs from 'node:fs';
import path from 'node:path';

import type { TOCItemType } from 'fumadocs-core/toc';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';

import { headingAnchor } from '@/lib/docs-toc';
import { withDocsBasePath } from '@/lib/docs-base-path';

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
  /**
   * First paragraph of the body, as plain text, for the page's meta
   * description. Empty when the document opens with something other than a
   * paragraph (a list, a table, a code fence).
   */
  description: string;
  /** Body HTML, without the `h1`. */
  html: string;
  headings: MarkdownHeading[];
  /** Ready for `DocsPage`'s `toc` prop. */
  toc: TOCItemType[];
};

const CONTENT_ROOT = path.join(process.cwd(), 'content');

/**
 * Longest meta description kept, in characters, and the shortest paragraph
 * that may be used as one.
 *
 * The minimum matters: these documents open with a metadata table and a table
 * of contents, whose entries are paragraphs too — "1.1 缔约主体" is the first
 * thing a naive walk finds, and it reads as a broken search result. A paragraph
 * long enough to be a sentence is the first one that describes the document.
 */
const MAX_DESCRIPTION_LENGTH = 200;
const MIN_DESCRIPTION_LENGTH = 40;

/**
 * Plain text of a node's inline content. `break` renders as a space rather
 * than nothing so a wrapped line does not glue two words together.
 */
function headingText(node: unknown): string {
  const anyNode = node as { type?: string; value?: string; children?: unknown[] };
  if (anyNode.type === 'break') return ' ';
  if (typeof anyNode.value === 'string') return anyNode.value;
  return (anyNode.children ?? []).map(headingText).join('');
}

/**
 * Meta description for a Markdown body: its first substantial paragraph,
 * flattened to one line.
 *
 * The walk is in document order and recurses, because the sentence that
 * describes the document often sits inside a blockquote (the 重要提示 of the
 * legal texts) rather than at the top level. Tables are skipped outright — the
 * metadata table every legal document opens with is a grid of short labels,
 * never a description — and paragraphs shorter than
 * {@link MIN_DESCRIPTION_LENGTH} are skipped too (table-of-contents entries
 * are paragraphs). The first paragraph seen is kept as a fallback for a
 * document whose every paragraph is short.
 *
 * The leading `h1` and anything before it are already gone by the time this
 * runs.
 */
function firstParagraphText(nodes: unknown[]): string {
  let fallback = '';

  const visit = (list: unknown[]): string => {
    for (const raw of list) {
      const node = raw as { type?: string; children?: unknown[] };
      if (node.type === 'table') continue;
      if (node.type === 'paragraph') {
        const text = headingText(node).replace(/\s+/g, ' ').trim();
        if (text.length >= MIN_DESCRIPTION_LENGTH) return text;
        if (text !== '' && fallback === '') fallback = text;
        continue;
      }
      if (Array.isArray(node.children)) {
        const found = visit(node.children);
        if (found !== '') return found;
      }
    }
    return '';
  };

  const text = visit(nodes) || fallback;
  if (text.length <= MAX_DESCRIPTION_LENGTH) return text;
  return `${text.slice(0, MAX_DESCRIPTION_LENGTH - 1).trimEnd()}…`;
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
/**
 * Give every image the basePath the export is served under.
 *
 * An author writes a picture as `/apps-assets/…` — a root-relative URL,
 * which is what a file copied verbatim out of `public/` needs. But the page
 * itself is requested at `/docs-content/docs/…`, so the browser resolves that
 * URL against the domain root, misses, and the Go SPA fallback answers with
 * `index.html`. The browser then holds HTML where it expects a pixel and
 * renders an empty box. Rewriting `src` here — once, for every page that
 * goes through this renderer — keeps content authoring unchanged and makes
 * the fix independent of how many files reference images.
 *
 * Runs as a rehype plugin rather than on the raw Markdown so it also covers
 * raw `<img>` tags typed straight into a document, not only `![]()`.
 */
function rehypeDocsAssetBasePath() {
  return (tree: HastNode): void => {
    visit(tree, (node) => {
      if (node.type !== 'element') return;
      if (node.tagName !== 'img' && node.tagName !== 'source') return;

      const src = (node.properties as Record<string, unknown> | undefined)?.src;
      if (typeof src !== 'string' || !src) return;
      (node.properties as Record<string, unknown>).src = withDocsBasePath(src);
    });
  };
}

/**
 * A hast node, narrowed to what this walk needs.
 *
 * `@types/hast` reaches this project only transitively (through
 * `mdast-util-to-hast`), so it is not a declared dependency and importing it
 * directly would be relying on someone else's dependency list. Describing the
 * three fields we touch keeps the plugin honest without that coupling.
 */
type HastNode = {
  type: string;
  tagName?: string;
  properties?: unknown;
  children?: HastNode[];
};

/**
 * The two shapes this file's remark plugin is typed against.
 *
 * `@types/mdast` and `vfile` reach this project only transitively (through
 * `remark-parse` / `unified`), so importing them directly would be relying on
 * someone else's dependency list — the same reason {@link HastNode} is
 * spelled out. Only the members actually touched are described, and both
 * stay deliberately loose: the plugin is handed whatever tree the processor
 * holds and narrows it itself, so annotating it any more tightly only risks
 * another overload mismatch rather than catching a real bug.
 */
type MdastRoot = { children?: unknown[]; type?: string };
type VFileLike = { data: Record<string, unknown> };

/** Depth-first walk over a hast tree, calling `fn` for every node. */
function visit(node: HastNode, fn: (node: HastNode) => void): void {
  fn(node);
  for (const child of node.children ?? []) visit(child, fn);
}

/**
 * Lift the page's `h1` into `file.data.title` and record the description.
 *
 * `DocsShell` renders the title itself, so it is taken out of the body
 * rather than drawn twice; anything before it (a front-matter leftover, a
 * stray comment) is dropped with it.
 *
 * Declared as a named plugin rather than an inline `.use(() => (tree, file)
 * => …)`: a bare function passed to `use` is matched against the processor's
 * plugin overloads, and an inline arrow's inferred parameter types do not
 * always satisfy them — the call then fails to compile with `TS2769: No
 * overload matches this call`, which is a type error in the *call*, not a
 * runtime fault, and reads as if `unified` were broken. A named function is
 * checked against one signature instead.
 */
function remarkPageMeta(options: {
  description: { value: string };
  headings: MarkdownHeading[];
}) {
  return (tree: MdastRoot, file: VFileLike): void => {
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
    options.description.value = firstParagraphText(children);
    assignAnchors(tree, options.headings);
  };
}

export function renderMarkdown(source: string): MarkdownPage {
  const headings: MarkdownHeading[] = [];
  const description = { value: '' };

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkPageMeta, { description, headings })
    .use(remarkRehype)
    .use(rehypeDocsAssetBasePath)
    .use(rehypeStringify);

  const file = processor.processSync(source);
  const title = String(file.data.title ?? '');

  return {
    title,
    description: description.value,
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
