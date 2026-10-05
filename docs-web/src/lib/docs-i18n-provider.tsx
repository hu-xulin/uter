'use client';

import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { I18nProvider } from 'fumadocs-ui/contexts/i18n';
import { SUPPORTED_DOCS_LOCALES, type DocsLocale } from '@/lib/i18n';
import { DOCS_CHROME } from '@/lib/docs-copy';

/**
 * Per-locale i18n provider for the docs site.
 *
 * The root `layout.tsx` wraps everything in `RootProvider`, but
 * `RootProvider`'s `I18nProvider` doesn't know the current locale
 * from the URL. This nested layout receives the locale from the
 * `[lang]` segment and feeds it to a dedicated `I18nProvider` that
 * also carries the `onLocaleChange` handler for URL-based switching.
 *
 * `translations` is what localises Fumadocs' own UI strings — the TOC
 * heading, the sidebar's accessible names, the search trigger — since
 * Fumadocs ships English only. `I18nProvider` forwards the map to
 * `@fuma-translate/react`, whose key is the English source string plus
 * its note chain; `docs-copy.ts` documents the exact spelling.
 *
 * `onLocaleChange` swaps the locale segment of the current URL — the
 * second one, since ours are `/<section>/<locale>/…` rather than the
 * `/<locale>/…` Fumadocs' default logic assumes. Both sections that use
 * this provider (`docs`, `about`) share that shape, so the section is
 * read off the path instead of being configured, and switching language
 * anywhere in either site keeps you on the page you were reading.
 */
export function DocsI18nProvider({
  locale,
  children,
}: {
  locale: DocsLocale;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <I18nProvider
      locale={locale}
      locales={[
        { name: '中文', locale: 'zh' },
        { name: '繁體中文', locale: 'zh-TW' },
        { name: 'English', locale: 'en' },
        { name: 'Français', locale: 'fr' },
        { name: '日本語', locale: 'ja' },
        { name: 'Русский', locale: 'ru' },
        { name: 'Tiếng Việt', locale: 'vi' },
      ]}
      translations={DOCS_CHROME[locale]}
      onLocaleChange={(target) => {
        if (typeof window === 'undefined') return;
        // `usePathname()` returns the path without the `basePath`
        // (`/docs-content`), so the shape is `/docs/<lang>/…` /
        // `/about/<lang>/…` — section first, locale second — exactly as
        // before `basePath` was introduced. `router.push` re-adds the
        // `basePath`, so the real URL stays under `/docs-content`.
        const segments = (pathname ?? '').split('/');
        const section = segments[1];
        const current = segments[2];
        const isLocale =
          current !== undefined &&
          (SUPPORTED_DOCS_LOCALES as readonly string[]).includes(current);
        if (section && isLocale) {
          segments[2] = target;
          const next = segments.join('/');
          router.push(next.endsWith('/') ? next : `${next}/`);
          return;
        }
        router.push(section ? `/${section}/${target}/` : `/${target}/`);
      }}
    >
      {children}
    </I18nProvider>
  );
}
