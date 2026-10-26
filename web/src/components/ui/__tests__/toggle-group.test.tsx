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

import { ToggleGroup, ToggleGroupItem } from '../toggle-group'

/**
 * Splits a className into tokens and returns the ones that paint a border
 * (`border`, `border-input`, `border-2`, ...). Tailwind's variant prefixes
 * contain `:` and stay part of the token, so plain `classList.contains()`
 * cannot be used for them — the full token has to be matched.
 */
function borderTokens(className: string | undefined): string[] {
  return (className ?? '')
    .split(/\s+/)
    .filter((token) => /^border(-|$)/.test(token))
}

/** Same, but for variant-prefixed utilities such as `…:first:border-l`. */
function prefixedBorderTokens(className: string | undefined): string[] {
  return (className ?? '')
    .split(/\s+/)
    .filter((token) => /:border(-|$)/.test(token))
}

describe('ToggleGroup segmented border', () => {
  it('does not paint its own border on the group container', () => {
    const { container } = render(
      <ToggleGroup variant='outline' size='sm'>
        <ToggleGroupItem value='standard'>Standard</ToggleGroupItem>
        <ToggleGroupItem value='recharge'>Recharge</ToggleGroupItem>
      </ToggleGroup>
    )

    const group = container.querySelector('[data-slot="toggle-group"]')
    expect(group).not.toBeNull()

    // The container must not draw a border: every outline item already carries
    // `border border-input`, and with spacing=0 there is no padding between the
    // two layers, so a container border renders as a 2px double line. That was
    // the visible bug on the pricing page's 标准/充值 and /1M /1K segmented
    // controls. The outer frame is stitched from the children's borders instead.
    expect(borderTokens(group?.className)).toEqual([])
  })

  it('keeps the white pill background on the group container', () => {
    const { container } = render(
      <ToggleGroup variant='outline' size='sm'>
        <ToggleGroupItem value='M'>/1M</ToggleGroupItem>
        <ToggleGroupItem value='K'>/1K</ToggleGroupItem>
      </ToggleGroup>
    )

    const group = container.querySelector('[data-slot="toggle-group"]')
    expect(borderTokens(group?.className)).toEqual([])
    expect(group?.classList.contains('bg-background')).toBe(true)
  })

  it('stitches the outer frame from the outline items', () => {
    const { container } = render(
      <ToggleGroup variant='outline' size='sm'>
        <ToggleGroupItem value='standard'>Standard</ToggleGroupItem>
        <ToggleGroupItem value='recharge'>Recharge</ToggleGroupItem>
      </ToggleGroup>
    )

    const items = [
      ...container.querySelectorAll('[data-slot="toggle-group-item"]'),
    ]
    expect(items).toHaveLength(2)

    for (const item of items) {
      // Every item contributes the top / right / bottom edges of the frame.
      expect(borderTokens(item.className)).toEqual(['border', 'border-input'])
    }

    // Only the first item keeps its left edge; the rest are opened up so the
    // inner divider stays a single 1px line instead of doubling up.
    expect(
      prefixedBorderTokens(items[0].className).some((token) =>
        token.endsWith(':first:border-l')
      )
    ).toBe(true)
    expect(
      prefixedBorderTokens(items[1].className).some((token) =>
        token.endsWith(':border-l-0')
      )
    ).toBe(true)
  })

  it('leaves default-variant items borderless, and the container too', () => {
    const { container } = render(
      <ToggleGroup>
        <ToggleGroupItem value='a'>A</ToggleGroupItem>
        <ToggleGroupItem value='b'>B</ToggleGroupItem>
      </ToggleGroup>
    )

    const group = container.querySelector('[data-slot="toggle-group"]')
    const items = container.querySelectorAll('[data-slot="toggle-group-item"]')

    for (const item of items) {
      expect(borderTokens(item.className)).toEqual([])
    }
    // A borderless group must not silently fall back to a bordered container.
    expect(borderTokens(group?.className)).toEqual([])
  })
})
