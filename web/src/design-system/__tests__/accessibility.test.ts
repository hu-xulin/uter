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
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * 无障碍基座的守卫测试（`foundations/accessibility.css`）。
 *
 * 这一层以前是「注释里的承诺，实现里没有」：
 *   · 注释写「统一 2px 外扩环，不允许组件用 outline:none 抹掉」，而 19 个
 *     基础组件正是 `outline-none` + `focus-visible:ring-2`，两种几何并存，
 *     Tab 时焦点环会在「外扩 2px」和「贴边」之间跳；
 *   · 注释写「触控目标不小于 24×24」，而 `.ds-touch-target` 零调用，
 *     真正 16px 的图标按钮一个都没被它兜住。
 *
 * 所以这里锁四件事：
 *   1. 焦点环 Token 只有一个来源（曾同时存在两个名字，其中一个零引用）；
 *   2. 原生元素的焦点几何与组件一致（`outline-offset: 0`）；
 *   3. `.ds-touch-target` 扩的是命中区、不是盒子（不撑布局）；
 *   4. `.ds-touch-target` 必须真的被调用 —— 否则又变回死代码。
 */

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, 'src', rel), 'utf8')

const accessibilityCss = read('design-system/foundations/accessibility.css')
const colorsCss = read('design-system/tokens/colors.css')
const semanticCss = read('design-system/tokens/semantic.css')

/** 递归收集 `src/` 下所有 .tsx / .ts 源码。 */
function sourceFiles(dir = join(ROOT, 'src')): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full))
    } else if (/\.tsx?$/.test(entry) && !full.includes('__tests__')) {
      out.push(full)
    }
  }
  return out
}

describe('焦点指示器', () => {
  it('焦点环 Token 只有一个来源', () => {
    // `--ds-color-focus-ring`（colors.css）与 `--ds-focus-ring-color`
    // （semantic.css）曾是同一个值的两个名字，前者零引用。
    expect(colorsCss).not.toContain('--ds-color-focus-ring')
    expect(semanticCss).toContain('--ds-focus-ring-width: 2px')
    expect(semanticCss).toContain('--ds-focus-ring-color: var(--ring)')
    expect(accessibilityCss).toContain('var(--ds-focus-ring-color)')
  })

  it('原生元素与组件是同一种几何：贴边 2px 环', () => {
    // 组件层是 `focus-visible:ring-2` = `box-shadow: 0 0 0 2px`，贴在边框外沿
    // 且没有间隙。基础层用 outline 兜底时必须 `outline-offset: 0`；
    // 写成 2px 就会和组件不一致 —— 同一次 Tab 里焦点环会「跳一下」。
    expect(accessibilityCss).toMatch(
      /:where\(a, button, \[role='button'\], \[tabindex\]\):focus-visible\s*\{[^}]*outline-offset: 0/
    )
    expect(accessibilityCss).not.toMatch(/outline-offset: 2px/)
  })

  it('基础组件的焦点写法没有被改掉', () => {
    // 按钮与开关是 2px 环；输入框 / 下拉（以及 textarea）是 1px —— 它们自带
    // 1px 边框，2px 环会叠成双线框（规范 §2.1 Input / Textarea / Select）。
    for (const rel of [
      'components/ui/button.tsx',
      'components/ui/toggle.tsx',
    ]) {
      expect(read(rel), `${rel} 缺少 focus-visible:ring-2`).toContain(
        'focus-visible:ring-2'
      )
    }
    for (const rel of ['components/ui/input.tsx', 'components/ui/select.tsx']) {
      expect(read(rel), `${rel} 缺少 focus-visible:ring-1`).toContain(
        'focus-visible:ring-1'
      )
    }
  })
})

describe('触控目标', () => {
  it('扩的是命中区而不是盒子（不撑布局）', () => {
    // 密集容器里视觉尺寸只能是 16–20px，给 min-width 会把行高撑起来。
    // 所以用居中伪元素把可点击区域扩到 24px。
    expect(accessibilityCss).toMatch(
      /\.ds-touch-target\s*\{[^}]*position: relative/
    )
    expect(accessibilityCss).toMatch(
      /\.ds-touch-target::after\s*\{[^}]*1\.5rem/
    )
    expect(accessibilityCss).not.toMatch(
      /\.ds-touch-target\s*\{[^}]*min-(width|height): 1\.5rem/
    )
  })

  it('至少有一处调用（防止再变成死代码）', () => {
    const callers = sourceFiles().filter((f) =>
      readFileSync(f, 'utf8').includes('ds-touch-target')
    )
    expect(
      callers.length,
      '`.ds-touch-target` 定义了却没人用 —— 要么接上真实调用点，要么删掉'
    ).toBeGreaterThan(0)
  })
})
