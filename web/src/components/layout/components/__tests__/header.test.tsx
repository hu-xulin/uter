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
import { describe, expect, it, vi } from 'vitest'

import { Header } from '../header'

vi.mock('@/components/ui/sidebar', () => ({
  SidebarTrigger: () => <button type='button' aria-label='Toggle sidebar' />,
}))

vi.mock('@/hooks/use-scrolled', () => ({
  useScrolled: () => false,
}))

describe('Header', () => {
  it('draws the bottom line as an overlay instead of consuming layout height', () => {
    const { container } = render(
      <Header>
        <span>content</span>
      </Header>
    )

    const header = screen.getByRole('banner')
    expect(header).toHaveClass('h-[var(--app-header-height,3rem)]')
    expect(header).not.toHaveClass('border-b')

    const divider = container.querySelector('span[aria-hidden="true"]')
    expect(divider).toHaveClass(
      'absolute',
      'inset-x-0',
      'bottom-0',
      'h-px'
    )
  })
})