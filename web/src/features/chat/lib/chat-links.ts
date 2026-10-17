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
import { API_KEY_STATUS } from '@/features/keys/constants'

export type ChatLinkType = 'web' | 'custom-protocol' | 'fluent'

export type ChatPreset = {
  id: string
  name: string
  url: string
  type: ChatLinkType
}

export type RawChatConfig =
  | string
  | Record<string, unknown>
  | Array<Record<string, unknown>>
  | null
  | undefined

export type ResolveChatUrlParams = {
  template: string
  apiKey?: string
  serverAddress: string
}

export type ActiveApiKey = {
  key: string
  status: number
}

const HTTP_REGEX = /^https?:\/\//i
const SCHEME_REGEX = /^[a-z][a-z0-9+.-]*:/i
const API_VERSION_SUFFIX = '/v1'

function toBase64(value: string) {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(value)
  }

  type BufferConstructorLike = {
    from(data: string, encoding: string): { toString(encoding: string): string }
  }

  const globalObj =
    typeof globalThis !== 'undefined'
      ? (globalThis as Record<string, unknown>)
      : undefined
  const bufferCtor = globalObj?.Buffer

  if (
    typeof bufferCtor === 'function' &&
    typeof (bufferCtor as unknown as BufferConstructorLike).from === 'function'
  ) {
    return (bufferCtor as unknown as BufferConstructorLike)
      .from(value, 'utf-8')
      .toString('base64')
  }

  return ''
}

export function detectChatLinkType(url: string): ChatLinkType {
  if (HTTP_REGEX.test(url)) {
    return 'web'
  }
  if (url.toLowerCase().startsWith('fluent')) {
    return 'fluent'
  }
  return 'custom-protocol'
}

export function chatLinkRequiresApiKey(url: string): boolean {
  return (
    url.includes('{key}') ||
    url.includes('{cherryConfig}') ||
    url.includes('{aionuiConfig}') ||
    url.includes('{deepchatConfig}') ||
    url.includes('{aqbotConfig}')
  )
}

export function parseChatConfig(raw: RawChatConfig): ChatPreset[] {
  let parsed: unknown = raw

  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return []
    }
  }

  if (!Array.isArray(parsed)) {
    return []
  }

  return parsed
    .map((entry, index) => {
      if (
        !entry ||
        typeof entry !== 'object' ||
        Array.isArray(entry) ||
        Object.keys(entry).length !== 1
      ) {
        return null
      }

      const [name, value] = Object.entries(entry)[0]
      if (typeof value !== 'string' || typeof name !== 'string') {
        return null
      }

      const url = value.trim()
      if (!url) {
        return null
      }

      return {
        id: String(index),
        name,
        url,
        type: detectChatLinkType(url),
      } satisfies ChatPreset
    })
    .filter((item): item is ChatPreset => item !== null)
}

function replaceToken(source: string, token: string, value: string) {
  return source.split(token).join(value)
}

function normalizeApiKey(apiKey: string): string {
  const trimmed = apiKey.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('sk-') ? trimmed : `sk-${trimmed}`
}

/**
 * Chat clients speak the OpenAI-compatible API, which is served under `/v1`.
 * `serverAddress` is the site root (it is also used to build OAuth callbacks
 * and passkey origins), so it must never be handed to a client verbatim.
 */
export function toApiBaseUrl(serverAddress: string): string {
  const base = (serverAddress ?? '').trim().replace(/\/+$/, '')
  if (!base) return ''
  return base.endsWith(API_VERSION_SUFFIX)
    ? base
    : `${base}${API_VERSION_SUFFIX}`
}

/**
 * A preset template is only launchable when it carries a scheme. A bare word
 * such as `ccswitch` would otherwise be resolved against the current origin
 * and land on a 404 page instead of reaching the client.
 */
export function isLaunchableChatUrl(url: string): boolean {
  return SCHEME_REGEX.test(url)
}

/**
 * `window.open()` cannot hand a custom scheme to the operating system: the
 * browser opens a real tab at that URL and renders ERR_UNKNOWN_URL_SCHEME (or
 * nothing at all). Only a top-level navigation triggers the external
 * application handoff, so custom protocols are dispatched through a synthetic
 * link click rather than `open()`.
 */
