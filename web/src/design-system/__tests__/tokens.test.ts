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
 * 设计系统 Token 的守卫测试。
 *
 * 要求「文档中的字号表由 Token 生成，或通过自动化检查确保一致」。这份
 * 测试就是那个检查：它把 04-TYPOGRAPHY-STANDARD.md §Token 表与
 * TOKEN-MANIFEST.json（UDS 8.0.0 唯一真源）**硬编码**成期望值，再去解析真实的
 * CSS 文件（运行真源是 `tokens/typography.css`）。
 *
 * 因此任何一次「顺手把 text-sm 改成 15px」都会让测试变红，而不是等
 * 三个月后有人发现页面字号不一致。
 *
 * 7.0 阶梯是 **10 个主档（2xs..5xl）+ 派生档**。2026-11-16 经用户授权
 * 从 v1.2 刻度正式切换到 7.0 值。
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
 * UDS 8.0.0 §Token 主档 + 派生档（与 TOKEN-MANIFEST.json font-size/line-height 同值）。
 * [token, 字号px, 行高px, 语义角色]
 */
const LADDER: Array<[string, number, number, string]> = [
  ['2xs', 12, 18, '最小可见文字（全站下限，7.0 2xs）'],
  ['xs', 13, 20, '密集表格 / 代码 / 标签（7.0 xs）'],
  ['sm', 14, 22, '默认正文 / label'],
  ['md', 15, 24, '次级正文（3.0 派生档保留，7.0 未定义）'],
  ['mono-xs', 12, 18, 'mono-xs：小型 ID、标签（= 7.0 2xs 同值）'],
  ['mono', 13, 20, 'mono 正文等宽文本'],
  ['mono-base', 14, 22, 'mono-base：代码、技术信息'],
  ['mono-code', 13, 20, '等宽代码展示区'],
  ['mono-title', 16, 22, '等宽卡片标题'],
  ['dense', 13, 20, '密集数据：表格单元格 / 二级导航 / 分页（专用派生档）'],
  ['group', 16, 24, 'group-title 分组标题（专用派生档）'],
  ['base', 16, 24, '行标题 / 设置字段 / 指标数值'],
  ['lg', 18, 26, 'h3 卡片标题 / 弹窗标题'],
  ['xl', 20, 26, '次级标题（7.0 xl）'],
  ['2xl', 24, 32, '区块标题（7.0 2xl）'],
  ['3xl', 30, 38, '分区标题（7.0 3xl，行高 = 7.0 h2）'],
  ['4xl', 36, 44, '页面主标题（7.0 4xl，行高 = 7.0 h1）'],
  ['5xl', 48, 56, 'Hero / 展示大标题（7.0 5xl，行高 = 7.0 display）'],
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
    ['ds-text-display', 'var(--text-5xl)'],
    ['ds-text-page-title', 'var(--text-4xl)'],
    ['ds-text-section-title', 'var(--text-3xl)'],
    ['ds-text-card-title', 'var(--text-lg)'],
    ['ds-text-dialog-title', 'var(--text-lg)'],
    ['ds-text-group-title', 'var(--text-group)'],
    ['ds-text-body', 'var(--text-sm)'],
    ['ds-text-long', 'var(--text-long)'],
    ['ds-text-body-sm', 'var(--text-sm)'],
    ['ds-text-label', 'var(--text-sm)'],
    ['ds-text-caption', 'var(--text-xs)'],
    ['ds-text-dense', 'var(--text-dense)'],
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

  it('语义行高的兜底值与阶梯行高一致', () => {
    // 兜底值是 `var(--text-x--line-height, <fallback>)` 里的 fallback，
    // 一旦和 typography.css 对不上，说明有人只改了一边。
    const pairs: Array<[string, string, number]> = [
      ['ds-line-display', 'text-5xl--line-height', 56],
      ['ds-line-page-title', 'text-4xl--line-height', 44],
      ['ds-line-section-title', 'text-3xl--line-height', 38],
      ['ds-line-card-title', 'text-lg--line-height', 26],
      ['ds-line-group-title', 'text-group--line-height', 24],
      ['ds-line-body', 'text-sm--line-height', 22],
      ['ds-line-long', 'text-long--line-height', 26],
      ['ds-line-body-sm', 'text-sm--line-height', 22],
      ['ds-line-dense', 'text-dense--line-height', 20],
      ['ds-line-caption', 'text-xs--line-height', 20],
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
    // 页面层级第 4 层：30 页面标题 → 24 区块 → 20 小区块 → 18 卡片 →
    // 16 分组 → 14 标签。一旦有人把分组标题调到 14（与 label 同号）或
    // 18（与卡片标题撞车），这一层的语义就消失了。
    const rule = /\.ds-heading--group-title\s*\{([^}]*)\}/.exec(
      read('foundations/typography.css')
    )
    expect(rule, '缺少 .ds-heading--group-title').toBeTruthy()
    expect(rule?.[1]).toContain('var(--ds-text-group-title)')
    expect(rule?.[1]).toContain('var(--ds-line-group-title)')
    expect(rule?.[1]).toContain('var(--ds-weight-semibold)')

    expect(readVar(semanticCss, 'ds-text-group-title')).toBe(
      'var(--text-group)'
    )
    expect(readVar(semanticCss, 'ds-text-card-title')).toBe('var(--text-lg)')
  })
})

