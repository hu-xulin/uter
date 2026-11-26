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
import { isMaskedSecret } from '@/lib/secret'

import type {
  ChannelProviderSettings,
  SystemOption,
  UpdateOptionRequest,
} from '../types'

export type ChannelProviderPrefix = 'featured' | 'bailian' | 'subscription'

export type ChannelProviderFormValues = {
  loginUrl: string
  username: string
  password: string
  apiKey: string
}

const OPTION_SUFFIX: Record<keyof ChannelProviderFormValues, string> = {
  loginUrl: 'login_url',
  username: 'username',
  password: 'password',
  apiKey: 'api_key',
}

export function channelProviderOptionKey(
  prefix: ChannelProviderPrefix,
  field: keyof ChannelProviderFormValues
) {
  return `channel_provider.${prefix}.${OPTION_SUFFIX[field]}`
}

type ChannelProviderMaskGroup = {
  password?: string
  api_key?: string
}

type ChannelProviderMaskView = Partial<
  Record<'featured' | 'bailian' | 'subscription', ChannelProviderMaskGroup>
>

/**
 * Replace whole-string option masks with the backend's per-line masks.
 *
 * GET /api/option/ masks each secret as one value, which loses the newlines of
 * a multiline API key. The derived view keeps one mask per saved line; falling
 * back to the raw option value keeps the form usable on older backends.
 */
export function applyChannelProviderMaskView(
  settings: ChannelProviderSettings,
  raw: SystemOption[] | undefined
): ChannelProviderSettings {
  const encoded = raw?.find(
    (option) => option.key === 'ChannelProviderCredentialMasks'
  )?.value
  if (!encoded) return settings

  let view: unknown
  try {
    view = JSON.parse(encoded)
  } catch {
    return settings
  }
  if (!view || typeof view !== 'object' || Array.isArray(view)) {
    return settings
  }

  const parsed = view as ChannelProviderMaskView
  const next = { ...settings }
  for (const prefix of ['featured', 'bailian', 'subscription'] as const) {
    const group = parsed[prefix]
    if (!group || typeof group !== 'object') continue
    if (typeof group.password === 'string') {
      next[`channel_provider.${prefix}.password`] = group.password
    }
    if (typeof group.api_key === 'string') {
      next[`channel_provider.${prefix}.api_key`] = group.api_key
    }
  }
  return next
}

/**
 * Build the minimal option update set for one provider group.
 *
 * Secret fields arrive as backend masks in display mode. A mask must never be
 * written back, otherwise it would replace the real stored credential. Empty
 * values are also skipped: SecretInput restores the saved value when the user
 * focuses and leaves without typing.
 */
export function buildChannelProviderUpdates(
  prefix: ChannelProviderPrefix,
  values: ChannelProviderFormValues,
  defaults: ChannelProviderFormValues
): UpdateOptionRequest[] {
  const updates: UpdateOptionRequest[] = []
  const fields: (keyof ChannelProviderFormValues)[] = [
    'loginUrl',
    'username',
    'password',
    'apiKey',
  ]

  for (const field of fields) {
    const next = (values[field] ?? '').trim()
    const previous = (defaults[field] ?? '').trim()
    if (next === previous) continue

    const secret = field === 'password' || field === 'apiKey'
    if (secret && (next === '' || isMaskedSecret(next))) continue

    updates.push({
      key: channelProviderOptionKey(prefix, field),
      value: next,
    })
  }

  return updates
}