export function launchChatUrl(url: string): void {
  if (typeof window === 'undefined' || !url) return

  if (HTTP_REGEX.test(url)) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export function resolveChatUrl({
  template,
  apiKey,
  serverAddress,
}: ResolveChatUrlParams): string {
  let url = template
  const safeServerAddress = serverAddress || ''
  const apiBaseUrl = toApiBaseUrl(safeServerAddress)

  const safeApiKey = normalizeApiKey(apiKey || '')

  if (url.includes('{cherryConfig}')) {
    const payload = {
      id: 'uter',
      name: 'Uter',
      type: 'openai',
      baseUrl: apiBaseUrl,
      apiKey: safeApiKey,
    }
    const encoded = encodeURIComponent(toBase64(JSON.stringify(payload)))
    return replaceToken(url, '{cherryConfig}', encoded)
  }

  if (url.includes('{aionuiConfig}')) {
    const payload = {
      platform: 'uter',
      baseUrl: apiBaseUrl,
      apiKey: safeApiKey,
    }
    const encoded = encodeURIComponent(toBase64(JSON.stringify(payload)))
    return replaceToken(url, '{aionuiConfig}', encoded)
  }

  if (url.includes('{deepchatConfig}')) {
    const payload = {
      id: 'uter',
      baseUrl: apiBaseUrl,
      apiKey: safeApiKey,
    }
    const encoded = encodeURIComponent(toBase64(JSON.stringify(payload)))
    return replaceToken(url, '{deepchatConfig}', encoded)
  }

  if (url.includes('{aqbotConfig}')) {
    const query = [
      `name=${encodeURIComponent('Uter')}`,
      `baseurl=${encodeURIComponent(apiBaseUrl)}`,
      `apikey=${encodeURIComponent(safeApiKey)}`,
      'type=openai',
    ].join('&')
    return replaceToken(url, '{aqbotConfig}', query)
  }

  if (apiBaseUrl) {
    url = replaceToken(url, '{apiBase}', encodeURIComponent(apiBaseUrl))
  }

  if (safeServerAddress) {
    const encodedAddress = encodeURIComponent(safeServerAddress)
    url = replaceToken(url, '{address}', encodedAddress)
  }

  if (safeApiKey) {
    url = replaceToken(url, '{key}', safeApiKey)
  }

  return url
}

export function getFirstActiveKey(
  keys: ActiveApiKey[] | undefined
): ActiveApiKey | undefined {
  if (!Array.isArray(keys)) return undefined
  return keys.find((item) => item.status === API_KEY_STATUS.ENABLED)
}

// ============================================================================
// Embedded chat isolation
// ============================================================================

export type ChatEmbedRejection = 'invalid-url' | 'same-origin'

export type ChatEmbedPolicy =
  | { embeddable: true; sandbox: string }
  | { embeddable: false; reason: ChatEmbedRejection }

/**
 * iframe 的 sandbox 属性。
 *
 * `allow-scripts` + `allow-same-origin` 同时存在时，若被嵌入页与主应用同源，
 * 沙箱等同于形同虚设：该页面可以访问父窗口 DOM 并自行移除 sandbox 属性。
 * 因此同源嵌入时必须去掉 `allow-same-origin`（页面仍在唯一的不透明源里运行，
 * 只是拿不到主应用的 origin/storage）。
 */
const BASE_EMBED_SANDBOX = 'allow-scripts allow-forms allow-popups allow-modals'

/**
 * 返回预设链接的主机名，用于在把 API 密钥交给第三方之前明确告知接收方。
 * 无法解析时返回空字符串。
 */
export function chatPresetHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

export function resolveChatEmbedPolicy(
  url: string,
  appOrigin: string
): ChatEmbedPolicy {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { embeddable: false, reason: 'invalid-url' }
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { embeddable: false, reason: 'invalid-url' }
  }

  let sameOrigin = false
  if (appOrigin) {
    try {
      sameOrigin = new URL(appOrigin).origin === parsed.origin
    } catch {
      sameOrigin = false
    }
  }

  return {
    embeddable: true,
    sandbox: sameOrigin
      ? BASE_EMBED_SANDBOX
      : `${BASE_EMBED_SANDBOX} allow-same-origin`,
  }
}
