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
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { SidebarModulesCard } from '../sidebar-modules-card'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useAuthStore.getState().auth.reset()
})

function renderCard(adminConfig: Record<string, unknown>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['status'], { SidebarModulesAdmin: adminConfig })
  useAuthStore.getState().auth.setUser({ sidebar_modules: '' } as never)
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: { sidebar_modules: null } },
  } as never)
  return render(
    <QueryClientProvider client={client}>
      <SidebarModulesCard />
    </QueryClientProvider>
  )
}

test('hides a whole area when the administrator disables it', async () => {
  renderCard({
    chat: { enabled: false, playground: true, chat: true },
    console: { enabled: true },
    personal: { enabled: true },
  })

  expect(await screen.findByText('Console Area')).toBeVisible()
  expect(screen.queryByText('Chat Area')).not.toBeInTheDocument()
})

test('hides only the disabled module inside an enabled area', async () => {
  renderCard({
    chat: { enabled: true, playground: true, chat: false },
    console: { enabled: true },
    personal: { enabled: true },
  })

  expect(await screen.findByText('Chat Area')).toBeVisible()
  expect(screen.getByText('Playground')).toBeVisible()
  expect(screen.queryByText('Chat')).not.toBeInTheDocument()
})
