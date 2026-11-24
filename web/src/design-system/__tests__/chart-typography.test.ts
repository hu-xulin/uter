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

import { CHART_FONT_SIZE } from '../tokens/chart-typography'

/**
 * 回归：图表 canvas 文字（轴标签、图例、柱顶数值、流程节点）属于「必须能读」
 * 的信息，不是装饰。历史上该常量从 11px（低于全站下限）修到 12px caption 档，
 * 但在 1600×900 的全屏看板里仍明显偏小 —— 与同页 14px 的卡片标签并排时形成
 * 视觉落差。UDS 8.0.0 的 body 档是 14px，图表文字跟随正文基准更协调。
 *
 * 锁定两点：值落在规范阶梯内（12/13/14/16/18/20/24/30/36/48），且不低于
 * body 档 14px，防止再次回退到 caption/密集档。
 */
describe('CHART_FONT_SIZE', () => {
  it('落在 UDS 8.0.0 字号阶梯内', () => {
    expect([12, 13, 14, 16, 18, 20, 24, 30, 36, 48]).toContain(CHART_FONT_SIZE)
  })

  it('不低于 body 档 14px，保证看板图表文字可读', () => {
    expect(CHART_FONT_SIZE).toBeGreaterThanOrEqual(14)
  })
})
