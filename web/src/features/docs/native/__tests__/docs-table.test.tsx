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
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DocsTable } from '../docs-table'

describe('DocsTable', () => {
  it('keeps the semantic table inside a rounded bordered frame', () => {
    const { container } = render(
      <DocsTable>
        <thead>
          <tr>
            <th>Metadata</th>
            <th>Access</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Public</td>
            <td>Read access</td>
          </tr>
        </tbody>
      </DocsTable>
    )

    const frame = container.firstElementChild as HTMLElement
    expect(frame.className).toContain('rounded-xl')
    expect(frame.className).toContain('border')
    expect(frame.className).toContain('overflow-hidden')

    const table = screen.getByRole('table')
    expect(frame.contains(table)).toBe(true)
    expect(screen.getByRole('columnheader', { name: 'Metadata' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'Public' })).toBeTruthy()
  })
})
