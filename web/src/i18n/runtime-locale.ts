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

import { normalizeInterfaceLanguage } from './languages'

/**
 * Runtime interface-locale hot-reload.
 *
 * Locale JSON is bundled into the SPA at build time — `en` statically, the rest
 * as code-split chunks pulled in by `locale-loaders.ts` — so fixing a typo in a
 * translation normally means a frontend rebuild plus a server restart. When the
 * backend exposes `GET /api/i18n/:file` — i.e. `UTER_I18N_DIR` points at a
 * directory of locale JSONs — we fetch the active locale once at startup and
 * swap it into i18next, so an edited translation reaches users without
 * rebuilding or restarting.
 *
 * The bundled JSON stays the source of truth for first paint and remains the
 * fallback: when the endpoint is absent (the default single-binary install)
 * every request 404s and the app behaves exactly as before.
 *
 * The response is `no-cache` + content-ETag, so the browser revalidates on
 * every load: unchanged locales cost one conditional request and no body,
 * changed ones are picked up on the next page load.
 */

/** i18next language code → the locale filename the backend serves. */
const LOCALE_FILE_BY_CODE: Record<string, string> = {
  en: 'en.json',
  zhCN: 'zh.json',
  zhTW: 'zh-TW.json',
  fr: 'fr.json',
  ru: 'ru.json',
  ja: 'ja.json',
  vi: 'vi.json',
}

function localeFileForCode(code?: string | null): string | null {
  const normalized = normalizeInterfaceLanguage(code)
  return LOCALE_FILE_BY_CODE[normalized] ?? null
}

type Bundle = Record<string, unknown>

/**
 * Merge a fetched locale into i18next.
 *
 * `deep` + `overwrite` make the runtime values win over the bundled ones for
 * the keys they define, while keys absent from the response keep working from
 * the bundle. Returns true when something was actually applied, so callers can
 * skip a needless re-render.
 *
 * Exported for tests; not part of the app's public surface.
 */
export function applyBundle(
  code: string,
  payload: unknown,
  target: typeof i18n = i18n
): boolean {
  if (!payload || typeof payload !== 'object') return false
  const translation = (payload as { translation?: unknown }).translation
  if (!translation || typeof translation !== 'object') return false

  const bundle = translation as Bundle
  const current = target.getResourceBundle(code, 'translation') as
    | Bundle
    | undefined
  // Nothing new to merge when every fetched key already matches.
  const changed = Object.entries(bundle).some(
    ([key, value]) => current?.[key] !== value
  )
  if (!changed) return false

  target.addResourceBundle(code, 'translation', bundle, true, true)
  return true
}

async function fetchLocale(code: string): Promise<void> {
  const file = localeFileForCode(code)
  if (!file) return
  if (typeof window === 'undefined') return

  try {
    const res = await fetch(`/api/i18n/${file}`, {
      headers: { Accept: 'application/json' },
      // Revalidate every load; the server answers 304 when nothing changed.
      cache: 'no-cache',
    })
    // 404 is the expected path when the feature isn't configured — stay on
    // the bundled locale silently rather than logging noise.
    if (!res.ok) return
    const payload = await res.json()
    if (applyBundle(code, payload)) {
      // Force mounted components to re-read `t()` with the new strings.
      i18n.emit('loaded', i18n.isInitialized ? i18n.language : undefined)
    }
  } catch {
    // Offline / transient failure: the bundled locale remains in place.
  }
}

/**
 * Fetch the currently active locale (and refetch on language switches) so the
 * interface picks up edited translations without a rebuild or restart.
 *
 * Safe to call more than once; failures are swallowed by design.
 */
export function installRuntimeLocaleLoader(): void {
  if (typeof window === 'undefined') return

  void fetchLocale(i18n.resolvedLanguage ?? i18n.language)

  i18n.on('languageChanged', (code) => {
    void fetchLocale(code)
  })
}
