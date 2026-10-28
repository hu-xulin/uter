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

import { ERROR_MESSAGES } from '../../../constants'
import {
  getAppendableStreamChunk,
  getStreamResponseCodeError,
  isStreamClosedReadyState,
  isStreamDoneMessage,
  mergeStreamChunk,
  parseStreamErrorDetails,
  parseStreamErrorEvent,
  parseStreamMessageUpdates,
} from '../stream-utils'

describe('stream chunk merging', () => {
  test('concatenates delta chunks verbatim', () => {
    expect(mergeStreamChunk('', 'Hel')).toBe('Hel')
    expect(mergeStreamChunk('Hel', 'lo')).toBe('Hello')
    expect(mergeStreamChunk('Hello', ' world')).toBe('Hello world')
  })

  test('keeps repeated identical deltas instead of swallowing them', () => {
    // 两个连续的 "\n" 是 Markdown 的空行；吃掉了段落就被压平。
    expect(mergeStreamChunk('\n', '\n')).toBe('\n\n')
    expect(mergeStreamChunk('ha', 'ha')).toBe('haha')
    expect(mergeStreamChunk('a ', ' ')).toBe('a  ')
  })

  test('collapses cumulative snapshots into their suffix only', () => {
    expect(getAppendableStreamChunk('H', 'He')).toBe('e')
    expect(getAppendableStreamChunk('Hel', 'Hello')).toBe('lo')
    expect(mergeStreamChunk('H', 'He')).toBe('He')
    expect(mergeStreamChunk('Hel', 'Hello')).toBe('Hello')
  })

  test('treats a shorter chunk as new content', () => {
    // 累积快照一定越来越长；变短说明是新的增量，不能按前缀截断。
    expect(getAppendableStreamChunk('hello', 'he')).toBe('he')
  })
})

describe('stream message parsing', () => {
  test('extracts reasoning and content from the same delta', () => {
    const updates = parseStreamMessageUpdates(
      JSON.stringify({
        choices: [
          {
            index: 0,
            delta: { reasoning_content: 'think', content: 'answer' },
            finish_reason: null,
          },
        ],
      })
    )

    expect(updates).toEqual([
      { type: 'reasoning', chunk: 'think' },
      { type: 'content', chunk: 'answer' },
    ])
  })

  test('accepts the legacy reasoning field', () => {
    const updates = parseStreamMessageUpdates(
      JSON.stringify({
        choices: [{ index: 0, delta: { reasoning: 'think' } }],
      })
    )

    expect(updates).toEqual([{ type: 'reasoning', chunk: 'think' }])
  })

  test('returns no updates for chunks without a delta', () => {
    expect(
      parseStreamMessageUpdates(
        JSON.stringify({
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        })
      )
    ).toEqual([])
    expect(parseStreamMessageUpdates(JSON.stringify({ choices: [] }))).toEqual(
      []
    )
  })

  test('throws on malformed JSON so the caller can report a parse error', () => {
    expect(() => parseStreamMessageUpdates('{not json')).toThrow()
  })
})

describe('stream done detection', () => {
  test('accepts the sentinel with surrounding whitespace', () => {
    expect(isStreamDoneMessage('[DONE]')).toBe(true)
    expect(isStreamDoneMessage('[DONE]\n')).toBe(true)
    expect(isStreamDoneMessage('  [DONE]  ')).toBe(true)
  })

  test('does not treat payloads as the sentinel', () => {
    expect(isStreamDoneMessage('{"choices":[]}')).toBe(false)
    expect(isStreamDoneMessage('[DONE] extra')).toBe(false)
  })

  test('only readyState 2 counts as closed', () => {
    expect(isStreamClosedReadyState(2)).toBe(true)
    expect(isStreamClosedReadyState(1)).toBe(false)
    expect(isStreamClosedReadyState(undefined)).toBe(false)
  })
})

describe('stream error parsing', () => {
  test('recognises an in-stream error payload', () => {
    expect(
      parseStreamErrorEvent(
        JSON.stringify({
          error: { code: 'model_price_error', message: 'price missing' },
        })
      )
    ).toEqual({ errorCode: 'model_price_error', errorMessage: 'price missing' })

    expect(parseStreamErrorEvent(JSON.stringify({ choices: [] }))).toBeNull()
    expect(parseStreamErrorEvent('')).toBeNull()
    expect(parseStreamErrorEvent('oops')).toBeNull()
  })

  test('falls back to the raw body and then to the generic message', () => {
    expect(parseStreamErrorDetails('gateway exploded')).toEqual({
      errorMessage: 'gateway exploded',
    })
    expect(parseStreamErrorDetails()).toEqual({
      errorMessage: ERROR_MESSAGES.API_REQUEST_ERROR,
    })
    expect(
      parseStreamErrorDetails(JSON.stringify({ error: { code: 'x' } }))
    ).toEqual({
      errorCode: 'x',
      errorMessage: ERROR_MESSAGES.API_REQUEST_ERROR,
    })
  })

  test('adds the HTTP status when the body carried no message', () => {
    expect(
      getStreamResponseCodeError(ERROR_MESSAGES.API_REQUEST_ERROR, 502)
    ).toBe(`HTTP 502: ${ERROR_MESSAGES.CONNECTION_CLOSED}`)

    expect(getStreamResponseCodeError('quota exceeded', 502)).toBe(
      'quota exceeded'
    )
    expect(getStreamResponseCodeError(ERROR_MESSAGES.API_REQUEST_ERROR)).toBe(
      ERROR_MESSAGES.API_REQUEST_ERROR
    )
  })
})
