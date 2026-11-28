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

import { UterApiPricePreview } from '../uterapi-price-preview'

function previewItem() {
  return {
    channel_id: 0,
    model_name: 'gpt-a',
    provider: 'uterapi',
    region: '',
    deployment_id: '',
    currency: 'USD',
    pricing_source: 'newapi:/api/pricing',
    pricing_status: 'official_only',
    pricing_version: '',
    price_supported: true,
    fetched_at: 1,
    updated_at: 1,
    stale: false,
    fetched_age_hours: 0,
    official: {
      currency: 'USD',
      unit: 'per_1m_token',
      tiers: [
        {
          range_name: 'base',
          input_per_million_usd: 10,
          output_per_million_usd: 50,
          unit: 'per_1m_token',
        },
      ],
      source: 'newapi:/api/pricing',
      fetched_at: 1,
    },
    upstream_quote: {
      price_basis: 'CHANNEL_DISCOUNT',
      currency: 'USD',
      unit: 'per_1m_token',
      input_per_million_usd: 5,
      output_per_million_usd: 25,
      source: 'uterroute-discount',
    },
  }
}

function renderPreview(group: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <UterApiPricePreview group={group} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
})

test('Uter.api preview shows official and channel prices for the selected group', async () => {
  const get = vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: {
        group: 'Codex',
        group_name: 'Codex · Standard',
        ratio: 0.5,
        currency: 'USD',
        fetched_at: 1,
        authenticated: true,
        items: [previewItem()],
      },
    },
  })
  renderPreview('Codex')

  expect(await screen.findByText('gpt-a')).toBeVisible()
  expect(screen.getByText('$10.0000 / $50.0000')).toBeVisible()
  expect(screen.getByText('$5.0000 / $25.0000')).toBeVisible()
  expect(screen.getByText(/Codex · Standard/)).toBeVisible()
  const call = get.mock.calls.find(([url]) =>
    String(url).includes('/uterapi/price-preview')
  )
  expect(call?.[1]).toMatchObject({ params: { group: 'Codex' } })
})

test('Uter.api preview labels public-catalog fallback as reference only', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: {
        group: 'Codex',
        group_name: 'Codex · Standard',
        ratio: 0.5,
        currency: 'USD',
        fetched_at: 1,
        authenticated: false,
        items: [previewItem()],
      },
    },
  })
  renderPreview('Codex')

  expect(
    await screen.findByText(
      'Public catalog reference prices: no upstream credential was available, so model availability is unverified.'
    )
  ).toBeVisible()
  expect(await screen.findByText('gpt-a')).toBeVisible()
})

test('Uter.api preview asks for a group before querying', () => {
  const get = vi.spyOn(api, 'get')
  renderPreview('')

  expect(
    screen.getByText('Choose a billing group to preview its prices.')
  ).toBeVisible()
  expect(
    get.mock.calls.some(([url]) =>
      String(url).includes('/uterapi/price-preview')
    )
  ).toBe(false)
})

test('Uter.api preview surfaces a failure without crashing', async () => {
  vi.spyOn(api, 'get').mockRejectedValue(new Error('upstream down'))
  renderPreview('Codex')

  expect(
    await screen.findByText('Could not preview prices for this group.')
  ).toBeVisible()
})
