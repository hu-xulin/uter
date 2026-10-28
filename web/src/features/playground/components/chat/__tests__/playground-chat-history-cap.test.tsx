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
import { render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'

import type { Message } from '../../../types'
import { PlaygroundChat } from '../playground-chat'

const HINT_KEY =
  'Only the latest {{count}} messages are shown; the full history is still sent with each request.'

/**
 * 回归背景：列表只渲染最近 24 条以控制流式输出时的重渲染成本，但早期版本是
 * **静默截断** —— 用户往上滚发现对话凭空断掉，会以为历史丢了。截断必须可见。
 */
function buildMessages(count: number): Message[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `m${index}`,
    from: index % 2 === 0 ? 'user' : 'assistant',
    versions: [{ id: `v${index}`, content: `message-${index}` }],
    ...(index % 2 === 0 ? {} : { status: 'complete' as const }),
  }))
}

describe('PlaygroundChat 历史截断提示', () => {
  beforeAll(() => {
    i18next.addResourceBundle('en', 'translation', {
      [HINT_KEY]: 'Only the latest {{count}} messages are shown.',
      'Loading conversation...': 'Loading conversation...',
    })
  })

  it('在消息超过渲染上限时显示截断提示', () => {
    render(<PlaygroundChat messages={buildMessages(30)} />)

    expect(
      screen.getByText(/Only the latest 24 messages are shown/)
    ).toBeVisible()
  })

  it('在消息未超过渲染上限时不显示提示', () => {
    render(<PlaygroundChat messages={buildMessages(4)} />)

    expect(
      screen.queryByText(/Only the latest \d+ messages are shown/)
    ).toBeNull()
  })

  it('截断提示出现时，更早的消息确实不在 DOM 里', () => {
    render(<PlaygroundChat messages={buildMessages(30)} />)

    // 30 条里渲染后 24 条 → 前 6 条（m0…m5）不渲染，m6 是最早的一条。
    expect(screen.queryByText('message-0')).toBeNull()
    expect(screen.queryByText('message-5')).toBeNull()
    expect(screen.getByText('message-6')).toBeVisible()
  })
})
