import type { ReactNode } from 'react';
import { SUPPORTED_DOCS_LOCALES, i18n, type DocsLocale } from '@/lib/i18n';
import { DocsI18nProvider } from '@/lib/docs-i18n-provider';

export function generateStaticParams() {
  return SUPPORTED_DOCS_LOCALES.map((lang) => ({ lang }));
}

/**
 * Per-locale layout for `/about/[lang]/`.
 *
 * Mirrors the docs one: it feeds the locale from the URL segment into
 * Fumadocs' `I18nProvider` so the language switch highlights the right
 * language and keeps you on the same page when you change it.
 */
export default async function AboutLocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale: DocsLocale = (
    SUPPORTED_DOCS_LOCALES as readonly string[]
  ).includes(lang)
    ? (lang as DocsLocale)
    : i18n.defaultLanguage;
  return <DocsI18nProvider locale={locale}>{children}</DocsI18nProvider>;
}
