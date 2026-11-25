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
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { describe, expect, test, vi } from 'vitest'

import { Form } from '@/components/ui/form'
import { api } from '@/lib/api'

import {
  CHANNEL_FORM_DEFAULT_VALUES,
  type ChannelFormValues,
} from '../../lib/channel-form'
import { ChannelConsoleCredentialsSection } from '../channel-console-credentials-section'

type HarnessProps = {
  channelId?: number | null
  primaryModels?: string[]
  values?: Partial<ChannelFormValues>
  onSaveCredentials?: () => Promise<void> | void
  savingCredentials?: boolean
}

function Harness(props: HarnessProps) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      })
  )
  const form = useForm<ChannelFormValues>({
    defaultValues: { ...CHANNEL_FORM_DEFAULT_VALUES, ...props.values },
  })
  return (
    <QueryClientProvider client={client}>
      <Form {...form}>
        <form>
          <ChannelConsoleCredentialsSection
            form={form}
            channelId={props.channelId === undefined ? 1 : props.channelId}
            sensitiveLocked={false}
            primaryModels={props.primaryModels ?? []}
            onSaveCredentials={props.onSaveCredentials}
            savingCredentials={props.savingCredentials}
          />
        </form>
      </Form>
    </QueryClientProvider>
  )
}

describe('channel console credentials section', () => {
  test('renders three inputs for a channel regardless of type', () => {
    render(<Harness />)
    expect(
      screen.getByRole('textbox', { name: 'Console login URL' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: 'Console username' })
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Console password')).toHaveAttribute(
      'type',
      'password'
    )
  })

  test('password visibility toggles between password and text', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const password = screen.getByLabelText('Console password')
    expect(password).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(password).toHaveAttribute('type', 'password')
  })

  test('cross-check button hidden when credentials incomplete', () => {
    render(
      <Harness values={{ console_login_url: 'https://console.example.com' }} />
    )
    expect(
      screen.queryByRole('button', { name: /Fetch & cross-check/ })
    ).toBeNull()
  })

  test('cross-check button appears when url and username are filled', () => {
    render(
      <Harness
        values={{
          console_login_url: 'https://console.example.com',
          console_username: 'admin',
        }}
      />
    )
    expect(
      screen.getByRole('button', { name: /Fetch & cross-check/ })
    ).toBeInTheDocument()
  })

  test('save button sits next to cross-check and calls onSaveCredentials', async () => {
    const user = userEvent.setup()
    const onSaveCredentials = vi.fn().mockResolvedValue(undefined)
    render(
      <Harness
        values={{
          console_login_url: 'https://console.example.com',
          console_username: 'admin',
        }}
        onSaveCredentials={onSaveCredentials}
      />
    )
    const save = screen.getByRole('button', { name: /Save credentials/ })
    const crossCheck = screen.getByRole('button', {
      name: /Fetch & cross-check/,
    })
    expect(save).toBeInTheDocument()
    expect(crossCheck).toBeInTheDocument()
    expect(save.compareDocumentPosition(crossCheck) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.click(save)
    expect(onSaveCredentials).toHaveBeenCalledTimes(1)
  })

  test('save button hidden without a save callback and disabled while saving', () => {
    const values = {
      console_login_url: 'https://console.example.com',
      console_username: 'admin',
    }
    const { unmount } = render(<Harness values={values} />)
    expect(screen.queryByRole('button', { name: /Save credentials/ })).toBeNull()
    unmount()
    render(<Harness values={values} onSaveCredentials={() => {}} savingCredentials />)
    expect(screen.getByRole('button', { name: /Save credentials/ })).toBeDisabled()
  })

  test('shows API Key fallback message when backend reports not_configured', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'get').mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          status: 'not_configured',
          login_succeeded: false,
          fallback_primary: true,
          models: [],
          prices: [],
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    })
    render(
      <Harness
        values={{
          console_login_url: 'https://console.example.com',
          console_username: 'admin',
        }}
      />
    )
    await user.click(
      screen.getByRole('button', { name: /Fetch & cross-check/ })
    )
    await waitFor(() =>
      expect(
        screen.getByText(/Using API Key \+ Base URL as the source of truth/)
      ).toBeInTheDocument()
    )
  })

  test('shows console prices on demand for cross-checking', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'get').mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          status: 'success',
          login_succeeded: true,
          fallback_primary: false,
          models: ['gpt-4o'],
          prices: [
            {
              model: 'gpt-4o',
              input_price: 2.5,
              output_price: 10,
              currency: 'USD',
            },
          ],
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    })
    render(
      <Harness
        values={{
          console_login_url: 'https://console.example.com',
          console_username: 'admin',
        }}
        primaryModels={['gpt-4o']}
      />
    )
    await user.click(
      screen.getByRole('button', { name: /Fetch & cross-check/ })
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Show console prices' })
      ).toBeInTheDocument()
    )
    expect(screen.queryByText(/Input price: 2\.5/)).toBeNull()

    await user.click(
      screen.getByRole('button', { name: 'Show console prices' })
    )
    expect(screen.getByText(/Input price: 2\.5/)).toBeInTheDocument()
    expect(screen.getByText(/Output price: 10/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Hide console prices' })
    ).toHaveAttribute('aria-expanded', 'true')
  })
})
