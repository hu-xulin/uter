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
import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import {
  FetchedPricePreview,
  PricePreviewTable,
} from '../fetched-price-preview'

function pricingItem() {
  return {
    channel_id: 7,
    model_name: 'qwen-plus',
    provider: 'aliyun-bailian',
    region: 'cn-beijing',
    deployment_id: '',
    currency: 'CNY',
    pricing_source: 'bailian-official',
    pricing_status: 'official_only',
    pricing_version: 'v1',
    price_supported: true,
    fetched_at: 1,
    updated_at: 2,
    stale: false,
    fetched_age_hours: 0,
    official: {
      currency: 'CNY',
      unit: 'per_1m_token',
      tiers: [
        {
          range_name: 'Default',
          input_per_million_usd: 2,
          output_per_million_usd: 4,
          unit: 'per_1m_tokens',
        },
      ],
      source: 'bailian-official',
      fetched_at: 1,
    },
    upstream_quote: {
      price_basis: 'CHANNEL_CATALOG',
      currency: 'CNY',
      unit: 'per_1m_token',
      input_per_million_usd: 1.5,
      output_per_million_usd: 3,
      source: 'bailian-official',
    },
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

function renderPreview(
  props: Partial<ComponentProps<typeof FetchedPricePreview>> = {}
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <FetchedPricePreview channelId={7} {...props} />
    </QueryClientProvider>
  )
}

test('fetched price preview shows official and channel prices per model', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: { channel_id: 7, items: [pricingItem()] } },
  })
  renderPreview()

  expect(await screen.findByText('qwen-plus')).toBeVisible()
  expect(screen.getByText('$2.0000 / $4.0000')).toBeVisible()
  expect(screen.getByText('$1.5000 / $3.0000')).toBeVisible()
})

test('fetched price preview keeps Bailian third-party price as channel price only', () => {
  // DeepSeek/GLM are not Alibaba-owned models. Their help-page quote is a
  // Bailian channel price: it belongs in channel_price_tiers and upstream_quote,
  // never in the official price column.
  const bailianRow = {
    ...pricingItem(),
    model_name: 'deepseek-v4.1-flash',
    official: {
      ...pricingItem().official,
      tiers: [],
      channel_price_tiers: [
        {
          range_name: 'Default',
          input_per_million_usd: 2,
          output_per_million_usd: 4,
          unit: 'per_1m_token',
        },
      ],
    },
    upstream_quote: {
      ...pricingItem().upstream_quote,
      price_basis: 'CHANNEL_CATALOG',
      input_per_million_usd: 2,
      output_per_million_usd: 4,
    },
  }

  render(<PricePreviewTable items={[bailianRow]} />)

  expect(screen.getByText('Not available')).toBeVisible()
  expect(screen.getByText('$2.0000 / $4.0000')).toBeVisible()
  expect(screen.queryByText('$1.5000 / $3.0000')).not.toBeInTheDocument()
})

test('fetched price preview remaps saved upstream prices to unsaved redirect aliases', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: { channel_id: 7, items: [pricingItem()] } },
  })
  renderPreview({
    modelMapping: '{"qwen-alias":"qwen-plus"}',
    models: ['qwen-alias'],
  })

  expect(await screen.findByText('qwen-alias')).toBeVisible()
  expect(screen.queryByText('qwen-plus')).not.toBeInTheDocument()
  expect(screen.getByText('$2.0000 / $4.0000')).toBeVisible()
  expect(screen.getByText('$1.5000 / $3.0000')).toBeVisible()
})

test('fetched price preview surfaces draft and fetch failures with retry', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: { channel_id: 7, items: [] } },
  })
  const onRetrySetup = vi.fn()
  const onRetryFetch = vi.fn()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={client}>
      <FetchedPricePreview
        channelId={0}
        setupState='failed'
        setupError='draft failed'
        onRetrySetup={onRetrySetup}
      />
    </QueryClientProvider>
  )
  expect(screen.getByText('draft failed')).toBeVisible()
  screen.getByRole('button', { name: 'Retry' }).click()
  expect(onRetrySetup).toHaveBeenCalledTimes(1)

  view.rerender(
    <QueryClientProvider client={client}>
      <FetchedPricePreview
        channelId={7}
        fetchState='failed'
        onRetryFetch={onRetryFetch}
      />
    </QueryClientProvider>
  )
  expect(
    screen.getByText('Failed to fetch prices from the catalog')
  ).toBeVisible()
  screen.getByRole('button', { name: 'Retry' }).click()
  expect(onRetryFetch).toHaveBeenCalledTimes(1)
})

