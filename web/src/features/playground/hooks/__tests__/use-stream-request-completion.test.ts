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

import type { ChatCompletionRequest } from '../../types'
import { createStreamRequestController } from '../use-stream-request'

type Listener = (
  event: Event & { data?: string; readyState?: number; responseCode?: number }
) => void

class FakeStreamSource {
  readyState = 1
  closed = false
  private listeners = new Map<string, Listener[]>()

  addEventListener(type: string, listener: Listener) {
    const listeners = this.listeners.get(type) ?? []
    listeners.push(listener)
    this.listeners.set(type, listeners)
  }

  close() {
    this.closed = true
  }

  stream() {
    this.readyState = 1
  }

  emit(type: string, payload: { data?: string; responseCode?: number } = {}) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({
        data: payload.data,
        readyState: this.readyState,
        responseCode: payload.responseCode,
      } as Event & {
        data?: string
        readyState?: number
        responseCode?: number
      })
    }
  }

  /** 模拟服务端直接关掉连接：先置 CLOSED，再派发 readystatechange。 */
  closeFromServer() {
    this.readyState = 2
    this.emit('readystatechange')
  }
}

const payload: ChatCompletionRequest = {
  model: 'test-model',
  messages: [{ role: 'user', content: 'hello' }],
  stream: true,
}

function createController() {
  const sources: FakeStreamSource[] = []
  const events: string[] = []
  const streamingStates: boolean[] = []
  const controller = createStreamRequestController({
    getHeaders: () => Promise.resolve({ Authorization: 'Bearer test' }),
    createSource: () => {
      const source = new FakeStreamSource()
      sources.push(source)
      return source
    },
    setStreaming: (streaming) => streamingStates.push(streaming),
  })

  return { controller, sources, events, streamingStates }
}

const chunk = (content: string) =>
  JSON.stringify({ choices: [{ index: 0, delta: { content } }] })

describe('stream completion', () => {
  test('completes when the server closes without sending [DONE]', async () => {
    const { controller, sources, events, streamingStates } = createController()

    await controller.send(payload, {
      onUpdate: () => undefined,
      onComplete: () => events.push('complete'),
      onError: (error) => events.push(`error:${error}`),
    })

    sources[0].emit('message', { data: chunk('partial') })
    // 上游被截断 / 网关超时：HTTP 仍是 200，但不会有结束帧。
    sources[0].closeFromServer()

    expect(events).toEqual(['complete'])
    expect(streamingStates.at(-1)).toBe(false)
  })

  test('does not complete twice when [DONE] arrives before the close', async () => {
    const { controller, sources, events } = createController()

    await controller.send(payload, {
      onUpdate: () => undefined,
      onComplete: () => events.push('complete'),
      onError: (error) => events.push(`error:${error}`),
    })

    sources[0].emit('message', { data: chunk('answer') })
    sources[0].emit('message', { data: '[DONE]' })
    sources[0].closeFromServer()

    expect(events).toEqual(['complete'])
  })

  test('ignores the close of a request that was already stopped', async () => {
    const { controller, sources, events } = createController()

    await controller.send(payload, {
      onUpdate: () => undefined,
      onComplete: () => events.push('complete'),
      onError: (error) => events.push(`error:${error}`),
    })

    controller.stop()
    sources[0].closeFromServer()

    expect(events).toEqual([])
  })
})

describe('in-stream error payloads', () => {
  test('surfaces an error chunk delivered as a normal message event', async () => {
    const { controller, sources, events } = createController()

    await controller.send(payload, {
      onUpdate: () => undefined,
      onComplete: () => events.push('complete'),
      onError: (error, code) => events.push(`error:${code}:${error}`),
    })

    sources[0].emit('message', { data: chunk('half') })
    sources[0].emit('message', {
      data: JSON.stringify({
        error: { code: 'model_price_error', message: 'model price missing' },
      }),
    })

    expect(events).toEqual(['error:model_price_error:model price missing'])
  })

  test('reports the HTTP status when the error body is not JSON', async () => {
    const { controller, sources, events } = createController()

    await controller.send(payload, {
      onUpdate: () => undefined,
      onComplete: () => events.push('complete'),
      onError: (error) => events.push(`error:${error}`),
    })

    sources[0].emit('error', {
      data: '<html>bad gateway</html>',
      responseCode: 502,
    })

    expect(events).toEqual(['error:<html>bad gateway</html>'])
  })

  test('falls back to the response code when the body is empty', async () => {
    const { controller, sources, events } = createController()

    await controller.send(payload, {
      onUpdate: () => undefined,
      onComplete: () => events.push('complete'),
      onError: (error) => events.push(`error:${error}`),
    })

    sources[0].emit('error', { responseCode: 502 })

    expect(events).toEqual(['error:HTTP 502: Connection closed'])
  })
})
