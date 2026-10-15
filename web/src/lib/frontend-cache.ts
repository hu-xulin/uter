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
import { THEME_STORAGE_KEYS } from '@/lib/theme-storage'

const FRONTEND_CACHE_VERSION = 'default-v1'
const FRONTEND_CACHE_VERSION_KEY = 'Uter:default:cache-version'
/**
 * Keys the version bump must not touch.
 *
 * The wipe exists to drop *derived* UI state that a new build may have
 * changed the shape of. A preference the user set by hand is not that:
 * `i18nextLng` is where i18next caches the chosen interface language, and
 * deleting it makes the next load fall back to `navigator.language` — an
 * English-locale browser then renders the whole interface in English while
 * 个人设置, which reads the account rather than this cache, still shows
 * 「简体中文」 selected.
 */
const PRESERVED_LOCAL_STORAGE_KEYS = new Set([
  FRONTEND_CACHE_VERSION_KEY,
  ...Object.values(THEME_STORAGE_KEYS),
  'user',
  'uid',
  'aff',
  'oauth:binding:result',
  'i18nextLng',
])

export function initializeFrontendCache(): void {
  if (typeof window === 'undefined') return

  try {
    const currentVersion = window.localStorage.getItem(
      FRONTEND_CACHE_VERSION_KEY
    )
    if (currentVersion === FRONTEND_CACHE_VERSION) return

    clearLocalUiCache()
    window.localStorage.setItem(
      FRONTEND_CACHE_VERSION_KEY,
      FRONTEND_CACHE_VERSION
    )
  } catch {
    // Storage can be unavailable in private mode; the app should still boot.
  }
}

function clearLocalUiCache(): void {
  const keysToRemove: string[] = []
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (key && !PRESERVED_LOCAL_STORAGE_KEYS.has(key)) {
      keysToRemove.push(key)
    }
  }

  keysToRemove.forEach((key) => window.localStorage.removeItem(key))
}
