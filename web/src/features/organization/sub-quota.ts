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

export type SubQuotaAmountResult =
  | { kind: 'unlimited'; quota: 0 }
  | { kind: 'quota'; quota: number }
  | { kind: 'invalid' }

/**
 * Parse the displayed currency amount into integer quota units.
 * Empty/zero explicitly mean unlimited; malformed, negative, or unsafe values
 * must never silently clear an existing quota limit.
 */
export function parseSubQuotaAmount(
  value: string,
  quotaPerUnit: number,
  badInput = false
): SubQuotaAmountResult {
  if (badInput || !Number.isFinite(quotaPerUnit) || quotaPerUnit <= 0) {
    return { kind: 'invalid' }
  }

  const trimmed = value.trim()
  if (trimmed === '') {
    return { kind: 'unlimited', quota: 0 }
  }

  const amount = Number(trimmed)
  if (!Number.isFinite(amount) || amount < 0) {
    return { kind: 'invalid' }
  }
  if (amount === 0) {
    return { kind: 'unlimited', quota: 0 }
  }

  const quota = Math.ceil(amount * quotaPerUnit)
  if (!Number.isSafeInteger(quota) || quota <= 0) {
    return { kind: 'invalid' }
  }
  return { kind: 'quota', quota }
}
