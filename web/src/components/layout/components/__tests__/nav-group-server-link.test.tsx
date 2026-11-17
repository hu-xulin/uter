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
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'

import { SidebarProvider } from '@/components/ui/sidebar'

import { NavGroup } from '../nav-group'

function renderNavGroup() {
  const root = createRootRoute()
  const index = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => (
      <SidebarProvider>
        <NavGroup
          title='Admin'
          items={[
            {
              title: 'Product Workspace',
              url: '/product-spec/',
            } as never,
            { title: 'System Settings', url: '/system-settings/site' } as never,
          ]}
        />
      </SidebarProvider>
    ),
  })
  const settings = createRoute({
    getParentRoute: () => root,
    path: '/system-settings/site',
    component: () => <div>settings</div>,
  })
  const router = createRouter({
    routeTree: root.addChildren([index, settings]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router} />)
  return router
}

it('renders the server-served product workspace as a real anchor', async () => {
  const user = userEvent.setup()
  const router = renderNavGroup()

  const workspace = await screen.findByRole('link', {
    name: /Product Workspace/,
  })
  expect(workspace).toHaveAttribute('href', '/product-spec/')

  // Clicking it must not go through the SPA router (it has no such route and
  // would render the app's 404 page); the browser performs a full navigation.
  await user.click(workspace)
  expect(router.state.location.pathname).toBe('/')

  // The same component still routes in-app items through TanStack.
  await user.click(screen.getByRole('link', { name: /System Settings/ }))
  expect(router.state.location.pathname).toBe('/system-settings/site')
})