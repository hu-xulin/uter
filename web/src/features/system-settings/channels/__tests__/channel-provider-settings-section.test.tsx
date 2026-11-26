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
import userEvent from '@testing-library/user-event'
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

vi.mock('../../../channels/api', () => ({
  getUterAPIPricingGroups: vi.fn().mockResolvedValue({
    success: true,
    data: {
      groups: [
        { key: 'claude-economy', name: 'Claude Code · 经济' },
        { key: 'claude-standard', name: 'Claude Code · 标准' },
      ],
    },
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
              apiUrl: '',
              slots: [],
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
    '%s renders only grouped key fields, with no standalone API Key field',
    async (prefix) => {
      render(<Fixture prefix={prefix} />)
      // The standalone "API Key" textarea duplicated the grouped slots below
      // it and has been removed for every provider (featured/bailian/
      // subscription share this section).
      expect(screen.queryByLabelText('API Key')).toBeNull()
      const groupedKey = await screen.findByLabelText('API keys 1')
      expect(groupedKey.tagName).toBe('TEXTAREA')
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

  it('bailian renders the Alibaba Cloud AccessKey pair', async () => {
    render(<Fixture prefix='bailian' />)
    expect(await screen.findByLabelText('Access Key ID')).toBeInTheDocument()
    expect(screen.getByLabelText('Access Key Secret')).toBeInTheDocument()
    expect(screen.getByText('Alibaba Cloud AccessKey')).toBeVisible()
  })

  it.each(['featured', 'subscription'] as const)(
    '%s does not render Bailian AccessKey fields',
    async (prefix) => {
      render(<Fixture prefix={prefix} />)
      expect(await screen.findByLabelText('Password')).toBeInTheDocument()
      expect(screen.queryByLabelText('Access Key ID')).toBeNull()
      expect(screen.queryByLabelText('Access Key Secret')).toBeNull()
    }
  )

  it.each(prefixes)(
    '%s renders grouped key slot controls with mode and keys',
    async (prefix) => {
      render(<Fixture prefix={prefix} />)
      expect(await screen.findByText('Grouped API keys')).toBeVisible()
      expect(screen.getByLabelText('Key group 1')).toBeInTheDocument()
      expect(screen.getByLabelText('Add Mode 1')).toBeInTheDocument()
      expect(screen.getByLabelText('API keys 1')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Add group' })).toBeVisible()
    }
  )

  it('subscription offers the upstream pricing groups in the key slot', async () => {
    const user = userEvent.setup()
    render(<Fixture prefix='subscription' />)
    const groupSelect = await screen.findByRole('combobox', {
      name: 'Key group 1',
    })
    await user.click(groupSelect)
    expect(
      await screen.findByRole('option', { name: 'Claude Code · 经济' })
    ).toBeVisible()
    expect(screen.getByText('Claude Code · 标准')).toBeVisible()
  })

  it('reveals the rotation strategy only for multi-key mode', async () => {
    const user = userEvent.setup()
    render(<Fixture prefix='bailian' />)
    expect(screen.queryByLabelText('Rotation strategy 1')).toBeNull()
    await user.click(screen.getByLabelText('Add Mode 1'))
    await user.click(
      await screen.findByRole('option', {
        name: 'Multi-Key Mode (multiple keys, one channel)',
      })
    )
    expect(
      await screen.findByLabelText('Rotation strategy 1')
    ).toBeInTheDocument()
  })
})
