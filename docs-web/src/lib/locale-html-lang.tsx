'use client';

import { useLayoutEffect } from 'react';
import type { DocsLocale } from '@/lib/i18n';

/**
 * The root `layout.tsx` hard-codes `<html lang='zh-CN'>` because it cannot
 * know the locale (it is shared across every `/docs/<lang>/…` page). Each
 * pre-rendered locale page is static-exported, so we set the real language
 * attribute here, before paint, from the `[lang]` segment the nested layout
 * already resolved.
 *
 * `useLayoutEffect` runs synchronously after DOM mutation but before the
 * browser paints, so the attribute is correct on first visual frame — no
 * flash, and correct `lang` for accessibility / SEO.
 */
const HTML_LANG: Record<DocsLocale, string> = {
  zh: 'zh-CN',
  'zh-TW': 'zh-TW',
  en: 'en',
  fr: 'fr',
  ja: 'ja',
  ru: 'ru',
  vi: 'vi',
};

export function LocaleHtmlLang({ locale }: { locale: DocsLocale }) {
  useLayoutEffect(() => {
    document.documentElement.lang = HTML_LANG[locale] ?? locale;
  }, [locale]);
  return null;
}
