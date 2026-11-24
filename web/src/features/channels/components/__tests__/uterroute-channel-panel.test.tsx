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

import { api } from '@/lib/api'

import { UterRouteChannelPanel } from '../uterroute-channel-panel'

function renderPanel(
  channelId: number | null = 7,
  onCreateDraft?: () => Promise<number | null>
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={client}>
      <UterRouteChannelPanel
        channelId={channelId}
        baseUrl='https://route.example.com'
        onCreateDraft={onCreateDraft}
        onChangeBaseUrl={() => undefined}
      />
    </QueryClientProvider>
  )
  return { client, ...view }
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url.includes('/uterroute/endpoint')) {
      return {
        data: {
          success: true,
          data: { base_url: 'https://route.example.com', host: 'route.example.com' },
        },
      }
    }
    return { data: { success: true, data: { synced: false } } }
  })
})

test('before a draft exists the panel offers a manual prepare action', async () => {
  const user = userEvent.setup()
  const onCreateDraft = vi.fn().mockResolvedValue(11)
  renderPanel(null, onCreateDraft)

  await user.click(screen.getByRole('button', { name: 'Prepare draft channel' }))

  expect(onCreateDraft).toHaveBeenCalledOnce()
})

test('changing the discount group re-syncs with the newly selected group', async () => {
  const user = userEvent.setup()
  const postSpy = vi.spyOn(api, 'post').mockResolvedValue({
    data: {
      success: true,
      data: {
        channel_pricing_written: 2,
        discount_groups: ['default', 'vip'],
        discount_group: 'vip',
      },
    },
  })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url.includes('/uterroute/endpoint')) {
      return {
        data: {
          success: true,
          data: { base_url: 'https://route.example.com', host: 'route.example.com' },
        },
      }
    }
    return {
      data: {
        success: true,
        data: {
          synced: true,
          discount_group: 'default',
          discount_groups: ['default', 'vip'],
          summary: { models: 2, groups: 2, pricing_version: 'v1', fetched_at: 'now', price_basis: 'ratio' },
        },
      },
    }
  })
  renderPanel()

  await user.click(screen.getByRole('combobox', { name: 'Discount group' }))
  await user.click(await screen.findByRole('option', { name: 'vip' }))

  await waitFor(() => {
    expect(postSpy).toHaveBeenCalledWith(
      '/api/upstream/uterroute/sync',
      expect.objectContaining({ channel_id: 7, discount_group: 'vip' })
    )
  })
})

test('syncing the Uter Route catalog invalidates the pricing query', async () => {
  const user = userEvent.setup()
  const postSpy = vi.spyOn(api, 'post').mockResolvedValue({
    data: { success: true, data: { channel_pricing_written: 2 } },
  })
  const { client } = renderPanel()
  client.setQueryData(['pricing'], { pages: [] })
  expect(client.getQueryState(['pricing'])?.isInvalidated).toBe(false)

  await user.click(screen.getByRole('button', { name: 'Sync Uter Route catalog' }))

  await waitFor(() => {
    expect(postSpy).toHaveBeenCalledWith(
      '/api/upstream/uterroute/sync',
      expect.objectContaining({ channel_id: 7 })
    )
  })
  await waitFor(() => {
    expect(client.getQueryState(['pricing'])?.isInvalidated).toBe(true)
  })
})
