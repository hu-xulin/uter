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
import { expect, test } from 'vitest'

import { channelSchema } from '../../types'
import {
  CHANNEL_FORM_DEFAULT_VALUES,
  channelFormSchema,
  transformChannelToFormDefaults,
  transformFormDataToCreatePayload,
} from '../channel-form'

test('custom channel branding round-trips through settings', () => {
  const form = channelFormSchema.parse({
    ...CHANNEL_FORM_DEFAULT_VALUES,
    name: 'Uter',
    type: 60,
    base_url: 'https://api.dreamrouter.ai',
    key: 'test-key',
    models: 'gpt-5',
    branding_display_name: 'Uter 官方渠道',
    branding_logo: 'https://cdn.example/uter-light.svg',
    branding_logo_dark: 'https://cdn.example/uter-dark.svg',
    settings: '{"custom_option":true}',
  })
  const payload = transformFormDataToCreatePayload(form).channel
  expect(JSON.parse(payload.settings ?? '{}')).toMatchObject({
    custom_option: true,
    branding: {
      display_name: 'Uter 官方渠道',
      logo: 'https://cdn.example/uter-light.svg',
      logo_dark: 'https://cdn.example/uter-dark.svg',
    },
  })

  const channel = channelSchema.parse({
    ...payload,
    other: '',
    remark: '',
    id: 9,
    status: 1,
    created_time: 1,
    test_time: 0,
    response_time: 0,
    balance_updated_time: 0,
  })
  const defaults = transformChannelToFormDefaults(channel)
  expect(defaults.branding_display_name).toBe('Uter 官方渠道')
  expect(defaults.branding_logo).toBe('https://cdn.example/uter-light.svg')
  expect(defaults.branding_logo_dark).toBe(
    'https://cdn.example/uter-dark.svg'
  )
})

test('clearing custom branding removes it without touching other settings', () => {
  const form = channelFormSchema.parse({
    ...CHANNEL_FORM_DEFAULT_VALUES,
    name: 'Uter',
    type: 60,
    base_url: 'https://api.dreamrouter.ai',
    key: 'test-key',
    models: 'gpt-5',
    branding_display_name: ' ',
    branding_logo: '',
    branding_logo_dark: '',
    settings: '{"custom_option":true,"branding":{"display_name":"Old"}}',
  })
  const settings = JSON.parse(
    transformFormDataToCreatePayload(form).channel.settings ?? '{}'
  )
  expect(settings).toMatchObject({ custom_option: true })
  expect(settings).not.toHaveProperty('branding')
})

test('advanced custom channels keep their own display editor', () => {
  const form = channelFormSchema.parse({
    ...CHANNEL_FORM_DEFAULT_VALUES,
    name: 'Custom',
    type: 58,
    base_url: 'https://custom.example',
    key: 'test-key',
    models: 'gpt-5',
    branding_display_name: 'Ignored',
    advanced_custom: JSON.stringify({
      advanced_routes: [
        {
          incoming_path: '/v1/models',
          upstream_path: '/v1/models',
          converter: 'none',
        },
      ],
    }),
  })
  const settings = JSON.parse(
    transformFormDataToCreatePayload(form).channel.settings ?? '{}'
  )
  expect(settings).not.toHaveProperty('branding')
})
