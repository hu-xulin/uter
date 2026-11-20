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
import type { ComponentProps } from 'react'
import { afterEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { ApikoChannelPanel } from '../apiko-channel-panel'

const clients: QueryClient[] = []

afterEach(() => {
  for (const client of clients) client.clear()
  clients.length = 0
})

function renderPanel(
  props: Partial<ComponentProps<typeof ApikoChannelPanel>> = {}
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  clients.push(client)
  const onModelsSynced = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <ApikoChannelPanel
        channelId={7}
        onModelsSynced={onModelsSynced}
        {...props}
      />
    </QueryClientProvider>
  )
  return { onModelsSynced }
}

test('syncs catalogue models and hands the merged list to the form', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({
    data: {
      success: true,
      data: {
        channel_id: 7,
        fetched: 2,
        total: 3,
        added: 2,
        models: ['manual-model', 'apiko-chat', 'apiko-video'],
      },
    },
  })
  const user = userEvent.setup()
  const { onModelsSynced } = renderPanel()

  await user.click(screen.getByRole('button', { name: 'Sync Apiko models' }))

  await waitFor(() =>
    expect(onModelsSynced).toHaveBeenCalledWith([
      'manual-model',
      'apiko-chat',
      'apiko-video',
    ])
  )
  expect(post).toHaveBeenCalledWith(
    '/api/channel/7/apiko/models/sync',
    {},
    expect.anything()
  )
  expect(await screen.findByRole('status')).toHaveTextContent(
    '3 models after sync; 2 added'
  )
})

test('creates a draft before syncing a channel that is not saved yet', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({
    data: {
      success: true,
      data: {
        channel_id: 9,
        fetched: 1,
        total: 1,
        added: 1,
        models: ['apiko-chat'],
      },
    },
  })
  const user = userEvent.setup()
  const onCreateDraft = vi.fn().mockResolvedValue(9)
  const { onModelsSynced } = renderPanel({ channelId: null, onCreateDraft })

  await user.click(screen.getByRole('button', { name: 'Sync Apiko models' }))

  await waitFor(() => expect(onCreateDraft).toHaveBeenCalled())
  expect(post).toHaveBeenCalledWith(
    '/api/channel/9/apiko/models/sync',
    {},
    expect.anything()
  )
  expect(onModelsSynced).toHaveBeenCalledWith(['apiko-chat'])
})
