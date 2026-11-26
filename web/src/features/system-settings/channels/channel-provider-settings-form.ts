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
import { isMaskedSecret, sanitizeSecretValue } from '@/lib/secret'

import type {
  ChannelProviderSettings,
  SystemOption,
  UpdateOptionRequest,
} from '../types'
import {
  buildChannelProviderCredentialSlotUpdates,
  channelProviderSlotAPIKeyOption,
  type ChannelProviderCredentialSlot,
} from './channel-provider-credential-slots'

export type ChannelProviderPrefix = 'featured' | 'bailian' | 'subscription'

export type ChannelProviderFormValues = {
  loginUrl: string
  username: string
  password: string
  apiKey: string
  slots: ChannelProviderCredentialSlot[]
}

type ChannelProviderBaseField = 'loginUrl' | 'username' | 'password' | 'apiKey'

const OPTION_SUFFIX: Record<ChannelProviderBaseField, string> = {
  loginUrl: 'login_url',
  username: 'username',
  password: 'password',
  apiKey: 'api_key',
}

export function channelProviderOptionKey(
  prefix: ChannelProviderPrefix,
  field: ChannelProviderBaseField
) {
  return `channel_provider.${prefix}.${OPTION_SUFFIX[field]}`
}

type ChannelProviderSlotMask = {
  id?: string
  api_key?: string
}

type ChannelProviderMaskGroup = {
  password?: string
  api_key?: string
  slots?: ChannelProviderSlotMask[]
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

  // getOptionValue only keeps keys declared in defaultSettings, so the dynamic
  // per-provider credential-slot keys never survive it. Without the metadata
  // option, readChannelProviderCredentialSlots() returns [] after every save
  // refetch and useResetForm wipes the operator's groups. Restore the metadata
  // verbatim from the raw options here (this resolver is the only channel
  // settings hook that sees them). Slot API keys are deliberately NOT copied
  // from raw: they are set from the derived mask view below, so plaintext
  // credentials never reach the form state.
  const rawByKey = new Map(raw?.map((option) => [option.key, option.value]))
  for (const prefix of ['featured', 'bailian', 'subscription'] as const) {
    const metadataKey = `channel_provider.${prefix}.credential_slots`
    const metadata = rawByKey.get(metadataKey)
    if (typeof metadata === 'string' && metadata) {
      next[metadataKey] = metadata
    }
  }

  for (const prefix of ['featured', 'bailian', 'subscription'] as const) {
    const group = parsed[prefix]
    if (!group || typeof group !== 'object') continue
    if (typeof group.password === 'string') {
      next[`channel_provider.${prefix}.password`] = group.password
    }
    if (typeof group.api_key === 'string') {
      next[`channel_provider.${prefix}.api_key`] = group.api_key
    }
    for (const slot of group.slots ?? []) {
      if (
        !slot ||
        typeof slot.id !== 'string' ||
        typeof slot.api_key !== 'string'
      ) {
        continue
      }
      const optionKey = channelProviderSlotAPIKeyOption(prefix, slot.id)
      if (optionKey) next[optionKey] = slot.api_key
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
  const fields: ChannelProviderBaseField[] = [
    'loginUrl',
    'username',
    'password',
    'apiKey',
  ]

  for (const field of fields) {
    const secret = field === 'password' || field === 'apiKey'
    // 密钥粘贴时可能混入界面翻译标签（如 zh 的 t('Key') = 「密钥」）；
    // 保存前剥离，避免脏前缀落库。非密钥字段（URL/用户名）原样保留。
    const raw = (values[field] ?? '').trim()
    const next = secret ? sanitizeSecretValue(raw) : raw
    const previous = (defaults[field] ?? '').trim()
    if (next === previous) continue

    if (secret && (next === '' || isMaskedSecret(next))) continue

    updates.push({
      key: channelProviderOptionKey(prefix, field),
      value: next,
    })
  }

  updates.push(
    ...buildChannelProviderCredentialSlotUpdates(
      prefix,
      values.slots ?? [],
      defaults.slots ?? []
    )
  )
  return updates
}
