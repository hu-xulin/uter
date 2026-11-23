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
import { beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { FetchedPricePreview } from '../fetched-price-preview'

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

function renderPreview() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <FetchedPricePreview channelId={7} />
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
