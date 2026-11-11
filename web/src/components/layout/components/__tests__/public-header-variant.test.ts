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

  it('keeps framed docs paths transparent while the host does not scroll', () => {
    // The frame owns its own scrolling, so the host document never scrolls.
    // The header therefore stays in its transparent state and the shared
    // top-of-page brand glow bleeds through, matching the pricing page.
    for (const path of ['/docs', '/docs/', '/docs/zh/getting-started']) {
      expect(shouldUseSolidHeader(path, false)).toBe(false)
    }
  })

  it('keeps framed about paths transparent while the host does not scroll', () => {
    for (const path of ['/about', '/about/', '/about/zh/']) {
      expect(shouldUseSolidHeader(path, false)).toBe(false)
    }
  })

  it('uses the solid variant on framed paths once the host document scrolls', () => {
    for (const path of [
      '/docs',
      '/docs/zh/getting-started',
      '/about',
      '/about/zh/',
    ]) {
      expect(shouldUseSolidHeader(path, true)).toBe(true)
    }
  })

  it('keeps the transparent variant at the top of scrollable marketing pages', () => {
    for (const path of ['/', '/pricing', '/rankings']) {
      expect(shouldUseSolidHeader(path, false)).toBe(false)
    }
  })
})
