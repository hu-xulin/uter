import { notFound } from 'next/navigation';

import { MarkdownBody } from '@/lib/content-renderer';
import { loadMarkdownPage } from '@/lib/content/markdown-page';
import { DocsShell } from '@/lib/docs-shell';
import { SUPPORTED_DOCS_LOCALES, docsLocaleFromSegment } from '@/lib/i18n';

/**
 * The legal documents, at `/docs/<lang>/legal/<doc>/`.
 *
 * Both are served to the SPA by `/api/<doc>` and stored as one setting,
 * so there is a single text rather than a translation per locale; the
 * sync script copies it to every locale, which is what the SPA shows too.
 * The page title is the document's own `h1`.
 */
const DOCS = ['user-agreement', 'privacy-policy'] as const;

export function generateStaticParams() {
  return SUPPORTED_DOCS_LOCALES.flatMap((lang) =>
    DOCS.map((doc) => ({ lang, doc }))
  );
}

export default async function LegalPage(props: {
  params: Promise<{ lang: string; doc: string }>;
}) {
  const { lang, doc } = await props.params;
  const locale = docsLocaleFromSegment(lang);
  if (!(DOCS as readonly string[]).includes(doc)) notFound();

  const page = loadMarkdownPage(`legal/${locale}/${doc}.md`);
  if (!page) notFound();

  return (
    <DocsShell locale={locale} title={page.title} toc={page.toc}>
      <MarkdownBody html={page.html} />
    </DocsShell>
  );
}
