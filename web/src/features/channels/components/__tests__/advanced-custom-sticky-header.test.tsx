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
import { expect, test, vi } from 'vitest'

import { AdvancedCustomEditorDialog } from '../dialogs/advanced-custom-editor-dialog'

test('route table header stays fixed while only the route rows scroll', () => {
  render(
    <AdvancedCustomEditorDialog
      open
      value={JSON.stringify({
        advanced_routes: [
          {
            incoming_path: '/v1/chat/completions',
            upstream_path: '/v1/chat/completions',
            converter: 'none',
          },
        ],
      })}
      onOpenChange={vi.fn()}
      onSave={vi.fn()}
    />
  )

  const header = screen.getAllByText('Route').at(0)?.parentElement
  expect(header).toHaveClass('sticky', 'top-0', 'z-10')
  expect(header?.parentElement).toHaveClass('max-h-[32rem]', 'overflow-y-auto')
})
