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
import { render } from '@testing-library/react'
import { expect, it } from 'vitest'

import { StaticDataTable } from '../static-data-table'

const columns = [
  { id: 'name', header: 'Name', cell: (row: { name: string }) => row.name },
]
const data = [{ name: 'alpha' }]

it('pins the header only when stickyHeader is requested', () => {
  const { container, rerender } = render(
    <StaticDataTable data={data} columns={columns} stickyHeader />
  )
  const header = container.querySelector('[data-slot=table-header]')
  expect(header).toHaveClass('sticky', 'top-0', 'z-10', 'bg-background')
  // overflow-hidden 会成为 sticky 的滚动祖先却永远不滚动，表头会失效。
  expect(container.firstElementChild).toHaveClass('overflow-visible')
  expect(container.firstElementChild).not.toHaveClass('overflow-hidden')
  // Table 自带的包裹层同样是 overflow-y-hidden，必须一并去掉。
  expect(container.querySelector('[data-slot=table-container]')).toBeNull()

  rerender(<StaticDataTable data={data} columns={columns} />)
  expect(container.querySelector('[data-slot=table-header]')).not.toHaveClass(
    'sticky'
  )
})
