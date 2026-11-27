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
import { describe, expect, it } from 'vitest'

import {
  comparePinnedChannelOrder,
  PINNED_CHANNEL_ORDER,
  sortByPinnedChannelOrder,
} from './channel-order'

const PINNED = [...PINNED_CHANNEL_ORDER]

describe('comparePinnedChannelOrder', () => {
  it('九个业务指定渠道始终按固定顺序置顶，忽略模型数', () => {
    // 故意让模型数与固定顺序相反，验证固定顺序优先。
    const counts = new Map(PINNED.map((name, index) => [name, 100 - index]))
    const shuffled = [...PINNED].reverse()
    const sorted = [...shuffled].sort((a, b) =>
      comparePinnedChannelOrder(a, counts.get(a) ?? 0, b, counts.get(b) ?? 0)
    )
    expect(sorted).toEqual(PINNED)
  })

  it('固定渠道排在未列入渠道之前', () => {
    const names = ['普通渠道A', 'Claude-Basic', '普通渠道B', '优特-精选']
    const counts = new Map([
      ['普通渠道A', 5],
      ['Claude-Basic', 100],
      ['普通渠道B', 9],
      ['优特-精选', 200],
    ])
    const sorted = [...names].sort((a, b) =>
      comparePinnedChannelOrder(a, counts.get(a) ?? 0, b, counts.get(b) ?? 0)
    )
    expect(sorted).toEqual([
      '优特-精选',
      'Claude-Basic',
      '普通渠道B',
      '普通渠道A',
    ])
  })

  it('未列入渠道按模型数降序，同数量按名称排序', () => {
    const items = [
      ['Zeta', 5],
      ['Alpha', 5],
      ['Beta', 9],
      ['Gamma', 1],
    ] as const
    const sorted = [...items].sort((a, b) =>
      comparePinnedChannelOrder(a[0], a[1], b[0], b[1])
    )
    expect(sorted.map(([name]) => name)).toEqual([
      'Beta',
      'Alpha',
      'Zeta',
      'Gamma',
    ])
  })
})

describe('sortByPinnedChannelOrder', () => {
  it('对任意对象数组按渠道名排序，且不修改原数组', () => {
    const items = [
      { name: 'GPT-Max', count: 1 },
      { name: 'Claude-Basic', count: 2 },
      { name: '其他渠道', count: 20 },
      { name: '优特-精选', count: 3 },
    ]
    const original = [...items]
    const sorted = sortByPinnedChannelOrder(
      items,
      (item) => item.name,
      (item) => item.count
    )
    expect(sorted.map((item) => item.name)).toEqual([
      '优特-精选',
      'Claude-Basic',
      'GPT-Max',
      '其他渠道',
    ])
    expect(items).toEqual(original)
  })
})
