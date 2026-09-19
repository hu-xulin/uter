/**
 * Locale list for the docs site. Adding more is a one-line change here
 * plus, for full docs pages, a content folder under `content/`.
 *
 * The supported locales are intentionally short (`zh`, `en`) — the
 * gateway's SPA already maps a much wider set (zh-CN, zh-TW, fr, ja,
 * ru, vi) onto a single canonical locale for the docs site, since we
 * only author content for one language pair today.
 */
export const SUPPORTED_DOCS_LOCALES = ['zh', 'en'] as const;
export type DocsLocale = (typeof SUPPORTED_DOCS_LOCALES)[number];

export const i18n = {
  defaultLanguage: 'zh' as const,
  languages: SUPPORTED_DOCS_LOCALES,
};

/**
 * Map the gateway SPA's locale codes onto a docs locale. Anything that
 * isn't `zh` falls back to `en` for now — that's the supported pair we
 * ship translations for. Add specific locale codes here as more
 * translations are authored; this function is the only place that
 * needs to know about the mapping.
 */
export function resolveDocsLocale(spaLocale: string | undefined | null): DocsLocale {
  if (!spaLocale) return i18n.defaultLanguage;
  const normalized = spaLocale.toLowerCase();
  if (normalized.startsWith('zh')) return 'zh';
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