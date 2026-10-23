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
import { describe, expect, test, vi } from 'vitest'

import { BRAND_LOGO_BOX_CLASS } from '@/lib/brand'

import { SystemBrand } from '../components/system-brand'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children?: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({ status: { system_name: 'Uter' } }),
}))
vi.mock('@/hooks/use-system-config', () => ({
  useSystemConfig: () => ({
    logo: '/logo.png',
    loading: false,
    logoLoaded: true,
  }),
}))
vi.mock('@/components/ui/sidebar', () => ({
  SidebarMenu: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarMenuItem: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarMenuButton: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

describe('SystemBrand', () => {
  // The console top bar used to render the logo in a `size-5` box while the
  // public header kept `size-7`. Both now share BRAND_LOGO_BOX_CLASS.
  test('renders the inline logo at the public header size', () => {
    render(<SystemBrand variant='inline' />)
    const logo = screen.getByAltText('Logo')
    const box = logo.parentElement
    expect(box).not.toBeNull()
    expect(box?.className).toBe(BRAND_LOGO_BOX_CLASS)
    expect(BRAND_LOGO_BOX_CLASS).toContain('size-7')
    expect(BRAND_LOGO_BOX_CLASS).not.toContain('size-5')
    expect(screen.getByText('Uter')).toBeInTheDocument()
  })

  test('keeps the sidebar variant on its own larger box', () => {
    render(<SystemBrand variant='sidebar' />)
    const logo = screen.getByAltText('Logo')
    const box = logo.parentElement
    expect(box?.className).toContain('size-8')
    expect(box?.className).not.toBe(BRAND_LOGO_BOX_CLASS)
  })
})
