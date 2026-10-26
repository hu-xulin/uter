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
import { afterEach, describe, expect, test } from 'vitest'

import {
  LEGACY_SESSION_HINT_COOKIE_NAME,
  SESSION_HINT_COOKIE_NAME,
  hasSessionHint,
  readCookie,
} from '../session-hint'

function clearHintCookies(): void {
  for (const name of [
    SESSION_HINT_COOKIE_NAME,
    LEGACY_SESSION_HINT_COOKIE_NAME,
  ]) {
    document.cookie = `${name}=; Max-Age=0; Path=/`
  }
}

afterEach(() => {
  clearHintCookies()
})

describe('session hint cookie detection', () => {
  test('reads a named cookie out of a document.cookie string', () => {
    expect(readCookie('a=1; b=2', 'b')).toBe('2')
    expect(readCookie('a=1; b=2', 'missing')).toBe(null)
    expect(readCookie('', 'a')).toBe(null)
  })

  test('detects the hint under the name the Go service writes', () => {
    expect(hasSessionHint()).toBe(false)

    document.cookie = `${LEGACY_SESSION_HINT_COOKIE_NAME}=1`
    expect(hasSessionHint()).toBe(true)
  })

  test('detects the hint under the frontend name as well', () => {
    expect(hasSessionHint()).toBe(false)

    document.cookie = `${SESSION_HINT_COOKIE_NAME}=1`
    expect(hasSessionHint()).toBe(true)
  })

  test('ignores unrelated cookies', () => {
    document.cookie = 'unrelated=1'
    expect(hasSessionHint()).toBe(false)
  })
})
