/**
 * Locale list for the docs site.
 *
 * The gateway's SPA already supports the full seven-locale set
 * (`zh-CN`, `zh-TW`, `fr`, `ja`, `ru`, `vi`, `en`); the docs site now
 * ships translations for the same seven. Adding more is a one-line change
 * here plus, for full docs pages, a content folder under `content/`.
 */
export const SUPPORTED_DOCS_LOCALES = [
  'zh',
  'zh-TW',
  'en',
  'fr',
  'ja',
  'ru',
  'vi',
] as const;
export type DocsLocale = (typeof SUPPORTED_DOCS_LOCALES)[number];

export const i18n = {
  defaultLanguage: 'zh' as const,
  languages: SUPPORTED_DOCS_LOCALES,
};

/**
 * Map the gateway SPA's locale codes onto a docs locale.
 *
 * The SPA uses `zh-CN` / `zh-TW` while the docs site uses `zh` / `zh-TW`,
 * so the regional variant has to be normalised here. Anything unrecognised
 * falls back to `en` — that is the second language we author content for,
 * and the safe default for locales we have not translated yet.
 *
 * This is the only place that needs to know about the mapping.
 */
export function resolveDocsLocale(spaLocale: string | undefined | null): DocsLocale {
  if (!spaLocale) return i18n.defaultLanguage;
  const normalized = spaLocale.toLowerCase();
  if (normalized.startsWith('zh')) {
    return normalized.includes('tw') || normalized.includes('hant') ? 'zh-TW' : 'zh';
  }
  if (
    normalized === 'en' ||
    normalized === 'fr' ||
    normalized === 'ja' ||
    normalized === 'ru' ||
    normalized === 'vi'
  ) {
    return normalized as DocsLocale;
  }
  return 'en';
}

export type Locale = (typeof i18n.languages)[number];

/**
 * Coerce a `[lang]` URL segment to a supported locale.
 *
 * Route params are strings, and with `output: 'export'` only the
 * generated locales are ever built — but the segment still has to be
 * narrowed before it can index per-locale content, and an unrecognised
 * one should read as the default rather than crash a render.
 */
export function docsLocaleFromSegment(segment: string): DocsLocale {
  return (SUPPORTED_DOCS_LOCALES as readonly string[]).includes(segment)
    ? (segment as DocsLocale)
    : i18n.defaultLanguage;
}
