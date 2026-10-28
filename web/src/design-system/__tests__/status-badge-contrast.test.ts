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
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * 守卫：状态角标与「品牌浅底文字」的对比度（规范 §1.1 / §1.1.2 / §2.3）。
 *
 * 两类曾经踩过的坑，都是**看起来只是配色偏好、实际是不达 AA**：
 *
 * 1. 折扣角标用 `bg-success/80` + 白字。`#16A34A` 80% 压在白底上合成
 *    `#45B56E`，白字对比度只有 **2.6:1**；溢价角标 `text-warning` 落在
 *    `warning/15` 上是 **2.7:1**。12px 文字要求 4.5:1，差了近一倍。
 *    现在两种状态都走实心 + 白字：
 *      · 折扣（倍率 < 1）`bg-success-hover`（#15803D）+ `text-on-emphasis`
 *        = **5.02:1**，达 AA；
 *      · 溢价（倍率 ≥ 1）`bg-destructive-hover`（#EF4444）+ `text-on-emphasis`
 *        = **3.76:1**，仍低于 AA，登记在 exceptions E24。
 *    绿色不能用 `--success`（#16A34A）：配白字只有 3.30:1。
 *
 * 2. 胶囊徽标沿用导航的 `bg-primary-subtle text-primary`。`#5B5EE6` on
 *    `#F0F0FF` = 4.44:1，规范 §2.3 明确要求「不能默认继承导航例外」。
 *    导航有专用 Token，非导航场景此前没有可用的可读档，于是补了
 *    `--primary-subtle-foreground`（#5558D8 / #8B8DF5，4.93:1 / 4.97:1）。
 */
const ROOT = join(process.cwd(), 'src')
const THEME = readFileSync(join(ROOT, 'styles/theme.css'), 'utf8')
const PRICING_COMPONENTS = join(ROOT, 'features/pricing/components')
/**
 * 配色规则已收敛到共享组件 `ui/discount-badge.tsx`（定价页 `DiscountTag` 与
 * 钱包充值档位角标共用）。守卫因此改为读这个文件 —— 读 `discount-tag.tsx`
 * 会退化成「断言一个已经不负责配色的调用点」，配色改错了也测不出来。
 */
const DISCOUNT_BADGE = readFileSync(
  join(ROOT, 'components/ui/discount-badge.tsx'),
  'utf8'
)
const DISCOUNT_TAG = readFileSync(
  join(PRICING_COMPONENTS, 'discount-tag.tsx'),
  'utf8'
)
/** 定价页所有组件拼在一起，用来断言「整块界面里没有 alpha 绿底白字」。 */
const PRICING_SOURCES = readdirSync(PRICING_COMPONENTS)
  .filter((name) => name.endsWith('.tsx'))
  .map((name) => readFileSync(join(PRICING_COMPONENTS, name), 'utf8'))
  .join('\n')

describe('status badge contrast', () => {
  it('never paints status badges with an alpha fill plus white text', () => {
    // 白字压在半透明状态色上是 2.6:1 —— 这是被规范否掉的写法。
    expect(PRICING_SOURCES).not.toContain('bg-success/80')
  })

  it('uses solid green for discounts and solid red for markups', () => {
    // 折扣：`--hover-success`（#15803D）+ 白字 = 5.02:1，达 AA。
    expect(DISCOUNT_BADGE).toContain('bg-success-hover text-on-emphasis')
    // 溢价：`--hover-destructive`（#EF4444）+ 白字 = 3.76:1（E24）。
    expect(DISCOUNT_BADGE).toContain('bg-destructive-hover text-on-emphasis')
    // `bg-success`（#16A34A）配白字只有 3.30:1，不够。
    expect(DISCOUNT_BADGE).not.toContain('bg-success text-on-emphasis')
  })

  /**
   * 调用点不得自己再写一套配色：两处角标各写一遍，就是下一次「改了一处、
   * 另一处还是旧色」的来源。定价页组件里出现这两个类名即说明有人绕开了
   * `DiscountBadge`。
   */
  it('keeps the color rule inside the shared badge', () => {
    expect(DISCOUNT_TAG).not.toContain('bg-success-hover')
    expect(DISCOUNT_TAG).not.toContain('bg-destructive-hover')
    expect(PRICING_SOURCES).not.toContain('bg-success-hover')
  })

  it('spells the hover tokens the way Tailwind actually generates them', () => {
    // Token 键是 `--color-success-hover` / `--color-destructive-hover`，
    // 所以工具类只能是 `bg-success-hover` / `bg-destructive-hover`。
    // 写成 `bg-hover-success` 时 Tailwind **静默不生成**任何 CSS —— 角标会变成
    // 透明底、白字直接压在白卡片上，构建和类型检查都发现不了。
    expect(DISCOUNT_BADGE).not.toContain('bg-hover-success')
    expect(DISCOUNT_BADGE).not.toContain('bg-hover-destructive')
    expect(THEME).toContain('--color-success-hover: var(--hover-success')
    expect(THEME).toContain(
      '--color-destructive-hover: var(--hover-destructive'
    )
  })
})

describe('brand-subtle foreground', () => {
  it('defines a readable foreground for primary-subtle surfaces in both themes', () => {
    expect(THEME).toContain('--primary-subtle-foreground: #5558d8')
    expect(THEME).toContain('--primary-subtle-foreground: #8b8df5')
  })

  it('maps it to a Tailwind semantic color', () => {
    // 不映射就是空类名：`text-primary-subtle-foreground` 会静默失效。
    expect(THEME).toContain(
      '--color-primary-subtle-foreground: var(--primary-subtle-foreground)'
    )
  })
})
