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
import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  chatPresetHost,
  getFirstActiveKey,
  isLaunchableChatUrl,
  launchChatUrl,
  resolveChatEmbedPolicy,
  resolveChatUrl,
  toApiBaseUrl,
} from '../chat-links'

const ADDRESS = 'https://uter.ai'
const API_KEY = 'sk-bwwWmrkhvgqMbuDNOaKA3q4OOBmJHqerVlM2oAPRUzczSNhU'

function decodeCherryPayload(url: string) {
  const encoded = new URLSearchParams(url.split('?')[1]).get('data') ?? ''
  return JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('toApiBaseUrl', () => {
  test('appends the /v1 API prefix to the site root', () => {
    expect(toApiBaseUrl('https://uter.ai')).toBe('https://uter.ai/v1')
  })

  test('ignores a trailing slash and never doubles the prefix', () => {
    expect(toApiBaseUrl('https://uter.ai/')).toBe('https://uter.ai/v1')
    expect(toApiBaseUrl('https://uter.ai/v1')).toBe('https://uter.ai/v1')
    expect(toApiBaseUrl('https://uter.ai/v1/')).toBe('https://uter.ai/v1')
  })

  test('returns an empty string for an empty address', () => {
    expect(toApiBaseUrl('')).toBe('')
  })
})

describe('resolveChatUrl', () => {
  test('hands chat clients the /v1 base URL they actually call', () => {
    const payload = decodeCherryPayload(
      resolveChatUrl({
        template: 'cherrystudio://providers/api-keys?v=1&data={cherryConfig}',
        apiKey: API_KEY,
        serverAddress: ADDRESS,
      })
    )

    expect(payload).toMatchObject({
      id: 'uter',
      name: 'Uter',
      type: 'openai',
      baseUrl: 'https://uter.ai/v1',
      apiKey: API_KEY,
    })
  })

  test('passes the /v1 base URL to AQBot', () => {
    const url = resolveChatUrl({
      template: 'aqbot://providers?{aqbotConfig}',
      apiKey: API_KEY,
      serverAddress: ADDRESS,
    })

    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('baseurl')).toBe('https://uter.ai/v1')
    expect(params.get('apikey')).toBe(API_KEY)
  })

  test('expands {apiBase} separately from {address}', () => {
    const url = resolveChatUrl({
      template: 'ama://set-api-key?server={apiBase}&origin={address}',
      apiKey: API_KEY,
      serverAddress: ADDRESS,
    })

    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('server')).toBe('https://uter.ai/v1')
    expect(params.get('origin')).toBe('https://uter.ai')
  })

  test('normalizes a key that is missing the sk- prefix', () => {
    const payload = decodeCherryPayload(
      resolveChatUrl({
        template: 'cherrystudio://providers/api-keys?v=1&data={cherryConfig}',
        apiKey: 'abc123',
        serverAddress: ADDRESS,
      })
    )

    expect(payload.apiKey).toBe('sk-abc123')
  })
})

describe('isLaunchableChatUrl', () => {
  test('rejects bare words that would resolve against the current origin', () => {
    expect(isLaunchableChatUrl('ccswitch')).toBe(false)
    expect(isLaunchableChatUrl('fluentread')).toBe(false)
  })

  test('accepts real custom-protocol links', () => {
    expect(isLaunchableChatUrl('ccswitch://v1/import?app=claude')).toBe(true)
    expect(isLaunchableChatUrl('cherrystudio://providers/api-keys')).toBe(true)
  })
})

describe('launchChatUrl', () => {
  function spyOnClicks() {
    const clicked: string[] = []
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push(this.getAttribute('href') ?? '')
      })
    return { click, clicked }
  }

  test('dispatches custom protocols as a link click, never window.open', () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)
    const { click, clicked } = spyOnClicks()

    launchChatUrl('cherrystudio://providers/api-keys?v=1&data=abc')

    expect(open).not.toHaveBeenCalled()
    expect(clicked).toEqual(['cherrystudio://providers/api-keys?v=1&data=abc'])
    // The synthetic anchor must not be left behind in the DOM.
    expect(document.querySelector('a[href^="cherrystudio:"]')).toBeNull()
    click.mockRestore()
  })

  test('still opens http(s) links in a new tab', () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)
    const { click, clicked } = spyOnClicks()

    launchChatUrl('https://aiaw.app/set-provider')

    expect(open).toHaveBeenCalledWith(
      'https://aiaw.app/set-provider',
      '_blank',
      'noopener,noreferrer'
    )
    expect(clicked).toEqual([])
    click.mockRestore()
  })
})

describe('resolveChatEmbedPolicy', () => {
  test('rejects non-http embed targets', () => {
    expect(
      resolveChatEmbedPolicy('javascript:alert(1)', 'https://uter.ai')
    ).toEqual({ embeddable: false, reason: 'invalid-url' })
    expect(
      resolveChatEmbedPolicy(
        'data:text/html,<script>1</script>',
        'https://uter.ai'
      )
    ).toEqual({ embeddable: false, reason: 'invalid-url' })
  })

  test('withholds allow-same-origin when the preset is same-origin', () => {
    // 同源 + allow-scripts + allow-same-origin 时，被嵌入页能访问父窗口 DOM
    // 并自行移除 sandbox 属性，等于没有沙箱。
    const policy = resolveChatEmbedPolicy(
      'https://uter.ai/chat-client',
      'https://uter.ai'
    )
    expect(policy.embeddable).toBe(true)
    if (!policy.embeddable) return
    expect(policy.sandbox).not.toContain('allow-same-origin')
    expect(policy.sandbox).toContain('allow-scripts')
  })

  test('keeps allow-same-origin for cross-origin presets', () => {
    const policy = resolveChatEmbedPolicy(
      'https://chat.example.com/app',
      'https://uter.ai'
    )
    expect(policy.embeddable).toBe(true)
    if (!policy.embeddable) return
    expect(policy.sandbox).toContain('allow-same-origin')
  })

  test('does not treat a look-alike host as same-origin', () => {
    const policy = resolveChatEmbedPolicy(
      'https://uter.ai.evil.test/chat',
      'https://uter.ai'
    )
    expect(policy.embeddable).toBe(true)
    if (!policy.embeddable) return
    expect(policy.sandbox).toContain('allow-same-origin')
  })
})

describe('chatPresetHost', () => {
  test('returns the host that will receive the API key', () => {
    expect(chatPresetHost('https://chat.example.com/app?x=1')).toBe(
      'chat.example.com'
    )
  })

  test('returns an empty string for an unparsable URL', () => {
    expect(chatPresetHost('not a url')).toBe('')
  })
})

describe('getFirstActiveKey', () => {
  test('returns the first enabled key', () => {
    expect(
      getFirstActiveKey([
        { key: 'a', status: 2 },
        { key: 'b', status: 1 },
        { key: 'c', status: 1 },
      ])
    ).toEqual({ key: 'b', status: 1 })
  })

  test('returns undefined when nothing is enabled', () => {
    expect(getFirstActiveKey([{ key: 'a', status: 2 }])).toBeUndefined()
    expect(getFirstActiveKey(undefined)).toBeUndefined()
  })
})
