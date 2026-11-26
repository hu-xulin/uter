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
import type { SystemOption } from '@/features/system-settings/types'

import { CHANNEL_TYPE_ALI } from '../constants'
import type { ChannelProviderTarget } from './channel-configuration'

export type ChannelProviderGroup = 'featured' | 'bailian' | 'subscription'

export type ChannelProviderConnection = {
  loginUrl: string
  username: string
  // 独立的 API 地址：仅它用于获取模型信息与价格，绝不从 loginUrl 推导。
  apiUrl: string
}

/**
 * 三类托管渠道到 System Settings → Channels 分组的映射：
 *   Uter Route (65)  → featured
 *   Alibaba Bailian (17) → bailian
 *   Uter.api (64)    → subscription
 * 与后端 applyChannelProviderCredentials 的映射严格一致。
 */
/**
 * 保留该导出以兼容既有调用方与测试，但语义已收紧：系统设置里的链接一律
 * 只是「控制台登录地址」，仅供 WorkBuddy 登录上游后台，不再作为 API 地址。
 * 获取模型/价格只能使用独立的 api_url。
 */
export function shouldUseProviderLoginURLAsBaseURL(
  _group: ChannelProviderGroup
): boolean {
  return false
}

export function channelProviderGroupForTarget(
  target: ChannelProviderTarget | null
): ChannelProviderGroup | null {
  if (!target) return null
  if (target.kind === 'uterroute') return 'featured'
  if (target.kind === 'uterapi') return 'subscription'
  if (target.kind === 'builtin' && target.type === CHANNEL_TYPE_ALI) {
    return 'bailian'
  }
  return null
}

function readOption(options: SystemOption[] | undefined, key: string): string {
  const value = options?.find((option) => option.key === key)?.value
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * 读取系统设置里对应分组的明文连接信息。login_url 与 username 按后端约定
 * 不经掩码、由 GET /api/option/ 明文下发，可在选定供应商时直接预填。
 */
export function readChannelProviderConnection(
  options: SystemOption[] | undefined,
  group: ChannelProviderGroup
): ChannelProviderConnection {
  return {
    loginUrl: readOption(options, `channel_provider.${group}.login_url`),
    username: readOption(options, `channel_provider.${group}.username`),
    apiUrl: readOption(options, `channel_provider.${group}.api_url`),
  }
}

/** 需要二次验证才能揭示的密钥 option key。 */
export function channelProviderSecretOptionKey(
  group: ChannelProviderGroup,
  field: 'api_key' | 'password'
): string {
  return `channel_provider.${group}.${field}`
}

/** 一条已保存 API Key 的来源：揭示用的 option key + 逐行掩码 + 上游分组。 */
export type ProviderAPIKeySource = {
  optionKey: string
  maskLines: string[]
  /** 系统设置槽位里保存的上游分组 key（如 Claude-kiro）；顶层密钥为空串。 */
  group: string
  mode: string
}

type MaskSlot = { id?: string; api_key?: string }
type MaskGroup = {
  api_key?: string
  password?: string
  slots?: MaskSlot[]
}
type MaskView = Partial<Record<ChannelProviderGroup, MaskGroup>>

function splitMask(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * 找到该分组真正保存 API Key 的所有 option key。
 *
 * 系统设置允许把密钥存在「分组槽位」里（slot_<id>_api_key），此时顶层的
 * api_key 为空、掩码在 slots[] 内。只读顶层会漏掉全部已存密钥。
 * 有槽位时返回每个有掩码的槽位；没有槽位时回退旧的顶层 api_key。
 */
type SlotMeta = { id?: string; group?: string; mode?: string }

export function resolveProviderAPIKeySources(
  options: SystemOption[] | undefined,
  group: ChannelProviderGroup
): ProviderAPIKeySource[] {
  const byKey = new Map(
    options?.map((option) => [option.key, option.value] as const)
  )
  const encoded = byKey.get('ChannelProviderCredentialMasks')
  if (!encoded) return []
  let view: unknown
  try {
    view = JSON.parse(encoded)
  } catch {
    return []
  }
  if (!view || typeof view !== 'object' || Array.isArray(view)) return []
  const maskGroup = (view as MaskView)[group]
  if (!maskGroup || typeof maskGroup !== 'object') return []

  // 槽位的分组 / 模式是明文元数据，和掩码按 id 合并。
  const metaById = new Map<string, SlotMeta>()
  const rawMeta = byKey.get(`channel_provider.${group}.credential_slots`)
  if (rawMeta) {
    try {
      const parsed = JSON.parse(rawMeta)
      if (Array.isArray(parsed)) {
        for (const meta of parsed as SlotMeta[]) {
          if (meta && typeof meta.id === 'string') metaById.set(meta.id, meta)
        }
      }
    } catch {
      // 元数据损坏时仍保留掩码来源，只是分组/模式留空。
    }
  }

  const sources: ProviderAPIKeySource[] = []
  for (const slot of maskGroup.slots ?? []) {
    if (!slot || typeof slot.id !== 'string' || !slot.id) continue
    const maskLines = splitMask(slot.api_key)
    if (maskLines.length === 0) continue
    const meta = metaById.get(slot.id)
    sources.push({
      optionKey: `channel_provider.${group}.slot_${slot.id}_api_key`,
      maskLines,
      group: typeof meta?.group === 'string' ? meta.group : '',
      mode: typeof meta?.mode === 'string' ? meta.mode : '',
    })
  }
  if (sources.length > 0) return sources

  const maskLines = splitMask(maskGroup.api_key)
  if (maskLines.length === 0) return []
  return [
    {
      optionKey: channelProviderSecretOptionKey(group, 'api_key'),
      maskLines,
      group: '',
      mode: '',
    },
  ]
}

/** 单条便捷版：取第一个有掩码的密钥来源。 */
export function resolveProviderAPIKeySource(
  options: SystemOption[] | undefined,
  group: ChannelProviderGroup
): ProviderAPIKeySource | null {
  return resolveProviderAPIKeySources(options, group)[0] ?? null
}
