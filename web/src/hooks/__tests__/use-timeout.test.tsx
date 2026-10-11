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
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useTimeout } from '../use-timeout'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useTimeout', () => {
  it('runs the callback after the delay', () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useTimeout())

    act(() => {
      result.current.schedule(callback, 2000)
    })

    expect(callback).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1999)
    })
    expect(callback).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('replaces the pending callback when scheduled again', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { result } = renderHook(() => useTimeout())

    act(() => {
      result.current.schedule(first, 1000)
      vi.advanceTimersByTime(500)
      result.current.schedule(second, 1000)
    })

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    // 旧回调被丢弃，不会造成「刚复制就立刻复位」这类竞态。
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('does not fire after unmount', () => {
    const callback = vi.fn()
    const { result, unmount } = renderHook(() => useTimeout())

    act(() => {
      result.current.schedule(callback, 1000)
    })

    unmount()

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(callback).not.toHaveBeenCalled()
  })

  it('clear() cancels the pending callback', () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useTimeout())

    act(() => {
      result.current.schedule(callback, 1000)
      result.current.clear()
    })

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(callback).not.toHaveBeenCalled()
  })

  it('clear() is a no-op when nothing is scheduled', () => {
    const { result } = renderHook(() => useTimeout())

    expect(() => {
      result.current.clear()
    }).not.toThrow()
  })

  it('defaults to a zero delay', () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useTimeout())

    act(() => {
      result.current.schedule(callback)
    })

    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('keeps a stable identity for schedule and clear', () => {
    const { result, rerender } = renderHook(() => useTimeout())
    const firstSchedule = result.current.schedule
    const firstClear = result.current.clear

    rerender()

    expect(result.current.schedule).toBe(firstSchedule)
    expect(result.current.clear).toBe(firstClear)
  })
})
