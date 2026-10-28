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
import { ERROR_MESSAGES, MESSAGE_ROLES, MESSAGE_STATUS } from '../../constants'
import type { Message } from '../../types'
import {
  completeAssistantMessage,
  isAssistantMessageFinal,
  isAssistantMessagePending,
} from './message-streaming-utils'
import { completeAssistantTiming } from './message-timing-utils'
import { hasMessageContent, updateCurrentVersionContent } from './message-utils'

/**
 * Update the last assistant message with an error.
 *
 * `title` 为空串时不再拼前缀，便于调用方自己组好完整文案。
 */
export function updateAssistantMessageWithError(
  messages: Message[],
  errorMessage: string,
  errorCode?: string,
  title: string = ERROR_MESSAGES.API_REQUEST_ERROR
): Message[] {
  return updateLastAssistantMessage(messages, (message) => {
    const updatedMessage = updateCurrentVersionContent(
      message,
      title ? `${title}: ${errorMessage}` : errorMessage
    )

    return completeAssistantTiming({
      ...updatedMessage,
      status: MESSAGE_STATUS.ERROR,
      isReasoningStreaming: false,
      errorCode: errorCode || null,
    })
  })
}

/**
 * Update the most recent assistant message, preserving the array when absent.
 */
export function updateLastAssistantMessage(
  messages: Message[],
  updater: (message: Message) => Message
): Message[] {
  if (messages.length === 0) return messages

  const last = messages.at(-1)
  if (!last || last.from !== MESSAGE_ROLES.ASSISTANT) return messages

  const updated = [...messages]
  updated[updated.length - 1] = updater(last)
  return updated
}

/**
 * 收尾正常结束（收到 `[DONE]` 或连接被正常关闭）的那一轮生成。
 *
 * 流正常关闭却一个字都没收到，通常意味着上游在首包之前就断了：这时留一条
 * `complete` + 空内容的助手消息，界面上什么都不显示，用户只会觉得「点了没反应」。
 * 按「生成被中断」报错，至少给出一条可见的失败原因。
 */
export function finalizeCompletedGeneration(
  messages: Message[],
  interruptedMessage: string
): Message[] {
  const last = messages.at(-1)
  if (!last || last.from !== MESSAGE_ROLES.ASSISTANT) return messages

  const finalized = isAssistantMessageFinal(last)
    ? last
    : completeAssistantMessage(last)

  const hasReasoning = Boolean(finalized.reasoning?.content.trim())
  if (hasMessageContent(finalized) || hasReasoning) {
    return [...messages.slice(0, -1), finalized]
  }

  return updateAssistantMessageWithError(
    messages,
    interruptedMessage,
    undefined,
    ''
  )
}

/**
 * 收尾被用户主动停止的那一轮生成。
 *
 * 已经有内容的回复按「完成」定稿；**一个字都没收到的占位消息直接删掉** ——
 * 否则它会以 `complete` + 空内容的状态留在会话和本地存储里：界面上什么都不渲染
 * （看起来像消息凭空消失），下次打开仍然占一条，还会把后续消息的「重新生成」
 * 目标错位。
 */
export function finalizeStoppedGeneration(messages: Message[]): Message[] {
  const last = messages.at(-1)
  if (!last || last.from !== MESSAGE_ROLES.ASSISTANT) return messages

  const finalized = isAssistantMessagePending(last)
    ? completeAssistantMessage(last)
    : last

  const hasReasoning = Boolean(finalized.reasoning?.content.trim())
  if (!hasMessageContent(finalized) && !hasReasoning) {
    return messages.slice(0, -1)
  }

  return [...messages.slice(0, -1), finalized]
}
