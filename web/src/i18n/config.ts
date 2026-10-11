/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import {
  convertDetectedLanguage,
  normalizeInterfaceLanguage,
  type InterfaceLanguageCode,
} from './languages'
import en from './locales/en.json'
import { loadLocaleBundle } from './locale-loaders'
import { installRuntimeLocaleLoader } from './runtime-locale'

/**
 * `en` is the only statically bundled locale.
 *
 * It is the `fallbackLng`, so it must exist before i18next initializes; the
 * other six are code-split (see `locale-loaders.ts`) and merged in below. Every
 * locale used to be imported statically, which put ~1.2 MB gzip of translation
 * data into the entry chunk — about 86% of its raw bytes — and charged it to
 * every visitor regardless of the language they read.
 */
export const resources = {
  en,
} as const

/**
 * Merge a locale bundle into i18next and return whether it was applied.
 *
 * `deep` + `overwrite` let the freshly fetched strings win over anything already
 * registered for that language while leaving untouched keys intact.
 */
function mergeBundle(code: InterfaceLanguageCode, bundle: {
  translation: Record<string, string>
}): boolean {
  i18n.addResourceBundle(code, 'translation', bundle, true, true)
  return true
}

/**
 * Load `code`'s bundle and hand it to i18next.
 *
 * Callers that need the strings to be *correct* on the very first paint (the
 * entry point, before `root.render`) should await this. Callers that can tolerate
 * a repaint — e.g. an in-app language switch — can fire and forget, because
 * `addResourceBundle` already triggers the re-render.
 */
export async function ensureLocale(code: InterfaceLanguageCode): Promise<void> {
  const bundle = await loadLocaleBundle(code)
  if (!bundle) return
  mergeBundle(code, bundle)
  // Components that already rendered read `t()` once and will not re-run it on
  // their own; this event is what makes `useTranslation` re-render them.
  i18n.emit('loaded', i18n.isInitialized ? i18n.language : undefined)
}

const initialized = i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'zhCN', 'fr', 'ru', 'ja', 'vi', 'zhTW'],
    load: 'currentOnly',
    nsSeparator: false, // Allow literal colons in keys (e.g., URLs, labels)
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      // Browsers report `zh-CN`/`zh-TW`/`zh`; map them onto our `zhCN`/`zhTW`
      // codes (non-Chinese codes pass through for normal supportedLngs matching).
      convertDetectedLanguage,
    },
  })
  .then(async () => {
    // A language switch has to pull in that locale's code-split chunk before
    // the new strings can render. Registered after the initial `ensureLocale`
    // so the startup language is fetched exactly once.
    i18n.on('languageChanged', (code) => {
      void ensureLocale(normalizeInterfaceLanguage(code))
    })

    // Pull the active locale from `GET /api/i18n/:file` (present only when the
    // backend sets UTER_I18N_DIR) and swap it in over the bundled JSON, so a
    // corrected translation applies without a rebuild or restart. The bundled
    // copy above stays the first-paint source and the fallback when the
    // endpoint is absent.
    await ensureLocale(
      normalizeInterfaceLanguage(i18n.resolvedLanguage ?? i18n.language)
    )
    installRuntimeLocaleLoader()
  })
  .catch(() => {})

export { initialized }

export default i18n
