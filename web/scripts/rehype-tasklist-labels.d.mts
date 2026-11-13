import type { Plugin } from 'unified'

export interface RehypeTasklistLabelsOptions {
  /** 无障碍名（默认「任务清单项」）。 */
  label?: string
}

/**
 * 为 GFM 任务清单 checkbox（type=checkbox 且 disabled）补 aria-label。
 * 见 rehype-tasklist-labels.mjs 的完整说明。
 */
export function rehypeTasklistLabels(options?: RehypeTasklistLabelsOptions): Plugin
