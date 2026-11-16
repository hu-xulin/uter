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
import { describe, expect, it } from 'vitest'

import { NativeDocsShell } from '../docs-shell'

const FEATURES_PAGE = 'guide/wiki/basic-concepts/features-introduction'

async function renderShell() {
  const root = createRootRoute()
  const docs = createRoute({
    getParentRoute: () => root,
    path: '/docs/$',
    component: () => (
      <NativeDocsShell locale='zh' pagePath={FEATURES_PAGE} toc={[]}>
        <div>content</div>
      </NativeDocsShell>
    ),
  })
  const router = createRouter({
    routeTree: root.addChildren([docs]),
    history: createMemoryHistory({
      initialEntries: [`/docs/zh/${FEATURES_PAGE}`],
    }),
  })
  await router.load()
  render(<RouterProvider router={router} />)
  return router
}

describe('docs sidebar user-guide folder', () => {
  it('starts collapsed away from its own pages', async () => {
    await renderShell()
    const title = screen.getByRole('button', { name: '用户指南' })
    expect(title).toBeVisible()
    expect(title).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: '注册与登录' })).toBeNull()
  })

  it('toggles every chapter when the section title is clicked', async () => {
    await renderShell()
    const title = screen.getByRole('button', { name: '用户指南' })
    expect(title).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(title)

    expect(
      await screen.findByRole('link', { name: '注册与登录' })
    ).toBeVisible()
    expect(screen.getByRole('link', { name: '定价和排行' })).toBeVisible()
    expect(title).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(title)

    expect(screen.queryByRole('link', { name: '注册与登录' })).toBeNull()
    expect(title).toHaveAttribute('aria-expanded', 'false')
  })

  it('expands every chapter when the disclosure arrow is clicked', async () => {
    await renderShell()
    const arrow = screen.getByRole('button', { name: 'Expand 用户指南' })
    expect(arrow).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(arrow)

    expect(arrow).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: '注册与登录' })).toBeVisible()
    expect(screen.getByRole('link', { name: '定价和排行' })).toBeVisible()
  })
})
