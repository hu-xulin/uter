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
 * 设计系统 Token 的守卫测试。
 *
 * 文档第十节要求「文档中的字号表由 Token 生成，或通过自动化检查确保
 * 一致」。这份测试就是那个检查：它把 `docs/design-system/design-system.md`
 * 里的九档字号表**硬编码**成期望值，再去解析真实的 CSS 文件。
 *
 * 因此任何一次「顺手把 text-sm 改成 15px」都会让测试变红，而不是等
 * 三个月后有人发现页面字号不一致。
 */

const DS_DIR = join(process.cwd(), 'src', 'design-system')
const read = (rel: string) => readFileSync(join(DS_DIR, rel), 'utf8')

const typographyCss = read('tokens/typography.css')
const semanticCss = read('tokens/semantic.css')

/** 从 CSS 文本里取某个变量的声明值（取第一个匹配）。 */
function readVar(css: string, name: string): string | undefined {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(css)
  if (!match) return undefined
  // 格式化器会按行宽把声明折行（`var(\n  --primitive-radius-md\n)`）。token
  // 的值没变，比较前必须先把空白压平，否则测试会因为一次格式化而变红。
  return match[1]
    .replaceAll(/\s+/g, ' ')
    .replaceAll(/\(\s/g, '(')
    .replaceAll(/\s\)/g, ')')
    .trim()
}

/** px 值换算成 rem（16px 基准），用于比较两种写法。 */
function toPx(value: string): number {
  const rem = /^(-?[\d.]+)rem$/.exec(value)
  if (rem) return Number.parseFloat(rem[1]) * 16
  const px = /^(-?[\d.]+)px$/.exec(value)
  if (px) return Number.parseFloat(px[1])
  const bare = /^(-?[\d.]+)$/.exec(value)
  if (bare) return Number.parseFloat(bare[1])
  return Number.NaN
}

/**
 * 文档 1.2 节的字号表 —— 唯一权威来源。
 * [token, 字号px, 行高px, 语义角色]
 */
const LADDER: Array<[string, number, number, string]> = [
  ['xs', 12, 16, 'caption'],
  ['sm', 14, 20, 'body-sm / label'],
  ['mono', 14, 20, 'mono 正文等宽文本'],
  ['mono-code', 13, 20, '等宽代码展示区'],
  ['mono-title', 16, 22, '等宽卡片标题'],
  ['base', 16, 24, 'body'],
  ['lg', 18, 28, 'h3 卡片标题 / 弹窗标题'],
  ['2xl', 24, 32, 'h2 区块标题'],
  ['3xl', 30, 36, 'h1 页面标题'],
  ['4xl', 36, 40, 'display'],
]

describe('字号阶梯（tokens/typography.css）', () => {
  it.each(LADDER)('--text-%s 为 %dpx / %dpx（%s）', (token, size, line) => {
    const sizeValue = readVar(typographyCss, `text-${token}`)
    const lineValue = readVar(typographyCss, `text-${token}--line-height`)

    expect(sizeValue, `--text-${token} 未声明`).toBeDefined()
    expect(lineValue, `--text-${token}--line-height 未声明`).toBeDefined()

    expect(toPx(sizeValue as string)).toBe(size)
    expect(toPx(lineValue as string)).toBe(line)
  })

  it('字号阶梯声明在 @theme 而不是 :root', () => {
    // Tailwind v4 只从 @theme 读主题值；写在 :root 会让 text-* 工具类
    // 静默退回内置默认值 —— 这正是历史上「改了刻度不生效」的原因。
    const themeBlocks = typographyCss.match(/@theme\s*\{[\s\S]*?\n\}/g) ?? []
    expect(themeBlocks.length).toBeGreaterThan(0)

    const insideTheme = themeBlocks.join('\n')
    expect(insideTheme).toContain('--text-sm:')

    // :root 里不允许再出现字号声明
    const rootBlocks = typographyCss.match(/:root\s*\{[\s\S]*?\n\}/g) ?? []
    for (const block of rootBlocks) {
      expect(block).not.toMatch(/--text-[a-z0-9]+:/)
    }
  })

  it('字重阶梯只有 400 / 500 / 600 / 700', () => {
    expect(toPx(readVar(typographyCss, 'font-weight-normal') as string)).toBe(
      400
    )
    expect(toPx(readVar(typographyCss, 'font-weight-medium') as string)).toBe(
      500
    )
    expect(toPx(readVar(typographyCss, 'font-weight-semibold') as string)).toBe(
      600
    )
    expect(toPx(readVar(typographyCss, 'font-weight-bold') as string)).toBe(700)
  })
})

