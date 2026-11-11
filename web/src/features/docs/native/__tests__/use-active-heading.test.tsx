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
import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useActiveHeading } from '../use-active-heading'

/**
 * jsdom 不做布局，`getBoundingClientRect()` 恒为 0 —— 直接跑 hook 会得到
 * 「所有标题都在阅读线以上」的假结果。这里按 id 给出真实的 top 值，
 * 才能验证「最后一个滚过阅读线的标题」这条判据本身。
 *
 * 视口同样要给出：jsdom 的 `scrollHeight` 是 0，而 `innerHeight` 是 768，
 * 于是「是否滚到底部」的分支恒为真，任何用例都会落到最后一个标题上。
 */
function stubHeadingTops(tops: Record<string, number>) {
  vi.spyOn(document, 'querySelector').mockImplementation((selector: string) => {
    const id = selector.replace(/^#/, '')
    const top = tops[id]
    if (top === undefined) return null
    return {
      getBoundingClientRect: () => ({ top }) as DOMRect,
    } as unknown as Element
  })
}

function stubViewport({
  scrollY = 0,
  innerHeight = 600,
  scrollHeight = 5000,
} = {}) {
  vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(
    scrollHeight
  )
  vi.spyOn(window, 'scrollY', 'get').mockReturnValue(scrollY)
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(innerHeight)
}

describe('useActiveHeading', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('picks the last heading that has scrolled past the reading line', () => {
    stubHeadingTops({ a: -400, b: -120, c: 60, d: 500 })
    stubViewport()

    const { result } = renderHook(() => useActiveHeading(['a', 'b', 'c', 'd']))

    // 阅读线 96px：c 的 top=60 已经越过，d 还没到，所以当前是 c。
    expect(result.current).toBe('c')
  })

  it('falls back to the first heading before any of them reach the line', () => {
    stubHeadingTops({ a: 300, b: 700 })
    stubViewport()

    const { result } = renderHook(() => useActiveHeading(['a', 'b']))

    expect(result.current).toBe('a')
  })

  it('marks the last heading active at the bottom of the page', () => {
    // 页面滚到底时最后一个标题可能永远够不到阅读线，否则末尾几节点不亮。
    stubHeadingTops({ a: -900, b: -300, c: 40 })
    stubViewport({ scrollY: 400, innerHeight: 600, scrollHeight: 1000 })

    const { result } = renderHook(() => useActiveHeading(['a', 'b', 'c']))

    expect(result.current).toBe('c')
  })

  it('returns null for an empty outline', () => {
    stubViewport()

    const { result } = renderHook(() => useActiveHeading([]))

    expect(result.current).toBeNull()
  })
})
