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
import i18next from 'i18next'
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

// The suite's shared i18n instance starts at `en` (see `src/test-setup.ts`),
// the one language the compliance row is *not* rendered for, so each test has
// to ask for its language explicitly and hand it back afterwards.
async function renderFooter(language: string) {
  await i18next.changeLanguage(language)
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

afterEach(async () => {
  cleanup()
  await i18next.changeLanguage('en')
})

it('renders the three compliance records beside the brand link, pinned to the top row’s right edge', async () => {
  const footer = await renderFooter('zhCN')

  // The platform tagline was removed from the footer's brand column, which
  // now holds nothing but the brand link itself.
  expect(
    within(footer).queryByText('Powerful API Management Platform')
  ).toBeNull()

  const rows = within(footer).getAllByRole('listitem')
  expect(rows).toHaveLength(3)

  // Display order matches the order the records are listed in.
  expect(rows.map((row) => row.textContent)).toEqual(
    COMPLIANCE_RECORDS.map((record) => record.labelKey)
  )

  // The records share one wrapping flex row with a 30px gap between items,
  // packed to that row's right edge so they line up with the attribution on
  // the copyright row below.
  const list = rows[0].parentElement as HTMLElement
  expect(list.tagName).toBe('UL')
  expect(list).toHaveClass('flex-wrap')
  expect(list).toHaveClass('gap-x-[30px]')
  expect(list).toHaveClass('justify-end')

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

  // The row shares the footer's top line with the brand link: it is a sibling
  // column inside that row, no longer nested under the brand column, and it
  // still follows the brand link in the document so the pair reads left to
  // right.
  const brandLink = within(footer).getAllByRole('link')[0]
  const brandColumn = brandLink.parentElement as HTMLElement
  expect(list.parentElement).toBe(brandColumn.parentElement)
  expect(list.parentElement).not.toBe(brandColumn)
  expect(
    brandLink.compareDocumentPosition(rows[0]) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy()
})

it('renders the compliance records under the traditional-Chinese interface too', async () => {
  const footer = await renderFooter('zhTW')

  expect(within(footer).getAllByRole('listitem')).toHaveLength(3)
})

it('renders the compliance records for a browser-detected zh-CN tag', async () => {
  const footer = await renderFooter('zh-CN')

  expect(within(footer).getAllByRole('listitem')).toHaveLength(3)
})

// The filings are mainland-China regulatory records whose labels are only
// written out in the Chinese locales; under every other interface language the
// row would be three unexplained alphanumeric strings, so it is not rendered.
it.each(['en', 'fr', 'ru', 'ja', 'vi'])(
  'omits the compliance records under the %s interface',
  async (language) => {
    const footer = await renderFooter(language)

    expect(within(footer).queryAllByRole('listitem')).toHaveLength(0)
    COMPLIANCE_RECORDS.forEach((record) => {
      expect(within(footer).queryByText(record.labelKey)).toBeNull()
      expect(footer.querySelector(`a[href="${record.href}"]`)).toBeNull()
    })

    // The brand column itself is still there — only the row is dropped.
    expect(within(footer).getAllByRole('link').length).toBeGreaterThan(0)
  }
)
