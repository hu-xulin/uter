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
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { NodeSyncIndicator } from '../components/node-sync-indicator'
import type { NodeSync, NodeSyncNode, NodeSyncNodeTopic } from '../types'

const synced: NodeSyncNodeTopic = {
  synced: true,
  applied_at: 1_730_650_000,
  error: '',
  errors: {},
}
const lagging: NodeSyncNodeTopic = { ...synced, synced: false, applied_at: 0 }

function node(
  name: string,
  topics: NodeSyncNode['topics'],
  online = true
): NodeSyncNode {
  return { node_name: name, online, topics }
}

function syncData(nodes: NodeSyncNode[]): NodeSync {
  return {
    topics: ['options', 'channels', 'plugins'].map((topic) => ({
      topic,
      revision: 1,
      updated_at: 1_730_650_000,
      updated_by: 'node-a',
    })),
    nodes,
  }
}

let response: NodeSync

beforeEach(() => {
  useAuthStore.getState().auth.setUser({ id: 1, username: 'root', role: 100 })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/system-info/sync') {
      return { data: { success: true, message: '', data: response } }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
})

afterEach(() => {
  useAuthStore.getState().auth.setUser(null)
  vi.restoreAllMocks()
})

function renderIndicator(topics?: string[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <NodeSyncIndicator
        topics={topics}
        pluginNames={{ incho: 'Incho video' }}
      />
    </QueryClientProvider>
  )
  return client
}

it('shows no indicator with a single online node, even when an offline node is listed', async () => {
  response = syncData([
    node('node-a', { options: synced }),
    node('node-b', { options: lagging }, false),
  ])
  renderIndicator(['options'])

  await waitFor(() => expect(api.get).toHaveBeenCalled())
  expect(screen.queryByRole('button')).toBeNull()
})

it('reports every online node as up to date when all watched topics synced', async () => {
  response = syncData([
    node('node-a', { options: synced, channels: lagging }),
    node('node-b', { options: synced, channels: lagging }),
  ])
  renderIndicator(['options'])

  expect(
    await screen.findByRole('button', { name: 'Up to date on 2 nodes' })
  ).toBeVisible()
})

it('shows the updated share while a watched topic has not reached every node', async () => {
  response = syncData([
    node('node-a', { options: synced }),
    node('node-b', { options: lagging }),
    node('node-c', { options: synced }),
  ])
  renderIndicator(['options'])

  expect(
    await screen.findByRole('button', { name: '2/3 nodes updated' })
  ).toBeVisible()
})

it('a load failure wins over updating and the popover names each failing node', async () => {
  const user = userEvent.setup()
  response = syncData([
    node('node-a', { plugins: synced }),
    node('node-b', {
      plugins: {
        ...synced,
        errors: { incho: 'SyntaxError: Unexpected token' },
      },
    }),
  ])
  renderIndicator(['plugins'])

  const trigger = await screen.findByRole('button', {
    name: 'Failed on 1 nodes',
  })
  await user.click(trigger)

  expect(await screen.findByText('Nodes')).toBeVisible()
  expect(await screen.findByText('Incho video')).toBeVisible()
  expect(
    await screen.findByText('SyntaxError: Unexpected token')
  ).toBeVisible()
})