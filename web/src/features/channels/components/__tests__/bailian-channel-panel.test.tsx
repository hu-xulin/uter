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
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { BailianChannelPanel } from '../bailian-channel-panel'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}))

let client: QueryClient
let status: unknown
let coverage: unknown

function renderPanel(
  opts: { channelId?: number | null; baseUrl?: string } = {}
) {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <BailianChannelPanel
        channelId={opts.channelId === undefined ? 88 : opts.channelId}
        baseUrl={opts.baseUrl ?? ''}
        onCreateDraft={undefined}
        onChangeBaseUrl={() => undefined}
      />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  status = { synced: false }
  coverage = { models: [], unmatched: 0 }
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/ratio_sync/bailian/status') {
      return { data: { success: true, data: status } }
    }
    if (typeof url === 'string' && url.includes('/bailian/coverage')) {
      return { data: { success: true, data: coverage } }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

// ── 状态三态 ────────────────────────────────────────────────────

test('百炼面板未同步时显示 Not synced yet', async () => {
  renderPanel()
  expect(await screen.findByText('Not synced yet')).toBeVisible()
})

test('百炼面板 finished_at 存在时显示 Synced', async () => {
  status = {
    synced: true,
    post_create: {
      steps: [],
      finished_at: 1,
      actual_models: 3,
      catalog_models: 5,
      matched_models: 3,
      reference_prices: 2,
    },
  }
  renderPanel()
  expect(await screen.findByText('Synced')).toBeVisible()
})

// ── 工作区解析 ──────────────────────────────────────────────────

test('百炼面板从 workspace URL 解析出区域与 workspace id', async () => {
  renderPanel({
    baseUrl: 'https://myws.cn-beijing.maas.aliyuncs.com/api/v1',
  })
  expect(await screen.findByDisplayValue('myws')).toBeVisible()
  expect(screen.getByRole('combobox', { name: 'Region' })).toHaveTextContent(
    'cn-beijing'
  )
})

test('外部 base_url 改变后 workspace 输入框同步刷新', async () => {
  const { rerender } = renderPanel({
    baseUrl: 'https://ws-a.cn-beijing.maas.aliyuncs.com/api/v1',
  })
  expect(await screen.findByDisplayValue('ws-a')).toBeVisible()

  rerender(
    <QueryClientProvider client={client}>
      <BailianChannelPanel
        channelId={88}
        baseUrl='https://ws-b.cn-shanghai.maas.aliyuncs.com/api/v1'
        onCreateDraft={undefined}
        onChangeBaseUrl={() => undefined}
      />
    </QueryClientProvider>
  )
  expect(await screen.findByDisplayValue('ws-b')).toBeVisible()
})

// ── 同步按钮 ────────────────────────────────────────────────────

test('百炼面板 Sync channel catalog 触发 refresh 并提示成功', async () => {
  const user = userEvent.setup()
  const postSpy = vi.spyOn(api, 'post').mockResolvedValue({
    data: { success: true, data: { actual_models: 3 } },
  } as never)
  renderPanel({ channelId: 88 })

  await user.click(screen.getByRole('button', { name: 'Sync channel catalog' }))

  await waitFor(() =>
    expect(postSpy).toHaveBeenCalledWith(
      '/api/ratio_sync/bailian/catalog/refresh',
      expect.objectContaining({ channel_id: 88 })
    )
  )
  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith('Channel catalog synchronized')
  )
})

test('百炼面板 Apply catalog metadata 触发 apply', async () => {
  const user = userEvent.setup()
  const postSpy = vi.spyOn(api, 'post').mockResolvedValue({
    data: { success: true, data: {} },
  } as never)
  renderPanel({ channelId: 88 })

  await user.click(
    screen.getByRole('button', { name: 'Apply catalog metadata' })
  )

  await waitFor(() =>
    expect(postSpy).toHaveBeenCalledWith(
      '/api/ratio_sync/bailian/catalog/apply',
      expect.objectContaining({ channel_id: 88 })
    )
  )
})

test('百炼面板 refresh 失败时提示错误 toast', async () => {
  const user = userEvent.setup()
  vi.spyOn(api, 'post').mockRejectedValue(new Error('catalog refresh down'))
  renderPanel({ channelId: 88 })

  await user.click(screen.getByRole('button', { name: 'Sync channel catalog' }))

  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith('catalog refresh down')
  )
})

// ── coverage 块 ─────────────────────────────────────────────────

test('百炼面板 coverage 有未匹配模型时显示未匹配清单', async () => {
  coverage = {
    matched: 2,
    channel_models: 3,
    unmatched: 1,
    models: [
      { model_name: 'qwen-unmatched', in_catalog: false, action: 'review' },
    ],
  }
  renderPanel({ channelId: 88 })
  expect(await screen.findByText(/Catalog coverage/)).toBeVisible()
  expect(screen.getByText(/1 unmatched/)).toBeVisible()
  expect(screen.getByText(/qwen-unmatched/)).toBeVisible()
})
