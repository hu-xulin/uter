import { notFound } from 'next/navigation';

import { AboutChapterBody } from '@/lib/content-renderer';
import { ABOUT_SECTION_SLUGS, getAboutSection } from '@/lib/content/about';
import { DocsShell } from '@/lib/docs-shell';
import { planHeadings } from '@/lib/docs-toc';
import { SUPPORTED_DOCS_LOCALES, docsLocaleFromSegment } from '@/lib/i18n';
import { aboutSidebarEntries } from '@/lib/nav';

/**
 * One chapter of the company profile, at `/about/<lang>/<slug>/`.
 *
 * Each chapter is a page rather than a section of one long document, so
 * opening 「我们的团队」 shows that chapter alone. The chapter's own title
 * is the page's `h1`; the right-hand table of contents therefore lists
 * the headings *inside* the chapter, which is why they are re-levelled
 * to depth 2 below — on this page they are the top level, not a
 * sub-level of anything the reader can see.
 *
 * Those headings keep their ids from `planHeadings()`, the same call the
 * docs pages use, so the TOC and the rendered `h3`s cannot disagree.
 * That is also what keeps `/about/zh/our-story/#第四阶段-面向未来` — the
 * URL the search index hands out — landing on a real element.
 */
export function generateStaticParams() {
  return SUPPORTED_DOCS_LOCALES.flatMap((lang) =>
    ABOUT_SECTION_SLUGS.map((section) => ({ lang, section }))
  );
}

export default async function AboutSectionPage(props: {
  params: Promise<{ lang: string; section: string }>;
}) {
  const { lang, section: slug } = await props.params;
  const locale = docsLocaleFromSegment(lang);

  const found = getAboutSection(locale, slug);
  if (!found) notFound();

  const plan = planHeadings([found.section]);
  const subIds = plan.subSectionIds[0] ?? [];
  const toc = plan.toc
    .filter((item) => item.depth === 3)
    .map((item) => ({ ...item, depth: 2 }));

  return (
    <DocsShell
      locale={locale}
      title={found.section.heading}
      toc={toc}
      entries={aboutSidebarEntries(locale)}
    >
      <AboutChapterBody subIds={subIds} section={found.section} locale={locale} />
    </DocsShell>
  );
}