describe('语义 Token 指向正确的阶梯档位', () => {
  const MAPPING: Array<[string, string]> = [
    ['ds-text-display', 'var(--text-4xl)'],
    ['ds-text-page-title', 'var(--text-3xl)'],
    ['ds-text-section-title', 'var(--text-2xl)'],
    ['ds-text-card-title', 'var(--text-lg)'],
    ['ds-text-dialog-title', 'var(--text-lg)'],
    ['ds-text-group-title', 'var(--text-base)'],
    ['ds-text-body', 'var(--text-sm)'],
    ['ds-text-long', 'var(--text-long)'],
    ['ds-text-body-sm', 'var(--text-sm)'],
    ['ds-text-label', 'var(--text-sm)'],
    ['ds-text-caption', 'var(--text-xs)'],
    ['ds-text-mono', 'var(--text-mono)'],
    ['ds-text-mono-code', 'var(--text-mono-code)'],
    ['ds-text-mono-title', 'var(--text-mono-title)'],
  ]

  it.each(MAPPING)('--%s → %s', (name, expected) => {
    expect(readVar(semanticCss, name)).toBe(expected)
  })

  it('多行主标题行高是无单位比例（E7）', () => {
    // 必须是纯数字：写成 rem 就丢了「随响应式字号缩放」的语义。
    expect(readVar(semanticCss, 'ds-line-display-multiline')).toBe('1.5')
  })

  it('多行主标题行高在 layers 之外，且引用语义 Token', () => {
    const foundations = read('foundations/typography.css')
    const rule = /\.ds-heading--display-multiline\s*\{([^}]*)\}/.exec(
      foundations
    )
    expect(rule, '缺少 .ds-heading--display-multiline').toBeTruthy()
    expect(rule?.[1]).toContain('var(--ds-line-display-multiline)')
    // 必须落在 @layer components 之外，否则会被 utilities 层的
    // text-3xl / text-4xl 自带的 line-height 覆盖。
    expect(foundations.indexOf('@layer components')).toBeLessThan(
      foundations.indexOf('.ds-heading--display-multiline')
    )
  })

  it('多行主标题行高是无单位比例（E7）', () => {
    // 必须是纯数字：写成 rem 就丢了「随响应式字号缩放」的语义。
    expect(readVar(semanticCss, 'ds-line-display-multiline')).toBe('1.5')
  })

  it('多行主标题行高在 layers 之外，且引用语义 Token', () => {
    const foundations = read('foundations/typography.css')
    const rule = /\.ds-heading--display-multiline\s*\{([^}]*)\}/.exec(
      foundations
    )
    expect(rule, '缺少 .ds-heading--display-multiline').toBeTruthy()
    expect(rule?.[1]).toContain('var(--ds-line-display-multiline)')
    // 必须落在 @layer components 之外，否则会被 utilities 层的
    // text-3xl / text-4xl 自带的 line-height 覆盖。
    expect(foundations.indexOf('@layer components')).toBeLessThan(
      foundations.indexOf('.ds-heading--display-multiline')
    )
  })

  it('语义行高的兜底值与阶梯行高一致', () => {
    // 兜底值是 `var(--text-x--line-height, <fallback>)` 里的 fallback，
    // 一旦和 typography.css 对不上，说明有人只改了一边。
    const pairs: Array<[string, string, number]> = [
      ['ds-line-display', 'text-4xl--line-height', 40],
      ['ds-line-page-title', 'text-3xl--line-height', 36],
      ['ds-line-section-title', 'text-2xl--line-height', 32],
      ['ds-line-card-title', 'text-lg--line-height', 28],
      ['ds-line-group-title', 'text-base--line-height', 24],
      ['ds-line-body', 'text-sm--line-height', 20],
      ['ds-line-long', 'text-long--line-height', 26],
      ['ds-line-body-sm', 'text-sm--line-height', 20],
      ['ds-line-caption', 'text-xs--line-height', 16],
    ]

    for (const [semanticName, ladderName, expectedPx] of pairs) {
      const value = readVar(semanticCss, semanticName) as string
      const fallback = /,\s*([^)]+)\)/.exec(value)?.[1].trim()
      expect(fallback, `--${semanticName} 缺少兜底值`).toBeDefined()
      expect(toPx(fallback as string), `--${semanticName} 兜底值`).toBe(
        expectedPx
      )
      // 阶梯侧也必须是同一个值
      expect(toPx(readVar(typographyCss, ladderName) as string)).toBe(
        expectedPx
      )
    }
  })
})

