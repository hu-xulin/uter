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
import type { Table as TanstackTable } from '@tanstack/react-table'
import type * as React from 'react'

import { isContentSizedColumn } from './content-sized-columns'

/**
 * 表格宽度策略。
 *
 * - 默认（`fit: false`）：`table-layout: auto` + `minWidth: max(100%, Σ列宽)`。
 *   列宽只当权重用，内容撑得比声明的宽时整表横向滚动 —— 管理端宽表要的就是这个
 *   （渠道 / 模型 / 用量日志列多、每列都有不可截断的信息）。
 * - `fit: true`：`table-layout: fixed` + `width: 100%`，不再设 minWidth。
 *   浏览器按 colgroup 的百分比切分容器宽度，`truncate` 才真正生效，
 *   整表恒等于容器宽度、不产生横向滚动。列少且都能截断的表（API 密钥）用它。
 */
export function getTableSizeStyle<TData>(
  table: TanstackTable<TData>,
  options?: { fit?: boolean }
): React.CSSProperties {
  if (options?.fit) {
    return { tableLayout: 'fixed', width: '100%' }
  }

  const width = table
    .getVisibleLeafColumns()
    .filter((column) => !isContentSizedColumn(column.id))
    .reduce((total, column) => total + column.getSize(), 0)

  return {
    minWidth: `max(100%, ${width}px)`,
    tableLayout: 'auto',
    width: '100%',
  }
}
