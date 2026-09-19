import { notFound } from 'next/navigation';

import { ContentCardGrid, MarkdownBody } from '@/lib/content-renderer';
import { loadMarkdownPage, loadSectionNav } from '@/lib/content/markdown-page';
import { DocsShell } from '@/lib/docs-shell';
import { SUPPORTED_DOCS_LOCALES, docsLocaleFromSegment } from '@/lib/i18n';

/**
 * API reference overview, at `/docs/<lang>/api/`.
 *
 * The intro is the upstream overview's own text; the grid below it leads
 * into the endpoint groups, which is what the sidebar lists as well.
 */
export function generateStaticParams() {
  return SUPPORTED_DOCS_LOCALES.map((lang) => ({ lang }));
}

export default async function ApiPage(props: { params: Promise<{ lang: string }> }) {
  const { lang } = await props.params;
  const locale = docsLocaleFromSegment(lang);
  const page = loadMarkdownPage(`api/${locale}/index.md`);
  if (!page) notFound();

  const items = loadSectionNav('api', locale).map((item) => ({
    title: item.title,
    url: `/docs/${locale}/api/${item.id}`,
  }));

  return (
    <DocsShell locale={locale} title={page.title} toc={[]}>
      <MarkdownBody html={page.html} />
      <ContentCardGrid items={items} />
    </DocsShell>
  );
}
