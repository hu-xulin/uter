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

import {
  DOCS_SEARCH_HOTKEY_ARIA,
  DOCS_SEARCH_HOTKEY_DISPLAY,
  isDocsSearchHotkey,
} from '../docs-search-hotkey'

type KeyInit = Partial<
  Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>
>

function keyEvent(init: KeyInit): KeyboardEvent {
  return {
    key: 'k',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...init,
  } as KeyboardEvent
}

describe('docs search hotkey', () => {
  test('accepts Meta+K and Ctrl+K, case-insensitively', () => {
    expect(isDocsSearchHotkey(keyEvent({ metaKey: true }))).toBe(true)
    expect(isDocsSearchHotkey(keyEvent({ ctrlKey: true }))).toBe(true)
    expect(isDocsSearchHotkey(keyEvent({ metaKey: true, key: 'K' }))).toBe(true)
    expect(isDocsSearchHotkey(keyEvent({ metaKey: true, ctrlKey: true }))).toBe(
      true
    )
  })

  test('rejects a bare K and any modified variant', () => {
    expect(isDocsSearchHotkey(keyEvent({}))).toBe(false)
    expect(isDocsSearchHotkey(keyEvent({ metaKey: true, key: 'j' }))).toBe(
      false
    )
    expect(isDocsSearchHotkey(keyEvent({ metaKey: true, altKey: true }))).toBe(
      false
    )
    expect(
      isDocsSearchHotkey(keyEvent({ ctrlKey: true, shiftKey: true }))
    ).toBe(false)
  })

  test('the on-screen hint and aria-keyshortcuts describe the same combo', () => {
    expect(DOCS_SEARCH_HOTKEY_DISPLAY).toEqual(['⌘/Ctrl', 'K'])
    expect(DOCS_SEARCH_HOTKEY_ARIA).toContain('Meta+K')
    expect(DOCS_SEARCH_HOTKEY_ARIA).toContain('Control+K')
  })
})
