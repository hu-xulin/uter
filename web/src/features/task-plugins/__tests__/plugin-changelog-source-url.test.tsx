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
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { PluginChangelogPanel } from '../components/plugin-changelog-panel'
import type { PluginChangelog } from '../lib/plugin-changelog'
import type { MarketplacePlugin } from '../types'

const plugin: MarketplacePlugin = {
  key: 'demo',
  name: 'Demo',
  latest: '1.2.0',
  versions: ['1.2.0'].map((version) => ({
    version,
    path: `plugins/tasks/demo/${version}/plugin.js`,
  })),
}

/**
 * The changelog document is produced by the parser from a marketplace sidecar.
 * This suite bypasses the network and hands the panel a finished document so it
 * can assert on the `sourceUrl` handling that the parser alone cannot prove.
 */
function changelogWithSourceUrl(sourceUrl: string): PluginChangelog {
  return {
    plugin: 'demo',
    version: '1.2.0',
    locale: 'en',
    sourceUrl,
    sections: [
      {
        category: 'Fixed',
        markdown: 'See [the source](./plugin.js) for the patch.',
      },
    ],
  }
}

const unsafeSourceUrls = [
  'javascript:alert(1)',
  'JavaScript:alert(1)',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  'vbscript:msgbox(1)',
]

// Overridden per test so the component receives a finished document whose
// `sourceUrl` is exactly the value under test.
const changelogDocument = vi.hoisted(() => ({
  current: null as unknown as PluginChangelog,
}))

vi.mock('../lib/plugin-changelog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/plugin-changelog')>()),
  fetchPluginChangelog: vi.fn(async () => changelogDocument.current),
}))

function renderPanel(sourceUrl: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  changelogDocument.current = changelogWithSourceUrl(sourceUrl)

  return render(
    <QueryClientProvider client={client}>
      <PluginChangelogPanel
        indexUrl='https://example.com/index.json'
        plugin={plugin}
        version='1.2.0'
      />
    </QueryClientProvider>
  )
}

describe('PluginChangelogPanel untrusted sourceUrl', () => {
  test.each(unsafeSourceUrls)(
    'renders no source link when the sidecar declares %s',
    async (sourceUrl) => {
      renderPanel(sourceUrl)

      await waitFor(() => expect(screen.getByText('v1.2.0')).toBeVisible())
      expect(
        screen.queryByRole('link', { name: 'View changelog source' })
      ).not.toBeInTheDocument()
    }
  )

  test.each(unsafeSourceUrls)(
    'does not resolve relative changelog links against %s',
    async (sourceUrl) => {
      renderPanel(sourceUrl)

      await waitFor(() => expect(screen.getByText('v1.2.0')).toBeVisible())

      // No part of the attacker's URL may reach the DOM...
      expect(document.body.innerHTML).not.toContain('alert(1)')
      expect(document.body.innerHTML).not.toContain('msgbox(1)')
      expect(document.body.innerHTML).not.toContain('base64')

      // ...and the relative link falls back to staying relative instead of
      // being resolved against the rejected base, which is the same behaviour
      // as rendering Markdown without a baseUrl.
      const link = screen.getByRole('link', { name: 'the source' })
      expect(link).toHaveAttribute('href', './plugin.js')
    }
  )

  test('still renders a normal https source link', async () => {
    renderPanel('https://example.com/plugins/tasks/demo/1.2.0/plugin.js')

    const link = await screen.findByRole('link', {
      name: 'View changelog source',
    })
    expect(link).toHaveAttribute(
      'href',
      'https://example.com/plugins/tasks/demo/1.2.0/plugin.js'
    )
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
