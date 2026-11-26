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
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { ChannelPriorityDropHint } from '../channel-priority-drop-hint'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars?.priority === undefined ? key : `${key}:${vars.priority}`,
    i18n: { resolvedLanguage: 'en', language: 'en' },
  }),
}))

afterEach(() => {
  cleanup()
})

test('拖拽提示的详情文字与标题文字左对齐', () => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const snapshot = {
    drop: { drop: true, position: 'insert', id: 2, target_id: 1 },
    preview: { items: [{ id: 2, priority: 7 }] },
  }
  const order = {
    previewStore: {
      subscribe: () => () => {},
      getSnapshot: () => snapshot,
    },
  }

  render(
    <ChannelPriorityDropHint
      container={host}
      order={order as never}
      channels={[{ id: 1, priority: 5 } as never]}
    />
  )

  // Badge 内标题左边缘 = px-2.5(10px) + size-3 图标(12px) + gap-2(8px) = 30px，
  // 详情文字用同一 30px 缩进（pl-7.5）才能与标题文字首行对齐。
  const detail = host.querySelector('[data-priority-hint] p')
  expect(detail?.className).toContain('pl-7.5')
  document.body.removeChild(host)
})
