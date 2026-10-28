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
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * 守卫：导航选中态（规范 §2.3，2026-10-28 latest）。
 *
 * 规则演进过两次，这里记录清楚，避免下一个人再绕回去：
 *
 * 1. 最初用 `text-sidebar-accent-foreground`（近黑 `#0F172A`）—— 选中行只剩
 *    一层浅底，文字与图标退回普通前景色，和右侧内容区的强调色脱节。
 * 2. 后来改成 `text-primary`（品牌色 `#5B5EE6`）—— 但落在选中浅底
 *    `#F0F0FF` 上只有 **4.44:1**，差 0.06 未达 WCAG AA 普通文本 4.5:1
 *    （导航文字 14px/500 不属大文本豁免）。
 * 3. 现行规范改为**专用 Token** `sidebar-active-foreground`
 *    （浅色 `#5558D8` = 4.93:1，深色 `#8B8DF5` = 4.97:1）。它只与
 *    `primary-subtle` 浅底配对，**不修改全局品牌主色** —— 主按钮、链接、
 *    焦点环仍然是 `#5B5EE6`。
 *
 * 因此这里断言三件事：选中行用专用 Token、不用 `primary` / 旧 accent 前景色、
 * 且未选中行不被无条件染色。
 */
const SIDEBAR = join(process.cwd(), 'src/components/ui/sidebar.tsx')
const NAV_GROUP = join(
  process.cwd(),
  'src/components/layout/components/nav-group.tsx'
)
const THEME = join(process.cwd(), 'src/styles/theme.css')

const sidebar = readFileSync(SIDEBAR, 'utf8')
const navGroup = readFileSync(NAV_GROUP, 'utf8')
const theme = readFileSync(THEME, 'utf8')

describe('sidebar active state', () => {
  it('colours the selected row with the dedicated sidebar-active-foreground token', () => {
    // 一级行（SidebarMenuButton）与子项行（SidebarMenuSubButton）都要带上。
    const occurrences =
      sidebar.match(/data-active:text-sidebar-active-foreground/g) ?? []
    expect(occurrences.length).toBeGreaterThanOrEqual(2)

    // 子项行还要盖掉子元素自带颜色，图标才会跟着变。
    expect(sidebar).toContain(
      'data-active:[&>svg]:text-sidebar-active-foreground'
    )
  })

  it('never falls back to text-primary or the near-black accent foreground', () => {
    // 这两个都是被规范明确否掉的写法：前者 4.44:1 不达 AA，后者脱离品牌色。
    expect(sidebar).not.toContain('data-active:text-primary')
    expect(sidebar).not.toContain('data-active:text-sidebar-accent-foreground')
    expect(sidebar).not.toContain('active:text-primary')
    expect(navGroup).not.toContain("'bg-primary-subtle text-primary'")
  })

  it('keeps the brand-subtle fill under the selected row', () => {
    expect(sidebar).toContain('data-active:bg-primary-subtle')
    // 悬停选中行不能把底色冲掉，也不能把文字退回普通前景色。
    expect(sidebar).toContain('data-active:hover:bg-primary-subtle')
    expect(sidebar).toContain(
      'data-active:hover:text-sidebar-active-foreground'
    )
  })

  it('never forces the brand colour on an unselected icon', () => {
    // 无条件 `[&>svg]:text-*` 会让未选中行也变色 —— 只有
    // `data-active:[&>svg]:text-*` 这种带状态前缀的写法才合法。
    expect(sidebar).not.toMatch(
      /(?<!data-active:)\[&>svg\]:text-sidebar-active-foreground/
    )
    expect(sidebar).not.toMatch(/(?<!data-active:)\[&>svg\]:text-primary/)
  })

  it('matches the rule in the collapsed-sidebar dropdown', () => {
    expect(navGroup).toContain(
      "'bg-primary-subtle text-sidebar-active-foreground'"
    )
  })

  it('defines the dedicated token in both themes', () => {
    // 规范 §2.3 给定的两个值；改任一值都要重算对比度（4.93:1 / 4.97:1）。
    expect(theme).toContain('--sidebar-active-foreground: #5558d8')
    expect(theme).toContain('--sidebar-active-foreground: #8b8df5')
    // 必须映射成 Tailwind 语义色，否则 `text-sidebar-active-foreground` 是空类名。
    expect(theme).toContain(
      '--color-sidebar-active-foreground: var(--sidebar-active-foreground)'
    )
  })

  it('keeps the global brand primary untouched', () => {
    // 专用 Token 解决的是「浅底上的文本对比度」，不是改品牌主色。
    // 若有人为了达线直接调 --primary，这条会失败 —— 那是品牌决策，要走评审。
    expect(theme).toMatch(/--primary:\s*#5b5ee6/i)
  })
})
