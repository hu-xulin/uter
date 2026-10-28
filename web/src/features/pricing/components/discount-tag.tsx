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
along with this program; see <https://www.gnu.org/licenses/>.
*/
import { memo } from 'react'

import { DiscountBadge } from '@/components/ui/discount-badge'

import { getDiscountInfo } from '../lib/price'
import type { PricingModel } from '../types'

export type DiscountTagProps = {
  model: PricingModel
  officialPrices?: Record<string, Record<string, number>>
  selectedGroup?: string
  className?: string
}

/**
 * 模型名后的价格对比角标，两种形态共用同一套「倍率」写法：
 *
 * - **折扣**：平台价低于官方价 → 绿色 `x0.6`（ratio 0.6 → `x0.6`、0.85 → `x0.85`）。
 * - **溢价**：平台价高于官方价 → 红色 `x1.05`（ratio 1.05 → `x1.05`）。
 *
 * 折扣过去写成「6 折」，和溢价角标的 `x1.05` 是两套计数法 —— 同一张卡片上
 * 「6折」与「x1.05」并列时，读者得先在脑子里换算一次才能比较。统一成
 * 「官方价 × 倍率」后两者直接可比。溢价刻意不用绿色 —— 绿色在这套界面里
 * 恒表示「对用户有利」。
 */
export const DiscountTag = memo(function DiscountTag(props: DiscountTagProps) {
  const info = getDiscountInfo(
    props.model,
    props.officialPrices,
    props.selectedGroup
  )

  if (!info.hasDiscount && info.markup == null) return null

  const isMarkup = !info.hasDiscount
  // 折扣的 `zhe` 是折数（0.6 折率 → 6），这里还原成倍率，与溢价同一口径。
  const ratio = isMarkup ? (info.markup ?? 1) : info.zhe / 10
  // 折扣不到 0.5% 时两位小数会取整回 1，渲染出来就是 `x1` —— 一个声称有折扣
  // 却看不出折扣的角标。与溢价取整成 `x1.00` 时同样的处理：宁可不显示。
  if (!isMarkup && Math.round(ratio * 100) / 100 >= 1) return null

  return (
    <DiscountBadge
      ratio={ratio}
      className={props.className}
      title={
        isMarkup
          ? `+${Math.round(((info.markup ?? 1) - 1) * 100)}%`
          : `-${Math.round(info.percent)}%`
      }
    >
      x{formatMultiplier(ratio)}
    </DiscountBadge>
  )
})

/** `0.6` / `0.85` / `1.05` —— 两位小数取整，去掉无意义的尾零。 */
function formatMultiplier(ratio: number): string {
  return String(Math.round(ratio * 100) / 100)
}
