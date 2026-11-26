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
import { render, screen } from '@testing-library/react'
import { createInstance, type i18n } from 'i18next'
import { useState } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import en from '@/i18n/locales/en.json'

import { SettingsPageProvider } from '../../components/settings-page-context'
import type { ChannelProviderPrefix } from '../channel-provider-settings-form'
import { ChannelProviderSettingsSection } from '../channel-provider-settings-section'
import type { ChannelCredentialDisclosure } from '../use-channel-credential-disclosure'

vi.mock('../../hooks/use-update-option', () => ({
  useUpdateOption: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  }),
}))

let testI18n: i18n

function Fixture(props: { prefix: ChannelProviderPrefix }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  )
  const disclosure: ChannelCredentialDisclosure = {
    verification: {} as never,
    reveal: vi.fn(),
    hide: vi.fn(),
    revealed: {},
    pendingKey: null,
    isRevealing: false,
  }

  return (
    <I18nextProvider i18n={testI18n}>
      <QueryClientProvider client={client}>
        <div ref={setContainer} />
        <SettingsPageProvider actionsContainer={container}>
          <ChannelProviderSettingsSection
            title='Uter Provider'
            description='saved values fill empty connection fields on the server.'
            prefix={props.prefix}
            values={{
              loginUrl: '',
              username: '',
              password: 'abcd****wxyz',
              apiKey: 'key1****aaaa\nkey2****bbbb',
            }}
            disclosure={disclosure}
          />
        </SettingsPageProvider>
      </QueryClientProvider>
    </I18nextProvider>
  )
}

beforeEach(async () => {
  testI18n = createInstance()
  await testI18n.init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  })
})

describe('ChannelProviderSettingsSection credential inputs', () => {
  const prefixes: ChannelProviderPrefix[] = [
    'featured',
    'bailian',
    'subscription',
  ]

  it.each(prefixes)(
    '%s renders API Key as a multiline textarea (one key per line)',
    async (prefix) => {
      render(<Fixture prefix={prefix} />)
      const apiKey = await screen.findByLabelText('API Key')
      // SecretTextarea wraps a <textarea>; its read-only display shows the
      // per-line backend mask with the newline preserved.
      expect(apiKey.tagName).toBe('TEXTAREA')
      expect((apiKey as HTMLTextAreaElement).value).toContain('\n')
    }
  )

  it.each(prefixes)(
    '%s keeps Password as a single-line input',
    async (prefix) => {
      render(<Fixture prefix={prefix} />)
      const password = await screen.findByLabelText('Password')
      expect(password.tagName).toBe('INPUT')
    }
  )

  it.each([
    [
      'featured',
      'Saved Uter Route API keys, one per line; used when creating Uter Route channels.',
    ],
    [
      'bailian',
      'Saved Alibaba Bailian API keys, one per line; used when creating Alibaba Bailian channels.',
    ],
    [
      'subscription',
      'Saved Uter.api subscription keys, one per line; used when creating Uter.api channels.',
    ],
  ] as const)('%s explains which saved key it stores', async (prefix, hint) => {
    render(<Fixture prefix={prefix} />)
    expect(await screen.findByText(hint)).toBeVisible()
  })

  it.each(['featured', 'bailian', 'subscription'] as const)(
    '%s shows the credential group and key format',
    async (prefix) => {
      render(<Fixture prefix={prefix} />)
      expect(
        await screen.findByText(
          /Credential group: .+\. Key format: multi-line, one key per line; a single key occupies one line\./
        )
      ).toBeVisible()
    }
  )
})
