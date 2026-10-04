import type { ReactNode } from 'react';
import { SUPPORTED_DOCS_LOCALES, i18n, type DocsLocale } from '@/lib/i18n';
import { DocsI18nProvider } from '@/lib/docs-i18n-provider';
import { LocaleHtmlLang } from '@/lib/locale-html-lang';

export function generateStaticParams() {
  return SUPPORTED_DOCS_LOCALES.map((lang) => ({ lang }));
}

/**
 * Per-locale layout for `/docs/[lang]/...`. Feeds the current locale
 * into Fumadocs' `I18nProvider` so the language switcher highlights
 * the correct language and `onLocaleChange` redirects to the right
 * `/docs/<target>/` URL.
 */
export default async function DocsLocaleLayout({
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
  return (
    <>
      <LocaleHtmlLang locale={locale} />
      <DocsI18nProvider locale={locale}>{children}</DocsI18nProvider>
    </>
  );
}
