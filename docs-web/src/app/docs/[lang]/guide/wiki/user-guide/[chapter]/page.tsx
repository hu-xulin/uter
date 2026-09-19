import { notFound } from 'next/navigation';

import { BlockList, BlockSection } from '@/lib/content-renderer';
import { getUserGuideChapter } from '@/lib/content/user-guide-chapter';
import { USER_GUIDE_CHAPTER_SLUGS } from '@/lib/content/user-guide';
import { DocsShell } from '@/lib/docs-shell';
import { planHeadings } from '@/lib/docs-toc';
import { SUPPORTED_DOCS_LOCALES, docsLocaleFromSegment } from '@/lib/i18n';

/**
 * One chapter of the user guide, at
 * `/docs/<lang>/guide/wiki/user-guide/<chapter>/`.
 *
 * Each chapter is a page rather than a section of one long document, so
 * opening 「注册与登录」 shows that chapter alone. The chapter's own title
 * is the page's `h1` (`DocsShell`'s `title`), which is why the headings
 * below it start at `h2` and the right-hand table of contents lists them
 * at depth 2 and 3.
 *
 * The body comes from `getUserGuideChapter()`, which prefers a Markdown
 * file under `content/user-guide/<locale>/<slug>.md` and falls back to
 * the structured content in `user-guide.ts` for a chapter that has not
 * been converted yet. Both arrive as the same block model, so this page
 * does not care which it got.
 *
 * Anchors come from `planHeadings()` — the same call the page uses for
 * its `id`s — so the TOC and the rendered headings cannot disagree, which
 * is also what keeps a search hit landing on a real element.
 */
export function generateStaticParams() {
  return SUPPORTED_DOCS_LOCALES.flatMap((lang) =>
    USER_GUIDE_CHAPTER_SLUGS.map((chapter) => ({ lang, chapter }))
  );
}

export default async function UserGuideChapterPage(props: {
  params: Promise<{ lang: string; chapter: string }>;
}) {
  const { lang, chapter: slug } = await props.params;
  const locale = docsLocaleFromSegment(lang);

  const chapter = getUserGuideChapter(locale, slug);
  if (!chapter) notFound();

  const { toc, sectionIds, subSectionIds } = planHeadings(chapter.groups);

  return (
    <DocsShell locale={locale} title={chapter.title} toc={toc}>
      {/*
        * The chapter's opening prose, before its first `##`. Not part of
        * the TOC — it sits under the page's own `h1` — but dropping it
        * would lose the sentence that says what the chapter covers.
        */}
      <BlockList blocks={chapter.lead} locale={locale} />
      {chapter.groups.map((group, i) => (
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
