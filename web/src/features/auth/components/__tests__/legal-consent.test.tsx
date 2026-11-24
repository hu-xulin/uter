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
  Outlet,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { LegalConsent } from '../legal-consent'

async function renderConsent(onCheckedChange = vi.fn()) {
  const root = createRootRoute({ component: Outlet })
  const agreement = createRoute({
    getParentRoute: () => root,
    path: '/user-agreement',
  })
  const privacy = createRoute({
    getParentRoute: () => root,
    path: '/privacy-policy',
  })
  const consent = createRoute({
    getParentRoute: () => root,
    path: '/sign-in',
    component: () => (
      <LegalConsent
        status={{ user_agreement_enabled: true, privacy_policy_enabled: true }}
        checked={false}
        onCheckedChange={onCheckedChange}
      />
    ),
  })
  const router = createRouter({
    routeTree: root.addChildren([agreement, privacy, consent]),
    history: createMemoryHistory({ initialEntries: ['/sign-in'] }),
  })
  await router.load()
  render(<RouterProvider router={router} />)
  return onCheckedChange
}

describe('legal consent links', () => {
  test('links resolve to the public legal pages without toggling consent', async () => {
    const user = userEvent.setup()
    const onCheckedChange = await renderConsent()
    const agreement = screen.getByRole('link', { name: 'User Agreement' })
    const privacy = screen.getByRole('link', { name: 'Privacy Policy' })
    expect(agreement).toHaveAttribute('href', '/user-agreement')
    expect(agreement).toHaveAttribute('target', '_blank')
    expect(privacy).toHaveAttribute('href', '/privacy-policy')
    const opened: string[] = []
    vi.spyOn(window, 'open').mockImplementation((url) => {
      opened.push(String(url))
      return null
    })
    await user.click(agreement)
    await user.click(privacy)
    expect(onCheckedChange).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(opened).toEqual(['/user-agreement', '/privacy-policy'])
    )
  })

  test('the checkbox itself still changes consent', async () => {
    const user = userEvent.setup()
    const onCheckedChange = await renderConsent()
    await user.click(screen.getByRole('checkbox'))
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })
})
