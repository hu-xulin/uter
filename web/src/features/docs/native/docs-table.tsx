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
import type { ReactNode } from 'react'
import * as React from 'react'

import { withCjkTermBreaks } from '@/lib/cjk-term-breaks'

/**
 * MDX table → Clerk-style rounded frame.
 *
 * The compiler emits a bare `<table>`, so the frame cannot be drawn by the
 * prose descendant selectors alone: a rounded, 1px-bordered container has to
 * wrap it. The outer box owns the radius and clips the sunken header band; the
 * inner scroller keeps wide tables reachable without squaring off the corners.
 * Cell typography and dividers stay in `PROSE_CLASSES` (§23: 12/13px, horizontal
 * dividers only).
 *
 * 首列（每行第一个 th/td）经 `withCjkTermBreaks` 在中文词边界插入 `<wbr>`，
 * 配合全局 CSS 的 `word-break: keep-all`，让「个人信息」按「个人|信息」换行，
 * 而非被 `PROSE_CLASSES` 的 `overflow-wrap: anywhere` 拆成「个人信|息」。
 * 全局 CSS 的 `overflow-wrap: normal` 已压过 prose 的 anywhere。
 */
export function DocsTable({ children }: { children?: ReactNode }) {
  return (
    <div className='my-6 overflow-hidden rounded-xl border border-(--ds-color-border-table)'>
      <div className='overflow-x-auto'>
        <table className='w-full border-collapse text-left'>
          {withFirstColumnTermBreaks(children)}
        </table>
      </div>
    </div>
  )
}

/** 递归改写每行第一个 th/td 的内容；只进入原生 HTML 元素，不动自定义组件。 */
function withFirstColumnTermBreaks(node: ReactNode): ReactNode {
  // React.Children.map 保留原始 key 与顺序，避免用数组下标当 key。
  if (Array.isArray(node)) {
    return React.Children.map(node, (child) => withFirstColumnTermBreaks(child))
  }
  if (!React.isValidElement(node) || typeof node.type !== 'string') return node

  const element = node as React.ReactElement<{ children?: ReactNode }>
  const children = element.props.children
  if (children === undefined) return element

  // <thead>/<tbody>/<tr>：继续下钻；<tr> 的直接第一个子元素是首列单元格。
  if (node.type === 'tr') {
    const cells = React.Children.toArray(children)
    return React.cloneElement(
      element,
      undefined,
      cells.map((cell, index) => (index === 0 ? withCjkTermBreaks(cell) : cell))
    )
  }

  if (node.type === 'thead' || node.type === 'tbody') {
    return React.cloneElement(
      element,
      undefined,
      withFirstColumnTermBreaks(children)
    )
  }

  return element
}
