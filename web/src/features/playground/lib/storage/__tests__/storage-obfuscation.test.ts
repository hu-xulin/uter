/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without any warranty of any kind. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { scopedKey } from '@/lib/scoped-storage'
import { useAuthStore } from '@/stores/auth-store'

import { STORAGE_KEYS } from '../../../constants'
import { clearPlaygroundData, loadMessages, saveMessages } from '../storage'

// A value that must never appear verbatim in localStorage.
const SECRET = 'sk-abcdefghijklmnopqrstuvwxyz123456'
const ZH_CONTENT = '好的，已收到。中文内容也能正确往返。'

function makeMessages() {
  return [
    {
      key: 'm1',
      from: 'user' as const,
      versions: [{ id: 'v1', content: `Please use ${SECRET} for this request` }],
    },
    {
      key: 'm2',
      from: 'assistant' as const,
      versions: [{ id: 'v2', content: ZH_CONTENT }],
    },
  ]
}

describe('playground message storage obfuscation', () => {
  beforeEach(() => {
    // Playground history is user-scoped: nothing is persisted for a signed-out
    // visitor, so the obfuscation contract only applies once an account is set.
    useAuthStore.getState().auth.setUser({ id: 1, username: 'A', role: 1 })
    clearPlaygroundData()
  })

  afterEach(() => {
    clearPlaygroundData()
    useAuthStore.getState().auth.reset()
  })

  it('does not store message content as readable plaintext', () => {
    saveMessages(makeMessages())

    const raw = localStorage.getItem(scopedKey(STORAGE_KEYS.MESSAGES))
    expect(raw).toBeTruthy()
    // The persisted value is the obfuscated envelope, not raw JSON, so a casual
    // read of localStorage (or a naive XSS grabbing the stored string) must not
    // yield the user's secret or any message text.
    expect(raw).not.toContain(SECRET)
    expect(raw).not.toContain('sk-abcdef')
    expect(raw).not.toContain(ZH_CONTENT)
    expect(raw).not.toContain('"versions"')
  })

  it('round-trips messages through load (including non-ASCII)', () => {
    saveMessages(makeMessages())

    const loaded = loadMessages()
    expect(loaded).not.toBeNull()
    expect(loaded).toHaveLength(2)
    expect(loaded?.[0].versions[0].content).toContain(SECRET)
    expect(loaded?.[1].versions[0].content).toContain(ZH_CONTENT)
  })

  it('remains backwards-compatible with legacy plaintext storage', () => {
    // Simulate an older build that wrote raw JSON without obfuscation.
    const envelope = { version: 1, data: makeMessages() }
    localStorage.setItem(
      scopedKey(STORAGE_KEYS.MESSAGES),
      JSON.stringify(envelope)
    )

    const loaded = loadMessages()
    expect(loaded).not.toBeNull()
    expect(loaded).toHaveLength(2)
    expect(loaded?.[0].versions[0].content).toContain(SECRET)
  })
})
