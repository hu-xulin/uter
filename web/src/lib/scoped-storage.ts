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
import type { StateStorage } from 'zustand/middleware'

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

/**
 * StateStorage adapter for zustand's `persist` middleware.
 *
 * `persist` resolves the storage key once, at store creation, so handing it a
 * plain `name` would put every account in the same slot. Routing get/set
 * through scopedKey gives each account its own entry instead — otherwise a
 * second account signing in on the same browser inherits the first one's
 * persisted state.
 */
export const scopedStateStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(scopedKey(name))
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(scopedKey(name), value)
    } catch {
      /* storage unavailable or quota exceeded — ignore */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(scopedKey(name))
    } catch {
      /* storage unavailable — ignore */
    }
  },
}

/**
 * Drop every user-scoped entry that belongs to the account being signed out.
 *
 * Private per-account data (playground conversations, read state, personal
 * settings) must not survive for whoever uses the browser next. Scanning for
 * the `:userId` suffix covers every scoped key without each feature having to
 * register its own, so a new scoped key is cleaned up by default.
 *
 * Must run while the session is still populated: scopedKey falls back to the
 * unscoped name once the user is cleared.
 */
export function clearScopedItemsForCurrentUser(): void {
  const userId = useAuthStore.getState().auth.user?.id
  if (!userId) return
  const suffix = `:${userId}`
  try {
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key?.endsWith(suffix)) doomed.push(key)
    }
    for (const key of doomed) localStorage.removeItem(key)
  } catch {
    /* storage unavailable — ignore */
  }
}
