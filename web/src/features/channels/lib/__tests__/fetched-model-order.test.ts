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
import { afterEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { fetchModels, fetchUpstreamModels } from '../../api'

const UNORDERED_MODELS = [
  'deepseek-v4-flash-0916',
  'Qwen3.8-Max',
  'claude-opus-4-5',
  'DeepSeek-v4-flash-1017',
  'Qwen4-Max',
  'claude-opus-4-6',
]

afterEach(() => {
  vi.restoreAllMocks()
})

function familyOrder(models: string[] | undefined, pattern: RegExp): string[] {
  return (models ?? []).filter((model) => pattern.test(model))
}

test('fetchUpstreamModels (edit channel) returns newest-first model list', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: UNORDERED_MODELS },
  })
  const response = await fetchUpstreamModels(1251)
  expect(response.success).toBe(true)
  expect(familyOrder(response.data, /^qwen/i)).toEqual([
    'Qwen4-Max',
    'Qwen3.8-Max',
  ])
  expect(familyOrder(response.data, /deepseek/i)).toEqual([
    'DeepSeek-v4-flash-1017',
    'deepseek-v4-flash-0916',
  ])
  expect(familyOrder(response.data, /claude/i)).toEqual([
    'claude-opus-4-6',
    'claude-opus-4-5',
  ])
})

test('fetchModels (create channel) returns newest-first model list', async () => {
  vi.spyOn(api, 'post').mockResolvedValue({
    data: { success: true, data: UNORDERED_MODELS },
  })
  const response = await fetchModels({
    type: 1,
    base_url: 'https://example.com',
    key: 'test-key',
  })
  expect(familyOrder(response.data, /^qwen/i)).toEqual([
    'Qwen4-Max',
    'Qwen3.8-Max',
  ])
  expect(familyOrder(response.data, /deepseek/i)).toEqual([
    'DeepSeek-v4-flash-1017',
    'deepseek-v4-flash-0916',
  ])
})

test('fetch responses without a model list are passed through unchanged', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: false, message: 'no models' },
  })
  const response = await fetchUpstreamModels(1)
  expect(response).toEqual({ success: false, message: 'no models' })
})
