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

For commercial licensing, please contact support@Uter.ai.com
*/
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { api } = await import('@/lib/api')
const { ChatKeyDialog } = await import('../chat-key-dialog')

type ApiMethod = (url: string, data?: unknown) => Promise<{ data: unknown }>
type MockableApi = { get: ApiMethod; post: ApiMethod }

const apiClient = api as unknown as MockableApi
const originalGet = apiClient.get
const originalPost = apiClient.post

afterEach(() => {
  apiClient.get = originalGet
  apiClient.post = originalPost
})

function installApi() {
  const calls: Array<{ url: string; data?: unknown }> = []
  let created = false
  apiClient.get = async () => ({
    data: {
      success: true,
      data: { items: created ? [{ id: 1, status: 1 }] : [] },
    },
  })
  apiClient.post = async (url, data) => {
    calls.push({ url, data })
    if (url === '/api/token/') {
      created = true
      return { data: { success: true, message: '' } }
    }
    return { data: { success: true, data: { key: 'created' } } }
  }
  return calls
}

function renderDialog() {
  const onOpenChange = vi.fn()
  const onCreated = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <ChatKeyDialog open onOpenChange={onOpenChange} onCreated={onCreated} />
    </QueryClientProvider>
  )
  return { onOpenChange, onCreated }
}

describe('ChatKeyDialog', () => {
  test('asks before creating a key and continues with the created one', async () => {
    const calls = installApi()
    const { onOpenChange, onCreated } = renderDialog()

    expect(
      screen.getByText(
        'This client needs an API key to be filled in automatically. Create one now?'
      )
    ).toBeInTheDocument()

    fireEvent.click(screen.getByText('Create and continue'))

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('sk-created'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(calls[0]).toEqual({
      url: '/api/token/',
      data: {
        name: 'Default key',
        remain_quota: 0,
        expired_time: -1,
        unlimited_quota: true,
        model_limits_enabled: false,
        model_limits: '',
        allow_ips: '',
        group: '',
        auto_groups: [],
        cross_group_retry: false,
      },
    })
  })

  test('creates nothing when the user cancels', async () => {
    const calls = installApi()
    const { onOpenChange, onCreated } = renderDialog()

    fireEvent.click(screen.getByText('Cancel'))

    // Base UI closes with extra event details, so only the first argument matters.
    await waitFor(() =>
      expect(onOpenChange.mock.calls.some(([open]) => open === false)).toBe(
        true
      )
    )
    expect(calls).toEqual([])
    expect(onCreated).not.toHaveBeenCalled()
  })
})
