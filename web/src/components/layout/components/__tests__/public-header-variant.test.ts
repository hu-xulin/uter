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

import { describe, expect, it } from 'vitest'

import { shouldUseSolidHeader } from '../public-header-variant'

describe('shouldUseSolidHeader', () => {
  it('uses the solid variant on any page once the host document scrolls', () => {
    expect(shouldUseSolidHeader('/pricing', true)).toBe(true)
    expect(shouldUseSolidHeader('/', true)).toBe(true)
  })

  it('uses the solid variant on framed docs paths without host scrolling', () => {
    for (const path of ['/docs', '/docs/', '/docs/zh/getting-started']) {
      expect(shouldUseSolidHeader(path, false)).toBe(true)
    }
  })

  it('uses the solid variant on framed about paths without host scrolling', () => {
    for (const path of ['/about', '/about/', '/about/zh/']) {
      expect(shouldUseSolidHeader(path, false)).toBe(true)
    }
  })

  it('keeps the transparent variant at the top of scrollable marketing pages', () => {
    for (const path of ['/', '/pricing', '/rankings']) {
      expect(shouldUseSolidHeader(path, false)).toBe(false)
    }
  })

  it('does not match unrelated paths that merely share the prefix', () => {
    expect(shouldUseSolidHeader('/documentation', false)).toBe(false)
    expect(shouldUseSolidHeader('/about-us', false)).toBe(false)
  })
})