describe('分组标题档（group-title）', () => {
  it('是 16/24/600，且比卡片标题低一档', () => {
    // 页面层级第 4 层：30 页标题 → 24 区块 → 18 卡片 → 16 分组 → 14 标签。
    // 一旦有人把分组标题调到 14（与 label 同号）或 18（与卡片标题撞车），
    // 这一层的语义就消失了。
    const rule = /\.ds-heading--group-title\s*\{([^}]*)\}/.exec(
      read('foundations/typography.css')
    )
    expect(rule, '缺少 .ds-heading--group-title').toBeTruthy()
    expect(rule?.[1]).toContain('var(--ds-text-group-title)')
    expect(rule?.[1]).toContain('var(--ds-line-group-title)')
    expect(rule?.[1]).toContain('var(--ds-weight-semibold)')

    expect(readVar(semanticCss, 'ds-text-group-title')).toBe('var(--text-base)')
    expect(readVar(semanticCss, 'ds-text-card-title')).toBe('var(--text-lg)')
  })
})

describe('圆角 Token 对应文档 1.3 Shape', () => {
  it('六个圆角档位与文档一致', () => {
    const SHAPE: Array<[string, number]> = [
      ['xs', 4],
      ['sm', 6],
      ['md', 8],
      ['lg', 10],
      ['xl', 12],
      ['2xl', 16],
    ]
    for (const [step, px] of SHAPE) {
      const value = readVar(semanticCss, `ds-radius-${step}`) as string
      const primitive = /var\(--primitive-radius-[a-z0-9]+\)/.test(value)
        ? readVar(read('tokens/primitives.css'), `primitive-radius-${step}`)
        : value
      expect(toPx(primitive as string), `圆角 ${step}`).toBe(px)
    }
  })
})

describe('theme.css 圆角阶梯与文档一致', () => {
  /** 把 `var(--radius)` 或 `calc(var(--radius) * N)` 按基准值解析成 px。 */
  function resolveLadderPx(declaration: string, base: number): number {
    const scaled = /^calc\(var\(--radius\)\s*\*\s*([\d.]+)\)$/.exec(declaration)
    if (scaled) return base * Number.parseFloat(scaled[1])
    if (declaration === 'var(--radius)') return base
    return Number.NaN
  }

  it('默认基准 8px 推出 4/6/8/10/12/16/20/24 八档', () => {
    // theme.css 的 `--radius-*` 阶梯是 Tailwind `rounded-*` 工具类的真实
    // 来源（@theme inline 内联 + :root 运行时变量双出口）。它与
    // primitives.css 是同一套刻度的两种声明，改一边忘了另一边就会
    // 出现「文档 8px、页面 6px」，这里把差异钉死。
    const themeCss = readFileSync(
      join(process.cwd(), 'src', 'styles', 'theme.css'),
      'utf8'
    )
    const base = toPx(readVar(themeCss, 'radius') as string)
    expect(base, '默认基准 --radius').toBe(8)

    const EXPECTED: Array<[string, number]> = [
      ['xs', 4],
      ['sm', 6],
      ['md', 8],
      ['lg', 10],
      ['xl', 12],
      ['2xl', 16],
      ['3xl', 20],
      ['4xl', 24],
    ]
    for (const [step, px] of EXPECTED) {
      const declaration = readVar(themeCss, `radius-${step}`) as string
      expect(declaration, `--radius-${step} 未声明`).toBeDefined()
      expect(resolveLadderPx(declaration, base), `圆角 ${step}`).toBe(px)
    }
  })
})
