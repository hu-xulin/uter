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
import type { UterAPIKeySlot } from '../api'

export type CredentialKeyMode = 'single' | 'batch' | 'multi_to_single'

export type CredentialSlot = {
  id: string
  groupName: string
  mode: CredentialKeyMode
  keysText: string
}

let nextSlotId = 0

export function createCredentialSlot(
  groupName = '',
  mode: CredentialKeyMode = 'single'
): CredentialSlot {
  nextSlotId += 1
  return { id: `credential-slot-${nextSlotId}`, groupName, mode, keysText: '' }
}

/** One API key per line; blank lines and duplicates are ignored. */
export function splitCredentialKeys(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ]
}

export type BuildCredentialSlotsResult = {
  slots: UterAPIKeySlot[]
  /** True when at least one row has a group but no key (server falls back). */
  hasMissingKey: boolean
  /** True when no usable row exists at all. */
  empty: boolean
}

/**
 * Expand wizard rows into the backend `slots` payload.
 *
 * - single: one key per channel. Extra lines are ignored (the first key wins).
 * - batch: one key per channel, one channel per line.
 * - multi_to_single: all keys share one channel; the backend marks it as a
 *   multi-key channel and rotates between the keys.
 *
 * A row with no keys still produces a slot with an empty key list: the server
 * fills it from the saved Uter.api subscription key (which is never exposed to
 * the browser). This is why `hasMissingKey` is separate from `empty`.
 */
export function buildCredentialSlots(
  rows: CredentialSlot[],
  resolveGroup: (groupName: string) => { name: string; group: string } | null,
  hasSavedKey: boolean
): BuildCredentialSlotsResult {
  const slots: UterAPIKeySlot[] = []
  let hasMissingKey = false
  let usableRows = 0

  for (const row of rows) {
    const target = resolveGroup(row.groupName.trim())
    if (!target) continue
    usableRows += 1
    const keys = splitCredentialKeys(row.keysText)
    if (keys.length === 0) {
      hasMissingKey = true
      slots.push({ name: target.name, group: target.group, keys: [] })
      continue
    }
    if (row.mode === 'batch') {
      keys.forEach((key, index) => {
        slots.push({
          name: keys.length === 1 ? target.name : `${target.name} ${index + 1}`,
          group: target.group,
          keys: [key],
        })
      })
      continue
    }
    if (row.mode === 'multi_to_single') {
      slots.push({ name: target.name, group: target.group, keys })
      continue
    }
    slots.push({ name: target.name, group: target.group, keys: [keys[0]] })
  }

  return {
    slots,
    hasMissingKey: hasMissingKey && !hasSavedKey,
    empty: usableRows === 0 || (slots.length === 0 && !hasSavedKey),
  }
}
