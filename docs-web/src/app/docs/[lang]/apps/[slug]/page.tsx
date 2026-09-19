import { notFound } from 'next/navigation';

import { MarkdownBody } from '@/lib/content-renderer';
import { loadMarkdownPage, loadSectionNav } from '@/lib/content/markdown-page';
import { DocsShell } from '@/lib/docs-shell';
import { SUPPORTED_DOCS_LOCALES, docsLocaleFromSegment } from '@/lib/i18n';

/**
 * One AI-application guide, at `/docs/<lang>/apps/<slug>/`.
 *
 * The body is the whole Markdown file, so its headings build the TOC
 * themselves (`loadMarkdownPage`) instead of being planned from
 * structured data the way the user guide's chapters are.
 */
export function generateStaticParams() {
  return SUPPORTED_DOCS_LOCALES.flatMap((lang) =>
    loadSectionNav('apps', lang).map((item) => ({ lang, slug: item.id }))
  );
}

export default async function AppPage(props: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await props.params;
  const locale = docsLocaleFromSegment(lang);
  const page = loadMarkdownPage(`apps/${locale}/${slug}.md`);
  if (!page) notFound();

  return (
    <DocsShell locale={locale} title={page.title} toc={page.toc}>
      <MarkdownBody html={page.html} />
    </DocsShell>
  );
}
