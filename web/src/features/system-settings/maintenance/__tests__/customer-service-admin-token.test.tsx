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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { updateSystemOption } from '@/features/system-settings/api'
import { api } from '@/lib/api'

import { CustomerServiceSection } from '../customer-service-section'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/features/system-settings/api', () => ({
  updateSystemOption: vi.fn(),
  updatePasskeyDomains: vi.fn(),
}))

const validToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTIwNjU3MTR9.c2lnbmF0dXJlc2lnbmF0dXJl'

function renderSection(props: { defaultAdminToken?: string } = {}) {
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <CustomerServiceSection
        defaultPages='home'
        defaultAdminToken={props.defaultAdminToken ?? ''}
      />
    </QueryClientProvider>
  )
}

async function typeTokenAndSave(value: string) {
  const input = await screen.findByPlaceholderText('Bearer …')
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Save token' }))
}

/**
 * 令牌框的形态校验与「令牌被拒」的展示。
 *
 * 真实事故：运营把管理员密码填进令牌框（实测库里存的是 11 字符的密码），
 * 保存接口照收，之后每次读取都 401 —— 页面表现为「参数怎么都显示不出来 /
 * 刷新后清空」，看上去像保存丢数据。三条不变量：
 *   1) 明显不是令牌的输入（密码/随手字符串）在保存前就被拦下，不写库；
 *   2) 三段式令牌正常提交；
 *   3) 后端判定令牌无效时，展示后端给的可操作说明，而不是一句 HTTP 401。
 */
describe('customer service admin token', () => {
  beforeEach(() => {
    vi.spyOn(api, 'get').mockImplementation((url: string) => {
      if (url.includes('admin-token')) {
        return Promise.resolve({
          data: { success: true, data: { token: '' } },
        } as never)
      }
      return Promise.resolve({ data: { success: true, data: {} } } as never)
    })
    vi.mocked(updateSystemOption).mockResolvedValue({
      success: true,
    } as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('rejects a password-shaped value before writing it to options', async () => {
    renderSection()
    await typeTokenAndSave('Uter.ai2026')

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
    expect(updateSystemOption).not.toHaveBeenCalled()
  })

  it('saves a three-segment login token', async () => {
    renderSection()
    await typeTokenAndSave(validToken)

    await waitFor(() => {
      expect(updateSystemOption).toHaveBeenCalledWith({
        key: 'CustomerServiceAdminToken',
        value: validToken,
      })
    })
  })

  it('accepts a single-segment long-lived service token', async () => {
    // 方案 B 的服务令牌是单段不透明串（openssl rand -hex 32 → 64 字符），
    // 不含点。校验必须同时接受这种形态，否则运营保存合法令牌会被自己拦下。
    renderSection()
    const serviceToken = 'a1b2c3d4'.repeat(8)
    await typeTokenAndSave(serviceToken)

    await waitFor(() => {
      expect(updateSystemOption).toHaveBeenCalledWith({
        key: 'CustomerServiceAdminToken',
        value: serviceToken,
      })
    })
  })

  it('shows the actionable message when uter-cs rejects the token', async () => {
    const message =
      '智能客服管理员令牌无效或已过期。这里要填的是登录令牌，不是管理员密码。'
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('admin-token')) {
        return Promise.resolve({
          data: { success: true, data: { token: validToken } },
        } as never)
      }
      return Promise.reject({
        response: {
          data: { needToken: true, tokenInvalid: true, message },
        },
      })
    })

    renderSection({ defaultAdminToken: validToken })

    await waitFor(() => {
      expect(screen.getByText(message)).toBeInTheDocument()
    })
  })
})
