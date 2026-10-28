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

import type { Message } from '../../../types'
import {
  appendUserMessagePair,
  applyMessageEdit,
  createRegeneratedMessages,
  getChatMessageRenderState,
  getEditingMessageContent,
  getPreviousUserMessage,
  removeMessageByKey,
} from '../conversation-message-utils'

function message(
  key: string,
  from: Message['from'],
  content: string,
  status?: Message['status']
): Message {
  return {
    key,
    from,
    versions: [{ id: `${key}-v`, content }],
    ...(status ? { status } : {}),
  }
}

const history: Message[] = [
  message('u1', 'user', 'first'),
  message('a1', 'assistant', 'answer one', 'complete'),
  message('u2', 'user', 'second'),
  message('a2', 'assistant', 'answer two', 'complete'),
]

describe('appendUserMessagePair', () => {
  test('appends the user message and a loading placeholder', () => {
    const next = appendUserMessagePair(history, 'third')

    expect(next).toHaveLength(history.length + 2)
    expect(next.at(-2)?.from).toBe('user')
    expect(next.at(-2)?.versions[0].content).toBe('third')
    expect(next.at(-1)?.from).toBe('assistant')
    expect(next.at(-1)?.status).toBe('loading')
  })

  test('does not mutate the previous history', () => {
    appendUserMessagePair(history, 'third')

    expect(history).toHaveLength(4)
  })
})

describe('createRegeneratedMessages', () => {
  test('keeps the user message and replaces everything after it', () => {
    const next = createRegeneratedMessages(history, 'u2')

    expect(next?.map((item) => item.key)).toEqual([
      'u1',
      'a1',
      'u2',
      next?.[3].key,
    ])
    expect(next?.at(-1)?.from).toBe('assistant')
    expect(next?.at(-1)?.status).toBe('loading')
  })

  test('drops the assistant message that is being regenerated', () => {
    const next = createRegeneratedMessages(history, 'a2')

    expect(next?.map((item) => item.key)).toEqual([
      'u1',
      'a1',
      'u2',
      next?.[3].key,
    ])
    expect(next?.[3].status).toBe('loading')
  })

  test('returns null for an unknown message', () => {
    expect(createRegeneratedMessages(history, 'missing')).toBeNull()
  })
})

describe('applyMessageEdit', () => {
  test('only rewrites the content when the edit is not submitted', () => {
    const result = applyMessageEdit(history, 'u1', 'edited', false)

    expect(result?.shouldSend).toBe(false)
    expect(result?.messages).toHaveLength(history.length)
    expect(result?.messages[0].versions[0].content).toBe('edited')
    expect(result?.messages[0].createdAt).toBeUndefined()
  })

  test('truncates the conversation and appends a placeholder when submitted', () => {
    const result = applyMessageEdit(history, 'u1', 'edited', true)

    expect(result?.shouldSend).toBe(true)
    expect(result?.messages).toHaveLength(2)
    expect(result?.messages[0].versions[0].content).toBe('edited')
    expect(result?.messages[0].createdAt).toEqual(expect.any(Number))
    expect(result?.messages[1].from).toBe('assistant')
    expect(result?.messages[1].status).toBe('loading')
  })

  test('never resubmits an assistant message', () => {
    const result = applyMessageEdit(history, 'a1', 'edited answer', true)

    expect(result?.shouldSend).toBe(false)
    expect(result?.messages).toHaveLength(history.length)
    expect(result?.messages[1].versions[0].content).toBe('edited answer')
  })

  test('returns null for an unknown message', () => {
    expect(applyMessageEdit(history, 'missing', 'x', true)).toBeNull()
  })
})

describe('message helpers', () => {
  test('removes a message by key without touching the rest', () => {
    expect(removeMessageByKey(history, 'u2').map((item) => item.key)).toEqual([
      'u1',
      'a1',
      'a2',
    ])
  })

  test('finds the previous user message', () => {
    expect(getPreviousUserMessage(history, 3)?.key).toBe('u2')
    expect(getPreviousUserMessage(history, 1)?.key).toBe('u1')
    expect(getPreviousUserMessage(history, 0)).toBeNull()
  })

  test('reads the content of the message being edited', () => {
    expect(getEditingMessageContent(history, 'a1')).toBe('answer one')
    expect(getEditingMessageContent(history, 'missing')).toBe('')
    expect(getEditingMessageContent(history, null)).toBe('')
  })

  test('always shows actions on the last assistant message', () => {
    expect(
      getChatMessageRenderState(history, history[3], 3).alwaysShowActions
    ).toBe(true)
    expect(
      getChatMessageRenderState(history, history[2], 2).alwaysShowActions
    ).toBe(false)
    expect(
      getChatMessageRenderState(history, history[0], 0, 'u1')
    ).toMatchObject({ isEditing: true, content: 'first' })
  })
})
