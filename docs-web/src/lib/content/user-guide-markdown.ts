/**
 * Markdown as a content source for the user guide.
 *
 * The guide's chapters are authored as Markdown under
 * `content/user-guide/<locale>/<slug>.md`. This module reads one, parses
 * it with `remark` (CommonMark + GFM) and normalises it into the block
 * model the renderer already draws (`blocks.ts`), so a Markdown chapter
 * and a chapter that is still a hand-written object in
 * `content/user-guide.ts` render through exactly the same components.
 *
 * **Server-only.** It reads from disk, so it may only be imported by
 * Server Components and by the `search-index.json` route handler. The
 * sidebar in particular does *not* come from here — its labels live in
 * `user-guide.ts` so the navigation keeps working for a chapter whose
 * Markdown has not been written yet (and so the shipped label is the same
 * in both locales while only one of them has a file).
 *
 * ### Images
 *
 * A picture is a file under `public/user-guide/<locale>/<slug>/`. Because
 * `public/` is copied into the export verbatim, that URL needs no build
 * step and no entry in the Go embed list.
 *
 * Files are numbered by their own names (`01-login.webp`,
 * `02-oauth.webp`, …) and are matched **by sort order**: `__img0` is the
 * first, `__img1` the second. That is what makes the common export form
 *
 * ```mdx
 * <img alt="登录页" src={__img0} placeholder="blur" />
 * ```
 *
 * work as-is. (`__imgN` comes from the authoring tool having hoisted the
 * pictures into variables; the variables are not defined in the file, so
 * nothing but a convention like this can resolve them.) A plain
 * `![alt](01-login.webp)` works too and is resolved against the same
 * directory; an absolute or remote URL is passed through untouched.
 *
 * When a source names a picture the directory does not contain, the block
 * keeps an empty `src` and the renderer draws a labelled placeholder —
 * a chapter can therefore be published with its prose complete and its
 * screenshots still being collected.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import type { RootContent, PhrasingContent, Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import {
  blocksText,
  collapseWhitespace,
  type Block,
  type BlockGroup,
  type CalloutTone,
  type Inline,
} from '@/lib/content/blocks';
import type { DocsLocale } from '@/lib/i18n';

/** One chapter parsed out of Markdown. */
export type MarkdownChapter = {
  /** The document's own `# heading`, if it has one — informational only. */
  documentTitle?: string;
  /** Blocks that appear before the first `## heading`. */
  lead: Block[];
  groups: {
    heading: string;
    blocks: Block[];
    subSections: BlockGroup[];
  }[];
};

const CONTENT_ROOT = path.join(process.cwd(), 'content', 'user-guide');
const IMAGE_ROOT = path.join(process.cwd(), 'public', 'user-guide');

/** Where a chapter's Markdown lives. */
export function userGuideMarkdownPath(locale: DocsLocale, slug: string): string {
  return path.join(CONTENT_ROOT, locale, `${slug}.md`);
}

/**
 * The chapter's pictures, in the order `__img0`, `__img1`, … refer to
 * them.
 *
 * Sorted with `numeric` so `10-` follows `09-` rather than `01-`; the
 * zero-padded names the convention asks for make this a no-op, but an
 * author who forgets the padding still gets the intended order.
 */
function chapterImageUrls(locale: DocsLocale, slug: string): string[] {
  const dir = path.join(IMAGE_ROOT, locale, slug);
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((name) => !name.startsWith('.') && /\.(png|jpe?g|webp|avif|gif|svg)$/i.test(name))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    .map((name) => `/user-guide/${locale}/${slug}/${name}`);
}

/** Resolve one image reference against the chapter's picture directory. */
function resolveImageSrc(raw: string, images: string[], locale: DocsLocale, slug: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) return raw;
  if (raw.startsWith('/')) return raw;

  const placeholder = /^__img(\d+)$/.exec(raw.trim());
  if (placeholder) return images[Number(placeholder[1])] ?? '';

  return `/user-guide/${locale}/${slug}/${raw.replace(/^\.\//, '')}`;
}

const CALLOUT_TONES: readonly CalloutTone[] = [
  'info',
  'warn',
  'warning',
  'error',
  'success',
  'idea',
];

function asCalloutTone(value: string | undefined): CalloutTone {
  const tone = (value ?? '').trim().toLowerCase();
  return (CALLOUT_TONES as readonly string[]).includes(tone) ? (tone as CalloutTone) : 'info';
}

/**
 * Read an attribute out of a raw HTML tag.
 *
 * Deliberately a regex rather than a parser: the tags in these files are
 * authored by hand and carry three attributes at most, and pulling in an
 * HTML parser for that would be the larger risk.
 */
