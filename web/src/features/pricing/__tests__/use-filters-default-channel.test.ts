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
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { useFilters } from '../hooks/use-filters'
import type { PricingModel } from '../types'

const { mockSearch } = vi.hoisted(() => ({
  mockSearch: { value: {} as Record<string, unknown> },
}))

vi.mock('@tanstack/react-router', () => ({
  useSearch: () => mockSearch.value,
}))

function model(
  id: number,
  modelName: string,
  channels: string[]
): PricingModel {
  return {
    id,
    model_name: modelName,
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: ['default'],
    channels,
  }
}

const catalog = [
  model(1, 'claude-sonnet-4', ['Claude-Basic', 'Claude-Pro']),
  model(2, 'gpt-5', ['GPT-Pro']),
  model(3, 'qwen3-8b', ['优特-百炼']),
]

function shownModels(result: { current: ReturnType<typeof useFilters> }) {
  return result.current.filteredModels.map((item) => item.model_name)
}

describe('定价页默认渠道筛选', () => {
  beforeEach(() => {
    mockSearch.value = {}
  })

  test('URL 无 channel 参数时默认展示 Claude-Basic 承载的模型', () => {
    const { result } = renderHook(() => useFilters(catalog))

    expect(result.current.channelFilter).toBe('Claude-Basic')
    expect(shownModels(result)).toEqual(['claude-sonnet-4'])
    expect(result.current.activeFilterCount).toBe(1)
  })

  test('URL 显式 channel=all 时仍然展示所有渠道', () => {
    mockSearch.value = { channel: 'all' }
    const { result } = renderHook(() => useFilters(catalog))

    expect(result.current.channelFilter).toBe('all')
    expect(shownModels(result).sort()).toEqual(
      ['claude-sonnet-4', 'gpt-5', 'qwen3-8b'].sort()
    )
  })

  test('URL 指定其他渠道时不被默认值覆盖', () => {
    mockSearch.value = { channel: 'GPT-Pro' }
    const { result } = renderHook(() => useFilters(catalog))

    expect(result.current.channelFilter).toBe('GPT-Pro')
    expect(shownModels(result)).toEqual(['gpt-5'])
  })

  test('用户手动切回「所有渠道」后保持清空状态', () => {
    const { result } = renderHook(() => useFilters(catalog))

    act(() => result.current.setChannelFilter('all'))

    expect(result.current.channelFilter).toBe('all')
    expect(shownModels(result).sort()).toEqual(
      ['claude-sonnet-4', 'gpt-5', 'qwen3-8b'].sort()
    )
  })

  test('目录中没有 Claude-Basic 时降级展示全部模型，避免空列表', () => {
    const withoutDefault = [
      model(1, 'gpt-5', ['GPT-Pro']),
      model(2, 'qwen3-8b', ['优特-百炼']),
    ]
    const { result } = renderHook(() => useFilters(withoutDefault))

    expect(result.current.channelFilter).toBe('all')
    expect(shownModels(result).sort()).toEqual(['gpt-5', 'qwen3-8b'].sort())
  })
})
