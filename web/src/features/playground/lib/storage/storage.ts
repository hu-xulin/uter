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
import { useAuthStore } from '@/stores/auth-store'

import { MESSAGE_STATUS, STORAGE_KEYS } from '../../constants'
import type { PlaygroundConfig, ParameterEnabled, Message } from '../../types'
import {
  finalizeMessage,
  isAssistantMessagePending,
  sanitizeMessagesOnLoad,
} from '../message/message-streaming-utils'
import { completeAssistantTiming } from '../message/message-timing-utils'
import { hasMessageContent } from '../message/message-utils'
import {
  MAX_LOADED_MESSAGE_CHARS,
  MAX_LOADED_MESSAGES_CHARS,
  MAX_STORED_MESSAGES,
  MAX_STORED_MESSAGES_BYTES,
  STORAGE_VERSION,
  messagesSchema,
  parameterEnabledSchema,
  playgroundConfigSchema,
} from './storage-schema'

type StoredEnvelope<T> = {
  version: number
  data: T
}

const TRUNCATED_CONTENT_SUFFIX = '\n\n[...]'
const MIN_PREFIX_COLLAPSE_LENGTH = 2000
const MIN_REPEATED_SECTION_COUNT = 3
const SECTION_HEADING_LINE_PATTERN = /^#{2,6}\s+\d+\.\s+.+$/gm

function getUserStorageKey(key: string): string | null {
  // Legacy data has no owner; never assign it to the next signed-in account.
  for (const legacyKey of Object.values(STORAGE_KEYS)) {
    localStorage.removeItem(legacyKey)
  }
  const userId = useAuthStore.getState().auth.user?.id
  return userId == null ? null : `${key}:${userId}`
}

function readStoredValue(baseKey: string): unknown | null {
  const key = getUserStorageKey(baseKey)
  if (!key) return null
  const saved = localStorage.getItem(key)
  if (!saved) return null

  return JSON.parse(saved) as unknown
}

function readStoredMessagesValue(): unknown | null {
  const key = getUserStorageKey(STORAGE_KEYS.MESSAGES)
  if (!key) return null
  const saved = localStorage.getItem(key)
  if (!saved) return null

  // New writes are obfuscated (base64); legacy plaintext is still valid JSON.
  // Deobfuscate first and fall back to a plain parse so data stored by older
  // builds keeps loading. The size guard runs on the decoded content, not the
  // ~33%-larger base64 wrapper, so large histories aren't dropped on read.
  let decoded: string
  try {
    decoded = deobfuscateStored(saved)
  } catch {
    decoded = saved
  }

  if (decoded.length > MAX_STORED_MESSAGES_BYTES) {
    localStorage.removeItem(key)
    return null
  }

  try {
    return JSON.parse(decoded) as unknown
  } catch {
    return null
  }
}

function unwrapStoredValue(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value
  }

  if ('version' in value && 'data' in value) {
    return (value as StoredEnvelope<unknown>).data
  }

  return value
}

function writeStoredValue<T>(baseKey: string, data: T): void {
  const key = getUserStorageKey(baseKey)
  if (!key) return
  const payload: StoredEnvelope<T> = {
    version: STORAGE_VERSION,
    data,
  }

  localStorage.setItem(key, JSON.stringify(payload))
}

// Defense-in-depth for the persisted playground conversation. It can contain
// user-pasted secrets or PII, so we avoid storing it as readable plaintext: the
// on-disk value is XOR-scrambled + base64 rather than raw JSON. This is NOT
// crypto-grade (the transform is reversible by anyone with the source), but it
// removes the lowest-hanging exposure — a casual localStorage read or a naive
// XSS that grabs the stored string verbatim — and stays fully synchronous and
// backwards-compatible with previously stored plaintext.
const MESSAGES_OBFUSCATION_SALT = 'uter-playground-obf-v1'

function scrambleBytes(bytes: Uint8Array): Uint8Array {
  const salt = new TextEncoder().encode(MESSAGES_OBFUSCATION_SALT)
  const out = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i] ^ salt[i % salt.length]
  }
  return out
}

