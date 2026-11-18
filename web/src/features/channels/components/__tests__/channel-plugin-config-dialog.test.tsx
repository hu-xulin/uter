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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

import { ChannelPluginConfigDialog } from '../dialogs/channel-plugin-config-dialog'

const getPluginCredentials = vi.fn()
const startPluginLogin = vi.fn()
const continuePluginLogin = vi.fn()

vi.mock('../../api', () => ({
  getPluginCredentials: (...args: unknown[]) => getPluginCredentials(...args),
  startPluginLogin: (...args: unknown[]) => startPluginLogin(...args),
  continuePluginLogin: (...args: unknown[]) => continuePluginLogin(...args),
}))

vi.mock('@/components/json-code-editor', () => ({
  JsonCodeEditor: (props: {
    value: string
    onChange: (value: string) => void
    ariaLabel?: string
  }) => (
    <textarea
      aria-label={props.ariaLabel}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
    />
  ),
}))

beforeEach(() => {
  getPluginCredentials.mockReset()
  startPluginLogin.mockReset()
  continuePluginLogin.mockReset()
})

test('saves the plugin config as JSON and rejects an invalid draft', async () => {
  const user = userEvent.setup()
  const onConfigChange = vi.fn()
  const onOpenChange = vi.fn()
  getPluginCredentials.mockResolvedValue([])

  render(
    <ChannelPluginConfigDialog
      open
      onOpenChange={onOpenChange}
      channelId={7}
      pluginName='Vendor'
      config=''
      onConfigChange={onConfigChange}
    />
  )
  const editor = screen.getByLabelText('Plugin config (JSON)')

  fireEvent.change(editor, { target: { value: 'not json' } })
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(onConfigChange).not.toHaveBeenCalled()

  fireEvent.change(editor, { target: { value: '{"region":"eu"}' } })
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(onConfigChange).toHaveBeenCalledWith('{"region":"eu"}')
  expect(onOpenChange).toHaveBeenCalledWith(false)
})

test('renders schema fields and keeps them in sync with the JSON text', async () => {
  const user = userEvent.setup()
  const onConfigChange = vi.fn()
  getPluginCredentials.mockResolvedValue([])

  render(
    <ChannelPluginConfigDialog
      open
      onOpenChange={vi.fn()}
      pluginName='Vendor'
      schema={{
        type: 'object',
        properties: {
          region: {
            type: 'string',
            title: { en: 'Region' },
            enum: ['us', 'eu'],
            default: 'us',
          },
          enabled: { type: 'boolean', title: { en: 'Enabled' } },
        },
      }}
      config=''
      onConfigChange={onConfigChange}
    />
  )

  expect(screen.getByLabelText('Region')).toBeVisible()
  const editor = screen.getByLabelText('Plugin config (JSON)')
  fireEvent.change(editor, {
    target: { value: '{"region":"eu","enabled":true}' },
  })
  await waitFor(() =>
    expect(screen.getByLabelText('Enabled')).toHaveAttribute(
      'aria-checked',
      'true'
    )
  )
  fireEvent.click(screen.getByLabelText('Enabled'))
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(onConfigChange).toHaveBeenCalledWith(
    JSON.stringify({ region: 'eu' }, null, 2)
  )
})

test('lists credential summaries and completes a field login', async () => {
  const user = userEvent.setup()
  getPluginCredentials.mockResolvedValue([
    {
      index: 0,
      label: 'Main',
      account_id: 'acct-1',
      expires_at: 0,
      needs_login: false,
    },
  ])
  startPluginLogin.mockResolvedValue({
    success: true,
    data: {
      flow: 'flow-1',
      step: {
        type: 'fields',
        fields: [
          {
            name: 'access',
            label: { en: 'Token' },
            type: 'password',
            required: true,
          },
        ],
      },
    },
  })
  continuePluginLogin.mockResolvedValue({
    success: true,
    data: { step: { type: 'done' } },
  })

  render(
    <ChannelPluginConfigDialog
      open
      onOpenChange={vi.fn()}
      channelId={7}
      pluginName='Vendor'
      keyHint={{ en: 'Access token' }}
      config=''
      onConfigChange={vi.fn()}
    />
  )

  await waitFor(() => expect(screen.getByText('Main')).toBeVisible())
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  const token = await screen.findByLabelText('Token')
  await user.type(token, 'tok-1')
  await user.click(screen.getByRole('button', { name: 'Continue' }))

  await waitFor(() =>
    expect(continuePluginLogin).toHaveBeenCalledWith(7, {
      flow: 'flow-1',
      input: { fields: { access: 'tok-1' } },
    })
  )
  expect(screen.queryByLabelText('Token')).not.toBeInTheDocument()
})
test('submits the pasted callback address for a paste step', async () => {
  const user = userEvent.setup()
  getPluginCredentials.mockResolvedValue([])
  startPluginLogin.mockResolvedValue({
    success: true,
    data: {
      flow: 'flow-paste',
      step: { type: 'paste', url: 'https://vendor.example/login' },
    },
  })
  continuePluginLogin.mockResolvedValue({
    success: true,
    data: { step: { type: 'done' } },
  })

  render(
    <ChannelPluginConfigDialog
      open
      onOpenChange={vi.fn()}
      channelId={9}
      pluginName='Vendor'
      config=''
      onConfigChange={vi.fn()}
    />
  )
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  const address = await screen.findByLabelText('Address after sign-in')
  await user.type(address, 'https://vendor.example/callback?code=abc')
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  await waitFor(() =>
    expect(continuePluginLogin).toHaveBeenCalledWith(9, {
      flow: 'flow-paste',
      input: { callback_url: 'https://vendor.example/callback?code=abc' },
    })
  )
})
