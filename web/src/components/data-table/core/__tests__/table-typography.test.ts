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

import { READABLE_TABLE_CLASS } from '../table-typography'

/**
 * 回归：以阅读为主的管理表必须统一到 UDS 8.0.0 body 档 text-sm(14px)。
 * 之前 API 密钥表漏配覆盖，停留在 Table 组件默认的 13px/12px，与使用日志、
 * 审计日志的 14px 不一致，观感偏小。本测试锁定该恒等关系，防止任何一页
 * 再次回退到密集档，或把 text-sm 写成 text-base(16px)/任意像素值。
 */
describe('READABLE_TABLE_CLASS', () => {
  it('覆盖表格本体、表头、单元格及单元格后代，全部落到 text-sm(14px)', () => {
    for (const selector of [
      '[data-slot=table]',
      '[data-slot=table]_td',
      '[data-slot=table]_td_*',
      '[data-slot=table]_th',
      '[data-slot=table]_th_*',
    ]) {
      expect(READABLE_TABLE_CLASS).toContain(`[&_${selector}]:text-sm`)
    }
  })

  it('不引入超出规范档位的字号（text-base 16px / 任意像素值）', () => {
    expect(READABLE_TABLE_CLASS).not.toMatch(/text-base/)
    expect(READABLE_TABLE_CLASS).not.toMatch(/\[\d+px\]/)
    // 只有 text-sm 一种字号类，避免 twMerge 冲突导致某个选择器被覆盖。
    const sizeTokens =
      READABLE_TABLE_CLASS.match(/text-(xs|sm|base|lg|2xs|dense)\b/g) || []
    expect([...new Set(sizeTokens)]).toEqual(['text-sm'])
  })
})
