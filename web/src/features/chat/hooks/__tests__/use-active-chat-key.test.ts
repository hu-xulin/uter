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
import i18next from 'i18next'
import { afterEach, describe, expect, test } from 'vitest'

const { api } = await import('@/lib/api')
const { fetchActiveChatKey, createDefaultChatKey, NoActiveChatKeyError } =
  await import('../use-active-chat-key')

type ApiMethod = (url: string, data?: unknown) => Promise<{ data: unknown }>
type MockableApi = { get: ApiMethod; post: ApiMethod }

const apiClient = api as unknown as MockableApi
const originalGet = apiClient.get
const originalPost = apiClient.post

afterEach(async () => {
  apiClient.get = originalGet
  apiClient.post = originalPost
  await i18next.changeLanguage('en')
})

function respondWithTokens(items: Array<{ id: number; status: number }>) {
  apiClient.get = async () => ({
    data: { success: true, data: { items } },
  })
}

describe('fetchActiveChatKey', () => {
  test('throws a typed, localizable error when no key is enabled', async () => {
    respondWithTokens([{ id: 7, status: 2 }])

    await expect(fetchActiveChatKey()).rejects.toBeInstanceOf(
      NoActiveChatKeyError
    )

    await i18next.addResourceBundle(
      'zh',
      'translation',
      { 'No enabled tokens available': '当前没有可用的启用令牌' },
      true,
      true
    )
    await i18next.changeLanguage('zh')

    await expect(fetchActiveChatKey()).rejects.toThrow('当前没有可用的启用令牌')
  })

  test('reuses the first enabled key with the sk- prefix', async () => {
    respondWithTokens([
      { id: 3, status: 2 },
      { id: 9, status: 1 },
    ])
    const postedUrls: string[] = []
    apiClient.post = async (url) => {
      postedUrls.push(url)
      return { data: { success: true, data: { key: 'abcdef' } } }
    }

    await expect(fetchActiveChatKey()).resolves.toBe('sk-abcdef')
    expect(postedUrls).toEqual(['/api/token/9/key'])
  })
})

describe('createDefaultChatKey', () => {
  test('creates the key with the API Keys page defaults, then returns it', async () => {
    const calls: Array<{ url: string; data?: unknown }> = []
    let created = false
    apiClient.get = async () => ({
      data: {
        success: true,
        data: { items: created ? [{ id: 12, status: 1 }] : [] },
      },
    })
    apiClient.post = async (url, data) => {
      calls.push({ url, data })
      if (url === '/api/token/') {
        created = true
        return { data: { success: true, message: '' } }
      }
      return { data: { success: true, data: { key: 'newkey' } } }
    }

    await expect(createDefaultChatKey()).resolves.toBe('sk-newkey')

    expect(calls).toEqual([
      {
        url: '/api/token/',
        data: {
          name: 'Default key',
          remain_quota: 0,
          expired_time: -1,
          unlimited_quota: true,
          model_limits_enabled: false,
          model_limits: '',
          allow_ips: '',
          group: '',
          auto_groups: [],
          cross_group_retry: false,
        },
      },
      { url: '/api/token/12/key', data: undefined },
    ])
  })

  test('surfaces the creation failure instead of continuing without a key', async () => {
    apiClient.post = async () => ({
      data: { success: false, message: 'Reached the maximum token limit (10)' },
    })

    await expect(createDefaultChatKey()).rejects.toThrow(
      'Reached the maximum token limit (10)'
    )
  })
})
