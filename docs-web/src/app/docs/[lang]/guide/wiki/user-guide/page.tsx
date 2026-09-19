import { ContentCardGrid } from '@/lib/content-renderer';
import { userGuideChapterTeaser } from '@/lib/content/user-guide-chapter';
import {
  USER_GUIDE_CHAPTER_SLUGS,
  getUserGuideContent,
  userGuideChapterTitle,
  userGuideChapterUrl,
} from '@/lib/content/user-guide';
import { DocsShell } from '@/lib/docs-shell';
import { SUPPORTED_DOCS_LOCALES, docsLocaleFromSegment } from '@/lib/i18n';

/**
 * Landing page of the user guide, at `/docs/<lang>/guide/wiki/user-guide/`.
 *
 * The guide is split into a page per chapter, so this is the index that
 * leads into them: the guide's title and blurb, then a card for each
 * chapter. Chapter bodies live under `./[chapter]/`.
 *
 * Each card's summary is the chapter's own opening sentence
 * (`userGuideChapterTeaser`) rather than a blurb maintained separately,
 * so the index cannot drift out of date as the chapters are rewritten.
 */
export function generateStaticParams() {
  return SUPPORTED_DOCS_LOCALES.map((lang) => ({ lang }));
}

export default async function UserGuidePage(props: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await props.params;
  const locale = docsLocaleFromSegment(lang);
  const content = getUserGuideContent(locale);

  const items = USER_GUIDE_CHAPTER_SLUGS.map((slug) => ({
    title: userGuideChapterTitle(locale, slug) ?? slug,
    url: userGuideChapterUrl(locale, slug),
    teaser: userGuideChapterTeaser(locale, slug),
  }));

  return (
    <DocsShell
      locale={locale}
      title={content.title}
      description={content.description}
      toc={[]}
    >
      <ContentCardGrid items={items} />
    </DocsShell>
  );
}
