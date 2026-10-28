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
import { useEffect, useState } from 'react'

/**
 * Resolve any CSS color expression (a `var()` reference, a `color-mix()`
 * derivation, …) to an `rgba()` string a canvas chart can draw with. The
 * expression is evaluated on a probe element inside `<body>` so theme preset
 * overrides apply, and normalized through a canvas because tokens are written
 * as `oklch()` / `color-mix()`, which chart libraries do not parse.
 */
export function resolveCssColor(expression: string): string | undefined {
  if (typeof document === 'undefined') return undefined

  const probe = document.createElement('div')
  probe.style.color = expression
  probe.style.display = 'none'
  document.body.appendChild(probe)
  const computedColor = getComputedStyle(probe).color
  probe.remove()
  if (!computedColor) return undefined

  const context = document.createElement('canvas').getContext('2d')
  if (!context) return computedColor
  context.fillStyle = computedColor
  context.fillRect(0, 0, 1, 1)
  const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data
  return `rgba(${red}, ${green}, ${blue}, ${(alpha / 255).toFixed(2)})`
}

/**
 * Resolve a theme color token (e.g. `--foreground`) to an `rgba()` string.
 */
export function resolveThemeColor(cssVariable: string): string | undefined {
  return resolveCssColor(`var(${cssVariable})`)
}

/**
 * Track a theme color token. The light/dark class on `<html>` and the theme
 * preset attribute on `<body>` are applied by provider effects that run after
 * this hook's, so the color is re-resolved when either attribute changes.
 */
export function useThemeColor(cssVariable: string): string | undefined {
  const [color, setColor] = useState<string | undefined>()

  useEffect(() => {
    const update = () => setColor(resolveThemeColor(cssVariable))
    update()

    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-theme-preset'],
    })
    return () => observer.disconnect()
  }, [cssVariable])

  return color
}

/**
 * Track several color expressions at once, keyed by the expression itself.
 *
 * Canvas 图表需要一整组色值（状态分级、序列区分），逐个调用
 * `useThemeColor` 会重复建探针元素、并且要写 5 个 hook；这里用同一个
 * 探针遍历解析，主题变化时一起刷新。
 */
export function useThemeColors(
  expressions: readonly string[]
): Record<string, string> {
  const key = expressions.join('\n')
  const [colors, setColors] = useState<Record<string, string>>({})

  useEffect(() => {
    const update = () => {
      const next: Record<string, string> = {}
      for (const expression of key.split('\n')) {
        const color = resolveCssColor(expression)
        if (color) next[expression] = color
      }
      setColors(next)
    }
    update()

    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-theme-preset'],
    })
    return () => observer.disconnect()
  }, [key])

  return colors
}
