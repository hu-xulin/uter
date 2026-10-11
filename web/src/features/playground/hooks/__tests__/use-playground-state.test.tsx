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
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const loadMessages = vi.hoisted(() => vi.fn())
const saveMessages = vi.hoisted(() => vi.fn())

vi.mock('../../lib', () => ({
  DEFAULT_CONFIG: {},
  DEFAULT_PARAMETER_ENABLED: {},
  saveConfig: vi.fn(),
  saveParameterEnabled: vi.fn(),
  saveMessages,
  applyMessageStateUpdate: vi.fn(),
  getInitialParameterEnabled: vi.fn(() => ({})),
  getInitialPlaygroundConfig: vi.fn(() => ({})),
  loadMessages,
}))

const { usePlaygroundState } = await import('../use-playground-state')

const storedMessage = {
  key: 'stored-1',
  from: 'user',
  versions: [{ id: 'v1', content: 'restored' }],
}

beforeEach(() => {
  loadMessages.mockReset()
  saveMessages.mockReset()
  loadMessages.mockReturnValue([storedMessage])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('usePlaygroundState initial message load', () => {
  it('loads persisted messages after the deferred tick', async () => {
    const { result } = renderHook(() => usePlaygroundState())

    expect(result.current.isLoadingMessages).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoadingMessages).toBe(false)
    })

    expect(result.current.messages).toEqual([storedMessage])
    expect(loadMessages).toHaveBeenCalledTimes(1)
  })

  it('does not touch state after unmounting before the deferred tick', async () => {
    vi.useFakeTimers()

    const { result, unmount } = renderHook(() => usePlaygroundState())
    expect(result.current.isLoadingMessages).toBe(true)

    unmount()

    // 卸载后定时器必须被清掉：既不能再读 localStorage，也不能 setState。
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(loadMessages).not.toHaveBeenCalled()
  })
})
