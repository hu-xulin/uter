import { notFound } from 'next/navigation';

import { BlockList, BlockSection } from '@/lib/content-renderer';
import { loadUserGuideMarkdown } from '@/lib/content/user-guide-markdown';
import { DocsShell } from '@/lib/docs-shell';
import { planHeadings } from '@/lib/docs-toc';
import { SUPPORTED_DOCS_LOCALES, docsLocaleFromSegment } from '@/lib/i18n';

/**
 * 模型测试, at `/docs/<lang>/guide/wiki/model-testing/`.
 *
 * A top-level section of the outline — a peer of 用户指南, sitting above
 * it — rather than one of the guide's chapters. Its body is still the
 * Markdown the user guide renders (`content/user-guide/<locale>/model-testing.md`),
 * parsed by the same block loader, so the `<Callout>`s, tables and fenced
 * snippets it relies on come through exactly as they do inside the guide.
 * What changed is the *address and the navigation*: the page is reached at
 * its own URL and listed as its own sidebar row and landing card, declared
 * in `content/nav.json`.
 *
 * The title is the document's own `# heading`, which each locale writes in
 * its own language (模型测试 / Model Testing / …), so the page heading needs
 * no separate label table. When a file opens straight into a `##` with no
 * `h1`, the first group heading stands in for it.
 */
const SLUG = 'model-testing';

export function generateStaticParams() {
  return SUPPORTED_DOCS_LOCALES.map((lang) => ({ lang }));
}

export default async function ModelTestingPage(props: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await props.params;
  const locale = docsLocaleFromSegment(lang);

  const markdown = loadUserGuideMarkdown(locale, SLUG);
  if (!markdown) notFound();

  const title = markdown.documentTitle ?? markdown.groups[0]?.heading ?? '';
  const groups =
    markdown.groups.length > 0
      ? markdown.groups
      : [{ heading: title, blocks: markdown.lead, subSections: [] }];
  const { toc, sectionIds, subSectionIds } = planHeadings(groups);

  return (
    <DocsShell locale={locale} title={title} toc={toc}>
      <BlockList blocks={markdown.groups.length > 0 ? markdown.lead : []} locale={locale} />
      {groups.map((group, i) => (
        <BlockSection
          key={i}
          id={sectionIds[i]}
          subIds={subSectionIds[i]}
          heading={group.heading}
          blocks={group.blocks}
          subSections={group.subSections}
          locale={locale}
        />
      ))}
    </DocsShell>
  );
}
