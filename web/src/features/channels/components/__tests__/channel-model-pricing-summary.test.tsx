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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

import { getChannelBillingSnapshots, getChannelModelPricing } from '../../api'
import { ChannelModelPricingSection } from '../channel-model-pricing-section'

vi.mock('../../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api')>()
  return {
    ...actual,
    getChannelModelPricing: vi.fn(),
    getChannelBillingSnapshots: vi.fn(),
  }
})

function record(
  modelName: string,
  provider: string,
  pricingStatus: 'configured' | 'needs_review'
) {
  return {
    channel_id: 1233,
    model_name: modelName,
    provider,
    region: '',
    deployment_id: '',
    currency: 'USD',
    pricing_source: 'uterroute-official',
    pricing_status: pricingStatus,
    pricing_version: 'v1',
    price_supported: true,
    fetched_at: 1,
    updated_at: 1,
    stale: false,
    fetched_age_hours: 0,
  }
}

function renderSection(
  options: { modelMapping?: string; publishedModels?: string[] } = {}
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <ChannelModelPricingSection channelId={1233} {...options} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getChannelBillingSnapshots).mockResolvedValue({
    success: true,
    data: { items: [] },
  } as never)
})

test('counts unique models, not provider rows, and surfaces the review filter', async () => {
  const user = userEvent.setup()
  // m-a exists under two providers after the historical double sync: a
  // duplicate configured row must not inflate the model count.
  vi.mocked(getChannelModelPricing).mockResolvedValue({
    success: true,
    data: {
      items: [
        record('m-a', 'uterroute', 'configured'),
        record('m-a', 'newapi-compatible', 'configured'),
        record('m-b', 'uterroute', 'configured'),
        record('m-c', 'uterroute', 'needs_review'),
      ],
    },
  } as never)

  renderSection()
  await waitFor(() =>
    expect(screen.getByText(/3 models · 2 configured · 1 review/)).toBeVisible()
  )

  const toggle = screen.getByRole('button', { name: /Needs review/ })
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await user.click(toggle)
  expect(toggle).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('m-c')).toBeVisible()
  expect(screen.queryByText('m-a')).not.toBeInTheDocument()
  expect(screen.queryByText('m-b')).not.toBeInTheDocument()

  await user.click(toggle)
  // m-a still renders both provider rows once the filter is released; the
  // assertion only cares that the model is visible again.
  expect(screen.getAllByText('m-a').length).toBeGreaterThan(0)
  expect(screen.getByText('m-b')).toBeInTheDocument()
})

test('shows only published aliases when the channel uses redirects', async () => {
  vi.mocked(getChannelModelPricing).mockResolvedValue({
    success: true,
    data: {
      items: [
        record('MiniMax-H3-Max', 'uterroute', 'configured'),
        record('MiniMax-H3-Max-dr', 'uterroute', 'configured'),
        record('Unmapped-Model', 'uterroute', 'configured'),
      ],
    },
  } as never)

  renderSection({
    modelMapping: '{"MiniMax-H3-Max-dr":"MiniMax-H3-Max"}',
    publishedModels: ['MiniMax-H3-Max-dr'],
  })

  await waitFor(() =>
    expect(screen.getByText(/1 models · 1 configured · 0 review/)).toBeVisible()
  )
  expect(screen.getByText('MiniMax-H3-Max-dr')).toBeVisible()
  expect(screen.queryByText('MiniMax-H3-Max')).not.toBeInTheDocument()
  expect(screen.queryByText('Unmapped-Model')).not.toBeInTheDocument()
})

test('keeps Bailian third-party price as channel price only', async () => {
  // 非阿里系模型在阿里云帮助页上的价格是百炼渠道价，不能显示为官方价。
  const bailianRecord = {
    ...record('glm-5.2', 'alibaba-bailian', 'configured'),
    official: {
      currency: 'USD',
      unit: 'per_1m_token',
      tiers: [],
      channel_price_tiers: [
        {
          range_name: 'Default',
          unit: 'per_1m_token',
          input_per_million_usd: 8,
          output_per_million_usd: 28,
        },
      ],
      source: 'bailian-official',
      fetched_at: 1,
      currency_inferred: true,
    },
  }
  vi.mocked(getChannelModelPricing).mockResolvedValue({
    success: true,
    data: { items: [bailianRecord] },
  } as never)

  renderSection()
  await waitFor(() =>
    expect(screen.getByText(/Upstream official price:/)).toHaveTextContent(
      'Not available'
    )
  )
  expect(
    screen.getByText(/Upstream channel price tiers \(1\)/)
  ).toBeVisible()
})

test('applies the same alias-only rule to a different channel mapping', async () => {
  vi.mocked(getChannelModelPricing).mockResolvedValue({
    success: true,
    data: {
      items: [
        record('gpt-5-upstream', 'uterroute', 'configured'),
        record('gpt-5-upstream-dr', 'uterroute', 'configured'),
        record('claude-upstream-dr', 'uterroute', 'configured'),
      ],
    },
  } as never)

  renderSection({
    modelMapping: '{"gpt-5-upstream-dr":"gpt-5-upstream"}',
    publishedModels: ['gpt-5-upstream-dr'],
  })

  await waitFor(() =>
    expect(screen.getByText(/1 models · 1 configured · 0 review/)).toBeVisible()
  )
  expect(screen.getByText('gpt-5-upstream-dr')).toBeVisible()
  expect(screen.queryByText('gpt-5-upstream')).not.toBeInTheDocument()
  expect(screen.queryByText('claude-upstream-dr')).not.toBeInTheDocument()
})

test('a duplicate configured row cannot hide a model awaiting review', async () => {
  vi.mocked(getChannelModelPricing).mockResolvedValue({
    success: true,
    data: {
      items: [
        record('m-a', 'uterroute', 'needs_review'),
        record('m-a', 'newapi-compatible', 'configured'),
      ],
    },
  } as never)

  renderSection()
  await waitFor(() =>
    expect(screen.getByText(/1 models · 0 configured · 1 review/)).toBeVisible()
  )
})
