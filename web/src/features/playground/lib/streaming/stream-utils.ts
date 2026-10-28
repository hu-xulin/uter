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
import { ERROR_MESSAGES } from '../../constants'
import type { ChatCompletionChunk } from '../../types'

const STREAM_DONE_MESSAGE = '[DONE]'
const STREAM_CLOSED_READY_STATE = 2

/**
 * 取出「还没收到过」的那一段增量。
 *
 * 同一条解析路径要同时兼容两种上游行为：
 * - 增量分片（`"Hel"`、`"lo"`）：必须原样拼接。
 * - 累积快照（`"H"`、`"He"`、`"Hel"`）：新分片已包含此前全部内容，只有后缀是新的。
 *
 * 累积分支要求新分片**严格更长**。只判 `startsWith` 会把合法的重复分片吃掉：
 * 连续两个 `"\n"` 会合并成一个（Markdown 段落被压平），重复的词（`"ha"`、`"ha"`）
 * 只显示一次。
 */
export function getAppendableStreamChunk(
  accumulated: string,
  incoming: string
): string {
  if (!accumulated) {
    return incoming
  }

  if (
    incoming.length > accumulated.length &&
    incoming.startsWith(accumulated)
  ) {
    return incoming.slice(accumulated.length)
  }

  return incoming
}

/** 把新分片并入已累积文本，语义与 `getAppendableStreamChunk` 一致。 */
export function mergeStreamChunk(
  accumulated: string,
  incoming: string
): string {
  return accumulated + getAppendableStreamChunk(accumulated, incoming)
}

export type StreamUpdateType = 'reasoning' | 'content'

export type StreamMessageUpdate = {
  type: StreamUpdateType
  chunk: string
}

type StreamErrorPayload = {
  error?: {
    code?: string
    message?: string
  }
}

export type StreamErrorDetails = {
  errorCode?: string
  errorMessage: string
}

export function parseStreamErrorDetails(data?: string): StreamErrorDetails {
  const parsed = parseStreamErrorEvent(data)
  if (parsed) {
    return parsed
  }

  return { errorMessage: data || ERROR_MESSAGES.API_REQUEST_ERROR }
}

/**
 * 识别流内错误负载（`{"error":{"code","message"}}`）。
 *
 * 上游在 HTTP 200 之后出错时，网关会把错误当成一条普通 data 事件写进流里，
 * 这类事件既不是 `error` 事件也不是 `[DONE]`，必须单独识别，否则会被当成
 * 「没有 delta 的正常分片」静默丢掉，界面只剩半截内容且没有任何错误提示。
 */
export function parseStreamErrorEvent(
  data?: string
): StreamErrorDetails | null {
  if (!data) {
    return null
  }

  try {
    const parsed = JSON.parse(data) as StreamErrorPayload

    if (!parsed || typeof parsed !== 'object' || !parsed.error) {
      return null
    }

    return {
      errorCode: parsed.error.code || undefined,
      errorMessage: parsed.error.message || ERROR_MESSAGES.API_REQUEST_ERROR,
    }
  } catch {
    return null
  }
}

export function parseStreamMessageUpdates(data: string): StreamMessageUpdate[] {
  const chunk = JSON.parse(data) as ChatCompletionChunk
  const delta = chunk.choices?.[0]?.delta

  if (!delta) {
    return []
  }

  const updates: StreamMessageUpdate[] = []
  const reasoning = delta.reasoning_content ?? delta.reasoning

  if (reasoning) {
    updates.push({ type: 'reasoning', chunk: reasoning })
  }

  if (delta.content) {
    updates.push({ type: 'content', chunk: delta.content })
  }

  return updates
}

export function isStreamDoneMessage(data: string): boolean {
  // 部分网关会在 `[DONE]` 前后带上空白/换行；严格相等会把结束帧当成普通分片，
  // 解析失败后整条回复被误判成「解析错误」。
  return data.trim() === STREAM_DONE_MESSAGE
}

export function isStreamClosedReadyState(readyState?: number): boolean {
  return readyState === STREAM_CLOSED_READY_STATE
}

/**
 * 把 HTTP 状态码拼进连接错误文案。
 *
 * sse.js 只在 `error` 事件上给 `responseCode`，实例本身没有 `status` 字段，
 * 所以这里只能从事件取；拿不到状态码时保持原文案不变。
 */
export function getStreamResponseCodeError(
  message: string,
  responseCode?: number
): string {
  if (!responseCode || message !== ERROR_MESSAGES.API_REQUEST_ERROR) {
    return message
  }

  return `HTTP ${responseCode}: ${ERROR_MESSAGES.CONNECTION_CLOSED}`
}
