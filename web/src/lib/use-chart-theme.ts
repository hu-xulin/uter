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
