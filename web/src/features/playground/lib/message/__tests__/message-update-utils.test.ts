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
  completeReasoningTiming,
  startReasoningTiming,
} from '../message-timing-utils'
import {
  finalizeCompletedGeneration,
  finalizeStoppedGeneration,
  updateAssistantMessageWithError,
  updateLastAssistantMessage,
} from '../message-update-utils'

const userMessage: Message = {
  key: 'u1',
  from: 'user',
  versions: [{ id: 'u1-v', content: 'hello' }],
}

const emptyAssistant: Message = {
  key: 'a1',
  from: 'assistant',
  versions: [{ id: 'a1-v', content: '' }],
  status: 'loading',
  startedAt: 1_000,
}

const partialAssistant: Message = {
  key: 'a2',
  from: 'assistant',
  versions: [{ id: 'a2-v', content: 'half an ans' }],
  status: 'streaming',
  startedAt: 1_000,
}

describe('finalizeStoppedGeneration', () => {
  test('drops a placeholder that never received a token', () => {
    const next = finalizeStoppedGeneration([userMessage, emptyAssistant])

    // 空占位必须被删掉：留在会话里既不渲染任何东西，又会污染下次「重新生成」的目标。
    expect(next).toEqual([userMessage])
  })

  test('keeps partial content and marks it complete', () => {
    const next = finalizeStoppedGeneration([userMessage, partialAssistant])

    expect(next).toHaveLength(2)
    expect(next[1].status).toBe('complete')
    expect(next[1].versions[0].content).toBe('half an ans')
    expect(next[1].durationMs).toEqual(expect.any(Number))
  })

  test('keeps a message that only produced reasoning', () => {
    const reasoningOnly: Message = {
      ...emptyAssistant,
      reasoning: {
        content: 'thinking...',
        duration: 0,
        startedAt: 1_000,
      },
    }

    const next = finalizeStoppedGeneration([userMessage, reasoningOnly])

    expect(next).toHaveLength(2)
    expect(next[1].reasoning?.content).toBe('thinking...')
  })

  test('leaves untouched histories alone', () => {
    expect(finalizeStoppedGeneration([])).toEqual([])
    expect(finalizeStoppedGeneration([userMessage])).toEqual([userMessage])

    const finished: Message = {
      ...partialAssistant,
      status: 'complete',
    }
    expect(finalizeStoppedGeneration([userMessage, finished])[1]).toBe(finished)
  })
})

describe('finalizeCompletedGeneration', () => {
  const interrupted = 'Request error occurred: Generation was interrupted'

  test('reports an interrupted generation when no token arrived', () => {
    const next = finalizeCompletedGeneration(
      [userMessage, emptyAssistant],
      interrupted
    )

    // 流正常关闭却一个字都没收到：留一条 complete + 空内容的助手消息，界面上
    // 什么都不显示，用户只会觉得「点了没反应」。
    expect(next).toHaveLength(2)
    expect(next[1].status).toBe('error')
    expect(next[1].versions[0].content).toBe(interrupted)
  })

  test('keeps a normal completion untouched', () => {
    const next = finalizeCompletedGeneration(
      [userMessage, partialAssistant],
      interrupted
    )

    expect(next[1].status).toBe('complete')
    expect(next[1].versions[0].content).toBe('half an ans')
  })

  test('keeps a reasoning-only completion', () => {
    const reasoningOnly: Message = {
      ...emptyAssistant,
      reasoning: { content: 'thinking...', duration: 1, startedAt: 1_000 },
    }

    const next = finalizeCompletedGeneration(
      [userMessage, reasoningOnly],
      interrupted
    )

    expect(next[1].status).toBe('complete')
  })

  test('leaves histories without a trailing assistant message alone', () => {
    expect(finalizeCompletedGeneration([], interrupted)).toEqual([])
    expect(finalizeCompletedGeneration([userMessage], interrupted)).toEqual([
      userMessage,
    ])
  })
})

describe('updateLastAssistantMessage', () => {
  test('ignores histories that do not end with an assistant message', () => {
    expect(updateLastAssistantMessage([], () => partialAssistant)).toEqual([])
    expect(
      updateLastAssistantMessage([userMessage], () => partialAssistant)
    ).toEqual([userMessage])
  })

  test('replaces only the trailing assistant message', () => {
    const next = updateLastAssistantMessage(
      [userMessage, partialAssistant],
      (message) => ({ ...message, status: 'complete' })
    )

    expect(next[0]).toBe(userMessage)
    expect(next[1].status).toBe('complete')
  })
})

describe('updateAssistantMessageWithError', () => {
  test('writes the error into the trailing assistant message', () => {
    const next = updateAssistantMessageWithError(
      [userMessage, partialAssistant],
      'boom',
      'model_price_error',
      'Request error occurred'
    )

    expect(next[1].status).toBe('error')
    expect(next[1].errorCode).toBe('model_price_error')
    expect(next[1].versions[0].content).toBe('Request error occurred: boom')
  })

  test('clears the error code when none is supplied', () => {
    const next = updateAssistantMessageWithError(
      [userMessage, partialAssistant],
      'boom'
    )

    expect(next[1].errorCode).toBeNull()
  })
})

describe('reasoning timing', () => {
  test('never reports a zero-second duration', () => {
    const message: Message = {
      ...partialAssistant,
      reasoning: {
        ...startReasoningTiming(partialAssistant, 5_000),
        content: 'x',
      },
    }

    const completed = completeReasoningTiming(message, 5_000)

    expect(completed.reasoning?.durationMs).toBe(0)
    // 同一毫秒内开始并结束的推理，界面文案是「思考了 N 秒」；取整成 0 会显示
    // 「思考了 0 秒」，看起来像坏了。
    expect(completed.reasoning?.duration).toBe(1)
  })

  test('keeps the real duration when it is measurable', () => {
    const message: Message = {
      ...partialAssistant,
      reasoning: {
        ...startReasoningTiming(partialAssistant, 5_000),
        content: 'x',
      },
    }

    expect(completeReasoningTiming(message, 8_400).reasoning?.duration).toBe(4)
  })
})
