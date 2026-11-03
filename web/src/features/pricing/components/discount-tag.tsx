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
 * - **持平**：平台价与官方价一致（或价差小到取整回 1）→ 中性灰 `x1.0`。
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

  // 与官方价持平（或价差小到两位小数取整回 1）：渲染中性 x1.0 而不是什么都不
  // 显示 —— 用户无法区分「与官方同价」和「没算出折扣」（2026-11-02 用户裁定）。
  // 仅在存在官方参照（info.ratio 非空）时生效；无从比价的模型保持静默。
  const rounded = info.ratio != null ? Math.round(info.ratio * 100) / 100 : null
  if (rounded === 1) {
    return (
      <DiscountBadge ratio={1} title='0%' className={props.className}>
        x1.0
      </DiscountBadge>
    )
  }

  if (!info.hasDiscount && info.markup == null) return null

  const isMarkup = !info.hasDiscount
  // 折扣的 `zhe` 是折数（0.6 折率 → 6），这里还原成倍率，与溢价同一口径。
  const ratio = isMarkup ? (info.markup ?? 1) : info.zhe / 10
  // 无官方参照的组倍率折扣兜底路径取整后不可能 ≥ 1，此守卫仅为防御。
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
