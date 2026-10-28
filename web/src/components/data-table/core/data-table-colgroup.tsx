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

import {
  CONTENT_SIZED_COLUMN_WIDTH_PX,
  isContentSizedColumn,
} from './content-sized-columns'

export function DataTableColgroup<TData>({
  table,
  fit = false,
}: {
  table: TanstackTable<TData>
  /** 与 {@link getTableSizeStyle} 的 `fit` 保持一致（table-layout: fixed）。 */
  fit?: boolean
}) {
  const columns = table.getVisibleLeafColumns()
  const sizedColumns = columns.filter(
    (column) => !isContentSizedColumn(column.id)
  )
  const totalSize = sizedColumns.reduce((sum, col) => sum + col.getSize(), 0)

  return (
    <colgroup>
      {columns.map((column) => {
        const width = getColumnWidth(
          table,
          column.id,
          column.getSize(),
          totalSize,
          fit
        )

        return <col key={column.id} style={{ width }} />
      })}
    </colgroup>
  )
}

function getColumnWidth<TData>(
  table: TanstackTable<TData>,
  columnId: string,
  columnSize: number,
  totalSize: number,
  fit: boolean
) {
  if (isContentSizedColumn(columnId)) {
    // fixed 布局下 1% 会被当成真的 1%，必须给确定宽度，否则操作列被压成缝。
    return fit ? `${CONTENT_SIZED_COLUMN_WIDTH_PX}px` : '1%'
  }

  if (table.options.enableColumnResizing === true) {
    return `${columnSize}px`
  }

  if (totalSize <= 0) {
    return undefined
  }

  const ratio = columnSize / totalSize

  // fixed 布局：操作列已固定占掉 110px，其余列按比例切分「容器宽 - 110px」，
  // 保证百分比之和刚好填满容器而不是溢出。
  if (fit) {
    return `calc((100% - ${CONTENT_SIZED_COLUMN_WIDTH_PX}px) * ${ratio})`
  }

  return `${ratio * 100}%`
}
