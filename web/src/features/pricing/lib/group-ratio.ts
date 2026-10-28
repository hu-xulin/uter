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
 * 分组筛选（VIP0 … VIP5）倍率徽标的文案与配色。
 *
 * 独立成模块而不是留在 `pricing-sidebar.tsx`：侧栏是组件文件，导出非组件
 * 常量会触发 `react-refresh/only-export-components`，热更新会整页刷新。
 */

/**
 * 倍率文案：恒带一位小数（`x1.0` / `x0.9` / `x0.85`）。
 *
 * 整数倍率此前渲染成 `x1`，与隔壁的 `x0.9` 摆在一起时，读者会以为前者是
 * 「没有倍率」而后者是「打折」—— 其实两者是同一把尺子上的两个刻度。补上
 * `.0` 后同一列的小数位对齐，`x1.0` 读起来就是「1.0 倍」，不是「1 倍」。
 */
export function formatGroupRatio(
  ratio: number | undefined
): string | undefined {
  if (ratio == null) return undefined
  const trimmed = ratio.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return `x${trimmed.includes('.') ? trimmed : `${trimmed}.0`}`
}

/**
 * 倍率为 0 时是否展示徽标：不展示。
 *
 * 倍率 0 意味着运营把这一档配置成了「不开放计价」（或配置遗漏），渲染成
 * `x0.0` 会像「免费」—— 这是个危险的误读。宁可什么都不显示，让用户看到
 * 的第一信号是该档倍率未配置，而不是一个看似合法的价格刻度。
 */
export function hasGroupRatioBadge(ratio: number | undefined): boolean {
  return ratio != null && ratio !== 0
}

/**
 * 倍率徽标的配色：`≤1` 一律染绿，`>1` 保持中性灰。
 *
 * 判据是「这一档对用户有没有利」。`x1.0`（VIP0）与 `x0.9`（VIP1）是同一把尺子
 * 上的相邻刻度，只把 `x1.0` 留成灰色会让同一列看起来像「这一档没生效」。溢价
 * （>1）不能染绿 —— 那等于把涨价说成优惠。
 *
 * 绿底用 soft 对（≈6.6:1），不是 `success/80` + 白字（2.6:1，不达 AA）。
 */
export function groupRatioBadgeClass(ratio: number | undefined): string {
  return ratio != null && ratio <= 1
    ? 'bg-success-soft text-success-soft-foreground'
    : 'bg-muted text-muted-foreground'
}
