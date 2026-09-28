import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { MarkdownBody } from '@/lib/content-renderer';
import { loadMarkdownPage } from '@/lib/content/markdown-page';
import { DocsShell } from '@/lib/docs-shell';
import { SUPPORTED_DOCS_LOCALES, docsLocaleFromSegment } from '@/lib/i18n';
import { collectionDocuments } from '@/lib/nav';

/**
 * The legal documents, at `/docs/<lang>/legal/<doc>/`.
 *
 * The documents are listed once, in `content/nav.json`, where they are
 * also the two section rows of the sidebar and two cards of the docs
 * landing page (the `"collection": "legal"` sections). This route reads
 * that list rather than carrying its own copy, so the pages it generates
 * cannot fall out of step with the navigation.
 *
 * Both are served to the SPA by `/api/<doc>` and stored as one setting,
 * so there is a single text rather than a translation per locale; the
 * sync script copies it to every locale, which is what the SPA shows too.
 * The page title is the document's own `h1`.
 */
export function generateStaticParams() {
  return SUPPORTED_DOCS_LOCALES.flatMap((lang) =>
    collectionDocuments('legal', lang).map((document) => ({ lang, doc: document.id }))
  );
}

/**
 * Title and description for the legal pages.
 *
 * These are the pages the footer links to, so they are the ones an external
 * reader — or a crawler — lands on directly: without a description they show
 * up as a bare title, and without a title of their own they would all be
 * labelled with the site name. Both come from the document itself (its `h1`
 * and its opening paragraph) rather than from a hand-written table, so a
 * rewrite of the agreement updates the search result with it.
 */
export async function generateMetadata(props: {
  params: Promise<{ lang: string; doc: string }>;
}): Promise<Metadata> {
  const { lang, doc } = await props.params;
  const locale = docsLocaleFromSegment(lang);
  if (!collectionDocuments('legal', locale).some((document) => document.id === doc)) {
    return {};
  }

  const page = loadMarkdownPage(`legal/${locale}/${doc}.md`);
  if (!page) return {};

  return {
    title: page.title,
    description: page.description || undefined,
  };
}

export default async function LegalPage(props: {
  params: Promise<{ lang: string; doc: string }>;
}) {
  const { lang, doc } = await props.params;
  const locale = docsLocaleFromSegment(lang);
  if (!collectionDocuments('legal', locale).some((document) => document.id === doc)) notFound();

  const page = loadMarkdownPage(`legal/${locale}/${doc}.md`);
  if (!page) notFound();

  return (
    <DocsShell locale={locale} title={page.title} toc={page.toc}>
      <MarkdownBody html={page.html} />
    </DocsShell>
  );
}
