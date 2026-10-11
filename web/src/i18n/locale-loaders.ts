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
import type { InterfaceLanguageCode } from './languages'

/** The shape every locale JSON on disk has: a single `translation` namespace. */
export type LocaleBundle = { translation: Record<string, string> }

type LocaleModule = { default: LocaleBundle }

/**
 * Dynamic loaders for the non-English locale bundles.
 *
 * Bundling all seven locales statically put ~1.2 MB of gzip into the entry
 * chunk — measured against a production build, `locales/*.json` accounted for
 * roughly 86% of the entry chunk's raw bytes, and every visitor paid for the
 * six languages they were not going to read.
 *
 * `en` stays a static import in `config.ts`: it is the fallback namespace, so
 * it has to be present before i18next initializes, and an English visitor
 * (or a visitor whose chosen locale fails to load) still gets real strings
 * rather than raw keys. The remaining six are code-split — each becomes its own
 * async chunk, fetched at most once, and only when that language is actually
 * selected.
 */
const LOCALE_LOADERS: Record<
  Exclude<InterfaceLanguageCode, 'en'>,
  () => Promise<LocaleModule>
> = {
  zhCN: () => import('./locales/zh.json'),
  zhTW: () => import('./locales/zh-TW.json'),
  fr: () => import('./locales/fr.json'),
  ru: () => import('./locales/ru.json'),
  ja: () => import('./locales/ja.json'),
  vi: () => import('./locales/vi.json'),
}

/**
 * In-flight/settled loads, keyed by language code. Rspack already caches the
 * chunk at the network layer, but deduping here also collapses the repeated
 * `languageChanged` events i18next emits during startup into one import, and
 * lets a second caller await the *same* promise instead of starting another
 * dynamic import.
 */
const pending = new Map<InterfaceLanguageCode, Promise<LocaleBundle | null>>()

/**
 * Fetch one locale bundle, or `null` when the language has no separate chunk
 * (`en`) or the chunk could not be loaded.
 *
 * Returning `null` rather than rejecting is deliberate: a failed locale load
 * must never break rendering. i18next keeps whatever it already has for that
 * language and falls back to `en`.
 */
export function loadLocaleBundle(
  code: InterfaceLanguageCode
): Promise<LocaleBundle | null> {
  const existing = pending.get(code)
  if (existing) return existing

  const loader = LOCALE_LOADERS[code as Exclude<InterfaceLanguageCode, 'en'>]
  if (!loader) {
    // `en` is bundled statically; nothing to fetch.
    const settled = Promise.resolve<LocaleBundle | null>(null)
    pending.set(code, settled)
    return settled
  }

  const request = loader()
    .then((module) => module.default)
    .catch(() => null)
  pending.set(code, request)
  return request
}
