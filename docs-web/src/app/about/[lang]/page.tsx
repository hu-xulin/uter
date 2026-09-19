import { ContentCardGrid } from '@/lib/content-renderer';
import { aboutSectionUrl, getAboutContent } from '@/lib/content/about';
import { DocsShell } from '@/lib/docs-shell';
import { SUPPORTED_DOCS_LOCALES, docsLocaleFromSegment } from '@/lib/i18n';
import { aboutSidebarEntries } from '@/lib/nav';

/**
 * Landing page of the company profile, at `/about/zh/` and `/about/en/`.
 *
 * The profile is split into a page per chapter, so this is the index
 * that leads into them: the title and tagline, then a card for each
 * chapter. Chapter bodies live under `./[section]/`.
 *
 * The sidebar lists the chapters and nothing else — the profile's own
 * title is not an entry, since it is where you already are when you
 * arrive from the top navigation's 「关于」.
 */
export function generateStaticParams() {
  return SUPPORTED_DOCS_LOCALES.map((lang) => ({ lang }));
}

export default async function AboutPage(props: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await props.params;
  const locale = docsLocaleFromSegment(lang);
  const content = getAboutContent(locale);

  const items = content.sections.map((section, index) => ({
    title: section.heading,
    url: aboutSectionUrl(locale, index),
    // The chapter's opening sentence doubles as its teaser — every
    // chapter starts with one, and it says what the page is about
    // better than a hand-written blurb would.
    teaser: section.subSections?.[0]?.paragraphs?.[0],
  }));

  return (
    <DocsShell
      locale={locale}
      title={content.title}
      description={content.description}
      toc={[]}
      entries={aboutSidebarEntries(locale)}
    >
      <ContentCardGrid items={items} />
    </DocsShell>
  );
}
