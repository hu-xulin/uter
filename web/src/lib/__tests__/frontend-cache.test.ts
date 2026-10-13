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
import { beforeEach, describe, expect, test } from 'vitest'

import { initializeFrontendCache } from '../frontend-cache'

beforeEach(() => {
  window.localStorage.clear()
})

describe('frontend cache version migration', () => {
  test('keeps the interface language across a cache wipe', () => {
    window.localStorage.setItem('i18nextLng', 'zhCN')
    window.localStorage.setItem('some-derived-ui-state', 'stale')

    initializeFrontendCache()

    expect(window.localStorage.getItem('i18nextLng')).toBe('zhCN')
    // Derived state is still dropped — that is the point of the version bump.
    expect(window.localStorage.getItem('some-derived-ui-state')).toBeNull()
  })

  test('is a no-op once the version marker matches', () => {
    initializeFrontendCache()
    window.localStorage.setItem('some-derived-ui-state', 'fresh')

    initializeFrontendCache()

    expect(window.localStorage.getItem('some-derived-ui-state')).toBe('fresh')
  })
})
