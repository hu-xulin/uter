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
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type DiscountBadgeProps = {
  /**
   * 价差倍率：平台价 / 官方价（或实付 / 原价）。
   *
   * 角标颜色只由它决定 —— `< 1` 是折扣（绿），`> 1` 是溢价（红），
   * 恰好等于 1（两位小数取整后）是中性灰「与官方价一致」。
   */
  ratio: number
  /** 悬停提示，通常是精确的百分比，例如 `-10%` / `+5%`。 */
  title?: string
  className?: string
  children: ReactNode
}

/**
 * 价格对比角标（`x0.9` / `20% OFF` / `+5%` / `x1.0`）。
 *
 * 配色是**全站唯一一处**折扣语义落点，定价页与钱包充值档位共用：
 *
 * - 折扣（倍率 < 1）→ `bg-success-hover`（#15803D，配白字 5.02:1，达 AA）
 * - 溢价（倍率 > 1）→ `bg-destructive-hover`（#EF4444，3.76:1，见 exceptions E24）
 * - 与官方价持平（倍率取整后 = 1）→ `bg-muted` 中性灰：既非「对用户有利」
 *   也非「被加价」，红色会把持平误报成溢价（2026-11-02 用户裁定 seedance-2.0-ab
 *   这类 0% 价差也要有角标）
 *
 * 绿底取 `success-hover` 而不是 `success`：后者 #16A34A 配白字只有 3.30:1。
 * 类名必须是 `bg-success-hover` —— Token 键叫 `--color-success-hover`，把 `hover`
 * 写到 `success` 前面 Tailwind 会静默不生成，角标就变成透明底。
 *
 * 溢价刻意不用绿色：绿色在这套界面里恒表示「对用户有利」。
 */
export function DiscountBadge({
  ratio,
  title,
  className,
  children,
}: DiscountBadgeProps) {
  // 两位小数取整后等于 1 → 持平（覆盖 0.995 ~ 1.0049 的比价结果）。
  const isNeutral = Math.round(ratio * 100) / 100 === 1
  const isMarkup = ratio > 1

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg px-1.5 py-1 text-xs font-semibold whitespace-nowrap',
        isNeutral
          ? 'bg-muted text-fg-secondary'
          : isMarkup
            ? 'bg-destructive-hover text-on-emphasis'
            : 'bg-success-hover text-on-emphasis',
        className
      )}
      title={title}
    >
      {children}
    </span>
  )
}
