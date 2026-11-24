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
import { beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { ChannelPricingPanel } from '../channel-pricing-panel'

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url.endsWith('/model_pricing/schedule')) {
      return {
        data: {
          success: true,
          data: { channel_id: 7, enabled: false, schedule: {} },
        },
      }
    }
    if (url.endsWith('/model_pricing/reviews')) {
      return { data: { success: true, data: { channel_id: 7, items: [] } } }
    }
    if (url.endsWith('/model_pricing/history')) {
      return { data: { success: true, data: { channel_id: 7, items: [] } } }
    }
    if (url.endsWith('/sync_capabilities')) {
      return {
        data: {
          success: true,
          data: {
            provider: {
              capabilities: {
                official_pricing: { status: 'SUPPORTED' },
                channel_pricing: { status: 'SUPPORTED' },
                token_pricing: { status: 'SUPPORTED' },
                image_pricing: { status: 'SUPPORTED' },
                video_pricing: { status: 'SUPPORTED' },
                audio_pricing: { status: 'SUPPORTED' },
                per_call_pricing: { status: 'SUPPORTED' },
                per_second_pricing: { status: 'SUPPORTED' },
                per_minute_pricing: { status: 'SUPPORTED' },
                deployment_pricing: { status: 'SUPPORTED' },
              },
              sync_frequency: '',
            },
          },
        },
      }
    }
    if (url.endsWith('/pricing_audit')) {
      return { data: { success: true, data: null } }
    }
    if (url.endsWith('/model_pricing')) {
      return {
        data: {
          success: true,
          data: {
            channel_id: 7,
            items: [
              {
                channel_id: 7,
                model_name: 'qwen-plus',
                provider: 'aliyun-bailian',
                region: 'cn-beijing',
                currency: 'CNY',
                pricing_source: 'bailian-official',
                pricing_status: 'official_only',
                pricing_version: 'v1',
                fetched_at: 1,
                updated_at: 2,
                official: {
                  currency: 'CNY',
                  unit: 'per_1m_token',
                  tiers: [
                    {
                      range_name: 'Default',
                      input_per_million_usd: 2,
                      output_per_million_usd: 4,
                      unit: 'per_1m_token',
                    },
                  ],
                  source: 'bailian-official',
                  fetched_at: 1,
                  component_prices: [
                    {
                      name: 'Voice cloning',
                      type: 'tts_vc_model',
                      unit: 'per_call',
                      usd: 9.9,
                    },
                  ],
                },
              },
            ],
          },
        },
      }
    }
    return { data: { success: true, data: { items: [] } } }
  })
})

function renderPanel(
  options: { showSchedule?: boolean; configureOnly?: boolean } = {}
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <ChannelPricingPanel
        channelId={7}
        baseUrl='https://example.com'
        showSchedule={options.showSchedule}
        configureOnly={options.configureOnly}
      />
    </QueryClientProvider>
  )
}

test('pricing selects render translated labels instead of raw enum values', async () => {
  renderPanel()

  expect(
    (await screen.findAllByText('Fixed multiplier')).length
  ).toBeGreaterThan(0)
  expect(screen.getAllByText('Official price').length).toBeGreaterThan(0)
  expect(screen.getAllByText('All models').length).toBeGreaterThan(0)
  expect(screen.queryByText('multiply')).not.toBeInTheDocument()
  expect(screen.queryByText('official')).not.toBeInTheDocument()
})

test('channel model row lists additional service prices next to the token tier', async () => {
  renderPanel()

  expect(await screen.findByText(/Additional service price/)).toBeVisible()
  expect(screen.getByText(/Voice cloning/)).toBeVisible()
})

test('automatic update cadence exposes labels without touching sale prices', async () => {
  renderPanel()

  expect(
    await screen.findByText(/Scheduled price update|Automatic updates/)
  ).toBeVisible()
  for (const label of [
    'Enabled',
    'Official price interval (minutes)',
    'Channel price interval (minutes)',
  ]) {
    expect(screen.getByText(label)).toBeVisible()
  }
  expect(screen.getByRole('button', { name: 'Save schedule' })).toBeVisible()
  // The model list is owned by upstream model detection; the cadence section
  // must not expose a second model-sync timer.
  expect(
    screen.queryByText('Model sync interval (minutes)')
  ).not.toBeInTheDocument()
})
test('official-only rows expose an explicit adopt-official-price action', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({
    data: { success: true, data: { seeded: 1, skipped: 0 } },
  })
  renderPanel()

  const button = await screen.findByRole('button', {
    name: 'Use official prices',
  })
  await waitFor(() => expect(button).toBeEnabled())
  await button.click()
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/api/channel/7/model_pricing/seed',
      { overwrite: false },
      expect.anything()
    )
  )
})

