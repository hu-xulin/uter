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
  formatGroupRatio,
  groupRatioBadgeClass,
  hasGroupRatioBadge,
} from '../lib/group-ratio'

/**
 * 分组筛选（VIP0 … VIP5）的倍率徽标。
 *
 * 两条曾被反馈的问题：
 *   1. VIP0 显示 `x1`，隔壁 VIP1 是 `x0.9` —— 同一列小数位不齐，`x1` 读起来
 *      像「没有倍率」而不是「1.0 倍」；
 *   2. `x1` 走灰色徽标、`x0.9` 走绿色，同一列两种底色，看着像 VIP0 没生效。
 */
describe('分组倍率徽标', () => {
  it('恒带一位小数，整数补 .0', () => {
    expect(formatGroupRatio(1)).toBe('x1.0')
    expect(formatGroupRatio(0.9)).toBe('x0.9')
    expect(formatGroupRatio(0.85)).toBe('x0.85')
    expect(formatGroupRatio(1.05)).toBe('x1.05')
    expect(formatGroupRatio(0)).toBe('x0.0')
    expect(formatGroupRatio(undefined)).toBeUndefined()
  })

  it('倍率为 0 时不显示徽标（x0.0 会被误读成免费）', () => {
    expect(hasGroupRatioBadge(0)).toBe(false)
    // 未配置（undefined）与正常倍率仍照常处理。
    expect(hasGroupRatioBadge(undefined)).toBe(false)
    expect(hasGroupRatioBadge(1)).toBe(true)
    expect(hasGroupRatioBadge(0.9)).toBe(true)
    expect(hasGroupRatioBadge(1.2)).toBe(true)
  })

  it('≤1 与 VIP1 同色，溢价保持中性灰', () => {
    // VIP0（1.0）与 VIP1（0.9）必须完全同款。
    expect(groupRatioBadgeClass(1)).toBe(groupRatioBadgeClass(0.9))
    expect(groupRatioBadgeClass(1)).toBe(
      'bg-success-soft text-success-soft-foreground'
    )
    // 涨价不能染绿 —— 那等于把涨价说成优惠。
    expect(groupRatioBadgeClass(1.2)).toBe('bg-muted text-muted-foreground')
    expect(groupRatioBadgeClass(undefined)).toBe(
      'bg-muted text-muted-foreground'
    )
  })
})
