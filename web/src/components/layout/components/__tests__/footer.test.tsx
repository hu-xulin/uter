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

import en from '../../../../i18n/locales/en.json'
import zhTW from '../../../../i18n/locales/zh-TW.json'
import zh from '../../../../i18n/locales/zh.json'
import { Footer } from '../footer'

// The test i18n setup registers no translation resources, so `t()` resolves
// every key to itself — these are the keys rendered by the filing links.
const FILING_LINKS = [
  {
    labelKey: 'ICP Filing Number',
    href: 'https://beian.miit.gov.cn',
  },
  {
    labelKey: 'Police Filing Number',
    href: 'https://beian.mps.gov.cn/#/query/webSearch?code=44030002018502',
  },
]

// The agreements read left to right as three links with a `·` between each
// pair. They are their own block now: the filing numbers no longer trail them
// inline.
const LEGAL_LINKS_ROW_ITEMS = [
  'User Agreement',
  '·',
  'Privacy Policy',
  '·',
  'Recharge Agreement',
]

// The filing numbers form the middle block of the footer row, with a single
// separator between the two of them and none in front of the first.
const FILING_ROW_ITEMS = ['ICP Filing Number', '·', 'Police Filing Number']

// The suite's shared i18n instance starts at `en` (see `src/test-setup.ts`),
// the one language the filing numbers are *not* rendered for, so each test has
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

it('spreads the agreements, the filing numbers and the attribution across the row', async () => {
  const footer = await renderFooter('zhCN')

  // The brand mark, the tagline, the filing icons and the enterprise credit
  // number are all gone; the row is text only.
  expect(
    within(footer).queryByText('Powerful API Management Platform')
  ).toBeNull()
  expect(footer.querySelector('img')).toBeNull()
  expect(within(footer).queryByText(/Enterprise Credit/)).toBeNull()
  expect(footer.querySelector('a[href="https://www.gsxt.gov.cn"]')).toBeNull()

  // Three blocks, not two: the agreements, the filing numbers and the
  // attribution are siblings of the row, so the row can distribute them
  // horizontally instead of stacking the first two on the left.
  const legalBlock = within(footer).getByText('User Agreement')
    .parentElement as HTMLElement
  const filingBlock = within(footer).getByText('ICP Filing Number')
    .parentElement as HTMLElement
  const attributionBlock = (
    footer.querySelector('a[href="https://uter.ai"]') as HTMLElement
  ).closest('div')?.parentElement as HTMLElement

  // 三块共用的行容器：取一次并断言非空，避免在断言里散落 `!`。
  const row = legalBlock.parentElement as HTMLElement

  expect(legalBlock).not.toBe(filingBlock)
  expect(filingBlock.parentElement).toBe(row)
  expect(attributionBlock.parentElement).toBe(row)
  expect([...row.children]).toEqual([legalBlock, filingBlock, attributionBlock])

  // The row spreads those three blocks instead of packing them left: from the
  // `sm` breakpoint up it is a three-track grid — equal `1fr` sides with the
  // filings taking their own width in between, so the middle block stays
  // centred without squeezing the agreements into a fixed third.
  expect(row.className).toContain(
    'sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'
  )

  // Each block keeps its own reading order.
  expect(
    ([...legalBlock.children] as HTMLElement[]).map(
      (child) => child.textContent
    )
  ).toEqual(LEGAL_LINKS_ROW_ITEMS)
  expect(
    ([...filingBlock.children] as HTMLElement[]).map(
      (child) => child.textContent
    )
  ).toEqual(FILING_ROW_ITEMS)

  // Each filing number links to its official portal and opens in a new tab.
  FILING_LINKS.forEach((record) => {
    const link = filingBlock.querySelector(`a[href="${record.href}"]`)
    expect(link).not.toBeNull()
    expect(link?.textContent).toBe(record.labelKey)
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
  })
})

it('keeps a single divider above the legal row', async () => {
  const footer = await renderFooter('zhCN')

  // The filing row and its divider are gone: the footer keeps only the border
  // at its own top edge, and the row that holds the links has no divider and
  // no top margin of its own.
  expect(footer).toHaveClass('border-t')

  const legalLinks = within(footer).getByText('User Agreement')
    .parentElement as HTMLElement
  const legalRow = legalLinks.parentElement as HTMLElement
  expect(legalRow).not.toHaveClass('border-t')
  expect(legalRow).not.toHaveClass('mt-12')

  // Nothing is left above the row inside the footer.
  expect(footer.querySelectorAll('ul')).toHaveLength(0)
  expect(legalRow.parentElement?.firstElementChild).toBe(legalRow)
})

it('renders the filing numbers under the traditional-Chinese interface too', async () => {
  const footer = await renderFooter('zhTW')

  FILING_LINKS.forEach((record) => {
    expect(within(footer).getByText(record.labelKey)).toBeTruthy()
  })
})

