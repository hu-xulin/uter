import type { ReactNode } from 'react';
import { Callout } from 'fumadocs-ui/components/callout';

import { PARTNER_GROUP_LABELS } from '@/lib/content/about';
import type { AboutPartner, AboutSection } from '@/lib/content/about';
import { CodeBlock, type CodeCopyLabels } from '@/lib/code-block';
import { withDocsBasePath } from '@/lib/docs-base-path';
import { PartnerLogo } from '@/lib/partner-logo';
import type { Block, BlockGroup, Inline } from '@/lib/content/blocks';
import type { DocsLocale } from '@/lib/i18n';

/**
 * Renders a structured content section (heading + paragraphs + lists +
 * sub-sections) as Fumadocs-styled HTML. Used by all content pages to
 * avoid duplicating the rendering logic.
 *
 * `id` / `subIds` come from `planHeadings()` and are what the right-hand
 * TOC links to; they are passed in rather than derived from the heading
 * text so the ids used by the TOC and the ids in the DOM cannot drift.
 */
export function ContentSection({
  id,
  subIds,
  heading,
  paragraphs,
  list,
  subSections,
}: {
  id?: string;
  subIds?: string[];
  heading: string;
  paragraphs: string[];
  list?: string[];
  subSections?: {
    heading: string;
    paragraphs: string[];
    list?: string[];
  }[];
}) {
  return (
    <section className='mt-8'>
      <h2
        id={id}
        className='mb-4 text-doc-h2 font-semibold tracking-tight text-fd-foreground'
      >
        {heading}
      </h2>
      {paragraphs.map((p, i) => (
        <p key={i} className='mb-3 text-doc-body leading-relaxed text-fd-muted-foreground'>
          {p}
        </p>
      ))}
      {list ? (
        <ul className='mb-4 ml-6 list-disc space-y-1.5 text-doc-body text-fd-muted-foreground'>
          {list.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : null}
      {subSections?.map((sub, i) => (
        <div key={i} className='mt-6'>
          <h3
            id={subIds?.[i]}
            className='mb-3 text-doc-h2 font-semibold text-fd-foreground'
          >
            {sub.heading}
          </h3>
          {sub.paragraphs.map((p, j) => (
            <p key={j} className='mb-2 text-doc-body leading-relaxed text-fd-muted-foreground'>
              {p}
            </p>
          ))}
          {sub.list ? (
            <ul className='mb-4 ml-6 list-disc space-y-1.5 text-doc-body text-fd-muted-foreground'>
              {sub.list.map((item, k) => (
                <li key={k}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </section>
  );
}

/**
 * Renders the body of one About chapter.
 *
 * Chapters are pages of their own, so the chapter's own title is the
 * page's `h1` (`DocsTitle`) and is deliberately not repeated here — what
 * this draws is everything under it, starting at `h3`.
 *
 * The company profile says some of its headings as values rather than
 * as prose — a person and their title, a list of partner categories, a
 * single contact address — so it carries fields the generic
 * `ContentSection` has no equivalent for. Everything else follows the
 * same type scale, so the page reads as part of the same site.
 *
 * `subIds` come from `planHeadings()`: the right-hand TOC links to them.
 */
export function AboutChapterBody({
  subIds,
  section,
  locale,
}: {
  subIds?: string[];
  section: AboutSection;
  locale: DocsLocale;
}) {
  return (
    <section className='mt-2'>
      {section.subSections?.map((sub, i) => (
        <div key={i} className='mt-6'>
          <h3
            id={subIds?.[i]}
            className='mb-3 text-doc-h2 font-semibold text-fd-foreground'
          >
            {sub.heading}
          </h3>
          {sub.profile ? (
            /*
             * `not-prose`: typography gives every `img` a `2em 0` margin,
             * which would pad the portrait inside the card and throw the
             * name/role block out of line with it. The card is a UI
             * element, not prose.
             */
            <div className='not-prose mb-3 flex items-center gap-4 rounded-lg border border-fd-border bg-fd-card/40 px-4 py-3'>
              {sub.profile.avatar ? (
                /*
                 * A plain `img`, not `next/image`: the export is
                 * `unoptimized`, and the portrait is served by the Go
                 * static handler rather than through an Image API.
                 */
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={sub.profile.avatar}
                  alt={sub.profile.name}
                  width={72}
                  height={72}
                  className='size-18 shrink-0 rounded-full object-cover'
                />
              ) : null}
              <div className='flex min-w-0 flex-col gap-0.5'>
                <span className='text-doc-body font-semibold text-fd-foreground'>
                  {sub.profile.name}
                </span>
                <span className='text-doc-body text-fd-muted-foreground'>
                  {sub.profile.role}
                </span>
              </div>
            </div>
          ) : null}
          {sub.paragraphs?.map((paragraph, j) => (
            <p
              key={j}
              className='mb-2 text-doc-body leading-relaxed text-fd-muted-foreground'
            >
              {paragraph}
            </p>
          ))}
          {sub.entries ? (
            <dl className='mb-4 mt-3 grid gap-3 sm:grid-cols-2'>
              {sub.entries.map((entry, k) => (
                <div
                  key={k}
                  className='rounded-lg border border-fd-border bg-fd-card/40 p-4'
                >
                  <dt className='text-doc-body font-semibold text-fd-foreground'>
                    {entry.label}
                  </dt>
                  <dd className='mt-1 text-doc-body leading-relaxed text-fd-muted-foreground'>
                    {entry.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {sub.email ? (
            <a
              href={`mailto:${sub.email}`}
              className='text-doc-body font-medium text-fd-primary'
            >
              {sub.email}
            </a>
          ) : null}
        </div>
      ))}
      {section.closing?.map((paragraph, i) => (
        <p key={i} className='mt-4 text-doc-body leading-relaxed text-fd-muted-foreground'>
          {paragraph}
        </p>
      ))}
      {section.partnerWall ? (
        <PartnerWall partners={section.partnerWall} locale={locale} />
      ) : null}
    </section>
  );
}

/** The order the partner wall's rows are drawn in. */
const PARTNER_GROUP_ORDER = ['global', 'china'] as const;

/**
 * The model brands the platform connects, as a wall of tiles.
 *
 * Each tile carries its brand's mark next to the model name and the
 * company behind it. The marks live in `public/img/partners/<id>.svg`
 * (see `PARTNER_WALL` for the ids) and are looked up by the tile rather
 * than named in the data, so replacing a logo — or adding a partner —
 * does not couple the copy to a filename. A missing mark falls back to
 * the monogram, which is also what a partner without artwork gets.
 *
 * `not-prose` for the same reason as the landing cards: prose indents the
 * `ul` and would push the wall out of line with the prose above it.
 */
function PartnerWall({
  partners,
  locale,
}: {
  partners: AboutPartner[];
  locale: DocsLocale;
}) {
  return (
    <div className='not-prose mt-8 border-t border-fd-border pt-6'>
      {PARTNER_GROUP_ORDER.map((group) => {
        const items = partners.filter((partner) => partner.group === group);
        if (items.length === 0) return null;

        return (
          <div key={group} className='mt-5 first:mt-0'>
            <h4 className='mb-3 text-doc-body font-semibold text-fd-foreground'>
              {PARTNER_GROUP_LABELS[group][locale]}
            </h4>
            <ul className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'>
              {items.map((partner) => {
                const name = partner.name[locale];
                return (
                  <li
                    key={partner.id}
                    className='flex items-center gap-3 rounded-lg border border-fd-border bg-fd-card/40 px-3 py-2.5'
                  >
                    <PartnerLogo id={partner.id} monogram={monogram(name)} />
                    <span className='flex min-w-0 flex-col'>
                      <span className='truncate text-doc-body font-medium text-fd-foreground'>
                        {name}
                      </span>
                      <span className='truncate text-xs text-fd-muted-foreground'>
                        {partner.company[locale]}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Anchor letter for a brand tile.
 *
 * Taken as a whole code point rather than `charAt(0)` so a name starting
 * with an astral character is not sliced in half. CJK names keep their
 * first character, which is how they are abbreviated anyway.
 */
function monogram(name: string): string {
  return Array.from(name)[0] ?? '·';
}

/**
 * A page's landing grid: one card per destination.
 *
 * Used by both the company profile and the user guide, whose landing
 * pages are indexes into their own chapters rather than prose.
 *
 * `not-prose` matters here: `DocsBody` wraps every page in `prose`, which
 * would put a bullet in front of each card and underline the whole card
 * (the `<a>` typography rule covers its children). Nothing in this grid
 * wants prose's typography, so the subtree opts out wholesale rather than
 * fighting each rule one utility at a time.
 *
 * The href carries the export's `basePath`. Next.js rewrites the href of
 * its own `<Link>`, but not that of a plain `<a>`, so a URL assembled in
 * TypeScript (`/about/zh/our-story/`) comes out of the export as a bare
 * root-relative path — and the page it belongs to is served at
 * `/docs-content/about/…`. Clicking the bare form therefore leaves the
 * export, hits the gateway on a path no static file answers, and lands on
 * the SPA fallback, which has no route for it and renders its Not Found
 * page. {@link withDocsBasePath} is idempotent, so a caller that already
 * passes a prefixed URL is left alone.
 */
export function ContentCardGrid({
  items,
}: {
  items: { title: string; url: string; teaser?: string }[];
}) {
  return (
    <ul className='not-prose mt-8 grid gap-3 sm:grid-cols-2'>
      {items.map((item) => (
        <li key={item.url}>
          <a
            href={withDocsBasePath(item.url)}
            className='flex h-full flex-col rounded-lg border border-fd-border bg-fd-card/40 p-4 transition-colors hover:border-fd-primary/40 hover:bg-fd-primary/5'
          >
            <span className='text-doc-body font-semibold text-fd-foreground'>
              {item.title}
            </span>
            {item.teaser ? (
              <span className='mt-2 text-doc-body leading-relaxed text-fd-muted-foreground'>
                {item.teaser}
              </span>
            ) : null}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * Renders an ordered list of features with optional detail items.
 *
 * `heading` / `headingId` / `detailIds` exist so the features page has
 * real headings for the right-hand TOC to list. The detail cards' titles
 * were plain paragraphs; they are `h3` now — same size and weight, so the
 * page looks unchanged, but a TOC entry can point at them.
 */
export function FeatureList({
  heading,
  headingId,
  detailIds,
  features,
  featureDetails,
}: {
  heading?: string;
  headingId?: string;
  detailIds?: string[];
  features: string[];
  featureDetails?: { text: string; subItems?: string[] }[];
}) {
  return (
    <div>
      {heading ? (
        <h2
          id={headingId}
          className='mt-8 mb-4 text-doc-h2 font-semibold tracking-tight text-fd-foreground'
        >
          {heading}
        </h2>
      ) : null}
      <ol className='mt-6 space-y-3'>
        {features.map((feature, i) => (
          <li key={i} className='text-doc-body leading-relaxed text-fd-muted-foreground'>
            <span className='mr-2 font-semibold text-fd-foreground'>{i + 1}.</span>
            {feature}
          </li>
        ))}
      </ol>
      {featureDetails?.map((detail, i) => (
        <div key={i} className='mt-6 rounded-lg border border-fd-border bg-fd-card/40 p-4'>
          <h3
            id={detailIds?.[i]}
            className='mb-2 text-doc-body font-semibold text-fd-foreground'
          >
            {detail.text}
          </h3>
          {detail.subItems ? (
            <ol className='ml-6 list-decimal space-y-1.5 text-doc-body text-fd-muted-foreground'>
              {detail.subItems.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ol>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Placeholder wording for a picture the site does not ship yet. */
const PENDING_IMAGE_LABEL: Record<DocsLocale, string> = {
  zh: '图片待补充',
  'zh-TW': '圖片待補充',
  en: 'Screenshot coming soon',
  fr: 'Capture à venir',
  ja: 'スクリーンショット近日公開',
  ru: 'Скриншот скоро появится',
  vi: 'Ảnh chụp màn hình sắp ra mắt',
};

/**
 * The code block's copy-button label. Localised because the button is the
 * only interactive chrome the code block has, and a reader who cannot read
 * the surrounding prose cannot act on it either.
 */
const CODE_COPY_LABEL: Record<DocsLocale, CodeCopyLabels> = {
  zh: { copy: '复制', copied: '已复制' },
  'zh-TW': { copy: '複製', copied: '已複製' },
  en: { copy: 'Copy', copied: 'Copied' },
  fr: { copy: 'Copier', copied: 'Copié' },
  ja: { copy: 'コピー', copied: 'コピーしました' },
  ru: { copy: 'Копировать', copied: 'Скопировано' },
  vi: { copy: 'Sao chép', copied: 'Đã sao chép' },
};

function codeCopyLabels(locale: DocsLocale): CodeCopyLabels {
  return CODE_COPY_LABEL[locale];
}

/** Draw one run of inline text, keeping its formatting. */
function InlineRuns({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        switch (node.kind) {
          case 'text':
            return <span key={i}>{node.value}</span>;
          case 'code':
            return (
              <code
                key={i}
                className='rounded bg-fd-muted px-1 py-0.5 font-mono text-[0.85em] text-fd-foreground'
              >
                {node.value}
              </code>
            );
          case 'strong':
            return (
              <strong key={i} className='font-semibold text-fd-foreground'>
                <InlineRuns nodes={node.children} />
              </strong>
            );
          case 'emphasis':
            return (
              <em key={i}>
                <InlineRuns nodes={node.children} />
              </em>
            );
          case 'deleted':
            return (
              <del key={i}>
                <InlineRuns nodes={node.children} />
              </del>
            );
          case 'link':
            return (
              <a key={i} href={node.href} className='text-fd-primary'>
                <InlineRuns nodes={node.children} />
              </a>
            );
          case 'break':
            return <br key={i} />;
          default:
            return null;
        }
      })}
    </>
  );
}

/**
 * Draw one block.
 *
 * Everything structural opts out of `prose` (`not-prose`): a screenshot, a
 * code block and a table are UI, not prose, and typography's blanket rules
 * — `img { margin: 2em 0 }`, list markers on the wrapper — would fight the
 * card styling each of them needs.
 */
function BlockView({ block, locale }: { block: Block; locale: DocsLocale }) {
  switch (block.kind) {
    case 'paragraph':
      return (
        <p className='mb-3 text-doc-body leading-relaxed text-fd-muted-foreground'>
          <InlineRuns nodes={block.children} />
        </p>
      );

    case 'list': {
      const items = block.items.map((item, i) => (
        <li key={i}>
          <InlineRuns nodes={item} />
        </li>
      ));
      const className = 'mb-4 ml-6 space-y-1.5 text-doc-body text-fd-muted-foreground';

      return block.ordered ? (
        <ol className={`${className} list-decimal`}>{items}</ol>
      ) : (
        <ul className={`${className} list-disc`}>{items}</ul>
      );
    }

    case 'image': {
      /*
       * An unresolved source stays as a labelled frame rather than a
       * broken image: a chapter is published as soon as its prose is
       * written, and its screenshots are collected afterwards.
       */
      if (!block.src) {
        return (
          <figure className='not-prose my-5'>
            <div className='flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-fd-border bg-fd-card/40 px-4 py-8 text-center'>
              {block.alt ? (
                <span className='text-sm font-medium text-fd-muted-foreground'>{block.alt}</span>
              ) : null}
              <span className='text-xs text-fd-muted-foreground/70'>
                {PENDING_IMAGE_LABEL[locale]}
              </span>
            </div>
          </figure>
        );
      }

      return (
        <figure className='not-prose my-5'>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.src}
            alt={block.alt}
            className='w-full rounded-lg border border-fd-border'
          />
          {block.alt ? (
            <figcaption className='mt-2 text-center text-xs text-fd-muted-foreground'>
              {block.alt}
            </figcaption>
          ) : null}
        </figure>
      );
    }

    case 'code':
      return <CodeBlock code={block.value} lang={block.lang} labels={codeCopyLabels(locale)} />;

    case 'table':
      return (
        <div className='not-prose my-4 overflow-x-auto rounded-lg border border-fd-border'>
          <table className='w-full border-collapse text-doc-body'>
            <thead className='bg-fd-card/40'>
              <tr>
                {block.head.map((cell, i) => (
                  <th
                    key={i}
                    className='border-b border-fd-border px-3 py-2 text-start font-semibold text-fd-foreground'
                  >
                    <InlineRuns nodes={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className='border-b border-fd-border/60 px-3 py-2 align-top text-fd-muted-foreground last:border-b-0'
                    >
                      <InlineRuns nodes={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'callout':
      /*
       * Fumadocs' own `Callout`, which is what the source's
       * `<Callout type="…">` is asking for — the authoring tool exports
       * this component by name.
       */
      return (
        <div className='not-prose my-4'>
          <Callout type={block.tone}>
            <BlockList blocks={block.children} locale={locale} />
          </Callout>
        </div>
      );

    default:
      return null;
  }
}

/** Draw a run of blocks. */
export function BlockList({ blocks, locale }: { blocks: Block[]; locale: DocsLocale }) {
  return (
    <>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} locale={locale} />
      ))}
    </>
  );
}

/**
 * One group of a Markdown-authored page: an `h2` and everything under it.
 *
 * The block-model twin of `ContentSection`, with the same type scale and
 * the same contract for `id` / `subIds` — they come from `planHeadings()`
 * so the right-hand TOC and the rendered headings cannot disagree.
 */
export function BlockSection({
  id,
  subIds,
  heading,
  blocks,
  subSections,
  locale,
}: {
  id?: string;
  subIds?: string[];
  heading: string;
  blocks: Block[];
  subSections?: BlockGroup[];
  locale: DocsLocale;
}) {
  return (
    <section className='mt-8 first:mt-0'>
      <h2
        id={id}
        className='mb-4 text-doc-h2 font-semibold tracking-tight text-fd-foreground'
      >
        {heading}
      </h2>
      <BlockList blocks={blocks} locale={locale} />
      {subSections?.map((sub, i) => (
        <div key={i} className='mt-6'>
          <h3
            id={subIds?.[i]}
            className='mb-3 text-doc-h2 font-semibold text-fd-foreground'
          >
            {sub.heading}
          </h3>
          <BlockList blocks={sub.blocks} locale={locale} />
        </div>
      ))}
    </section>
  );
}

/**
 * A page body that is a whole Markdown document.
 *
 * Used by the pages whose content is a Markdown file under `content/`
 * (AI 应用、API 参考、用户协议、隐私政策、特性说明) — see
 * `markdown-page.ts`. The HTML is produced at build time from our own
 * files, so `dangerouslySetInnerHTML` here is no different from writing
 * the markup into the JSX by hand.
 *
 * `DocsBody` supplies the `prose` classes, which is what styles the
 * headings, tables, code fences and images this emits. `not-prose` is
 * deliberately *not* applied: unlike the card grids and partner walls
 * elsewhere in this file, everything here is prose and wants typography.
 */
export function MarkdownBody({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
