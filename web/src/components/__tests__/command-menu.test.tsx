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
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'

import { SearchProvider } from '@/context/search-provider'
import { ROLE } from '@/lib/roles'
import { STATUS_QUERY_KEY } from '@/lib/status-query'
import { useAuthStore } from '@/stores/auth-store'

import { CommandMenu } from '../command-menu'
import { Search } from '../search'

const adminEntries = ['Channels', 'Models', 'Users', 'Redemption Codes']
const superAdminEntries = ['System Info', 'Plugins', 'System Settings']

// jsdom lacks the Web Animations API the menu's scroll area waits on.
const getAnimationsDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'getAnimations'
)

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
    configurable: true,
    value: () => [],
  })
})

afterAll(() => {
  if (getAnimationsDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      'getAnimations',
      getAnimationsDescriptor
    )
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations')
  }
})

afterEach(() => {
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  window.localStorage.clear()
})

async function renderOpenMenu() {
  useAuthStore
    .getState()
    .auth.setUser({ id: 1, username: 'alice', role: ROLE.USER })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <SearchProvider>
          <Search />
          <CommandMenu />
        </SearchProvider>
      ),
    }),
    history: createMemoryHistory({ initialEntries: ['/dashboard/overview'] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  await userEvent.click(await screen.findByRole('button', { name: /Search/ }))
}

test('command dialog title and description render through translated keys', async () => {
  // Distinct bundle values prove the dialog surface is fed by t() rather than
  // the raw English defaults baked into CommandDialog.
  i18next.addResourceBundle(
    'en',
    'translation',
    {
      'Command Palette': 'Translated Palette',
      'Search for a command to run...': 'Translated search hint',
    },
    true,
    true
  )
  try {
    await act(() => i18next.changeLanguage('en'))
    await renderOpenMenu()
    expect(await screen.findByText('Translated Palette')).toBeTruthy()
    expect(screen.getByText('Translated search hint')).toBeTruthy()
  } finally {
    await act(() => i18next.changeLanguage('en'))
    i18next.removeResourceBundle('en', 'translation')
    i18next.addResourceBundle('en', 'translation', {}, true, true)
  }
})

async function searchEntriesFor(role: number, sidebarModulesAdmin = '') {
  useAuthStore.getState().auth.setUser({ id: 1, username: 'alice', role })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(STATUS_QUERY_KEY, {
    SidebarModulesAdmin: sidebarModulesAdmin,
  })
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <SearchProvider>
          <Search />
          <CommandMenu />
        </SearchProvider>
      ),
    }),
    history: createMemoryHistory({ initialEntries: ['/dashboard/overview'] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )

  // 搜索按钮的可访问名称为「Search ⌘K」（search.tsx 为通过 axe
  // label-content-name-mismatch 校验，将可见的快捷键徽标一并纳入 aria-label），
  // 故用部分匹配而非精确匹配。
  await userEvent.click(await screen.findByRole('button', { name: /Search/ }))
  const options = await screen.findAllByRole('option')
  return options.map((option) => option.textContent)
}

test('regular users only find their own console pages in search', async () => {
  const entries = await searchEntriesFor(ROLE.USER)

  expect(entries).toEqual(
    expect.arrayContaining(['API Keys', 'Usage Logs', 'Wallet', 'Settings'])
  )
  for (const entry of [...adminEntries, ...superAdminEntries]) {
    expect(entries).not.toContain(entry)
  }
})

test('admins find admin pages in search but not super admin pages', async () => {
  const entries = await searchEntriesFor(ROLE.ADMIN)

  expect(entries).toEqual(expect.arrayContaining(adminEntries))
  for (const entry of superAdminEntries) {
    expect(entries).not.toContain(entry)
  }
})

test('pages hidden in the sidebar settings stay out of search', async () => {
  const entries = await searchEntriesFor(
    ROLE.USER,
    JSON.stringify({ personal: { enabled: true, topup: false } })
  )

  expect(entries).not.toContain('Wallet')
  expect(entries).toContain('Settings')
})

test('the shortcut badge sits on the vertical center of the search button', async () => {
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <SearchProvider>
          <Search />
        </SearchProvider>
      ),
    }),
    history: createMemoryHistory(),
  })
  await router.load()
  render(<RouterProvider router={router} />)

  const kbd = screen.getByText('⌘').closest('kbd')
  expect(kbd).not.toBeNull()
  // 居中契约：绝对定位 + 上移自身一半，而不是固定 top 偏移。
  expect(kbd).toHaveClass('top-1/2', '-translate-y-1/2', 'h-5')
  expect(kbd?.className.split(/\s+/)).not.toContain('top-1')
  // 右侧内边距与垂直居中留下的 9px 一致，避免徽标贴边。
  expect(kbd).toHaveClass('end-[9px]', 'px-1')
})
