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
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { useAuthStore } from '@/stores/auth-store'

import type { Message } from '../../../types'
import { loadMessages, saveMessages } from '../storage'
import {
  MAX_LOADED_MESSAGE_CHARS,
  MAX_STORED_MESSAGES,
  MAX_STORED_MESSAGES_BYTES,
} from '../storage-schema'

function message(key: string, content: string): Message {
  return {
    key,
    from: 'assistant',
    versions: [{ id: `${key}-v`, content }],
    status: 'complete',
  }
}

beforeEach(() => {
  localStorage.clear()
  useAuthStore.getState().auth.reset()
  useAuthStore.getState().auth.setUser({ id: 9, username: 'limits', role: 1 })
})

afterEach(() => {
  localStorage.clear()
  useAuthStore.getState().auth.reset()
})

describe('playground message storage limits', () => {
  test('truncates an oversized message instead of losing the whole history', () => {
    // 单条回复超过 1MB 硬上限：不做写入侧截断时，整键会在下次读取时被删除。
    const huge = 'x'.repeat(MAX_STORED_MESSAGES_BYTES + 512 * 1024)
    saveMessages([message('big', huge)])

    const loaded = loadMessages()

    expect(loaded).not.toBeNull()
    expect(loaded).toHaveLength(1)
    expect(loaded?.[0].versions[0].content.length).toBe(
      MAX_LOADED_MESSAGE_CHARS
    )
    expect(loaded?.[0].versions[0].content.endsWith('[...]')).toBe(true)
  })

  test('keeps the newest messages when the stored count is over the cap', () => {
    const messages = Array.from(
      { length: MAX_STORED_MESSAGES + 5 },
      (_, index) => message(`m${index}`, `content-${index}`)
    )

    saveMessages(messages)

    const loaded = loadMessages()

    expect(loaded).toHaveLength(MAX_STORED_MESSAGES)
    expect(loaded?.[0].key).toBe('m5')
    expect(loaded?.at(-1)?.key).toBe(`m${MAX_STORED_MESSAGES + 4}`)
  })

  test('keeps the newest messages when the content budget is exceeded', () => {
    // 10 条各 200k 字符：合计远超 1MB 硬上限，也远超 120k 字符预算。
    const chunk = 'y'.repeat(200_000)
    const messages = Array.from({ length: 10 }, (_, index) =>
      message(`b${index}`, `${index}-${chunk}`)
    )

    saveMessages(messages)

    const loaded = loadMessages() ?? []

    expect(loaded.length).toBeGreaterThan(0)
    expect(loaded.length).toBeLessThan(messages.length)
    // 预算从最新往回收，所以保留的一定是尾部连续区间。
    expect(loaded.at(-1)?.key).toBe('b9')
    expect(loaded[0].key).toBe(`b${10 - loaded.length}`)
  })

  test('still drops a payload that a previous build wrote over the hard limit', () => {
    const key = 'playground_messages:9'
    const oversized = JSON.stringify({
      version: 1,
      data: [message('huge', 'z'.repeat(1024 * 1024 + 1))],
    })
    localStorage.setItem(key, oversized)

    expect(loadMessages()).toBeNull()
    expect(localStorage.getItem(key)).toBeNull()
  })
})