test('renders official, channel and default-marked Uter prices separately', async () => {
  const previous = vi.mocked(api.get).getMockImplementation()
  vi.spyOn(api, 'get').mockImplementation(async (url, ...args) => {
    if (url.endsWith('/model_pricing')) {
      return {
        data: {
          success: true,
          data: {
            channel_id: 7,
            items: [
              {
                channel_id: 7,
                model_name: 'claude-fable-5',
                provider: 'uterroute',
                region: '',
                currency: 'USD',
                pricing_source: 'uterroute-official',
                pricing_status: 'configured',
                pricing_version: 'v1',
                fetched_at: Math.floor(Date.now() / 1000),
                updated_at: Math.floor(Date.now() / 1000),
                official: {
                  currency: 'USD',
                  unit: 'expression',
                  tiers: null,
                  price_kind: 'BILLING_EXPRESSION',
                  source: 'uterroute-expression',
                  fetched_at: Math.floor(Date.now() / 1000),
                  billing_expr: 'tier("base", p * 10 + c * 50)',
                  expression_status: 'EXECUTABLE',
                },
                upstream_quote: {
                  price_basis: 'CHANNEL_DISCOUNT',
                  currency: 'USD',
                  unit: 'per_1m_token',
                  input_per_million_usd: 6,
                  output_per_million_usd: 30,
                  discount_ratio: 0.6,
                  source: 'uterroute-discount',
                },
                internal: {
                  mode: 'tiered_expr',
                  billing_expr: '((tier("base", p * 10 + c * 50)) * 0.6) * 1.1',
                  source: 'uterroute-discount',
                  discount_ratio: 0.6,
                },
              },
            ],
          },
        },
      }
    }
    if (previous) return previous(url, ...args)
    return { data: { success: true, data: { items: [] } } }
  })

  renderPanel()
  expect(await screen.findByText(/\$6\.0000 \/ \$30\.0000/)).toBeVisible()
  expect(await screen.findByText(/Uter sale price: Expression/)).toBeVisible()
})

test('create wizard hides the schedule because Automatic updates owns it', async () => {
  renderPanel({ showSchedule: false })

  expect((await screen.findAllByText('All models')).length).toBeGreaterThan(0)
  expect(
    screen.queryByText(/Scheduled price update|Automatic updates/)
  ).not.toBeInTheDocument()
})

test('creation pricing step keeps only configuration controls', async () => {
  renderPanel({ configureOnly: true })

  expect(await screen.findByText('Batch pricing')).toBeVisible()
  expect(await screen.findByText('qwen-plus')).toBeVisible()
  for (const hidden of [
    'Upstream catalog',
    /Scheduled price update|Automatic updates/,
    'Pending price reviews',
    'Sync diagnostics',
    'Upstream parity',
    'Upstream reconciliation',
    'Price source audit',
    'Recent price changes',
  ]) {
    expect(screen.queryByText(hidden)).not.toBeInTheDocument()
  }
})

test('batch pricing preview keeps every table header sticky in the scroll container', async () => {
  vi.spyOn(api, 'post').mockResolvedValue({
    data: {
      success: true,
      data: {
        basis: 'official',
        mode: 'multiply',
        value: 0.6,
        dry_run: true,
        updated: 1,
        items: [
          {
            model_name: 'claude-fable-5',
            mode: 'per_1m_token',
            version: 'v1',
            input_per_million_usd: 6,
            output_per_million_usd: 30,
            cache_per_million_usd: 0.6,
            create_cache_per_million_usd: 8.25,
          },
        ],
        skipped: [
          { model_name: 'wan3.0-video', reason: 'multiple price tiers' },
        ],
      },
    },
  })

  renderPanel({ configureOnly: true })
  const previewButton = await screen.findByRole('button', { name: 'Preview' })
  await waitFor(() => expect(previewButton).toBeEnabled())
  await previewButton.click()

  const headers = await screen.findAllByRole('columnheader')
  expect(headers).toHaveLength(6)
  for (const header of headers) {
    expect(header).toHaveClass('sticky', 'top-0', 'bg-muted')
  }
})

test('batch pricing preview shows the scaled expression for expression-priced models', async () => {
  vi.spyOn(api, 'post').mockResolvedValue({
    data: {
      success: true,
      data: {
        basis: 'channel',
        mode: 'markup',
        value: 0.1,
        dry_run: true,
        updated: 1,
        items: [
          {
            model_name: 'gpt-image-2',
            mode: 'tiered_expr',
            version: 'v1',
            billing_expr:
              'tier("base", p * 4.125 + c * 0 + cr * 1.03125 + img * 6.6 + img_o * 24.75)',
          },
        ],
        skipped: [],
      },
    },
  })

  renderPanel({ configureOnly: true })
  const previewButton = await screen.findByRole('button', { name: 'Preview' })
  await waitFor(() => expect(previewButton).toBeEnabled())
  await previewButton.click()

  expect(await screen.findByText('gpt-image-2')).toBeVisible()
  expect(
    screen.getByText(/img_o \* 24\.75/)
  ).toBeVisible()
  expect(screen.getByText('Expression')).toBeVisible()
  expect(screen.queryByText(/skipped/i)).not.toBeInTheDocument()
})
