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

import { DEFAULT_CONFIG, DEFAULT_PARAMETER_ENABLED } from '../../../constants'
import type {
  Message,
  ParameterEnabled,
  PlaygroundConfig,
} from '../../../types'
import { buildChatCompletionPayload } from '../payload-builder'

const config: PlaygroundConfig = {
  ...DEFAULT_CONFIG,
  model: 'gpt-test',
  group: 'vip',
  temperature: 0.3,
  top_p: 0.9,
  max_tokens: 512,
  frequency_penalty: -0.5,
  presence_penalty: 0.25,
  seed: 7,
}

const allDisabled: ParameterEnabled = {
  temperature: false,
  top_p: false,
  max_tokens: false,
  frequency_penalty: false,
  presence_penalty: false,
  seed: false,
}

const userMessage: Message = {
  key: 'u1',
  from: 'user',
  versions: [{ id: 'v1', content: 'hello' }],
}

describe('buildChatCompletionPayload', () => {
  test('always sends model, group, stream and the formatted messages', () => {
    const payload = buildChatCompletionPayload(
      [userMessage],
      config,
      DEFAULT_PARAMETER_ENABLED
    )

    expect(payload.model).toBe('gpt-test')
    expect(payload.group).toBe('vip')
    expect(payload.stream).toBe(true)
    expect(payload.messages).toEqual([{ role: 'user', content: 'hello' }])
  })

  test('omits every optional parameter when it is disabled', () => {
    const payload = buildChatCompletionPayload(
      [userMessage],
      config,
      allDisabled
    )

    expect(payload).not.toHaveProperty('temperature')
    expect(payload).not.toHaveProperty('top_p')
    expect(payload).not.toHaveProperty('max_tokens')
    expect(payload).not.toHaveProperty('frequency_penalty')
    expect(payload).not.toHaveProperty('presence_penalty')
    expect(payload).not.toHaveProperty('seed')
  })

  test('sends only the enabled parameters, keeping negative penalties', () => {
    const payload = buildChatCompletionPayload([userMessage], config, {
      ...allDisabled,
      temperature: true,
      frequency_penalty: true,
      seed: true,
    })

    expect(payload.temperature).toBe(0.3)
    expect(payload.frequency_penalty).toBe(-0.5)
    expect(payload.seed).toBe(7)
    expect(payload).not.toHaveProperty('top_p')
    expect(payload).not.toHaveProperty('max_tokens')
  })

  test('skips the seed when it is enabled but unset', () => {
    const payload = buildChatCompletionPayload(
      [userMessage],
      { ...config, seed: null },
      { ...allDisabled, seed: true }
    )

    expect(payload).not.toHaveProperty('seed')
  })

  /**
   * 回归背景：参数面板的输入框被清空后，`normalizeParameterNumberValue` 会把
   * `max_tokens` 归一化成 0（seed 才是 null）。旧代码只要开关打开就无条件下发，
   * 于是「清空输入框」变成了 `max_tokens: 0` —— OpenAI 兼容上游直接 400，
   * Anthropic 系按 0 产出空回复。0 必须按「未设置」省略。
   */
  test('omits max_tokens when the cleared input normalizes to 0', () => {
    const payload = buildChatCompletionPayload(
      [userMessage],
      { ...config, max_tokens: 0 },
      { ...allDisabled, max_tokens: true }
    )

    expect(payload).not.toHaveProperty('max_tokens')
  })

  test('still sends a positive max_tokens', () => {
    const payload = buildChatCompletionPayload([userMessage], config, {
      ...allDisabled,
      max_tokens: true,
    })

    expect(payload.max_tokens).toBe(512)
  })

  test('drops empty assistant placeholders from the request', () => {
    const messages: Message[] = [
      userMessage,
      {
        key: 'a1',
        from: 'assistant',
        versions: [{ id: 'v2', content: '   ' }],
        status: 'complete',
      },
      {
        key: 'u2',
        from: 'user',
        versions: [{ id: 'v3', content: 'again' }],
      },
      {
        key: 'a2',
        from: 'assistant',
        versions: [{ id: 'v4', content: '' }],
        status: 'loading',
      },
    ]

    const payload = buildChatCompletionPayload(
      messages,
      config,
      DEFAULT_PARAMETER_ENABLED
    )

    expect(payload.messages).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'user', content: 'again' },
    ])
  })

  test('keeps the system prompt in order', () => {
    const payload = buildChatCompletionPayload(
      [
        {
          key: 's1',
          from: 'system',
          versions: [{ id: 'v0', content: 'be brief' }],
        },
        userMessage,
      ],
      config,
      DEFAULT_PARAMETER_ENABLED
    )

    expect(payload.messages.map((message) => message.role)).toEqual([
      'system',
      'user',
    ])
  })
})
