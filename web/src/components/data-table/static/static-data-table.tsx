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
import * as React from 'react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { withCjkTermBreaks } from '@/lib/cjk-term-breaks'
import { cn } from '@/lib/utils'

import { TruncatedCell } from '../core/truncated-cell'
import { staticDataTableClassNames } from './static-data-table-classnames'

type StaticDataTableBaseProps = {
  className?: string
  tableClassName?: string
  /**
   * 让表头钉在最近的滚动容器顶部。仅用于包裹在 `overflow-auto` 里、
   * 表体明显长于可视区间的表格；不透明背景避免滚动行从表头透出。
   */
  stickyHeader?: boolean
  containerProps?: Omit<React.ComponentProps<'div'>, 'className' | 'children'>
  tableProps?: Omit<
    React.ComponentProps<typeof Table>,
    'className' | 'children'
  >
}

type StaticDataTableDataProps<TData = unknown> = StaticDataTableBaseProps & {
  columns: StaticDataTableColumn<TData>[]
  data: TData[]
  getRowKey?: (row: TData, index: number) => React.Key
  getRowClassName?: (row: TData, index: number) => string | undefined
  renderRow?: (row: TData, index: number) => React.ReactNode
  empty?: boolean
  emptyContent?: React.ReactNode
  emptyClassName?: string
  headerRowClassName?: string
}

type StaticDataTableChildrenProps = StaticDataTableBaseProps & {
  children: React.ReactNode
  columns?: never
  data?: never
}

type StaticDataTableProps<TData = unknown> =
  | StaticDataTableDataProps<TData>
  | StaticDataTableChildrenProps

export type StaticDataTableColumn<TData = unknown> = {
  id: string
  header: React.ReactNode
  className?: string
  cellClassName?: string | ((row: TData, index: number) => string | undefined)
  cell?: (row: TData, index: number) => React.ReactNode
}

export function StaticDataTable<TData = unknown>(
  props: StaticDataTableProps<TData>
) {
  const {
    className,
    tableClassName,
    stickyHeader,
    containerProps,
    tableProps,
  } = props

  return (
    <div
      className={cn(
        staticDataTableClassNames.container,
        // 容器自带的 overflow-hidden 会成为 sticky 的滚动祖先却不会滚动，
        // 表头因此钉不住；交给外层真正的滚动容器来裁剪。
        stickyHeader && 'overflow-visible',
        className
      )}
      {...containerProps}
    >
      <Table
        className={tableClassName}
        // Table 默认自带的包裹层是 overflow-x-auto/overflow-y-hidden，会成为
        // sticky 的滚动祖先却不会纵向滚动；固定表头时必须去掉这一层。
        withContainer={stickyHeader ? false : undefined}
        {...tableProps}
      >
        {props.columns !== undefined ? (
          <StaticDataTableWithColumns {...props} />
        ) : (
          props.children
        )}
      </Table>
    </div>
  )
}

function StaticDataTableWithColumns<TData>({
  columns,
  data,
  getRowKey,
  getRowClassName,
  renderRow,
  empty,
  emptyContent,
  emptyClassName,
  headerRowClassName,
  stickyHeader,
}: StaticDataTableDataProps<TData>) {
  const isEmpty = empty ?? (data !== undefined && data.length === 0)
  const bodyRows = data.map((row, index) => (
    <StaticDataTableRow
      key={getRowKey?.(row, index) ?? index}
      row={row}
      index={index}
      columns={columns}
      getRowClassName={getRowClassName}
      renderRow={renderRow}
    />
  ))

  return (
    <>
      <TableHeader
        className={cn(stickyHeader && 'bg-background sticky top-0 z-10')}
      >
        <TableRow className={headerRowClassName}>
          {columns.map((column) => (
            <TableHead key={column.id} className={column.className}>
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isEmpty ? (
          <StaticDataTableEmptyRow
            colSpan={columns.length}
            className={emptyClassName}
          >
            {emptyContent}
          </StaticDataTableEmptyRow>
        ) : (
          bodyRows
        )}
      </TableBody>
    </>
  )
}

type StaticDataTableRowProps<TData> = Required<
  Pick<StaticDataTableDataProps<TData>, 'columns'>
> &
  Pick<StaticDataTableDataProps<TData>, 'getRowClassName' | 'renderRow'> & {
    row: TData
    index: number
  }

function StaticDataTableRow<TData>({
  row,
  index,
  columns,
  getRowClassName,
  renderRow,
}: StaticDataTableRowProps<TData>) {
  if (renderRow) {
    return <>{renderRow(row, index)}</>
  }

  return (
    <TableRow className={getRowClassName?.(row, index)}>
      {columns.map((column, columnIndex) => (
        <TableCell
          key={column.id}
          className={cn(
            'max-w-full min-w-0 overflow-hidden',
            getStaticCellClassName(column, row, index)
          )}
        >
          {renderStaticCellContent(column, row, index, columnIndex === 0)}
        </TableCell>
      ))}
    </TableRow>
  )
}

function renderStaticCellContent<TData>(
  column: StaticDataTableColumn<TData>,
  row: TData,
  index: number,
  isFirstColumn: boolean
) {
  const rawContent = column.cell?.(row, index)
  const textContent = getPrimitiveTextContent(rawContent)
  // 首列纯文本在词边界加 wbr；自定义渲染器保持原样。
  const content = isFirstColumn ? withCjkTermBreaks(rawContent) : rawContent

  if (!textContent) return content

  return <TruncatedCell tooltipContent={textContent}>{content}</TruncatedCell>
}

function getPrimitiveTextContent(content: React.ReactNode): string | null {
  if (typeof content === 'string' || typeof content === 'number') {
    return String(content)
  }

  if (
    React.isValidElement<{ children?: React.ReactNode }>(content) &&
    (typeof content.props.children === 'string' ||
      typeof content.props.children === 'number')
  ) {
    return String(content.props.children)
  }

  return null
}

function getStaticCellClassName<TData>(
  column: StaticDataTableColumn<TData>,
  row: TData,
  index: number
) {
  return typeof column.cellClassName === 'function'
    ? column.cellClassName(row, index)
    : column.cellClassName
}

type StaticDataTableEmptyRowProps = {
  colSpan: number
  children: React.ReactNode
  className?: string
}

function StaticDataTableEmptyRow({
  colSpan,
  children,
  className,
}: StaticDataTableEmptyRowProps) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className={cn('h-24 text-center', className)}
      >
        {children}
      </TableCell>
    </TableRow>
  )
}
