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

import {
  CHANNEL_TYPE_ALI,
  CHANNEL_TYPE_NEW_API,
  CHANNEL_TYPE_UTER_ROUTE,
} from '../../constants'
import {
  channelProviderGroupForTarget,
  channelProviderSecretOptionKey,
  readChannelProviderConnection,
  shouldUseProviderLoginURLAsBaseURL,
  resolveProviderAPIKeySource,
  resolveProviderAPIKeySources,
} from '../channel-provider-prefill'

const options = [
  {
    key: 'channel_provider.featured.login_url',
    value: 'https://featured.example',
  },
  { key: 'channel_provider.featured.username', value: 'featured-user' },
  {
    key: 'channel_provider.featured.api_url',
    value: 'https://featured-api.example',
  },
  {
    key: 'channel_provider.bailian.login_url',
    value: 'https://bailian.example',
  },
  {
    key: 'channel_provider.bailian.api_url',
    value: 'https://ws-space.example',
  },
  {
    key: 'channel_provider.subscription.login_url',
    value: 'https://sub.example',
  },
  {
    key: 'channel_provider.subscription.api_url',
    value: 'https://sub-api.example',
  },
]

describe('channelProviderGroupForTarget', () => {
  test('三类托管渠道映射到系统设置分组', () => {
    expect(channelProviderGroupForTarget({ kind: 'uterroute' })).toBe(
      'featured'
    )
    expect(
      channelProviderGroupForTarget({ kind: 'builtin', type: CHANNEL_TYPE_ALI })
    ).toBe('bailian')
    expect(channelProviderGroupForTarget({ kind: 'uterapi' })).toBe(
      'subscription'
    )
  })

  test('其它渠道与未选择供应商不映射', () => {
    expect(channelProviderGroupForTarget(null)).toBeNull()
    expect(
      channelProviderGroupForTarget({
        kind: 'builtin',
        type: CHANNEL_TYPE_NEW_API,
      })
    ).toBeNull()
    expect(
      channelProviderGroupForTarget({ kind: 'plugin', key: 'x' })
    ).toBeNull()
    expect(
      channelProviderGroupForTarget({
        kind: 'builtin',
        type: CHANNEL_TYPE_UTER_ROUTE,
      })
    ).toBeNull()
  })
})

test('三个渠道的控制台登录地址都不能作为 API Base URL', () => {
  expect(shouldUseProviderLoginURLAsBaseURL('bailian')).toBe(false)
  expect(shouldUseProviderLoginURLAsBaseURL('featured')).toBe(false)
  expect(shouldUseProviderLoginURLAsBaseURL('subscription')).toBe(false)
})

describe('readChannelProviderConnection', () => {
  test('读取明文 login_url / username / api_url，缺项为空串', () => {
    expect(readChannelProviderConnection(options, 'featured')).toEqual({
      loginUrl: 'https://featured.example',
      username: 'featured-user',
      apiUrl: 'https://featured-api.example',
    })
    expect(readChannelProviderConnection(options, 'bailian')).toEqual({
      loginUrl: 'https://bailian.example',
      username: '',
      apiUrl: 'https://ws-space.example',
    })
    expect(readChannelProviderConnection(undefined, 'subscription')).toEqual({
      loginUrl: '',
      username: '',
      apiUrl: '',
    })
  })

  test('API 地址与登录地址分离，绝不从登录地址推导', () => {
    const connection = readChannelProviderConnection(options, 'subscription')
    expect(connection.loginUrl).toBe('https://sub.example')
    expect(connection.apiUrl).toBe('https://sub-api.example')
    expect(connection.apiUrl).not.toBe(connection.loginUrl)
  })
})

test('密钥 option key 与后端分组一致', () => {
  expect(channelProviderSecretOptionKey('featured', 'api_key')).toBe(
    'channel_provider.featured.api_key'
  )
  expect(channelProviderSecretOptionKey('bailian', 'password')).toBe(
    'channel_provider.bailian.password'
  )
  expect(channelProviderSecretOptionKey('subscription', 'api_key')).toBe(
    'channel_provider.subscription.api_key'
  )
})

test('密钥存在分组槽位时解析出 slot option key，而非顶层 api_key', () => {
  const slotOptions = [
    {
      key: 'ChannelProviderCredentialMasks',
      value: JSON.stringify({
        featured: {
          api_key: '',
          password: 'Uter****026.',
          slots: [
            { id: 'slot-mwxg677x-1', api_key: 'sk-a****1\nsk-b****2' },
            { id: 'slot-empty', api_key: '' },
          ],
        },
      }),
    },
  ]
  expect(resolveProviderAPIKeySource(slotOptions, 'featured')).toEqual({
    optionKey: 'channel_provider.featured.slot_slot-mwxg677x-1_api_key',
    maskLines: ['sk-a****1', 'sk-b****2'],
    group: '',
    mode: '',
  })
})

test('无分组槽位时回退顶层 api_key；都没有则返回 null', () => {
  const legacy = [
    {
      key: 'ChannelProviderCredentialMasks',
      value: JSON.stringify({ bailian: { api_key: 'bk****1' } }),
    },
  ]
  expect(resolveProviderAPIKeySource(legacy, 'bailian')).toEqual({
    optionKey: 'channel_provider.bailian.api_key',
    maskLines: ['bk****1'],
    group: '',
    mode: '',
  })
  expect(resolveProviderAPIKeySource(legacy, 'featured')).toBeNull()
})

test('订阅多分组槽位按 id 合并分组与模式元数据', () => {
  const options = [
    {
      key: 'ChannelProviderCredentialMasks',
      value: JSON.stringify({
        subscription: {
          slots: [
            { id: 'slot-a', api_key: 'a****1' },
            { id: 'slot-b', api_key: 'b****1' },
          ],
        },
      }),
    },
    {
      key: 'channel_provider.subscription.credential_slots',
      value: JSON.stringify([
        { id: 'slot-a', group: 'Claude-kiro', mode: 'single' },
        { id: 'slot-b', group: 'Codex Pro', mode: 'multi_to_single' },
      ]),
    },
  ]
  expect(resolveProviderAPIKeySources(options, 'subscription')).toEqual([
    {
      optionKey: 'channel_provider.subscription.slot_slot-a_api_key',
      maskLines: ['a****1'],
      group: 'Claude-kiro',
      mode: 'single',
    },
    {
      optionKey: 'channel_provider.subscription.slot_slot-b_api_key',
      maskLines: ['b****1'],
      group: 'Codex Pro',
      mode: 'multi_to_single',
    },
  ])
})
