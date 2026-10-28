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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { createInstance } from 'i18next'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import { useApiKeysColumns } from '../api-keys-columns'

// The API keys table used to overflow horizontally: the declared column sizes
// summed to ~1800px, so the trailing Actions column sat outside the viewport
// and required a sideways scroll. These tests pin the width budget so a future
// column addition cannot silently push the actions column off-screen again.
//
// The budget is the desktop content width at the common laptop breakpoints:
//   viewport - sidebar (208px) - page horizontal padding (32px)
// 1366px is the tightest viewport we still treat as a "desktop" one here.

const i18n = createInstance()
await i18n.init({
  lng: 'en',
  resources: { en: { translation: {} } },
  initAsync: false,
})

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </QueryClientProvider>
  )
}

const CONTENT_WIDTH_1366 = 1366 - 208 - 32
// Row actions are content sized (not part of the declared sizes); reserve the
// measured real-world width of the two icon buttons plus the overflow menu.
const ACTIONS_RESERVE = 110

describe('API keys table column width budget', () => {
  beforeEach(() => {
    useSystemConfigStore.setState((state) => ({
      config: { ...state.config, currency: { ...DEFAULT_CURRENCY_CONFIG } },
    }))
    // getUserGroups is fired by the columns hook; keep it from hitting the network.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ success: true, data: {} }),
      })
    )
  })

  it('keeps the declared sizes plus row actions within a 1366px viewport', () => {
    const { result } = renderHook(() => useApiKeysColumns(Date.now()), {
      wrapper,
    })
    const total = result.current.reduce((sum, column) => {
      // `actions` renders its content without a declared size by design.
      if (column.id === 'actions') return sum
      return sum + (column.size ?? 0)
    }, 0)

    expect(total + ACTIONS_RESERVE).toBeLessThanOrEqual(CONTENT_WIDTH_1366)
  })

  it('never shrinks an interactive column below a usable touch target', () => {
    const { result } = renderHook(() => useApiKeysColumns(Date.now()), {
      wrapper,
    })
    for (const column of result.current) {
      if (column.id === 'actions') continue
      // Checkbox column may be as narrow as an icon; text columns must not
      // collapse to the point where the header label is unreadable.
      const floor = column.id === 'select' ? 24 : 72
      expect(
        column.size ?? 0,
        `${column.id} is below its floor`
      ).toBeGreaterThanOrEqual(floor)
    }
  })

  /**
   * 脱敏密钥与分组是「必须完整可读」的两列，不能只满足 72px 的通用下限。
   *
   * 回归背景：`key` 曾是 140px、`group` 曾是 78px，结果
   *  - 密钥只剩 `sk-3Enj****…`，复制按钮被挤到第二行；
   *  - 分组只剩 `VI…`，`VIP0` 被截断，倍率徽标却还在。
   * 两列都需要「内容宽度 + 交互控件」的实测预算，所以单独钉住。
   */
  it('reserves room for the masked key and the group badge', () => {
    const { result } = renderHook(() => useApiKeysColumns(Date.now()), {
      wrapper,
    })
    // 这里拿到的是 ColumnDef 而不是 TanStack 的 Column 实例：
    // 只有显式写了 `id` 的列才有 id，其余列（如 `group`）的身份在 `accessorKey` 上。
    // ColumnDef 是联合类型，`accessorKey` 只存在于其中一支，故先断言成结构类型再取。
    type ColumnKey = { id?: string; accessorKey?: string }
    const sizeOf = (id: string) => {
      const column = result.current.find((item) => {
        const key = item as unknown as ColumnKey
        return (key.id ?? key.accessorKey) === id
      })
      return column?.size ?? 0
    }

    // 脱敏密钥 = `sk-` + 16 位 + 尾号 = 21 个等宽字符。
    // 14px 等宽字宽约 8.4px → 176px；再加 28px 复制按钮与间距。
    const MASKED_KEY_CHARS = 21
    const MONO_CHAR_PX = 8.4
    const COPY_BUTTON_PX = 28
    expect(sizeOf('key')).toBeGreaterThanOrEqual(
      Math.ceil(MASKED_KEY_CHARS * MONO_CHAR_PX) + COPY_BUTTON_PX
    )

    // 分组列 = 分组名（`VIP0` ≈ 35px）+ 间距 + 倍率徽标（`1x` ≈ 30px）+ 单元格内边距。
    expect(sizeOf('group')).toBeGreaterThanOrEqual(100)
  })
})
