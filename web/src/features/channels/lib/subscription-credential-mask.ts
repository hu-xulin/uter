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

type MaskGroup = {
  password?: string
  api_key?: string
  slots?: Array<{ id?: string; api_key?: string }>
}
export type ChannelProviderCredentialGroup =
  | 'featured'
  | 'bailian'
  | 'subscription'
type MaskView = Partial<Record<ChannelProviderCredentialGroup, MaskGroup>>

/**
 * 读取系统设置里某一组渠道提供方已存 API Key 的逐行掩码，用于创建向导提示。
 *
 * 明文按安全红线不下发浏览器：GET /api/option/ 只给出掩码。后端用
 * ChannelProviderCredentialMasks 下发逐行掩码（保留一行一个 key 的结构），
 * 这里按 featured / bailian / subscription 解析对应 api_key；解析不到时返回
 * 空数组，表示未配置。返回的每一行都应是掩码串（含 *），绝不可能是明文。
 */
export function readChannelProviderKeyMask(
  options: SystemOption[] | undefined,
  group: ChannelProviderCredentialGroup,
  field: 'api_key' | 'password' = 'api_key'
): string[] {
  const encoded = options?.find(
    (option) => option.key === 'ChannelProviderCredentialMasks'
  )?.value
  if (!encoded) return []

  let view: unknown
  try {
    view = JSON.parse(encoded)
  } catch {
    return []
  }
  if (!view || typeof view !== 'object' || Array.isArray(view)) return []

  const credential = (view as MaskView)[group]
  const masks: string[] = []
  const append = (value: unknown) => {
    if (typeof value !== 'string') return
    for (const line of value.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !masks.includes(trimmed)) masks.push(trimmed)
    }
  }
  append(credential?.[field])
  // Grouped credentials store one key (or one newline-separated key list) per
  // slot. Reading only the top-level api_key makes a settings-only deployment
  // look empty and blocks the wizard's "leave blank to reuse saved key" path.
  if (field === 'api_key') {
    for (const slot of credential?.slots ?? []) append(slot?.api_key)
  }
  return masks
}

/** 保留原调用名：Uter.api（优特订阅）已存密钥掩码。 */
export function readSubscriptionKeyMask(
  options: SystemOption[] | undefined
): string[] {
  return readChannelProviderKeyMask(options, 'subscription')
}
