import type { DocsLocale } from '../i18n';

import { ZH_CONTENT } from './about-content/zh';
import { ZH_TW_CONTENT } from './about-content/zh-TW';
import { EN_CONTENT } from './about-content/en';
import { FR_CONTENT } from './about-content/fr';
import { JA_CONTENT } from './about-content/ja';
import { RU_CONTENT } from './about-content/ru';
import { VI_CONTENT } from './about-content/vi';

import type { AboutContent } from './about-shared';
import { ABOUT_SECTION_SLUGS, aboutSectionUrl } from './about-shared';
import type { AboutSection, AboutSectionSlug } from './about-shared';
import { PARTNER_GROUP_LABELS } from './about-shared';

export type {
  AboutContent,
  AboutEntry,
  AboutPartner,
  AboutSection,
  AboutSectionSlug,
  AboutSubSection,
} from './about-shared';
export { ABOUT_SECTION_SLUGS, aboutSectionUrl, PARTNER_GROUP_LABELS } from './about-shared';

/**
 * The company profile, in the reader's language.
 *
 * Every supported locale has its own module under `./about-content/`, so
 * this is a straight lookup with no fallback: a language that has not been
 * written yet is a build error rather than a page of English, which is the
 * failure mode a silent `?? EN_CONTENT` would hide.
 */
const CONTENT_BY_LOCALE: Record<DocsLocale, AboutContent> = {
  zh: ZH_CONTENT,
  'zh-TW': ZH_TW_CONTENT,
  en: EN_CONTENT,
  fr: FR_CONTENT,
  ja: JA_CONTENT,
  ru: RU_CONTENT,
  vi: VI_CONTENT,
};

export function getAboutContent(locale: DocsLocale): AboutContent {
  return CONTENT_BY_LOCALE[locale];
}

/**
 * One chapter of the profile, addressed by its URL slug.
 *
 * Chapters are pages of their own (`/about/<lang>/<slug>/`), so this is
 * what a chapter route resolves its params with. Unknown slugs come back
 * `undefined` and the route turns that into a 404 rather than rendering
 * an empty page.
 */
export function getAboutSection(
  locale: DocsLocale,
  slug: string
): { section: AboutSection; index: number; slug: AboutSectionSlug } | undefined {
  const index = (ABOUT_SECTION_SLUGS as readonly string[]).indexOf(slug);
  if (index === -1) return undefined;

  const section = getAboutContent(locale).sections[index];
  if (!section) return undefined;

  return { section, index, slug: ABOUT_SECTION_SLUGS[index] };
}