test('fetched price preview shows a sync hint when the catalog is empty', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: { channel_id: 7, items: [] } },
  })
  renderPreview()

  expect(
    await screen.findByText(
      'No prices fetched yet. Sync the channel catalog first.'
    )
  ).toBeVisible()
})

test('price preview header stays fixed while only the rows scroll', () => {
  render(<PricePreviewTable items={[pricingItem()]} />)

  const header = screen.getByText('Model').parentElement
  expect(header).toHaveClass('sticky', 'top-0', 'z-10', 'bg-muted')
  // 表头必须钉在滚动容器里；若容器不滚动，sticky 会失效。
  expect(header?.parentElement).toHaveClass('max-h-80', 'overflow-y-auto')
})

test('fetched price preview hides catalog rows for models the channel no longer serves', async () => {
  // 复现渠道 1271「优特-百炼」：渠道只发布 23 个模型，但同步过的目录把 168
  // 个模型的价格全写进了价格表。获取价格步骤不能把 145 个已下架模型显示出来。
  const staleRow = {
    ...pricingItem(),
    model_name: 'MiniMax-M2.5',
    official: {
      ...pricingItem().official,
      tiers: [
        {
          range_name: 'Default',
          input_per_million_usd: 11,
          output_per_million_usd: 22,
          unit: 'per_1m_tokens',
        },
      ],
    },
  }
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: { channel_id: 7, items: [staleRow, pricingItem()] },
    },
  })
  renderPreview({ models: ['qwen-plus'] })

  expect(await screen.findByText('qwen-plus')).toBeVisible()
  expect(screen.queryByText('MiniMax-M2.5')).not.toBeInTheDocument()
  expect(screen.queryByText('$11.0000 / $22.0000')).not.toBeInTheDocument()
})

test('needs_review row never renders the official price as the channel price', async () => {
  // 复现截图 claude-fable-5 等 6 行：后端 channelUpstreamQuote 回落到
  // OFFICIAL_REFERENCE 填入 upstream_quote（$10/$50），但渠道价真实为空。
  // 界面必须显示"不可用"，不能把官方价冒充渠道价。
  const needsReviewRow = {
    ...pricingItem(),
    model_name: 'claude-fable-5',
    pricing_status: 'needs_review',
    upstream_quote: {
      price_basis: 'OFFICIAL_REFERENCE',
      currency: 'USD',
      unit: 'per_1m_token',
      input_per_million_usd: 10,
      output_per_million_usd: 50,
      source: 'uterroute-expression',
    },
  }
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: { channel_id: 7, items: [needsReviewRow] } },
  })
  renderPreview()

  expect(await screen.findByText('claude-fable-5')).toBeVisible()
  // 官方价列（fixture 为 $2/$4）仍显示；渠道价列必须显示"不可用"，
  // 绝不能把 upstream_quote 里的 $10/$50 渲染出来。
  expect(screen.getByText('$2.0000 / $4.0000')).toBeVisible()
  expect(screen.queryByText('$10.0000 / $50.0000')).not.toBeInTheDocument()
  expect(screen.getByText('Not available')).toBeVisible()
})

// In the create wizard, no draft channel exists until the operator explicitly
// asks for one. The preview must expose that action in the idle state instead
// of showing a permanent "Preparing the draft channel..." message with no
// way forward (channelId 0 means "not created yet").
test('idle preview without a draft channel exposes a create-draft action', () => {
  const onRetrySetup = vi.fn()
  renderPreview({ channelId: 0, setupState: 'idle', onRetrySetup })

  expect(
    screen.queryByText('Preparing the draft channel...')
  ).not.toBeInTheDocument()
  const button = screen.getByRole('button', { name: 'Create draft channel' })
  button.click()
  expect(onRetrySetup).toHaveBeenCalledTimes(1)
})

// Editing a channel: after the operator reselects models in the "fetch models"
// step, the price preview must re-fetch for the new selection. A queryKey that
// only contains channelId leaves the old cached rows in place, so the new
// models are silently shown as "Not available".
test('fetched price preview re-queries when the selected models change', async () => {
  const getSpy = vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: { channel_id: 7, items: [pricingItem()] } },
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const { rerender } = render(
    <QueryClientProvider client={client}>
      <FetchedPricePreview channelId={7} models={['qwen-plus']} />
    </QueryClientProvider>
  )
  expect(await screen.findByText('qwen-plus')).toBeVisible()
  const callsAfterFirst = getSpy.mock.calls.length

  rerender(
    <QueryClientProvider client={client}>
      <FetchedPricePreview channelId={7} models={['qwen-plus', 'new-model']} />
    </QueryClientProvider>
  )

  await vi.waitFor(() => {
    expect(getSpy.mock.calls.length).toBeGreaterThan(callsAfterFirst)
  })
})
