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
import { describe, expect, test } from 'vitest'

import { cn } from '../utils'

describe('cn', () => {
  test('keeps a text color next to a custom uk font-size token', () => {
    // `text-uk-caption` is a font-size utility (Tailwind's --text-* namespace).
    // Without registering it with tailwind-merge, twMerge reads it as a text
    // color and drops the real color class.
    expect(cn('text-foreground', 'text-uk-caption')).toBe(
      'text-foreground text-uk-caption'
    )
    expect(cn('text-muted-foreground text-uk-body')).toBe(
      'text-muted-foreground text-uk-body'
    )
  })

  test('keeps the selected-state foreground of a button', () => {
    // Regression: the pricing filter chips render a primary background in the
    // selected state; the white foreground must survive the merge.
    expect(
      cn(
        'bg-primary text-primary-foreground',
        'text-uk-caption h-auto',
        'aria-pressed:bg-primary aria-pressed:text-primary-foreground'
      )
    ).toContain('text-primary-foreground')
  })

  test('still resolves real conflicts between two font-size utilities', () => {
    expect(cn('text-xs', 'text-uk-caption')).toBe('text-uk-caption')
    expect(cn('text-uk-body', 'text-lg')).toBe('text-lg')
  })

  test('still resolves real conflicts between two text colors', () => {
    expect(cn('text-foreground', 'text-primary')).toBe('text-primary')
    expect(cn('text-muted-foreground', 'text-foreground')).toBe('text-foreground')
  })

  test('keeps foreground and color classes that use different properties', () => {
    expect(cn('text-primary-foreground', 'text-uk-label')).toBe(
      'text-primary-foreground text-uk-label'
    )
  })
})
