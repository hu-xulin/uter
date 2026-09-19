import { notFound } from 'next/navigation';

import { MarkdownBody } from '@/lib/content-renderer';
import { loadMarkdownPage } from '@/lib/content/markdown-page';
import { DocsShell } from '@/lib/docs-shell';
import { SUPPORTED_DOCS_LOCALES, docsLocaleFromSegment } from '@/lib/i18n';

/**
 * 特性说明, at
 * `/docs/<lang>/guide/wiki/basic-concepts/features-introduction/`.
 *
 * The feature list is one long ordered list with nested items — a shape
 * the structured content module held as parallel arrays of strings, which
 * had to be re-typed by hand whenever upstream changed and which lost the
 * nesting. It is a Markdown file now (`content/features/`), so the list,
 * its sub-items and its links come across as written.
 */
export function generateStaticParams() {
  return SUPPORTED_DOCS_LOCALES.map((lang) => ({ lang }));
}

export default async function FeaturesPage(props: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await props.params;
  const locale = docsLocaleFromSegment(lang);
  const page = loadMarkdownPage(`features/${locale}.md`);
  if (!page) notFound();

  return (
    <DocsShell locale={locale} title={page.title} toc={page.toc}>
      <MarkdownBody html={page.html} />
    </DocsShell>
  );
}
