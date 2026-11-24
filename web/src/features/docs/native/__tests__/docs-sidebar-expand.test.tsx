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
  useRouterState,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { DocsLocaleCode } from '@/lib/docs-link'

import { NativeDocsShell } from '../docs-shell'

const FEATURES_PAGE = 'guide/wiki/basic-concepts/features-introduction'

/**
 * Follow the URL so a click's selection state is observable: the shell
 * reads the current splat from router state instead of a fixed pagePath.
 */
function ShellFromRoute() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const rest = pathname.replace(/^\/docs\//, '').replace(/\/+$/, '')
  const slash = rest.indexOf('/')
  const locale = (slash === -1 ? rest : rest.slice(0, slash)) as DocsLocaleCode
  const pagePath = slash === -1 ? '' : rest.slice(slash + 1)
  return (
    <NativeDocsShell locale={locale} pagePath={pagePath} toc={[]}>
      <div>content</div>
    </NativeDocsShell>
  )
}

async function renderShell() {
  const root = createRootRoute()
  const docs = createRoute({
    getParentRoute: () => root,
    path: '/docs/$',
    component: ShellFromRoute,
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

const SECTIONS = [
  { label: '用户指南', pagePath: 'guide/wiki/user-guide' },
  { label: 'API 参考', pagePath: 'api' },
  { label: 'AI 应用', pagePath: 'apps' },
] as const

describe('docs sidebar section navigation', () => {
  it('renders each section title as a link to its landing page', async () => {
    await renderShell()
    for (const section of SECTIONS) {
      const link = screen.getByRole('link', { name: section.label })
      expect(link).toHaveAttribute('href', `/docs/zh/${section.pagePath}`)
      expect(link).not.toHaveAttribute('aria-current')
    }
  })

  it.each(SECTIONS)(
    'clicking $label navigates to its landing page and marks it current',
    async ({ label, pagePath }) => {
      const router = await renderShell()
      await userEvent.click(screen.getByRole('link', { name: label }))
      expect(router.state.location.pathname).toBe(`/docs/zh/${pagePath}`)
      expect(screen.getByRole('link', { name: label })).toHaveAttribute(
        'aria-current',
        'page'
      )
    }
  )

  it('auto-expands the landing section when navigation lands on it', async () => {
    await renderShell()
    await userEvent.click(screen.getByRole('link', { name: '用户指南' }))
    expect(await screen.findByRole('link', { name: '登录' })).toBeVisible()
    expect(screen.getByRole('link', { name: '排行' })).toBeVisible()
  })
})

describe('docs sidebar user-guide folder disclosure', () => {
  it('starts collapsed away from its own pages', async () => {
    await renderShell()
    const arrow = screen.getByRole('button', { name: 'Expand 用户指南' })
    expect(arrow).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: '登录' })).toBeNull()
  })

  it('toggles every chapter when the disclosure arrow is clicked', async () => {
    await renderShell()
    const arrow = screen.getByRole('button', { name: 'Expand 用户指南' })
    expect(arrow).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(arrow)

    expect(await screen.findByRole('link', { name: '登录' })).toBeVisible()
    expect(screen.getByRole('link', { name: '排行' })).toBeVisible()
    expect(arrow).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(arrow)

    expect(screen.queryByRole('link', { name: '登录' })).toBeNull()
    expect(arrow).toHaveAttribute('aria-expanded', 'false')
  })
})
