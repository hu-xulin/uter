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
 * 投影与动效档位的守卫测试。
 *
 * 规范 §1.5 / §1.6 把「投影」和「时长」都定成了**封闭集合**：四档投影、
 * 一档状态辉光、五组时长、三条缓动。封闭集合只有配上守卫才是封闭的 ——
 * 否则下一个人加一档 `--ds-elevation-card`，门禁的 `ELEVATION_TOKENS`
 * 不会知道，样式照样生效，规范就变成了文档里的历史记录。
 *
 * 这里锁三件事：
 *   1. `tokens/elevation.css` 声明的 elevation / glow 变量与门禁集合完全一致；
 *   2. 动效时长的分组与取值与 `spacing.md` 的表格一致；
 *   3. `ds-motion-*` 工具类必须用 `@utility` 注册（写成普通 CSS 类时
 *      Tailwind 的变体系统识别不到，`data-ending-style:ds-motion-fast`
 *      会静默失效）。
 */

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, 'src', rel), 'utf8')

const elevationCss = read('design-system/tokens/elevation.css')
const motionCss = read('design-system/foundations/motion.css')
const gateScript = readFileSync(
  join(ROOT, 'scripts', 'check-design-tokens.mjs'),
  'utf8'
)

/** 从 CSS 里取出 `--ds-x: value;` 的变量名集合。 */
function declaredVars(css: string): Set<string> {
  return new Set(
    [...css.matchAll(/^\s*(--ds-[a-z0-9-]+)\s*:/gm)].map((m) => m[1])
  )
}

describe('elevation tokens', () => {
  it('declares exactly four elevation steps plus one glow', () => {
    const vars = declaredVars(elevationCss)
    const elevation = [...vars]
      .filter((v) => v.startsWith('--ds-elevation-'))
      .sort()
    expect(elevation).toEqual([
      '--ds-elevation-marketing',
      '--ds-elevation-none',
      '--ds-elevation-overlay',
      '--ds-elevation-popover',
      '--ds-elevation-raised',
    ])
    expect([...vars].filter((v) => v.startsWith('--ds-glow-'))).toEqual([
      '--ds-glow-online',
    ])
  })

  it('keeps the gate allowlist in sync with the declared steps', () => {
    // 门禁只认 `ELEVATION_TOKENS` 里的六个写法；新增档位必须两处一起改。
    const expected = [
      'shadow-(--ds-elevation-none)',
      'shadow-(--ds-elevation-popover)',
      'shadow-(--ds-elevation-overlay)',
      'shadow-(--ds-elevation-raised)',
      'shadow-(--ds-elevation-marketing)',
      'shadow-(--ds-glow-online)',
    ]
    for (const token of expected) {
      expect(gateScript).toContain(`'${token}'`)
    }
  })

  it('overrides the two off-page steps in dark mode', () => {
    // 浅色主题的 0.18 在黑底上看不见；marketing 与 raised 必须单独覆盖。
    const dark = /\.dark\s*\{([\s\S]*?)\}/.exec(elevationCss)
    expect(dark, '缺少 .dark 覆盖块').toBeTruthy()
    expect(dark?.[1]).toContain('--ds-elevation-marketing')
    expect(dark?.[1]).toContain('--ds-elevation-raised')
  })
})

