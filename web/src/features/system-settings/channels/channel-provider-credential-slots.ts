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

import type { UpdateOptionRequest } from '../types'
import type { ChannelProviderPrefix } from './channel-provider-settings-form'

export type ChannelProviderCredentialMode =
  | 'single'
  | 'batch'
  | 'multi_to_single'

export type ChannelProviderCredentialStrategy = 'random' | 'polling'

export type ChannelProviderCredentialSlot = {
  slotId: string
  group: string
  label: string
  mode: ChannelProviderCredentialMode
  strategy: ChannelProviderCredentialStrategy
  /** Backend per-line mask or plaintext typed by the operator. */
  apiKey: string
}

export type ChannelProviderCredentialSlotMetadata = {
  id: string
  group: string
  label: string
  mode: ChannelProviderCredentialMode
  strategy: ChannelProviderCredentialStrategy
}

export const CHANNEL_PROVIDER_CREDENTIAL_MODES: readonly {
  value: ChannelProviderCredentialMode
  label: string
}[] = [
  { value: 'single', label: 'Single Key' },
  { value: 'batch', label: 'Batch Add (one key per line)' },
  {
    value: 'multi_to_single',
    label: 'Multi-Key Mode (multiple keys, one channel)',
  },
]

export const CHANNEL_PROVIDER_CREDENTIAL_STRATEGIES: readonly {
  value: ChannelProviderCredentialStrategy
  label: string
}[] = [
  { value: 'random', label: 'Random' },
  { value: 'polling', label: 'Polling' },
]

const SLOT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
const MAX_SLOTS = 20

let nextSlotID = 0

export function createChannelProviderCredentialSlot(
  group = ''
): ChannelProviderCredentialSlot {
  nextSlotID += 1
  return {
    slotId: `slot-${Date.now().toString(36)}-${nextSlotID}`,
    group,
    label: '',
    mode: 'single',
    strategy: 'random',
    apiKey: '',
  }
}

function isMode(value: unknown): value is ChannelProviderCredentialMode {
  return value === 'single' || value === 'batch' || value === 'multi_to_single'
}

function isStrategy(
  value: unknown
): value is ChannelProviderCredentialStrategy {
  return value === 'random' || value === 'polling'
}

export function channelProviderSlotAPIKeyOption(
  prefix: ChannelProviderPrefix,
  id: string
) {
  return `channel_provider.${prefix}.slot_${id}_api_key`
}

export function channelProviderCredentialSlotsOption(
  prefix: ChannelProviderPrefix
) {
  return `channel_provider.${prefix}.credential_slots`
}

export function readChannelProviderCredentialSlots(
  settings: Record<string, string | undefined>,
  prefix: ChannelProviderPrefix
): ChannelProviderCredentialSlot[] {
  const raw = settings[channelProviderCredentialSlotsOption(prefix)]
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const seen = new Set<string>()
  const slots: ChannelProviderCredentialSlot[] = []
  for (const item of parsed.slice(0, MAX_SLOTS)) {
    if (!item || typeof item !== 'object') continue
    const candidate = item as Partial<ChannelProviderCredentialSlotMetadata>
    if (
      typeof candidate.id !== 'string' ||
      !SLOT_ID_PATTERN.test(candidate.id)
    ) {
      continue
    }
    if (seen.has(candidate.id)) {
      continue
    }
    seen.add(candidate.id)
    const mode = isMode(candidate.mode) ? candidate.mode : 'single'
    const strategy = isStrategy(candidate.strategy)
      ? candidate.strategy
      : 'random'
    slots.push({
      slotId: candidate.id,
      group: typeof candidate.group === 'string' ? candidate.group : '',
      label: typeof candidate.label === 'string' ? candidate.label : '',
      mode,
      strategy: mode === 'multi_to_single' ? strategy : 'random',
      apiKey:
        settings[channelProviderSlotAPIKeyOption(prefix, candidate.id)] ?? '',
    })
  }
  return slots
}

export function buildChannelProviderCredentialSlotMetadata(
  slots: readonly ChannelProviderCredentialSlot[]
): ChannelProviderCredentialSlotMetadata[] {
  return slots.slice(0, MAX_SLOTS).map((slot) => ({
    id: slot.slotId,
    group: String(slot.group ?? '').trim(),
    label: String(slot.label ?? '').trim(),
    mode: isMode(slot.mode) ? slot.mode : 'single',
    strategy:
      slot.mode === 'multi_to_single' && isStrategy(slot.strategy)
        ? slot.strategy
        : 'random',
  }))
}

export function buildChannelProviderCredentialSlotUpdates(
  prefix: ChannelProviderPrefix,
  values: readonly ChannelProviderCredentialSlot[],
  defaults: readonly ChannelProviderCredentialSlot[]
): UpdateOptionRequest[] {
  const updates: UpdateOptionRequest[] = []
  const metadata = JSON.stringify(
    buildChannelProviderCredentialSlotMetadata(values)
  )
  const previousMetadata = JSON.stringify(
    buildChannelProviderCredentialSlotMetadata(defaults)
  )
  if (metadata !== previousMetadata) {
    updates.push({
      key: channelProviderCredentialSlotsOption(prefix),
      value: metadata,
    })
  }

  const oldKeys = new Map(
    defaults.map((slot) => [slot.slotId, slot.apiKey.trim()])
  )
  for (const slot of values) {
    // 粘贴时可能混入界面翻译标签（如 zh 的 t('Key') = 「密钥」），
    // 保存前先剥离，避免脏前缀落库后在输入框里显示为乱码掩码。
    const next = sanitizeSecretValue(String(slot.apiKey ?? ''))
    const previous = oldKeys.get(slot.slotId) ?? ''
    if (!next || next === previous || isMaskedSecret(next)) continue
    const key = channelProviderSlotAPIKeyOption(prefix, slot.slotId)
    if (!key) continue
    updates.push({ key, value: next })
  }
  return updates
}

export function maskChannelProviderCredentialSlots(
  slots: readonly ChannelProviderCredentialSlot[],
  mask: (value: string) => string
): ChannelProviderCredentialSlot[] {
  return slots.map((slot) => ({
    ...slot,
    apiKey: isMaskedSecret(slot.apiKey) ? slot.apiKey : mask(slot.apiKey),
  }))
}
