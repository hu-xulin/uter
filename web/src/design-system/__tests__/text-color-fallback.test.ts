/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * `.ds-text--*` 颜色规则的兜底值守卫。
 *
 * 背景：`--ds-color-text-primary` / `--ds-color-text-secondary` 在
 * `tokens/colors.css` 里声明，但**生产构建的压缩阶段会把它们丢掉**
 * （实测两次构建，产物里这两个声明不存在，其余 `--ds-*` 都在）。变量缺失时
 * `color: var(--ds-color-text-secondary)` 是无效声明，元素退回 `inherit`，
 * 于是所有次要文字（卡片说明、占位符）渲染成正文黑 —— 和主标题同色，
 * 层级直接塌掉。
 *
 * 所以 `foundations/typography.css` 的颜色规则一律带兜底值。这条测试就是
 * 防止有人「顺手简化」成 `var(--ds-color-text-secondary)`，把线上再次变成
 * 全站次要文字变黑。
 */
const FOUNDATIONS = join(
  process.cwd(),
  'src',
  'design-system',
  'foundations',
  'typography.css'
)

const css = readFileSync(FOUNDATIONS, 'utf8')

/** 取出所有 `color: var(--ds-color-…)` 声明（含兜底与否）。 */
const colorDeclarations = [
  ...css.matchAll(/color:\s*var\((--ds-color-[\w-]+)([^;]*)\);/g),
]

describe('ds-text 颜色规则的兜底值', () => {
  it('至少能扫描到颜色规则', () => {
    expect(colorDeclarations.length).toBeGreaterThanOrEqual(4)
  })

  it('每条 color 声明都带兜底值', () => {
    const withoutFallback = colorDeclarations
      .filter((match) => !match[2].includes(','))
      .map((match) => match[1])

    expect(withoutFallback).toEqual([])
  })

  it('次要文字兜底到 muted-foreground，主文字兜底到 foreground', () => {
    expect(css).toContain(
      'color: var(--ds-color-text-secondary, var(--muted-foreground))'
    )
    expect(css).toContain(
      'color: var(--ds-color-text-primary, var(--foreground))'
    )
  })
})