it('renders the filing numbers for a browser-detected zh-CN tag', async () => {
  const footer = await renderFooter('zh-CN')

  FILING_LINKS.forEach((record) => {
    expect(within(footer).getByText(record.labelKey)).toBeTruthy()
  })
})

// The filings are mainland-China regulatory records whose labels are only
// written out in the Chinese locales; under every other interface language the
// row would be two unexplained alphanumeric strings, so they are not rendered.
it.each(['en', 'fr', 'ru', 'ja', 'vi'])(
  'omits the filing numbers under the %s interface',
  async (language) => {
    const footer = await renderFooter(language)

    FILING_LINKS.forEach((record) => {
      expect(within(footer).queryByText(record.labelKey)).toBeNull()
      expect(footer.querySelector(`a[href="${record.href}"]`)).toBeNull()
    })

    // Only the filing numbers are dropped — the legal links and the project
    // attribution are still rendered, and the agreements block ends at the
    // recharge agreement.
    const legalLinks = within(footer).getByText('User Agreement')
      .parentElement as HTMLElement
    expect([...legalLinks.children].map((child) => child.textContent)).toEqual(
      LEGAL_LINKS_ROW_ITEMS
    )
  }
)

// The numbers themselves are regulatory identifiers, so they are carried
// verbatim rather than translated — and they must be the real filings. A
// placeholder left in a locale file renders as `12345678` in the footer of the
// two Chinese interfaces, which no assertion above would catch because the
// suite's i18n instance resolves keys to themselves.
it('carries the real filing numbers in both Chinese locales', () => {
  const ICP = '粤ICP备2026158037号'
  const POLICE = '粤公网安备44030002018502号'

  expect(zh.translation['ICP Filing Number']).toBe(ICP)
  expect(zh.translation['Police Filing Number']).toBe(POLICE)
  expect(zhTW.translation['ICP Filing Number']).toBe('粵ICP備2026158037號')
  expect(zhTW.translation['Police Filing Number']).toBe(
    '粵公網安備44030002018502號'
  )

  // The retired enterprise credit number is gone from every locale.
  for (const locale of [zh, zhTW, en]) {
    expect(locale.translation).not.toHaveProperty('Enterprise Credit Number')
  }
})

// The copyright is one sentence: `© 2026`, the brand name and `版权所有。`
// used to sit at two different opacities, which reads like three unrelated
// fragments rather than a single attribution. It also used to be darker
// (`text-muted-foreground`, then `text-muted-foreground`) than the agreements on
// its left, which made the copyright shout louder than the regulatory text.
// The whole row — links and attribution alike — now uses the tertiary text
// token, so this guards against either half drifting back to a heavier colour.
it('colours the whole legal row like the tertiary text token', async () => {
  const footer = await renderFooter('zhCN')

  const brand = footer.querySelector(
    'a[href="https://uter.ai"]'
  ) as HTMLElement | null
  expect(brand).not.toBeNull()

  const line = brand?.parentElement as HTMLElement
  expect(line.className).toContain('text-tertiary-foreground')
  expect(line.className).not.toContain('text-muted-foreground')
  expect(line.className).not.toContain('text-muted-foreground')

  // The right-aligned wrapper must not dim the line either: a colour on the
  // container would win wherever the inner span has no colour of its own.
  const wrapper = line.parentElement as HTMLElement
  expect(wrapper.className).toContain('text-tertiary-foreground')
  expect(wrapper.className).not.toContain('text-muted-foreground')

  // Both halves of the row carry the same colour, so the row reads as one line.
  const legalLink = within(footer).getByText('User Agreement')
  expect(legalLink.className).toContain('text-tertiary-foreground')

  // ...and the same weight: a `font-medium` on the brand link made the middle of
  // the sentence sit heavier than the words around it.
  expect(brand?.className).not.toContain('font-medium')
  expect(brand?.className).not.toContain('font-semibold')
})

// AGPLv3 Section 7(b): new-api's NOTICE requires a modified version that
// presents a user interface to keep a visible link to the original project
// plus the "Frontend design and development by New API contributors."
// attribution. This guards against the notice being quietly dropped — the
// failure mode the upstream terms are written to prevent.
it('keeps the upstream project link and attribution required by AGPLv3', async () => {
  const footer = await renderFooter('en')

  const upstream = within(footer).getByRole('link', { name: 'new-api' })
  expect(upstream.getAttribute('href')).toBe(
    'https://github.com/QuantumNous/new-api'
  )
  expect(upstream.getAttribute('target')).toBe('_blank')

  expect(
    within(footer).getByText(
      'Frontend design and development by New API contributors.'
    )
  ).toBeTruthy()
})
