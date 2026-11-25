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
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import type { DocsLocaleCode } from '@/lib/docs-link'

import { docRefForPagePath, sidebarEntries } from '../docs-content'
import { loadNativeDoc } from '../docs-loader'
import { NativeDocsShell } from '../docs-shell'

const LOCALES: DocsLocaleCode[] = ['zh', 'zh-TW', 'en', 'fr', 'ja', 'ru', 'vi']

/** Turn a sidebar URL into the page path `docRefForPagePath()` expects. */
function pagePathOf(url: string): string {
  return url.replace(/^\/docs\/[^/]+\//, '')
}

const FEATURES_PAGE = 'guide/wiki/basic-concepts/features-introduction'

afterEach(() => cleanup())

/** Render the real shell, following the URL so selection is observable. */
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

describe('API reference sidebar group links', () => {
  it('points every navigable protocol group header at a page that resolves', () => {
    for (const locale of LOCALES) {
      const api = sidebarEntries(locale).find((s) => s.url.endsWith('/api'))
      if (!api) throw new Error(`${locale} API section missing`)

      for (const group of api.children ?? []) {
        if ((group.children?.length ?? 0) === 0) continue
        // Toggle-only folders (Images) have no page — their header is a
        // disclosure button, not a link, so it must not be resolved.
        if (group.toggleOnly) continue
        const pagePath = pagePathOf(group.url)
        const ref = docRefForPagePath(pagePath)
        if (!ref) {
          throw new Error(`${locale} ${group.title} -> ${pagePath} no ref`)
        }
        expect(
          loadNativeDoc(locale, ref),
          `${locale} ${group.title} -> ${pagePath} has no MDX`
        ).not.toBeNull()
      }
    }
  })

  it('marks the Images group toggle-only with a canonical, non-navigating URL', () => {
    for (const locale of LOCALES) {
      const api = sidebarEntries(locale).find((s) => s.url.endsWith('/api'))
      if (!api) throw new Error(`${locale} API section missing`)
      const images = (api.children ?? []).find((g) =>
        (g.children ?? []).some((c) => c.url.includes('/ai-model-images-'))
      )
      if (!images) throw new Error(`${locale} Images group missing`)
      expect(images.toggleOnly, `${locale} Images toggleOnly`).toBe(true)
      // The header's URL is the group identity, not a child page — it is
      // never navigated to, so it must not masquerade as a resolvable page.
      expect(images.url, `${locale} Images URL`).toBe(
        `/docs/${locale}/api/ai-model-images`
      )
      // Every child is a real, navigable endpoint page.
      for (const child of images.children ?? []) {
        const childRef = docRefForPagePath(pagePathOf(child.url))
        if (!childRef) throw new Error(`${locale} ${child.title} no ref`)
        expect(loadNativeDoc(locale, childRef)).not.toBeNull()
      }
    }
  })
})

describe('Images group disclosure interaction', () => {
  const IMAGES = '图像（Images）'

  it('renders the Images header as a button, not a link, with no selected state', async () => {
    await renderShell()
    await userEvent.click(
      screen.getByRole('button', { name: 'Expand API 参考' })
    )

    expect(screen.queryByRole('link', { name: IMAGES })).toBeNull()
    const header = screen.getByRole('button', { name: IMAGES })
    expect(header).toBeTruthy()
    expect(header).not.toHaveAttribute('aria-current')
    expect(header).toHaveAttribute('aria-expanded', 'false')
  })

  it('clicking the Images header expands then collapses children without navigating', async () => {
    const router = await renderShell()
    const urlBefore = router.state.location.pathname
    await userEvent.click(
      screen.getByRole('button', { name: 'Expand API 参考' })
    )

    const header = screen.getByRole('button', { name: IMAGES })
    await userEvent.click(header)

    // Children appear; the header is expanded but never marked current.
    expect(
      await screen.findByRole('link', { name: '原生OpenAI格式' })
    ).toBeVisible()
    expect(header).toHaveAttribute('aria-expanded', 'true')
    expect(header).not.toHaveAttribute('aria-current')
    expect(router.state.location.pathname).toBe(urlBefore)

    // A second click collapses again — no navigation on either click.
    await userEvent.click(header)
    expect(screen.queryByRole('link', { name: '原生OpenAI格式' })).toBeNull()
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(router.state.location.pathname).toBe(urlBefore)
  })

  it('still navigates when a child endpoint is clicked', async () => {
    const router = await renderShell()
    await userEvent.click(
      screen.getByRole('button', { name: 'Expand API 参考' })
    )
    await userEvent.click(screen.getByRole('button', { name: IMAGES }))

    const child = await screen.findByRole('link', { name: '原生OpenAI格式' })
    await userEvent.click(child)

    expect(router.state.location.pathname).toMatch(
      /\/docs\/zh\/api\/ai-model-images-openai$/
    )
  })
})
