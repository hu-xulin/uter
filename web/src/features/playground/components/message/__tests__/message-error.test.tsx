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
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Message } from '../../../types'
import { MessageError } from '../message-error'

const navigate = vi.hoisted(() => vi.fn())
const openWindow = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}))

const modelPriceMessage: Message = {
  key: 'msg-1',
  from: 'assistant',
  status: 'error',
  errorCode: 'model_price_error',
  versions: [{ id: 'v1', content: 'price missing' }],
} as unknown as Message

async function renderAsAdmin() {
  const { useAuthStore } = await import('@/stores/auth-store')
  useAuthStore.setState({
    auth: { user: { id: 1, role: 10, username: 'admin' } },
  } as never)

  render(<MessageError message={modelPriceMessage} />)
  return screen.getByRole('button', { name: /go to settings/i })
}

describe('MessageError settings link', () => {
  beforeAll(() => {
    i18next.addResourceBundle('en', 'translation', {
      'Go to Settings': 'Go to Settings',
      'Model Price Not Configured': 'Model Price Not Configured',
      'price missing': 'price missing',
      Error: 'Error',
    })
  })

  beforeEach(() => {
    navigate.mockReset()
    openWindow.mockReset()
    vi.stubGlobal('open', openWindow)
  })

  it('navigates in-app instead of opening a new tab', async () => {
    const user = userEvent.setup()
    const button = await renderAsAdmin()

    await user.click(button)

    // 站内路径走 router 导航，不能再 window.open：新标签页会重新下载整个 SPA bundle。
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(openWindow).not.toHaveBeenCalled()
  })

  it('does not render the settings link for non-admin users', async () => {
    const { useAuthStore } = await import('@/stores/auth-store')
    useAuthStore.setState({
      auth: { user: { id: 2, role: 1, username: 'member' } },
    } as never)

    render(<MessageError message={modelPriceMessage} />)

    expect(
      screen.queryByRole('button', { name: /go to settings/i })
    ).not.toBeInTheDocument()
  })
})
