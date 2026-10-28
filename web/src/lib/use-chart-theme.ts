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
import { useEffect, useRef, useState } from 'react'

import { useTheme } from '@/context/theme-provider'
import { useThemeColors } from '@/lib/theme-color'

/**
 * Lazy-load VChart's `ThemeManager` and switch its theme to follow the
 * resolved app theme (light / dark). Returns flags consumers can use to
 * defer chart rendering until the theme is ready.
 */
let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

/**
 * VChart paints its text (axis numbers, legends, labels — including
 * Chinese) into a <canvas>, so it does NOT inherit the CSS font stack the
 * way DOM text does: the family has to be handed to it explicitly.
 *
 * These themes are clones of VChart's built-in `light` / `dark` themes with
 * `fontFamily` pinned to the project typeface. The value is read from
 * `--font-ui`, which is declared on `:root` in `styles/theme.css` and is
 * therefore readable at runtime — unlike the `@theme inline` tokens, which
 * Tailwind bakes straight into utilities and never emits as variables.
 */
const UTER_LIGHT_THEME = 'uter-light'
const UTER_DARK_THEME = 'uter-dark'

/** Used only if `--font-ui` cannot be read (SSR, very early paint). */
const CHART_FONT_FAMILY_FALLBACK =
  "'Inter Variable', 'Inter', 'Source Han Sans SC', 'Source Han Sans CN', 'Noto Sans SC Variable', 'Noto Sans SC', sans-serif"

function resolveChartFontFamily(): string {
  if (typeof globalThis.getComputedStyle !== 'function') {
    return CHART_FONT_FAMILY_FALLBACK
  }
  return (
    globalThis
      .getComputedStyle(document.documentElement)
      .getPropertyValue('--font-ui')
      .trim() || CHART_FONT_FAMILY_FALLBACK
  )
}

/** Used only if `--font-mono` cannot be read (SSR, very early paint). */
const CHART_MONO_FONT_FAMILY_FALLBACK =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"

function resolveChartMonoFontFamily(): string {
  if (typeof globalThis.getComputedStyle !== 'function') {
    return CHART_MONO_FONT_FAMILY_FALLBACK
  }
  return (
    globalThis
      .getComputedStyle(document.documentElement)
      .getPropertyValue('--font-mono')
      .trim() || CHART_MONO_FONT_FAMILY_FALLBACK
  )
}

/**
 * 图例条目的文字样式。
 *
 * 这些图表的图例项几乎都是模型 ID（`sf-qwen3-32b`、`claude-fable-5`）与
 * 分组名，是机器可读的标识，与页面里其余标识一样用等宽字形：等宽让只差
 * 后缀的两个模型名对得上，也避免 `1`/`l`、`0`/`O` 混淆。
 *
 * 必须在这里按需读取 `--font-mono`，不能在模块顶层算好常量：VChart 把
 * 文字画进 <canvas>，拿不到 CSS 字体栈，而模块求值时机早于样式表注入时
 * 会读到空值。
 */
export function chartLegendItemStyle(): {
  label: { style: { fontFamily: string } }
} {
  return { label: { style: { fontFamily: resolveChartMonoFontFamily() } } }
}

/**
 * Register (once) and activate the Inter-pinned theme for the given mode.
 * Falls back to VChart's built-in theme if registration fails, so a chart
 * never ends up unstyled.
 */
export function applyChartTheme(
  ThemeManager: (typeof import('@visactor/vchart'))['ThemeManager'],
  resolvedTheme: 'light' | 'dark' | string
) {
  const isDark = resolvedTheme === 'dark'
  const name = isDark ? UTER_DARK_THEME : UTER_LIGHT_THEME
  const builtin = isDark ? 'dark' : 'light'
  try {
    ThemeManager.registerTheme(name, {
      ...ThemeManager.getTheme(builtin),
      fontFamily: resolveChartFontFamily(),
    })
    ThemeManager.setCurrentTheme(name)
  } catch {
    ThemeManager.setCurrentTheme(builtin)
  }
}

/**
 * 图表轴文字 / 网格线 / 表面色 / 品牌色的**颜色表达式**（不是色值）。
 *
 * 这些颜色画在 canvas 上，读不到 CSS 变量；历史上各处按 `resolvedTheme`
 * 分支写死两组 `rgba()`，等于在组件里手写主题色 —— 换主题预设（暖灰、单色）
 * 时图表仍然是冷灰，而且 `rgba(15, 23, 42, …)` 是旧的 slate 值，
 * 早已和现在的 `--foreground` 脱钩。
 *
 * 这里只声明「用哪个 Token」，透明度用 `color-mix` 表达，
 * 由调用方用 `useThemeColors` 解析成真实颜色字符串。
 */
export const CHART_AXIS_COLOR_EXPR = {
  /** 轴标签文字：正文色降一档不透明度，比纯正文轻，比禁用态重 */
  textColor: 'color-mix(in oklch, var(--foreground) 68%, transparent)',
  /** 网格线：只做视觉引导，必须能一眼看穿 */
  gridColor: 'color-mix(in oklch, var(--foreground) 12%, transparent)',
  /** 数据点描边：在图表底色上勾出点的轮廓 */
  surfaceColor: 'var(--background)',
  /** 无成败含义的强调用量（柱状图填充）：品牌主色 */
  primaryColor: 'var(--primary)',
} as const

/**
 * 解析后的图表通用色。`textColor` / `gridColor` 直接可用；
 * `surfaceColor` / `primaryColor` 供点描边与柱填充。
 */
export function useChartAxisColors(): {
  textColor: string
  gridColor: string
  surfaceColor: string
  primaryColor: string
} {
  const resolved = useThemeColors(Object.values(CHART_AXIS_COLOR_EXPR))
  return {
    textColor: resolved[CHART_AXIS_COLOR_EXPR.textColor] ?? 'currentColor',
    gridColor: resolved[CHART_AXIS_COLOR_EXPR.gridColor] ?? 'currentColor',
    surfaceColor:
      resolved[CHART_AXIS_COLOR_EXPR.surfaceColor] ?? 'currentColor',
    primaryColor:
      resolved[CHART_AXIS_COLOR_EXPR.primaryColor] ?? 'currentColor',
  }
}

export function useChartTheme() {
  const { resolvedTheme } = useTheme()
  const [themeReady, setThemeReady] = useState(false)
  const themeRef = useRef<
    (typeof import('@visactor/vchart'))['ThemeManager'] | null
  >(null)

  useEffect(() => {
    let cancelled = false
    const updateTheme = async () => {
      setThemeReady(false)
      if (!themeManagerPromise) {
        themeManagerPromise = import('@visactor/vchart').then(
          (m) => m.ThemeManager
        )
      }
      const ThemeManager = await themeManagerPromise
      if (cancelled) return
      themeRef.current = ThemeManager
      applyChartTheme(ThemeManager, resolvedTheme)
      setThemeReady(true)
    }
    updateTheme()
    return () => {
      cancelled = true
    }
  }, [resolvedTheme])

  return { resolvedTheme, themeReady }
}
