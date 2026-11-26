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
/**
 * Uter Route detection never hardcodes a supplier host: the admin console asks
 * the backend for the configured endpoint and compares hostnames here.
 */
export function isUterRouteBaseUrl(
  baseUrl: string | null | undefined,
  configuredHost: string | null | undefined
): boolean {
  const host = configuredHost?.trim().toLowerCase()
  if (!host) return false
  let raw = (baseUrl ?? '').trim().toLowerCase()
  if (!raw) return false
  if (!raw.includes('://')) raw = `https://${raw}`
  try {
    const parsed = new URL(raw)
    const candidate = parsed.hostname.toLowerCase()
    return candidate === host || candidate.endsWith(`.${host}`)
  } catch {
    return false
  }
}
