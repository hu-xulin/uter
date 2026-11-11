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
import { describe, expect, it } from 'vitest'

import { PublicPageGlow } from '../public-page-glow'

describe('PublicPageGlow', () => {
  it('renders a decorative layer that never intercepts pointer events', () => {
    const { container } = render(<PublicPageGlow />)
    const glow = container.querySelector('[data-public-page-glow]')

    expect(glow).not.toBeNull()
    expect(glow?.getAttribute('aria-hidden')).toBe('true')
    expect(glow?.className).toContain('pointer-events-none')
  })

  it('derives every glow hue from --primary instead of a hard-coded color', () => {
    const { container } = render(<PublicPageGlow />)
    const glow = container.querySelector(
      '[data-public-page-glow]'
    ) as HTMLElement
    const background = glow.style.background

    expect(background.match(/radial-gradient/g)?.length).toBe(3)
    expect(background).toContain('var(--primary)')
    expect(background).not.toMatch(/#[0-9a-f]{3,8}/i)
  })
})
