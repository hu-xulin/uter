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

test.each(['invoke_model', 'mantle'] as const)(
  'AWS creation round-trips the %s interface without losing other settings',
  (apiType) => {
    const form = channelFormSchema.parse({
      ...CHANNEL_FORM_DEFAULT_VALUES,
      name: 'AWS',
      type: 33,
      key: 'key|us-east-1',
      models: 'claude-opus-4-7',
      aws_api_type: apiType,
      aws_key_type: 'api_key',
      settings: '{"custom_option":true}',
    })
    const payload = transformFormDataToCreatePayload(form).channel
    expect(JSON.parse(payload.settings ?? '{}')).toMatchObject({
      aws_api_type: apiType,
      aws_key_type: 'api_key',
      custom_option: true,
    })
    const channel = channelSchema.parse({
      ...payload,
      other: '',
      remark: '',
      id: 7,
      status: 1,
      created_time: 1,
      test_time: 0,
      response_time: 0,
      balance_updated_time: 0,
    })
    expect(transformChannelToFormDefaults(channel).aws_api_type).toBe(apiType)
  }
)

test('changing an AWS channel to another provider removes the AWS interface setting', () => {
  const form = channelFormSchema.parse({
    ...CHANNEL_FORM_DEFAULT_VALUES,
    name: 'Claude',
    type: 14,
    key: 'test-key',
    models: 'claude-opus-4-7',
    aws_api_type: 'mantle',
    settings: '{"aws_api_type":"mantle","aws_key_type":"api_key"}',
  })
  const settings = JSON.parse(
    transformFormDataToCreatePayload(form).channel.settings ?? '{}'
  )
  expect(settings).not.toHaveProperty('aws_api_type')
  expect(settings).not.toHaveProperty('aws_key_type')
})

test('a task plugin channel round-trips its plugin config and drops it on other types', () => {
  const pluginForm = channelFormSchema.parse({
    ...CHANNEL_FORM_DEFAULT_VALUES,
    name: 'Plugin',
    type: 61,
    base_url: 'https://vendor.example',
    key: 'sk-key',
    models: 'video-model',
    task_plugin_key: 'vendor',
    plugin_config: '{"region":"eu"}',
  })
  const pluginPayload = transformFormDataToCreatePayload(pluginForm).channel
  expect(JSON.parse(pluginPayload.setting ?? '{}')).toMatchObject({
    task_plugin_key: 'vendor',
  })
  expect(JSON.parse(pluginPayload.settings ?? '{}')).toMatchObject({
    plugin_config: { region: 'eu' },
  })

  const plainForm = channelFormSchema.parse({
    ...CHANNEL_FORM_DEFAULT_VALUES,
    name: 'OpenAI',
    type: 1,
    key: 'sk-key',
    models: 'gpt-4o',
    plugin_config: '{"region":"eu"}',
  })
  const plainPayload = transformFormDataToCreatePayload(plainForm).channel
  expect(JSON.parse(plainPayload.settings ?? '{}')).not.toHaveProperty(
    'plugin_config'
  )
})

test('a channel pricing-engine override round-trips and an empty one is omitted', () => {
  const overridden = channelFormSchema.parse({
    ...CHANNEL_FORM_DEFAULT_VALUES,
    name: 'Upstream priced',
    type: 1,
    key: 'sk-key',
    models: 'gpt-4o',
    pricing_engine: 'upstream',
  })
  const payload = transformFormDataToCreatePayload(overridden).channel
  expect(JSON.parse(payload.setting ?? '{}')).toMatchObject({
    pricing_engine: 'upstream',
  })

  const inherited = channelFormSchema.parse({
    ...CHANNEL_FORM_DEFAULT_VALUES,
    name: 'Inherited',
    type: 1,
    key: 'sk-key',
    models: 'gpt-4o',
  })
  const inheritedPayload = transformFormDataToCreatePayload(inherited).channel
  expect(JSON.parse(inheritedPayload.setting ?? '{}')).not.toHaveProperty(
    'pricing_engine'
  )
})

test('channel create payload strips translated label prefixes from pasted keys', () => {
  const form = channelFormSchema.parse({
    ...CHANNEL_FORM_DEFAULT_VALUES,
    name: 'Uter Route',
    type: 1,
    key: '密钥sk-TESTONLY-NOT-A-REAL-KEY-END',
    models: 'gpt-4o',
  })
  expect(transformFormDataToCreatePayload(form).channel.key).toBe(
    'sk-TESTONLY-NOT-A-REAL-KEY-END'
  )
})
