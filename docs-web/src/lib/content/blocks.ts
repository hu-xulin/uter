/**
 * The block model the docs pages render.
 *
 * Pages have two possible sources: a structured object in
 * `src/lib/content/*.ts`, and a Markdown file under `content/`. Rather
 * than teach the renderer about both, each source is normalised into
 * this one shape — paragraphs and lists are shared, Markdown adds images,
 * fenced code, tables and callouts.
 *
 * Pure types and tiny helpers only. This module is imported by both the
 * build-time loaders and the renderer, so it must stay free of `node:fs`
 * and of any dependency that cannot run in the browser.
 */

/**
 * A run of text with its inline formatting.
 *
 * Kept as a tree rather than a markup string so nothing has to re-parse
 * Markdown at render time, and so a code span cannot be confused with the
 * characters around it.
 */
export type Inline =
  | { kind: 'text'; value: string }
  | { kind: 'code'; value: string }
  | { kind: 'strong'; children: Inline[] }
  | { kind: 'emphasis'; children: Inline[] }
  | { kind: 'deleted'; children: Inline[] }
  | { kind: 'link'; href: string; children: Inline[] }
  /** An explicit `<br>` — a Markdown hard break, not a wrapped line. */
  | { kind: 'break' };

/** The tones `fumadocs-ui`'s `Callout` accepts. */
export type CalloutTone = 'info' | 'warn' | 'error' | 'success' | 'warning' | 'idea';

/**
 * One block of page content.
 *
 * `image.src` is empty when the source names a picture the site does not
 * ship yet — see `user-guide-markdown.ts`. The renderer draws a labelled
 * placeholder for those instead of a broken image, so a half-migrated
 * chapter still reads as a page rather than as an error.
 *
 * `image.srcDark` is the same screenshot captured in the dark theme. The
 * guide is shot twice, and the renderer draws the pair so the picture
 * always matches the surrounding scheme; a chapter that only ships one
 * set leaves it undefined and `src` is used for both.
 */
export type Block =
  | { kind: 'paragraph'; children: Inline[] }
  | { kind: 'list'; ordered: boolean; items: Inline[][] }
  | { kind: 'image'; src: string; srcDark?: string; alt: string }
  | { kind: 'code'; lang?: string; value: string }
  | { kind: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { kind: 'callout'; tone: CalloutTone; children: Block[] };

/** A run of blocks that share one heading. */
export type BlockGroup = {
  heading: string;
  blocks: Block[];
};

/**
 * A page body: its own heading, the blocks before the first sub-heading,
 * then the sub-headings. Mirrors the structured content modules' shape so
 * `planHeadings()` can plan either.
 */
export type BlockDocument = {
  groups: {
    heading: string;
    blocks: Block[];
    subSections: BlockGroup[];
  }[];
};

/** Flatten inline runs to the text a search index or a card teaser wants. */
export function inlineText(inline: Inline[]): string {
  return inline
    .map((node) => {
      switch (node.kind) {
        case 'text':
        case 'code':
          return node.value;
        case 'break':
          return ' ';
        default:
          return inlineText(node.children);
      }
    })
    .join('');
}

/**
 * Flatten blocks to plain text.
 *
 * Used by the search index (which stores text, not markup) and by the
 * landing cards' teasers. Images contribute their alt text: it is what
 * the reader sees in the placeholder and the only description of the
 * picture available.
 */
export function blocksText(blocks: Block[]): string {
  return blocks
    .map((block) => {
      switch (block.kind) {
        case 'paragraph':
          return inlineText(block.children);
        case 'list':
          return block.items.map(inlineText).join(' ');
        case 'image':
          return block.alt;
        case 'code':
          return block.value;
        case 'table':
          return [...block.head, ...block.rows.flat()].map(inlineText).join(' ');
        case 'callout':
          return blocksText(block.children);
      }
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * The first readable line of a run of blocks, for a card teaser.
 *
 * A chapter usually opens on a paragraph, but not always: several state
 * their premise as a bullet list, and a callout can carry the first
 * sentence of a section. Falling through to those keeps the card from
 * going blank on a chapter whose opening is not a paragraph.
 */
export function firstProseText(blocks: Block[]): string | undefined {
  for (const block of blocks) {
    switch (block.kind) {
      case 'paragraph': {
        const text = inlineText(block.children).trim();
        if (text) return text;
        break;
      }
      case 'list': {
        const first = block.items[0];
        const text = first ? inlineText(first).trim() : '';
        if (text) return text;
        break;
      }
      case 'callout': {
        const text = firstProseText(block.children);
        if (text) return text;
        break;
      }
      default:
        break;
    }
  }
  return undefined;
}

/**
 * Normalise whitespace inside a text run.
 *
 * Markdown source wraps prose at whatever column the author likes, and
 * the parser keeps the newline. Rendered HTML collapses it anyway, but
 * the search index does not — a query would otherwise fail to match a
 * phrase the file happens to break across two lines.
 */
export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