function attribute(tag: string, name: string): string | undefined {
  const quoted = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag);
  if (quoted) return quoted[1] ?? quoted[2];
  const braced = new RegExp(`${name}\\s*=\\s*\\{\\s*([^}]*?)\\s*\\}`, 'i').exec(tag);
  return braced?.[1];
}

/**
 * Turn one run of raw HTML into blocks.
 *
 * Two forms occur in practice, both of them produced by exporting an
 * authoring-tool document: an `<img>` on a line of its own, and a
 * `<Callout>` wrapping Markdown that has to be parsed in turn.
 */
function htmlToBlocks(
  html: string,
  images: string[],
  locale: DocsLocale,
  slug: string
): Block[] {
  const blocks: Block[] = [];

  const callout = /<Callout\b([^>]*)>([\s\S]*?)<\/Callout>/i.exec(html);
  if (callout) {
    const inner = unified().use(remarkParse).use(remarkGfm).parse(callout[2]);
    blocks.push({
      kind: 'callout',
      tone: asCalloutTone(attribute(callout[1], 'type')),
      children: nodesToBlocks(inner.children, images, locale, slug),
    });
  }

  /*
   * Every `<img>` in the run, with the `<Callout>` bodies removed first so
   * a picture inside a callout is not emitted twice — once nested and
   * once at the top level.
   */
  const withoutCallouts = html.replace(/<Callout\b[^>]*>[\s\S]*?<\/Callout>/gi, '');

  for (const tag of withoutCallouts.match(/<img\b[^>]*>/gi) ?? []) {
    const src = attribute(tag, 'src');
    blocks.push({
      kind: 'image',
      src: src ? resolveImageSrc(src, images, locale, slug) : '',
      alt: attribute(tag, 'alt') ?? '',
    });
  }

  return blocks;
}

/** Convert inline runs, dropping formatting this site does not draw. */
function phrasingToInline(nodes: PhrasingContent[], images: string[], locale: DocsLocale, slug: string): Inline[] {
  const inline: Inline[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        inline.push({ kind: 'text', value: collapseWhitespace(node.value) || ' ' });
        break;
      case 'inlineCode':
        inline.push({ kind: 'code', value: node.value });
        break;
      case 'strong':
        inline.push({
          kind: 'strong',
          children: phrasingToInline(node.children, images, locale, slug),
        });
        break;
      case 'emphasis':
        inline.push({
          kind: 'emphasis',
          children: phrasingToInline(node.children, images, locale, slug),
        });
        break;
      case 'delete':
        inline.push({
          kind: 'deleted',
          children: phrasingToInline(node.children, images, locale, slug),
        });
        break;
      case 'link':
        inline.push({
          kind: 'link',
          href: node.url,
          children: phrasingToInline(node.children, images, locale, slug),
        });
        break;
      case 'break':
        inline.push({ kind: 'break' });
        break;
      case 'image':
        /*
         * An inline picture carrying block-level meaning is promoted
         * separately (see `nodesToBlocks`); here it only contributes its
         * alt text so the surrounding sentence still reads.
         */
        inline.push({ kind: 'text', value: node.alt ?? '' });
        break;
      default:
        break;
    }
  }

  // A run that ends up empty would render an empty paragraph.
  return inline.filter((node) => node.kind !== 'text' || node.value.trim() !== '');
}

/** True for a paragraph that is really a leftover module statement. */
function isModuleStatement(children: Inline[]): boolean {
  const text = children.map((node) => (node.kind === 'text' ? node.value : '')).join('');
  return /^\s*(import|export)\s/.test(text);
}

/** Convert a list item's children into one line of inline runs. */
function listItemToInline(item: RootContent & { type: 'listItem' }, images: string[], locale: DocsLocale, slug: string): Inline[] {
  const inline: Inline[] = [];

  for (const child of item.children) {
    if (child.type === 'paragraph') {
      if (inline.length > 0) inline.push({ kind: 'text', value: ' ' });
      inline.push(...phrasingToInline(child.children, images, locale, slug));
    } else {
      /*
       * A nested list or a code block inside an item. These files use
       * one-line items, and the site draws lists as a line per item, so
       * the nested content is folded into the item's line rather than
       * given a shape the design has no room for.
       */
      const text = blocksText(nodesToBlocks([child], images, locale, slug))
        .replace(/\s+/g, ' ')
        .trim();
      if (text) inline.push({ kind: 'text', value: text });
    }
  }

  return inline;
}

