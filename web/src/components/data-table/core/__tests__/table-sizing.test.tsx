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
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DataTableColgroup } from '../data-table-colgroup'
import { getTableSizeStyle } from '../table-sizing'

type FakeColumn = { id: string; size: number }

/**
 * 只实现被测函数用到的两个方法（getVisibleLeafColumns / getSize）。
 * 用真实的 tanstack 表格构建会引入一堆无关状态，反而看不清断言点。
 */
function fakeTable(columns: FakeColumn[], enableColumnResizing = false) {
  return {
    getVisibleLeafColumns: () =>
      columns.map((column) => ({
        id: column.id,
        getSize: () => column.size,
      })),
    options: { enableColumnResizing },
  } as unknown as TanstackTable<unknown>
}

const COLUMNS: FakeColumn[] = [
  { id: 'select', size: 28 },
  { id: 'name', size: 200 },
  { id: 'actions', size: 0 },
]

describe('getTableSizeStyle', () => {
  it('默认保持 auto 布局，并给出「不小于列宽之和」的下限', () => {
    const style = getTableSizeStyle(fakeTable(COLUMNS))
    expect(style.tableLayout).toBe('auto')
    expect(style.width).toBe('100%')
    // 28 + 200（actions 是内容自适应列，不计入）
    expect(style.minWidth).toBe('max(100%, 228px)')
  })

  it('fit 模式改成 fixed 布局并去掉 minWidth，表格不可能超出容器', () => {
    const style = getTableSizeStyle(fakeTable(COLUMNS), { fit: true })
    expect(style.tableLayout).toBe('fixed')
    expect(style.width).toBe('100%')
    // 关键：一旦保留 minWidth，容器比列宽之和窄时整表就会横向溢出。
    expect(style.minWidth).toBeUndefined()
  })
})

describe('DataTableColgroup', () => {
  it('默认模式按列宽占比给百分比，内容自适应列给 1%', () => {
    const { container } = render(
      <table>
        <DataTableColgroup table={fakeTable(COLUMNS)} />
      </table>
    )
    const cols = [...container.querySelectorAll('col')]
    expect(cols.map((col) => col.style.width)).toEqual([
      `${(28 / 228) * 100}%`,
      `${(200 / 228) * 100}%`,
      '1%',
    ])
  })

  it('fit 模式给内容自适应列固定宽度，其余按「容器宽 - 该宽度」切分', () => {
    const { container } = render(
      <table>
        <DataTableColgroup table={fakeTable(COLUMNS)} fit />
      </table>
    )
    const cols = [...container.querySelectorAll('col')]
    const widths = cols.map((col) => col.style.width)
    // 1% 在 fixed 布局里会被当成真的 1%，操作列会被压成一条缝，所以给像素值。
    expect(widths[2]).toBe('110px')
    // CSSOM 会把 calc 的乘法项顺序规范化，这里断言归一化后的等价形式。
    expect(widths[0]).toBe(`calc(${28 / 228} * (100% - 110px))`)
    expect(widths[1]).toBe(`calc(${200 / 228} * (100% - 110px))`)
  })

  it('开启列宽拖拽时两种模式都用声明的像素宽度', () => {
    const { container } = render(
      <table>
        <DataTableColgroup table={fakeTable(COLUMNS, true)} fit />
      </table>
    )
    const cols = [...container.querySelectorAll('col')]
    expect(cols.map((col) => col.style.width)).toEqual([
      '28px',
      '200px',
      '110px',
    ])
  })
})
