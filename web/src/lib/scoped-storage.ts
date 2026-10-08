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
import { useAuthStore } from '@/stores/auth-store'

/**
 * Resolve a localStorage key for the currently signed-in account.
 *
 * Browser localStorage is scoped to the *browser profile*, NOT to the account.
 * Any private, per-user data (playground conversations, personal preferences,
 * per-user settings, …) persisted there MUST be routed through these helpers so
 * the account id is embedded in the key. Without it, two people sharing a
 * machine — or one person switching accounts in the same browser — would load
 * each other's data.
 *
 * Falls back to the unscoped key only when nobody is signed in; every real
 * read/write for an authenticated user is user-scoped.
 */
export function scopedKey(baseKey: string): string {
  const userId = useAuthStore.getState().auth.user?.id
  return userId ? `${baseKey}:${userId}` : baseKey
}

export function getScopedItem<T = unknown>(baseKey: string): T | null {
  try {
    const raw = localStorage.getItem(scopedKey(baseKey))
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function setScopedItem(baseKey: string, value: unknown): void {
  try {
    localStorage.setItem(scopedKey(baseKey), JSON.stringify(value))
  } catch {
    /* storage unavailable or quota exceeded — ignore */
  }
}

export function removeScopedItem(baseKey: string): void {
  localStorage.removeItem(scopedKey(baseKey))
}
