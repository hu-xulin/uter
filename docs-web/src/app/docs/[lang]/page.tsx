import { ContentCardGrid } from '@/lib/content-renderer';
import { DocsShell } from '@/lib/docs-shell';
import type { DocsLocale } from '@/lib/i18n';
import { SUPPORTED_DOCS_LOCALES, docsLocaleFromSegment } from '@/lib/i18n';
import { landingCards } from '@/lib/nav';

/**
 * `/docs/<lang>/` — the docs site's own front page, 文档 / Docs.
 *
 * This route has been a quick-start page and then a jump-off point that
 * forwarded to 特性说明. It is a page again: one card per section of the
 * outline, so the locale root is somewhere to land rather than only
 * somewhere to pass through.
 *
 * The cards are the outline's own sections — `landingCards()` reads the
 * same `content/nav.json` the sidebar does, and a page earns a card by
 * declaring a `summary` there. A section therefore cannot be renamed or
 * moved in one place and left behind in the other.
 */
const TITLE: Record<DocsLocale, string> = { zh: '文档', en: 'Docs' };

const INTRO: Record<DocsLocale, string> = {
  zh: '按板块浏览：特性说明、用户指南、API 参考、AI 应用与协议文件。',
  en: 'Browse by section: features, the user guide, the API reference, AI apps and the legal documents.',
};

export function generateStaticParams() {
  return SUPPORTED_DOCS_LOCALES.map((lang) => ({ lang }));
}

export default async function DocsLandingPage(props: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await props.params;
  const locale = docsLocaleFromSegment(lang);
  const prefix = `/docs/${locale}`;

  return (
    <DocsShell locale={locale} title={TITLE[locale]} description={INTRO[locale]} toc={[]}>
      <ContentCardGrid items={landingCards(locale, prefix)} />
    </DocsShell>
  );
}
