'use client';

/**
 * The current docs locale, read from the pathname.
 *
 * Fumadocs' own `useI18n()` is not usable for every component that needs
 * the locale: `SearchProvider` renders the search dialog *above* the
 * per-locale `I18nProvider` in `[lang]/layout.tsx`, so inside the dialog
 * that context still holds the root default. The URL segment is the one
 * source both sides agree on, which is why this hook exists instead of
 * reading the i18n context.
 */

import { usePathname } from 'fumadocs-core/framework';

import { localeFromPath } from '@/lib/docs-search-index';
import { SUPPORTED_DOCS_LOCALES, i18n, type DocsLocale } from '@/lib/i18n';

export function useDocsLocale(): DocsLocale {
  const pathname = usePathname();
  const segment = localeFromPath(pathname);
  if (segment && (SUPPORTED_DOCS_LOCALES as readonly string[]).includes(segment)) {
    return segment as DocsLocale;
  }
  return i18n.defaultLanguage;
}