describe('motion tokens', () => {
  const motionVars = declaredVars(elevationCss)

  it('declares the five groups with the documented values', () => {
    const expected: Record<string, string> = {
      '--ds-motion-fast': '100ms',
      '--ds-motion-base': '200ms',
      '--ds-motion-slow': '350ms',
      '--ds-motion-marketing-fast': '300ms',
      '--ds-motion-marketing-base': '500ms',
      '--ds-motion-enter': '600ms',
      '--ds-motion-loop-shimmer': '1.8s',
      '--ds-motion-loop-pulse': '1.5s',
      '--ds-motion-loop-caret': '1s',
      '--ds-motion-loop-spin': '0.8s',
      '--ds-motion-loop-marquee': '20s',
      '--ds-motion-loop-border': '3.2s',
      '--ds-motion-data-fast': '250ms',
      '--ds-motion-data': '500ms',
    }
    for (const [name, value] of Object.entries(expected)) {
      expect(motionVars.has(name), `缺少 ${name}`).toBe(true)
      expect(
        new RegExp(`${name}:\\s*${value.replace('.', '\\.')};`).test(
          elevationCss
        ),
        `${name} 应为 ${value}`
      ).toBe(true)
    }
  })

  it('declares exactly three easing curves', () => {
    const easings = [...motionVars].filter((v) =>
      v.startsWith('--ds-motion-ease')
    )
    expect(easings.sort()).toEqual([
      '--ds-motion-ease',
      '--ds-motion-ease-marketing',
      '--ds-motion-ease-snappy',
    ])
  })

  it('registers every ds-motion-* class with @utility so variants work', () => {
    // 写成 `@layer utilities { .ds-motion-x }` 时，`data-ending-style:ds-motion-x`
    // 不会生成选择器 —— 类名在 DOM 上、样式没生效，排查起来极其费时。
    const classes = [
      ...motionCss.matchAll(/@utility\s+(ds-motion-[a-z-]+)/g),
    ].map((m) => m[1])
    expect(classes.sort()).toEqual([
      'ds-motion-base',
      'ds-motion-data',
      'ds-motion-data-fast',
      'ds-motion-fast',
      'ds-motion-marketing',
      'ds-motion-marketing-fast',
      'ds-motion-slow',
    ])
    const withoutComments = motionCss.replaceAll(/\/\*[\s\S]*?\*\//g, '')
    expect(withoutComments).not.toMatch(
      /@layer utilities\s*\{[\s\S]*\.ds-motion-/
    )
  })
})

describe('content width tokens', () => {
  const spacingCss = read('design-system/tokens/spacing.css')

  it('declares both content widths and keeps them off the density scale', () => {
    expect(spacingCss).toContain('--ds-content-max: 80rem')
    expect(spacingCss).toContain('--ds-content-max-wide: 112.5rem')
    // 宽度不跟密度档走：`sm` / `xl` 块里不得出现这两个变量。
    const smBlock = /\[data-theme-scale='sm'\]\s*\{([\s\S]*?)\}/.exec(
      spacingCss
    )
    expect(smBlock?.[1]).not.toContain('--ds-content-max')
    const xlBlock = /\[data-theme-scale='xl'\]\s*\{([\s\S]*?)\}/.exec(
      spacingCss
    )
    expect(xlBlock?.[1]).not.toContain('--ds-content-max')
  })
})

describe('Tailwind 过渡默认值', () => {
  it('默认时长与缓动指向封闭集合，而不是 Tailwind 内置的 150ms', () => {
    // `transition-colors` 这类工具类不写时长时读 `--default-transition-duration`
    // （内置 .15s）。150ms 不在 fast/base/slow 三档里，而门禁只检查**显式写出**
    // 的 `duration-*`，看不见这些裸过渡 —— 所以默认值必须自己改。
    expect(elevationCss).toContain(
      '--default-transition-duration: var(--ds-motion-fast)'
    )
    expect(elevationCss).toContain(
      '--default-transition-timing-function: var(--ds-motion-ease)'
    )
  })

  it('声明在 @theme 里而不是 :root', () => {
    // 写进 `:root` 时 Tailwind 读不到，生成的工具类仍是 150ms
    // —— 与字号阶梯踩过的是同一个坑。
    const themeBlock = /@theme\s*\{([\s\S]*?)\}/.exec(elevationCss)
    expect(themeBlock, '缺少 @theme 块').toBeTruthy()
    expect(themeBlock?.[1]).toContain('--default-transition-duration')
    expect(themeBlock?.[1]).toContain('--default-transition-timing-function')
  })
})

describe('内联胶囊高度（chip）', () => {
  const spacingCss = read('design-system/tokens/spacing.css')

  it('只在一处声明，业务代码不得再写魔法值', () => {
    expect(spacingCss).toContain('--ds-chip-height: 1.3125rem')
    // 多选里的值胶囊与 `+N more` / `Collapse` 必须逐像素等高，
    // 4 处各自写一遍 `h-[calc(--spacing(5.25))]` 时改一处就错位。
    for (const rel of [
      'components/ui/combobox.tsx',
      'components/multi-select.tsx',
    ]) {
      expect(read(rel), `${rel} 仍在写魔法高度`).not.toContain(
        'calc(--spacing(5.25))'
      )
    }
  })
})
