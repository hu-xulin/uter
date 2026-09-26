/*
 * Localized brand name for the public site.
 *
 * The admin-configurable system name (e.g. "Uter.ai 优特智能") is shown verbatim
 * regardless of locale. The product brand, however, should follow the UI
 * language: full bilingual form in Chinese, and the short "Uter.ai" mark in
 * every other language (English, Japanese, Russian, French, Vietnamese, …).
 */
export function localizedBrandName(locale?: string): string {
  const lang = (locale ?? '').toLowerCase()
  if (lang.startsWith('zh')) {
    return lang.includes('tw') || lang.includes('hant')
      ? 'Uter.ai 優特智能'
      : 'Uter.ai 优特智能'
  }
  return 'Uter.ai'
}
