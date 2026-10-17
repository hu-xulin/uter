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
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'

import { STATUS_QUERY_KEY } from '@/lib/status-query'

import { Footer } from '../footer'

// The test i18n setup registers no translation resources, so `t()` resolves
// every key to itself — these are the keys rendered by the compliance items.
const COMPLIANCE_RECORDS = [
  {
    labelKey: 'ICP Filing Number',
    icon: '/icp-filing.png',
    href: 'https://beian.miit.gov.cn',
  },
  {
    labelKey: 'Enterprise Credit Number',
    icon: '/enterprise-credit.png',
    href: 'https://www.gsxt.gov.cn',
  },
  {
    labelKey: 'Police Filing Number',
    icon: '/police-filing.png',
    href: 'https://beian.mps.gov.cn',
  },
]

function renderFooter() {
  const root = createRootRoute()
  const index = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => <Footer />,
  })
  const router = createRouter({
    routeTree: root.addChildren([index]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  const queryClient = new QueryClient()
  // Seed the shared status cache so the footer renders its default branch
  // without a network request; the empty payload enables no optional legal
  // links, which keeps this test scoped to the brand column.
  queryClient.setQueryData(STATUS_QUERY_KEY, {})
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  // The router mounts the matched route asynchronously.
  return screen.findByRole('contentinfo')
}

afterEach(() => {
  cleanup()
})

it('renders the three compliance records as icon + text in one row below the platform tagline', async () => {
  const footer = await renderFooter()
  const tagline = within(footer).getByText('Powerful API Management Platform')

  // The tagline must stay on one line in every locale: English renders
  // "Intelligent Model Service Platform" and the fr/ru translations are even
  // longer, so a width-capped paragraph breaks them onto two lines.
  expect(tagline).toHaveClass('whitespace-nowrap')
  expect(tagline).not.toHaveClass('max-w-[200px]')

  const rows = within(footer).getAllByRole('listitem')
  expect(rows).toHaveLength(3)

  // Display order matches the order the records are listed in.
  expect(rows.map((row) => row.textContent)).toEqual(
    COMPLIANCE_RECORDS.map((record) => record.labelKey)
  )

  // The records share one wrapping flex row with a 30px gap between items.
  const list = rows[0].parentElement as HTMLElement
  expect(list.tagName).toBe('UL')
  expect(list).toHaveClass('flex-wrap')
  expect(list).toHaveClass('gap-x-[30px]')

  // Each record shows a decorative icon and its translated label, and links
  // only the filing number (after the colon) to its official filing portal,
  // opened safely in a new tab.
  rows.forEach((row, index) => {
    const icon = row.querySelector('img')
    expect(icon).not.toBeNull()
    expect(icon?.getAttribute('src')).toBe(COMPLIANCE_RECORDS[index].icon)
    expect(icon?.getAttribute('alt')).toBe('')

    const link = row.querySelector('a')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href')).toBe(COMPLIANCE_RECORDS[index].href)
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
  })

  // The records follow the tagline in document order — they sit under it.
  expect(
    tagline.compareDocumentPosition(rows[0]) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy()
})
