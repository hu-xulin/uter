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
import {
  isMaskedSecret,
  maskMultilineSecret,
  sanitizeSecretValue,
} from '@/lib/secret'

import type {
  ChannelProviderSettings,
  SystemOption,
  UpdateOptionRequest,
} from '../types'
import {
  buildChannelProviderCredentialSlotUpdates,
  channelProviderSlotAPIKeyOption,
  readChannelProviderCredentialSlots,
  type ChannelProviderCredentialSlot,
} from './channel-provider-credential-slots'

export type ChannelProviderPrefix = 'featured' | 'bailian' | 'subscription'

export type ChannelProviderFormValues = {
  // Console sign-in page for WorkBuddy's secondary cross-check only.
  loginUrl: string
  username: string
  password: string
  apiKey: string
  // Independent API address used to fetch model catalogue and prices. It is
  // never derived from loginUrl.
  apiUrl: string
  // Alibaba Bailian only: RAM AccessKey pair for Model Studio OpenAPI.
  accessKeyId?: string
  accessKeySecret?: string
  slots: ChannelProviderCredentialSlot[]
}

type ChannelProviderBaseField =
  | 'loginUrl'
  | 'username'
  | 'password'
  | 'apiKey'
  | 'apiUrl'
  | 'accessKeyId'
  | 'accessKeySecret'

const OPTION_SUFFIX: Record<ChannelProviderBaseField, string> = {
  loginUrl: 'login_url',
  username: 'username',
  password: 'password',
  apiKey: 'api_key',
  apiUrl: 'api_url',
  accessKeyId: 'access_key_id',
  accessKeySecret: 'access_key_secret',
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
  access_key_secret?: string
  slots?: ChannelProviderSlotMask[]
}

type ChannelProviderMaskView = Partial<
  Record<'featured' | 'bailian' | 'subscription', ChannelProviderMaskGroup>
>

const SLOT_OPTION_PATTERN =
  /^channel_provider\.(featured|bailian|subscription)\.slot_([A-Za-z0-9_-]{1,64})_api_key$/

/**
 * Recover credential-slot metadata from the raw option list when it is missing
 * or stale. A save bug could leave every provider's `credential_slots` pointing
 * at one slot id while the actual keys live under other ids; the form then
 * showed no keys at all even though they were still stored. Rebuild the
 * metadata from the authoritative `slot_<id>_api_key` option keys, preserving
 * group/mode/strategy from any metadata entry that already exists.
 */
function recoverCredentialSlotMetadata(
  prefix: 'featured' | 'bailian' | 'subscription',
  metadata: string | undefined,
  rawByKey: Map<string, string | undefined>
): string | undefined {
  const discovered = new Map<
    string,
    { id: string; group: string; label: string; mode: string; strategy: string }
  >()
  if (metadata) {
    try {
      const parsed: unknown = JSON.parse(metadata)
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (!item || typeof item !== 'object') continue
          const slot = item as Record<string, unknown>
          if (typeof slot.id !== 'string' || !slot.id) continue
          discovered.set(slot.id, {
            id: slot.id,
            group: typeof slot.group === 'string' ? slot.group : '',
            label: typeof slot.label === 'string' ? slot.label : '',
            mode:
              typeof slot.mode === 'string' &&
              ['single', 'batch', 'multi_to_single'].includes(slot.mode)
                ? slot.mode
                : 'single',
            strategy:
              slot.strategy === 'polling' || slot.strategy === 'random'
                ? slot.strategy
                : 'random',
          })
        }
      }
    } catch {
      // Fall through: discovered stays empty and keys below are rebuilt.
    }
  }

  let changed = false
  for (const [key] of rawByKey) {
    const match = SLOT_OPTION_PATTERN.exec(key)
    if (!match || match[1] !== prefix) continue
    const id = match[2]
    if (!discovered.has(id)) {
      discovered.set(id, {
        id,
        group: '',
        label: '',
        mode: 'single',
        strategy: 'random',
      })
      changed = true
    }
  }
  if (!changed) return metadata
  return JSON.stringify([...discovered.values()])
}

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
  let view: unknown = null
  if (encoded) {
    try {
      view = JSON.parse(encoded)
    } catch {
      view = null
    }
  }
  const hasDerivedView =
    view !== null && typeof view === 'object' && !Array.isArray(view)
  const rawByKey = new Map(raw?.map((option) => [option.key, option.value]))
  const hasRawSlotData = raw?.some(
    (option) =>
      option.key.endsWith('.credential_slots') ||
      /^channel_provider\.(featured|bailian|subscription)\.slot_[^_]+_api_key$/.test(
        option.key
      )
  )
  // Without either source there is nothing to restore; keep the original
  // reference so existing callers and tests see an unchanged settings object.
  if (!hasDerivedView && !hasRawSlotData) return settings

  const parsed = hasDerivedView ? (view as ChannelProviderMaskView) : null
  const next = { ...settings }

  // getOptionValue only keeps keys declared in defaultSettings, so the dynamic
  // per-provider credential-slot keys never survive it. Without the metadata
  // option, readChannelProviderCredentialSlots() returns [] after every save
  // refetch and useResetForm wipes the operator's groups. Restore the metadata
  // verbatim from the raw options here (this resolver is the only channel
  // settings hook that sees them).
  for (const prefix of ['featured', 'bailian', 'subscription'] as const) {
    const metadataKey = `channel_provider.${prefix}.credential_slots`
    const recovered = recoverCredentialSlotMetadata(
      prefix,
      rawByKey.get(metadataKey) || settings[metadataKey],
      rawByKey
    )
    if (typeof recovered === 'string' && recovered) {
      next[metadataKey] = recovered
    }
  }

  for (const prefix of ['featured', 'bailian', 'subscription'] as const) {
    const group = parsed?.[prefix]
    if (!group || typeof group !== 'object') continue
    if (typeof group.password === 'string') {
      next[`channel_provider.${prefix}.password`] = group.password
    }
    if (typeof group.api_key === 'string') {
      next[`channel_provider.${prefix}.api_key`] = group.api_key
    }
    if (prefix === 'bailian' && typeof group.access_key_secret === 'string') {
      next['channel_provider.bailian.access_key_secret'] =
        group.access_key_secret
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

  // Older/partial backends may not emit ChannelProviderCredentialMasks. The
  // option list itself already masks secret values, so restore each saved slot
  // from that mask; if an unmasked value ever reaches here, mask it locally
  // before it can enter form state. Never write these display values back.
  for (const prefix of ['featured', 'bailian', 'subscription'] as const) {
    for (const slot of readChannelProviderCredentialSlots(next, prefix)) {
      const optionKey = channelProviderSlotAPIKeyOption(prefix, slot.slotId)
      if (!optionKey || next[optionKey]) continue
      const rawValue = rawByKey.get(optionKey)
      if (typeof rawValue !== 'string' || !rawValue) continue
      next[optionKey] = isMaskedSecret(rawValue)
        ? rawValue
        : maskMultilineSecret(rawValue)
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
    'apiUrl',
    'accessKeyId',
    'accessKeySecret',
  ]

  for (const field of fields) {
    const secret =
      field === 'password' || field === 'apiKey' || field === 'accessKeySecret'
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
