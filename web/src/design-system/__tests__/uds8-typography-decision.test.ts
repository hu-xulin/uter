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
 * UDS 8.0.0 字号校对决定锁定（用户确认于 2026-11-24）。
 *
 * 决定来源：`docs/design-system/audit/UDS8-TYPOGRAPHY-AUDIT.html` 的 10 项校对决定。
 * 其中 6 处 15px（text-md）元素要求提升到 16px：
 *   - 决定 #5 / #10：/docs「Model Testing」、/about「Who We Are」等 page-nav 标题
 *   - 决定 #6-#9：/about 连续正文段落
 *
 * 这两类正文/标题分别落在 `text-long`（body-long 16/26）与 `text-base`（16/24）。
 * 两者字号同为 16px；正文段用 body-long 是 typography.css 的明确语义，
 * 不应回退到 15px 的 `text-md` 派生档。本测试守卫该决定不被后续改动回退。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const typography = readFileSync(
  join(ROOT, 'src/design-system/tokens/typography.css'),
  'utf8'
)
const pageNav = readFileSync(
  join(ROOT, 'src/features/docs/native/page-nav.tsx'),
  'utf8'
)
const aboutViewer = readFileSync(
  join(ROOT, 'src/features/about/about-viewer.tsx'),
  'utf8'
)
const proseClasses = readFileSync(
  join(ROOT, 'src/features/docs/native/prose-classes.ts'),
  'utf8'
)
const markdown = readFileSync(
  join(ROOT, 'src/components/ui/markdown.tsx'),
  'utf8'
)

function tokenValue(name: string): string | undefined {
  return new RegExp(`--text-${name}:\\s*([^;]+);`).exec(typography)?.[1]?.trim()
}

describe('UDS 8.0.0 字号校对决定锁定（6 处 15px → 16px）', () => {
  it('token 真源：base / long = 16px，md = 15px（被本决定弃用的派生档）', () => {
    // 1rem = 16px（root font-size 16px）
    expect(tokenValue('base')).toBe('1rem')
    expect(tokenValue('long')).toBe('1rem')
    expect(tokenValue('md')).toBe('0.9375rem')
  })

  it('决定 #5 / #10：docs 与 about 的 page-nav 标题用 text-base（16px），不回退 text-md', () => {
    expect(pageNav).toMatch(
      /className='text-fg-primary truncate text-base font-medium'/
    )
    expect(pageNav).not.toMatch(/text-md/)
  })

  it('决定 #6-#9：about 正文段落用 body-long 档 text-long（16px），不回退 text-md', () => {
    // 正文段落（含 4 段被校对的元素）走 text-long —— body-long 16px/26px
    expect(aboutViewer).toMatch(/className='text-long text-fg-secondary/)
    expect(aboutViewer).not.toMatch(/text-md/)
  })

  it('校对涉及的渲染文件整体不含 15px 派生档 text-md', () => {
    for (const [name, src] of [
      ['page-nav.tsx', pageNav],
      ['about-viewer.tsx', aboutViewer],
    ] as const) {
      expect(src, `${name} 不得含 text-md 15px`).not.toMatch(/\btext-md\b/)
    }
  })
})

/**
 * 连续阅读正文统一走 body-long：16/26。text-base 保持 16/24，只能用于
 * 行标题 / 设置字段 / 指标数值；正文段和列表项不得借它压行高。
 */
describe('连续正文只用 body-long（text-long 16/26）', () => {
  it('token 真源：long 行高 26px 大于 base 的 24px', () => {
    expect(tokenValue('long')).toBe('1rem')
    expect(tokenValue('base')).toBe('1rem')
    expect(typography).toMatch(/--text-long--line-height:\s*1\.625rem/)
    expect(typography).toMatch(/--text-base--line-height:\s*1\.5rem/)
  })

  it('原生文档与 Markdown 正文、列表项锁定 text-long，不回退 text-base', () => {
    for (const [name, src] of [
      ['prose-classes.ts', proseClasses],
      ['markdown.tsx', markdown],
    ] as const) {
      expect(src, `${name} 的正文容器必须是 text-long`).toMatch(
        /text-long text-fg-secondary|max-w-\[72ch\] text-long/
      )
      expect(src, `${name} 的 <p> 必须是 text-long`).toMatch(
        /\[&_p\]:text-long/
      )
      expect(src, `${name} 的 <li> 必须是 text-long`).toMatch(
        /\[&_li\]:text-long/
      )
      expect(src, `${name} 不得把 <p>/<li> 压回 text-base`).not.toMatch(
        /\[&_(?:p|li)\]:text-base/
      )
    }
  })
})
