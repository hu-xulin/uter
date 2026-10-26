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
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
/**
 * Route-level smoke test for the public routes.
 *
 * Why it exists: `useSearch({ from })` / `useParams({ from })` resolve the
 * route id **at runtime**, not only at compile time. A route id that does not
 * match the regenerated route tree throws while the component renders — and
 * `/pricing` and `/rankings` are unreachable in the browser for an anonymous
 * visitor (their `beforeLoad` guard bounces to `/sign-in`), so nothing else
 * exercises those components. This renders them through the real route tree
 * with the guard and the data fetches stubbed out.
 *
 * The `@visactor/vchart` mocks are here because importing the route tree pulls
 * in the dashboard charts, and vchart's ESM build — including the deep import
 * in `features/dashboard/lib/charts.ts` — does not resolve under vitest.
 * Nothing under test touches the charts.
 */
import { render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { routeTree } from '@/routeTree.gen'

// The guard must not hit the network, and the page data must be fixture
// data — otherwise these tests assert nothing about routing.
// Importing the route tree pulls in the dashboard charts. `@visactor/vchart`'s
// ESM build does not resolve under vitest in this environment — including the
// one deep import in `features/dashboard/lib/charts.ts` — and nothing under
// test touches it.
vi.mock('@visactor/react-vchart', () => ({ VChart: () => null }))
vi.mock('@visactor/vchart/esm/theme/color-scheme/builtin/default', () => ({
  dataScheme: ['#000000'],
}))
vi.mock('@visactor/vchart', () => ({
  ThemeManager: { setCurrentTheme: vi.fn() },
}))
// Only the guard needs to be neutralised; keep every other export real by
// re-exporting the actual module and overriding just this one.
vi.mock('@/lib/nav-modules', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/nav-modules')>()),
  getModuleAccessForGuard: vi.fn(async () => ({
    enabled: true,
    requireAuth: false,
  })),
}))
vi.mock('@/features/pricing/api', () => ({
  getPricing: vi.fn(async () => ({
    models: [],
    vendors: [],
    groups: [],
    tags: [],
    endpoints: [],
    group_ratios: {},
    usable_group: {},
    supported_endpoint: {},
    channel_ratio: {},
  })),
}))
vi.mock('@/features/rankings/api', () => ({
  getRankings: vi.fn(async () => ({
    period: 'today',
    items: [],
    updated_at: '',
  })),
}))

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

beforeAll(() => {
  // The root route's beforeLoad probes setup status; keep it offline.
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  )
})

describe('public routes render through the real route tree', () => {
  // The test i18n resources are empty, so `t('X')` renders the key itself —
  // which makes the key a stable, translation-independent page marker.
  it('renders /pricing without a route-id mismatch', async () => {
    renderAt('/pricing')
    // If `useSearch({ from: '/_public/pricing/' })` cannot resolve the id it
    // throws during render and the page never gets here.
    await waitFor(() => {
      expect(document.body.textContent).toContain('Model Square')
    })
    expect(screen.queryByText(/Back to Home/)).toBeNull()
  })

  it('renders /rankings without a route-id mismatch', async () => {
    renderAt('/rankings')
    await waitFor(() => {
      expect(document.body.textContent).toContain('Rankings')
    })
    expect(screen.queryByText(/Back to Home/)).toBeNull()
  })

  it('renders /about through the docs frame', async () => {
    renderAt('/about')
    await waitFor(() => {
      expect(document.querySelector('iframe')).not.toBeNull()
    })
  })
})
