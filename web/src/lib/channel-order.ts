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
 * 业务指定的渠道固定顺序（定价页左侧与上游监测共用同一真源）。
 * 未列入的渠道按「承载模型数降序、同数量按名称」排在后面，避免隐藏新增渠道。
 */
export const PINNED_CHANNEL_ORDER = [
  '优特-精选',
  '优特-百炼',
  'Claude-Basic',
  'Claude-Pro',
  'Claude-Max',
  'Claude-Ultra',
  'GPT-Pro',
  'GPT-Max',
  'GPT-Ultra',
] as const

const PINNED_CHANNEL_RANK = new Map<string, number>(
  PINNED_CHANNEL_ORDER.map((channel, index) => [channel, index] as const)
)

/**
 * 渠道排序比较器：固定渠道置顶且保持指定顺序，其余按模型数降序 + 名称兜底。
 * `aModelCount` / `bModelCount` 传入渠道承载的模型数（定价页取 facet 计数，
 * 上游监测取渠道 models 长度）。
 */
export function comparePinnedChannelOrder(
  aName: string,
  aModelCount: number,
  bName: string,
  bModelCount: number
): number {
  const rankA = PINNED_CHANNEL_RANK.get(aName)
  const rankB = PINNED_CHANNEL_RANK.get(bName)
  if (rankA !== undefined && rankB !== undefined) return rankA - rankB
  if (rankA !== undefined) return -1
  if (rankB !== undefined) return 1
  return bModelCount - aModelCount || aName.localeCompare(bName)
}

/**
 * 按渠道固定顺序对任意对象数组排序（返回新数组，不修改入参）。
 * 定价页侧栏、上游监测渠道下拉与监测任务列表共用，确保三处顺序完全一致。
 */
export function sortByPinnedChannelOrder<T>(
  items: readonly T[],
  getName: (item: T) => string,
  getModelCount: (item: T) => number
): T[] {
  return [...items].sort((a, b) =>
    comparePinnedChannelOrder(
      getName(a),
      getModelCount(a),
      getName(b),
      getModelCount(b)
    )
  )
}
