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
import { describe, expect, it, vi } from 'vitest'

import { useTableUrlState } from '../use-table-url-state'

type Search = Record<string, unknown>

function setup(initialSearch: Search = {}) {
  const navigate = vi.fn()
  const view = renderHook(
    ({ search }: { search: Search }) =>
      useTableUrlState({
        search,
        navigate,
        globalFilter: { enabled: true, key: 'filter' },
      }),
    { initialProps: { search: initialSearch } }
  )
  return { navigate, view }
}

describe('useTableUrlState globalFilter', () => {
  it('rolls the input back when the URL loses the keyword (browser back)', () => {
    const { navigate, view } = setup()

    expect(view.result.current.globalFilter).toBe('')

    // 用户输入关键词：state 立即更新并写回 URL。
    act(() => {
      view.result.current.onGlobalFilterChange?.('abc')
    })
    expect(view.result.current.globalFilter).toBe('abc')
    expect(navigate).toHaveBeenCalledTimes(1)

    // 路由把 URL 变更落地。
    view.rerender({ search: { filter: 'abc' } })
    expect(view.result.current.globalFilter).toBe('abc')

    // 浏览器后退：URL 已经没有 filter，输入框必须跟着回滚。
    view.rerender({ search: {} })
    expect(view.result.current.globalFilter).toBe('')
  })

  it('restores the keyword when navigating forward again', () => {
    const { view } = setup({ filter: 'abc' })

    expect(view.result.current.globalFilter).toBe('abc')

    view.rerender({ search: {} })
    expect(view.result.current.globalFilter).toBe('')

    view.rerender({ search: { filter: 'abc' } })
    expect(view.result.current.globalFilter).toBe('abc')
  })

  it('keeps the freshly typed value when a stale URL write lands late', () => {
    const { navigate, view } = setup()

    act(() => {
      view.result.current.onGlobalFilterChange?.('a')
    })
    act(() => {
      view.result.current.onGlobalFilterChange?.('ab')
    })
    expect(view.result.current.globalFilter).toBe('ab')

    // 第一次导航晚于第二次落地：URL 短暂回显旧值，输入框不能被拉回 'a'。
    view.rerender({ search: { filter: 'a' } })
    expect(view.result.current.globalFilter).toBe('ab')

    view.rerender({ search: { filter: 'ab' } })
    expect(view.result.current.globalFilter).toBe('ab')

    // 同步 effect 只读 URL，绝不触发新的导航（否则会与输入形成回环）。
    expect(navigate).toHaveBeenCalledTimes(2)
  })

  it('ignores navigation that does not touch the keyword', () => {
    const { navigate, view } = setup({ filter: 'abc' })

    view.rerender({ search: { filter: 'abc', page: 3 } })
    expect(view.result.current.globalFilter).toBe('abc')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('still rolls back when an earlier navigation never echoed back', () => {
    const { view } = setup({ filter: 'old' })

    // 输入写入 'abc'，但该次导航被丢弃，URL 始终停在 'old'。
    act(() => {
      view.result.current.onGlobalFilterChange?.('abc')
    })
    expect(view.result.current.globalFilter).toBe('abc')

    // 陈旧的待回显标记不能吞掉这次真实的后退。
    view.rerender({ search: {} })
    expect(view.result.current.globalFilter).toBe('')
  })

  it('does not push an echo entry when the keyword is unchanged', () => {
    const { view } = setup({ filter: 'abc' })

    // 相同关键词不会产生 URL 变化，也就不该留下待回显标记。
    act(() => {
      view.result.current.onGlobalFilterChange?.('abc')
    })

    view.rerender({ search: {} })
    expect(view.result.current.globalFilter).toBe('')
  })
})
