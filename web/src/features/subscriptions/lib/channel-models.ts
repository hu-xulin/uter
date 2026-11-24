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
 * A plan may restrict model choice to specific models on specific channels.
 * The stored value is a JSON object `{"<channelId>": ["model", ...]}`.
 * An empty string means unrestricted.
 */
export function parseChannelModels(value: string): Record<string, string[]> {
  const raw = (value || '').trim()
  if (!raw || raw === '{}' || raw === 'null') return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, string[]> = {}
    for (const [channelId, models] of Object.entries(parsed)) {
      if (!Array.isArray(models)) continue
      out[channelId] = models
        .filter((m): m is string => typeof m === 'string' && m.trim() !== '')
        .map((m) => m.trim())
    }
    return out
  } catch {
    return {}
  }
}
