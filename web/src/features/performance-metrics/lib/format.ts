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
export function formatThroughput(tps: number): string {
  if (!Number.isFinite(tps) || tps <= 0) return '—'
  if (tps >= 1_000) return `${(tps / 1_000).toFixed(1)}K t/s`
  return `${tps.toFixed(tps < 10 ? 2 : 1)} t/s`
}

export function formatLatency(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(2)}s`
  return `${Math.round(ms)}ms`
}

export function formatUptimePct(pct: number): string {
  if (!Number.isFinite(pct)) return '—'
  return `${pct.toFixed(2)}%`
}

export type SuccessRateLevel =
  | 'excellent'
  | 'good'
  | 'warning'
  | 'critical'
  | 'unknown'

const SUCCESS_RATE_EXCELLENT_MIN = 100
const SUCCESS_RATE_GOOD_MIN = 90
const SUCCESS_RATE_WARNING_MIN = 70

/**
 * Single source of truth for grading a success rate (0-100).
 * - excellent: 100% (full green)
 * - good: >= 90% (slightly lighter green)
 * - warning: >= 70%
 * - critical: below 70%
 * - unknown: non-finite values
 */
export function getSuccessRateLevel(rate: number): SuccessRateLevel {
  if (!Number.isFinite(rate)) return 'unknown'
  if (rate >= SUCCESS_RATE_EXCELLENT_MIN) return 'excellent'
  if (rate >= SUCCESS_RATE_GOOD_MIN) return 'good'
  if (rate >= SUCCESS_RATE_WARNING_MIN) return 'warning'
  return 'critical'
}

const SUCCESS_RATE_TEXT_CLASS: Record<SuccessRateLevel, string> = {
  excellent: 'text-success dark:text-success',
  good: 'text-success dark:text-success-soft-foreground',
  warning: 'text-warning dark:text-warning',
  critical: 'text-destructive dark:text-destructive',
  unknown: 'text-muted-foreground',
}

const SUCCESS_RATE_DOT_CLASS: Record<SuccessRateLevel, string> = {
  excellent: 'bg-success',
  good: 'bg-success',
  warning: 'bg-warning',
  critical: 'bg-destructive',
  unknown: 'bg-muted-foreground',
}

/**
 * Canvas 取色用的**颜色表达式**（不是色值）。
 *
 * 成功率点的填充色由 VChart 画在 canvas 上，读不到 CSS 变量，历史上这里
 * 写死了一组 emerald / amber / red 的 hex —— 那既绕过了语义层，也不会跟着
 * 深色模式和 5 套主题预设变化。现在只声明「用哪个 Token」，由调用方
 * 用 `useThemeColors` 解析成 rgba 再交给图表。
 *
 * `good` 比 `excellent` 浅一档：这两级在图上必须可区分，而语义 Token 只有
 * 一个 `--success`，所以用 `color-mix()` 与页面底色混合出浅一档的同色相绿 ——
 * 仍然是派生值，不是新写死的颜色。
 */
export const SUCCESS_RATE_COLOR_EXPR: Record<SuccessRateLevel, string> = {
  excellent: 'var(--success)',
  good: 'color-mix(in oklch, var(--success) 68%, var(--background))',
  warning: 'var(--warning)',
  critical: 'var(--destructive)',
  unknown: 'var(--muted-foreground)',
}

export function getSuccessRateTextClass(rate: number): string {
  return SUCCESS_RATE_TEXT_CLASS[getSuccessRateLevel(rate)]
}

export function getSuccessRateDotClass(rate: number): string {
  return SUCCESS_RATE_DOT_CLASS[getSuccessRateLevel(rate)]
}

/**
 * 解析后的状态色表，来自 `useThemeColors(Object.values(SUCCESS_RATE_COLOR_EXPR))`。
 */
export function getSuccessRateColor(
  rate: number,
  resolvedColors: Record<string, string>
): string | undefined {
  return resolvedColors[SUCCESS_RATE_COLOR_EXPR[getSuccessRateLevel(rate)]]
}