/** Convert block-level nodes into the render model. */
function nodesToBlocks(nodes: RootContent[], images: string[], locale: DocsLocale, slug: string): Block[] {
  const blocks: Block[] = [];

  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];

    switch (node.type) {
      case 'paragraph': {
        /*
         * A paragraph can contain an inline `<img>`. Block and inline
         * cannot be mixed in one element, so the paragraph is split at
         * the picture: the runs before it, the picture, then the rest.
         */
        const runs: PhrasingContent[][] = [[]];
        const flush = () => {
          if (runs[runs.length - 1].length > 0) runs.push([]);
        };

        for (const child of node.children) {
          if (child.type === 'html' && /<img\b/i.test(child.value)) {
            for (const tag of child.value.match(/<img\b[^>]*>/gi) ?? []) {
              flush();
              blocks.push({
                kind: 'image',
                src: resolveImageSrc(attribute(tag, 'src') ?? '', images, locale, slug),
                alt: attribute(tag, 'alt') ?? '',
              });
            }
            continue;
          }
          runs[runs.length - 1].push(child);
        }

        for (const run of runs) {
          const inline = phrasingToInline(run, images, locale, slug);
          if (inline.length > 0 && !isModuleStatement(inline)) {
            blocks.push({ kind: 'paragraph', children: inline });
          }
        }
        break;
      }

      case 'html': {
        /*
         * Consecutive raw-HTML nodes are one construct split at a blank
         * line — a `<Callout>` whose body is long enough to be wrapped,
         * for instance. Rejoining them before interpreting keeps the
         * opener and its closer in the same string.
         */
        let raw = node.value;
        while (nodes[i + 1]?.type === 'html') {
          i += 1;
          raw += `\n${(nodes[i] as RootContent & { type: 'html' }).value}`;
        }
        blocks.push(...htmlToBlocks(raw, images, locale, slug));
        break;
      }

      case 'list': {
        blocks.push({
          kind: 'list',
          ordered: node.ordered === true,
          items: node.children.map((item) => listItemToInline(item, images, locale, slug)),
        });
        break;
      }

      case 'code':
        blocks.push({ kind: 'code', lang: node.lang ?? undefined, value: node.value });
        break;

      case 'table':
        blocks.push({
          kind: 'table',
          head: node.children[0]?.children.map((cell) => phrasingToInline(cell.children, images, locale, slug)) ?? [],
          rows: node.children
            .slice(1)
            .map((row) => row.children.map((cell) => phrasingToInline(cell.children, images, locale, slug))),
        });
        break;

      case 'blockquote':
        blocks.push({
          kind: 'callout',
          tone: 'info',
          children: nodesToBlocks(node.children, images, locale, slug),
        });
        break;

      default:
        /*
         * `thematicBreak` and definitions carry no reader-visible text,
         * and footnotes are not used by this content. Anything else is
         * skipped rather than guessed at.
         */
        break;
    }
  }

  return blocks;
}

/**
 * Parse a chapter's Markdown.
 *
 * Returns `undefined` when the file does not exist, which is the signal
 * for the caller to fall back to the structured content in
 * `user-guide.ts`. That is what lets chapters migrate one at a time.
 *
 * Headings map to the two levels the design has: `##` opens a group and
 * `###` (or deeper) a sub-group. A `#` heading becomes the document
 * title, and any further `#` is treated as a group so nothing is lost.
 */
export function loadUserGuideMarkdown(locale: DocsLocale, slug: string): MarkdownChapter | undefined {
  const file = userGuideMarkdownPath(locale, slug);
  if (!existsSync(file)) return undefined;

  const source = readFileSync(file, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');
  const tree: Root = unified().use(remarkParse).use(remarkGfm).parse(source);
  const images = chapterImageUrls(locale, slug);

  const chapter: MarkdownChapter = { lead: [], groups: [] };
  let target: Block[] = chapter.lead;

  for (const node of tree.children) {
    if (node.type === 'heading') {
      const text = node.children.map((child) => ('value' in child ? child.value : '')).join('').trim();

      if (node.depth === 1 && chapter.documentTitle === undefined) {
        chapter.documentTitle = text;
        continue;
      }

      if (node.depth >= 3) {
        // No group yet? The file opened straight into a `###`; give it one.
        if (chapter.groups.length === 0) {
          chapter.groups.push({ heading: text, blocks: [], subSections: [] });
          target = chapter.groups[0].blocks;
          continue;
        }
        const group = chapter.groups[chapter.groups.length - 1];
        group.subSections.push({ heading: text, blocks: [] });
        target = group.subSections[group.subSections.length - 1].blocks;
        continue;
      }

      chapter.groups.push({ heading: text, blocks: [], subSections: [] });
      target = chapter.groups[chapter.groups.length - 1].blocks;
      continue;
    }

    target.push(...nodesToBlocks([node], images, locale, slug));
  }

  return chapter;
}