describe('圆角 Token 对应 UDS 8.0 §Shape 刻度', () => {
  it('圆角档位与九档刻度一致（xs 为兼容别名）', () => {
    const SHAPE: Array<[string, number]> = [
      ['xs', 4],
      ['sm', 4],
      ['md', 6],
      ['lg', 8],
      ['xl', 10],
      ['2xl', 12],
      ['3xl', 16],
      ['4xl', 20],
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
  /** 把 `var(--radius)` 或 `calc(var(--radius) * A / B)` 按基准值解析成 px。 */
  function resolveLadderPx(declaration: string, base: number): number {
    const scaled =
      /^calc\(var\(--radius\)\s*\*\s*([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/.exec(
        declaration
      )
    if (scaled) {
      const factor = Number.parseFloat(scaled[1])
      const divisor = scaled[2] ? Number.parseFloat(scaled[2]) : 1
      return (base * factor) / divisor
    }
    if (declaration === 'var(--radius)') return base
    return Number.NaN
  }

  it('默认基准 0.375rem(6px) 推出 4/4/6/8/10/12/16/20（xs 为兼容别名）', () => {
    // theme.css 的 `--radius-*` 阶梯是 Tailwind `rounded-*` 工具类的真实
    // 来源（@theme inline 内联 + :root 运行时变量双出口）。它与
    // primitives.css 是同一套刻度的两种声明，改一边忘了另一边就会
    // 出现「文档 12px、页面 10px」，这里把差异钉死。
    // UDS 8.0 §Shape / TOKEN-MANIFEST radius.scale：基准 6px（= md），
    // 刻度 sm=4 / md=6 / lg=8 / xl=10 / 2xl=12 / 3xl=16 / 4xl=20；
    // xs 只作为 历史别名（= sm 4px）。
    // `rounded-full` 是特殊档，由 Tailwind 内建提供，不在 theme.css 重复声明。
    const themeCss = readFileSync(
      join(process.cwd(), 'src', 'styles', 'theme.css'),
      'utf8'
    )
    const base = toPx(readVar(themeCss, 'radius') as string)
    expect(base, '默认基准 --radius').toBe(6)

    const EXPECTED: Array<[string, number]> = [
      ['xs', 4],
      ['sm', 4],
      ['md', 6],
      ['lg', 8],
      ['xl', 10],
      ['2xl', 12],
      ['3xl', 16],
      ['4xl', 20],
    ]
    for (const [step, px] of EXPECTED) {
      const declaration = readVar(themeCss, `radius-${step}`) as string
      expect(declaration, `--radius-${step} 未声明`).toBeDefined()
      expect(resolveLadderPx(declaration, base), `圆角 ${step}`).toBe(px)
    }
  })
})

describe('showcase 核查页与 Token 真源一致', () => {
  // UDS 8.0.0 §18.1 / §28「数据链」：核查页（showcase.html）的页内内联快照与
  // showcase.tokens.js 兼容回退，都是 §28 TOKEN-MANIFEST 的派生产物。
  // 原测试直接比对「核查页 HTML 里的 --radius-* / .rounded-* 声明」，但
  // showcase.html 遵守 §28.3 禁止在页内重复 :root Token，因此无法再依赖
  // HTML。这里改用「CSS 真源之间的圆角阶梯一致性」断言，与
  // `web/scripts/sync-design-showcase.mjs --check` 的 M.radius.scale 同义，
  // 且不依赖 HTML，更耐久。
  const THEME_CSS_PATH = join(process.cwd(), 'src', 'styles', 'theme.css')
  const LADDER_STEPS = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const

  /** theme.css 的圆角声明解析成 px：`var(--radius)` 基准 × 系数 / 分母。 */
  function themeRadiusPx(themeCss: string, step: string): number {
    // `full` 是 Tailwind 内建的第九档（9999px），theme.css 不重复声明，
    // 这里直接取内建值，与 primitives.css 的 primitive-radius-full 对齐。
    if (step === 'full') return 9999
    const base = toPx(readVar(themeCss, 'radius') as string)
    const declaration = readVar(themeCss, `radius-${step}`) as string
    const scaled =
      /^calc\(var\(--radius\)\s*\*\s*([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/.exec(
        declaration
      )
    if (!scaled) return base
    const divisor = scaled[2] ? Number.parseFloat(scaled[2]) : 1
    return (base * Number.parseFloat(scaled[1])) / divisor
  }

  const themeCss = readFileSync(THEME_CSS_PATH, 'utf8')
  const primitives = read('tokens/primitives.css')

  it.each(LADDER_STEPS)(
    'theme.css --radius-%s 与 primitives.css 一致',
    (step) => {
      expect(themeRadiusPx(themeCss, step)).toBe(
        toPx(readVar(primitives, `primitive-radius-${step}`) as string)
      )
    }
  )

  it('圆角阶梯（含 full 第九档）theme.css 与 primitives.css 一致', () => {
    for (const step of [...LADDER_STEPS, 'full'] as const) {
      expect(themeRadiusPx(themeCss, step)).toBe(
        toPx(readVar(primitives, `primitive-radius-${step}`) as string)
      )
    }
  })

  it('theme.css --radius 基准等于 primitive 基准（md）', () => {
    const themeBase = toPx(readVar(themeCss, 'radius') as string)
    const primitiveBase = toPx(
      readVar(primitives, 'primitive-radius-md') as string
    )
    expect(themeBase, 'theme.css --radius 基准').toBe(primitiveBase)
  })
})

describe('自托管字体覆盖 400/500/600/700', () => {
  const readWeb = (rel: string) =>
    readFileSync(join(process.cwd(), rel), 'utf8')

  it('Inter 与思源黑体（Noto Sans SC，字形同源）均以可变字重打包', () => {
    const indexCss = readWeb('src/styles/index.css')
    expect(indexCss).toContain("@import '@fontsource-variable/inter'")
    expect(indexCss).toContain("@import '@fontsource-variable/noto-sans-sc'")

    const inter = readWeb('node_modules/@fontsource-variable/inter/index.css')
    const cjk = readWeb(
      'node_modules/@fontsource-variable/noto-sans-sc/index.css'
    )
    // 100 900 的可变字重同时覆盖 regular/medium/semibold/bold。
    expect(inter).toMatch(
      /font-family: 'Inter Variable'[\s\S]*?font-weight: 100 900/
    )
    expect(cjk).toMatch(
      /font-family: 'Noto Sans SC Variable'[\s\S]*?font-weight: 100 900/
    )
  })

  it('字体文件随构建产物本地加载，不引用 CDN', () => {
    const interFiles = readdirSync(
      join(process.cwd(), 'node_modules/@fontsource-variable/inter/files')
    )
    const cjkFiles = readdirSync(
      join(
        process.cwd(),
        'node_modules/@fontsource-variable/noto-sans-sc/files'
      )
    )
    expect(
      interFiles.filter((f) => f.endsWith('.woff2')).length
    ).toBeGreaterThan(0)
    expect(cjkFiles.filter((f) => f.endsWith('.woff2')).length).toBeGreaterThan(
      0
    )
    const inter = readWeb('node_modules/@fontsource-variable/inter/index.css')
    expect(inter).toMatch(/url\(\.\/files\/inter-[a-z-]+-wght-normal\.woff2\)/)
  })
})
