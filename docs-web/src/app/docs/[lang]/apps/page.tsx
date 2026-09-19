import { notFound } from 'next/navigation';

import { ContentCardGrid } from '@/lib/content-renderer';
import { loadSectionNav } from '@/lib/content/markdown-page';
import { DocsShell } from '@/lib/docs-shell';
import { SUPPORTED_DOCS_LOCALES, docsLocaleFromSegment } from '@/lib/i18n';

/**
 * Landing page of the AI-application guides, at `/docs/<lang>/apps/`.
 *
 * A card per application. Titles and blurbs come from the section's
 * `_nav.json`, which the sync script derives from the upstream page
 * sources' front matter — the same place each guide's own `h1` comes
 * from, so the grid cannot name an application differently from its page.
 */
export function generateStaticParams() {
  return SUPPORTED_DOCS_LOCALES.map((lang) => ({ lang }));
}

export default async function AppsPage(props: { params: Promise<{ lang: string }> }) {
  const { lang } = await props.params;
  const locale = docsLocaleFromSegment(lang);
  const nav = loadSectionNav('apps', locale);
  const index = nav.find((item) => item.id === 'index');
  if (!index) notFound();

  const items = nav
    .filter((item) => item.id !== 'index')
    .map((item) => ({
      title: item.title,
      url: `/docs/${locale}/apps/${item.id}`,
      teaser: item.description,
    }));

  return (
    <DocsShell
      locale={locale}
      title={index.title}
      description={index.description}
      toc={[]}
    >
      <ContentCardGrid items={items} />
    </DocsShell>
  );
}
