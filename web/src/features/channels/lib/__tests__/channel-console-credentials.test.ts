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
import { describe, expect, test } from 'vitest'

import type { Channel } from '../../types'
import {
  CHANNEL_FORM_DEFAULT_VALUES,
  transformChannelToFormDefaults,
  transformFormDataToCreatePayload,
} from '../channel-form'

// buildSettingsJSON is private; exercise it through the public create payload.
type ConsoleSettingsPayload = {
  upstream_console?: { login_url?: string; username?: string; password?: string }
}

function settingsOf(values: typeof CHANNEL_FORM_DEFAULT_VALUES): ConsoleSettingsPayload {
  const payload = transformFormDataToCreatePayload(values)
  return JSON.parse(payload.channel.settings || '{}') as ConsoleSettingsPayload
}

function baseChannel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: 1,
    type: 1,
    name: 'test',
    key: '',
    models: '',
    group: 'default',
    status: 1,
    base_url: '',
    channel_info: {
      is_multi_key: false,
      multi_key_size: 0,
      multi_key_status_list: {},
      multi_key_mode: 'random',
      multi_key_polling_index: 0,
    },
    ...overrides,
  } as Channel
}

describe('console credentials transform', () => {
  test('build writes console block only when url and username are present', () => {
    const data = {
      ...CHANNEL_FORM_DEFAULT_VALUES,
      console_login_url: '  https://console.example.com  ',
      console_username: 'admin',
      console_password: 'secret',
    }
    const settings = settingsOf(data)
    expect(settings.upstream_console).toEqual({
      login_url: 'https://console.example.com',
      username: 'admin',
      password: 'secret',
    })
  })

  test('build omits console block when credentials incomplete', () => {
    const onlyUrl = settingsOf({
      ...CHANNEL_FORM_DEFAULT_VALUES,
      console_login_url: 'https://console.example.com',
      console_username: '',
      console_password: 'secret',
    })
    expect(onlyUrl.upstream_console).toBeUndefined()
  })

  test('build omits blank password so backend keeps stored password', () => {
    const settings = settingsOf({
      ...CHANNEL_FORM_DEFAULT_VALUES,
      console_login_url: 'https://console.example.com',
      console_username: 'admin',
      console_password: '',
    })
    expect(settings.upstream_console?.password).toBeUndefined()
  })

  test('transform reads url and username but never a password', () => {
    const channel = baseChannel({
      settings: JSON.stringify({
        upstream_console: {
          login_url: 'https://console.example.com',
          username: 'admin',
          has_password: true,
        },
      }),
    })
    const values = transformChannelToFormDefaults(channel)
    expect(values.console_login_url).toBe('https://console.example.com')
    expect(values.console_username).toBe('admin')
    expect(values.console_password).toBe('')
  })

  test('transform defaults to empty console fields when no settings', () => {
    const values = transformChannelToFormDefaults(baseChannel())
    expect(values.console_login_url).toBe('')
    expect(values.console_username).toBe('')
    expect(values.console_password).toBe('')
  })
})