function obfuscateStored(plain: string): string {
  const scrambled = scrambleBytes(new TextEncoder().encode(plain))
  let binary = ''
  for (const byte of scrambled) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function deobfuscateStored(cipher: string): string {
  const binary = atob(cipher)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(scrambleBytes(bytes))
}

function trimMessages(messages: Message[]): Message[] {
  if (messages.length <= MAX_STORED_MESSAGES) {
    return messages
  }

  return messages.slice(-MAX_STORED_MESSAGES)
}

function getMessageSize(message: Message): number {
  const versionsSize = message.versions.reduce(
    (total, version) => total + version.content.length,
    0
  )
  const reasoningSize = message.reasoning?.content.length ?? 0

  return versionsSize + reasoningSize
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }

  if (maxLength <= TRUNCATED_CONTENT_SUFFIX.length) {
    return text.slice(0, maxLength)
  }

  return `${text.slice(0, maxLength - TRUNCATED_CONTENT_SUFFIX.length)}${TRUNCATED_CONTENT_SUFFIX}`
}

type SectionOccurrence = {
  heading: string
  index: number
}

function getSectionOccurrences(text: string): SectionOccurrence[] {
  const occurrences: SectionOccurrence[] = []
  const matches = text.matchAll(SECTION_HEADING_LINE_PATTERN)
  for (const match of matches) {
    const index = match.index
    if (index === undefined) {
      continue
    }

    occurrences.push({
      heading: match[0],
      index,
    })
  }

  return occurrences
}

function getHeadingCounts(
  occurrences: SectionOccurrence[]
): Map<string, number> {
  const counts = new Map<string, number>()

  for (const occurrence of occurrences) {
    counts.set(occurrence.heading, (counts.get(occurrence.heading) ?? 0) + 1)
  }

  return counts
}

function findLastRepeatedSectionRunStart(text: string): number {
  const occurrences = getSectionOccurrences(text)
  const headingCounts = getHeadingCounts(occurrences)
  const lastRepeatedIndexes: number[] = []
  const seenHeadings = new Set<string>()

  for (let index = occurrences.length - 1; index >= 0; index--) {
    const occurrence = occurrences[index]
    const count = headingCounts.get(occurrence.heading) ?? 0

    if (
      count < MIN_REPEATED_SECTION_COUNT ||
      seenHeadings.has(occurrence.heading)
    ) {
      continue
    }

    seenHeadings.add(occurrence.heading)
    lastRepeatedIndexes.push(occurrence.index)
  }

  if (lastRepeatedIndexes.length === 0) {
    return -1
  }

  return Math.min(...lastRepeatedIndexes)
}

function collapseRepeatedSectionSnapshots(text: string): string {
  if (text.length < MIN_PREFIX_COLLAPSE_LENGTH) {
    return text
  }

  const lastRepeatedRunStart = findLastRepeatedSectionRunStart(text)
  if (lastRepeatedRunStart === -1) {
    return text
  }

  return text.slice(lastRepeatedRunStart)
}

function normalizeStoredMessageForLoad(message: Message): Message {
  let changed = false
  const versions = message.versions.map((version) => {
    const collapsedContent = collapseRepeatedSectionSnapshots(version.content)
    const content = truncateText(collapsedContent, MAX_LOADED_MESSAGE_CHARS)

    if (content === version.content && collapsedContent === version.content) {
      return version
    }

    changed = true
    return {
      ...version,
      content,
    }
  })

  const reasoning = message.reasoning
    ? {
        ...message.reasoning,
        content: truncateText(
          message.reasoning.content,
          MAX_LOADED_MESSAGE_CHARS
        ),
      }
    : undefined

  if (reasoning?.content !== message.reasoning?.content) {
    changed = true
  }

  const normalized = changed ? { ...message, versions, reasoning } : message

  if (!isAssistantMessagePending(normalized)) {
    return normalized
  }

  const hasContent = hasMessageContent(normalized)
  const hasReasoning = normalized.reasoning?.content.trim()

  if (!hasContent && !hasReasoning) {
    return normalized
  }

  const completedAt =
    normalized.completedAt ??
    normalized.reasoning?.completedAt ??
    normalized.startedAt ??
    normalized.createdAt ??
    Date.now()

  return completeAssistantTiming(
    {
      ...finalizeMessage(normalized),
      status: MESSAGE_STATUS.COMPLETE,
      isReasoningStreaming: false,
    },
    completedAt
  )
}

function trimMessagesByContentSize(messages: Message[]): Message[] {
  let totalSize = 0
  const result: Message[] = []

  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]
    const messageSize = getMessageSize(message)

    if (
      result.length > 0 &&
      totalSize + messageSize > MAX_LOADED_MESSAGES_CHARS
    ) {
      break
    }

    totalSize += messageSize
    result.push(message)
  }

  return result.reverse()
}

/**
 * Load playground config from localStorage
 */
