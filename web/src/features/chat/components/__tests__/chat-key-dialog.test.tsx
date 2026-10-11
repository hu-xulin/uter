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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { api } = await import('@/lib/api')
const { ChatKeyDialog } = await import('../chat-key-dialog')

// The dialog gates key creation behind step-up verification (Passkey / 2FA /
// password). A unit test can't drive that UI, so stub the hook to resolve a
// proof immediately — without it the confirm handler bails out before any key
// is created and `onCreated` never fires.
vi.mock('@/features/auth/secure-verification', () => ({
  useSecureVerification: () => ({
    requestVerification: vi.fn().mockResolvedValue({ proof_token: 'proof-123' }),
  }),
}))

type ApiMethod = (
  url: string,
  data?: unknown,
  config?: unknown,
) => Promise<{ data: unknown }>
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
  apiClient.get = async (url: string) => {
    if (url.startsWith('/api/token/?p=')) {
      return {
        data: { success: true, data: { items: [{ id: 1, status: 1 }] } },
      }
    }
    return { data: { success: true, data: {} } }
  }
  apiClient.post = async (url: string, data?: unknown) => {
    calls.push({ url, data })
    if (url === '/api/token/') {
      return { data: { success: true, data: { id: 1 } } }
    }
    if (url === '/api/token/1/key') {
      return { data: { success: true, data: { key: 'abc123' } } }
    }
    return { data: { success: true, data: {} } }
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

    // The created plaintext key (`sk-` + the fetched token key) is handed back
    // so the pending chat link can be opened.
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('sk-abc123'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(calls[0]).toMatchObject({
      url: '/api/token/',
      data: { name: 'Default key' },
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