export function loadConfig(): Partial<PlaygroundConfig> {
  try {
    const saved = readStoredValue(STORAGE_KEYS.CONFIG)
    if (!saved) return {}

    return playgroundConfigSchema.parse(unwrapStoredValue(saved))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load config:', error)
  }
  return {}
}

/**
 * Save playground config to localStorage
 */
export function saveConfig(config: Partial<PlaygroundConfig>): void {
  try {
    const parsed = playgroundConfigSchema.parse(config)
    writeStoredValue(STORAGE_KEYS.CONFIG, parsed)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save config:', error)
  }
}

/**
 * Load parameter enabled state from localStorage
 */
export function loadParameterEnabled(): Partial<ParameterEnabled> {
  try {
    const saved = readStoredValue(STORAGE_KEYS.PARAMETER_ENABLED)
    if (!saved) return {}

    return parameterEnabledSchema.parse(unwrapStoredValue(saved))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load parameter enabled:', error)
  }
  return {}
}

/**
 * Save parameter enabled state to localStorage
 */
export function saveParameterEnabled(
  parameterEnabled: Partial<ParameterEnabled>
): void {
  try {
    const parsed = parameterEnabledSchema.parse(parameterEnabled)
    writeStoredValue(STORAGE_KEYS.PARAMETER_ENABLED, parsed)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save parameter enabled:', error)
  }
}

/**
 * Load messages from localStorage
 */
export function loadMessages(): Message[] | null {
  try {
    const saved = readStoredMessagesValue()
    if (!saved) return null

    const parsed = messagesSchema.parse(unwrapStoredValue(saved)) as Message[]
    const normalized = parsed.map(normalizeStoredMessageForLoad)
    const normalizedChanged = normalized.some(
      (message, index) => message !== parsed[index]
    )
    const trimmed = trimMessages(normalized)
    const sizeTrimmed = trimMessagesByContentSize(trimmed)
    const sanitized = sanitizeMessagesOnLoad(sizeTrimmed)

    if (
      normalizedChanged ||
      trimmed !== normalized ||
      sizeTrimmed !== trimmed ||
      sanitized !== sizeTrimmed
    ) {
      saveMessages(sanitized)
    }

    return sanitized
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load messages:', error)
  }
  return null
}

/**
 * 写入前把每条消息压到读取时的同一档上限。
 *
 * 读取侧对单条消息做 `MAX_LOADED_MESSAGE_CHARS` 截断、对整段会话做
 * `MAX_LOADED_MESSAGES_CHARS` 预算；写入侧如果不管这两条，一条超长回复就会把
 * 整个键写成超限内容，下次读取时 `readStoredMessagesValue` 判定超限并**整键删除**，
 * 用户丢掉的是全部历史。这里只截断内容，不动 status —— 流式中的消息不能被提前定稿。
 */
function truncateMessagesForStorage(messages: Message[]): Message[] {
  return messages.map((message) => {
    let changed = false

    const versions = message.versions.map((version) => {
      const content = truncateText(version.content, MAX_LOADED_MESSAGE_CHARS)
      if (content === version.content) return version

      changed = true
      return { ...version, content }
    })

    const reasoningContent = message.reasoning?.content
    const reasoning =
      message.reasoning && reasoningContent !== undefined
        ? {
            ...message.reasoning,
            content: truncateText(reasoningContent, MAX_LOADED_MESSAGE_CHARS),
          }
        : message.reasoning

    if (reasoning?.content !== reasoningContent) {
      changed = true
    }

    return changed ? { ...message, versions, reasoning } : message
  })
}

/**
 * Save messages to localStorage
 */
export function saveMessages(messages: Message[]): void {
  try {
    const key = getUserStorageKey(STORAGE_KEYS.MESSAGES)
    if (!key) return
    const budgeted = trimMessagesByContentSize(
      truncateMessagesForStorage(trimMessages(messages))
    )
    const parsed = messagesSchema.parse(budgeted) as Message[]
    const payload: StoredEnvelope<Message[]> = {
      version: STORAGE_VERSION,
      data: parsed,
    }
    localStorage.setItem(key, obfuscateStored(JSON.stringify(payload)))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save messages:', error)
  }
}

/**
 * Clear the signed-in user's playground data
 */
export function clearPlaygroundData(): void {
  try {
    for (const baseKey of Object.values(STORAGE_KEYS)) {
      const key = getUserStorageKey(baseKey)
      if (key) localStorage.removeItem(key)
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to clear playground data:', error)
  }
}
