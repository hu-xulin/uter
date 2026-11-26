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
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { CHANNEL_TYPE_UTER_ROUTE } from '../../constants'
import { WizardHarness } from './wizard-harness'
import {
  makeEditingChannel,
  setupWizardApiMocks,
  wizardOriginalAuth,
  type WizardMockState,
} from './wizard-harness-data'

vi.setConfig({ testTimeout: 60_000 })

// 测试环境下连接步骤会额外挂载 models 步骤（见 channel-configuration.tsx），
// 其中的 ChannelModelWeightInline 也会 useSystemOptions() 拉取 /api/option/，
// 与抽屉自己的查询共享 ['system-options'] key。把它替换成空组件，确保
// 「编辑态自动填入」只能靠抽屉自己的查询拿到系统设置，从而精准回归该缺陷。
vi.mock('../drawers/sections/channel-model-weight-inline', () => ({
  ChannelModelWeightInline: () => null,
}))

let mocks: WizardMockState

beforeEach(() => {
  mocks = setupWizardApiMocks()
})

afterEach(() => {
  cleanup()
  mocks.client.clear()
  useAuthStore.setState({ auth: wizardOriginalAuth })
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

/**
 * 注入三类验证端点 + 系统设置明文 option，让「自动获取」按钮走完整
 * step-up 流程：拉验证方式 → 输入登录密码 → 换 proof → 揭示凭证。
 */
function setupAutofillMocks() {
  mocks = setupWizardApiMocks({
    extraGet: (url) => {
      if (url === '/api/verify/methods') {
        return {
          scope: 'channel.credential.read',
          methods: [{ method: 'password', available: true }],
          oauth_providers: [],
          password_encryption_enabled: false,
        }
      }
      if (url === '/api/option/') {
        return [
          {
            key: 'ChannelProviderCredentialMasks',
            value: JSON.stringify({
              featured: {
                api_key: 'route-key****one',
                password: 'console-pw****',
              },
            }),
          },
          {
            key: 'channel_provider.featured.login_url',
            value: 'https://featured.example.com',
          },
          {
            key: 'channel_provider.featured.api_url',
            value: 'https://featured-api.example.com',
          },
          {
            key: 'channel_provider.featured.username',
            value: 'featured-user',
          },
        ]
      }
      return undefined
    },
  })

  mocks.postSpy.mockImplementation(async (url: string) => {
    if (url === '/api/verify') {
      return {
        data: {
          success: true,
          data: {
            proof_token: 'proof-autofill',
            scope: 'channel.credential.read',
            method: 'password',
            expires_at: Math.floor(Date.now() / 1000) + 60,
          },
        },
      } as never
    }
    const key = String(url).match(
      /^\/api\/option\/channel-provider\/(.+)\/reveal$/
    )?.[1]
    if (key) {
      return {
        data: {
          success: true,
          data: {
            key,
            value: key.includes('api_key')
              ? 'route-secret-key'
              : 'console-secret-password',
          },
        },
      } as never
    }
    return { data: { success: true, data: {} } } as never
  })
}

async function openUterRoute(user: ReturnType<typeof userEvent.setup>) {
  render(<WizardHarness client={mocks.client} />)
  await user.click(
    await screen.findByRole('option', { name: /Uter Route.*#65/i })
  )
}

test('密钥存在分组槽位时揭示 slot option key 并填入', async () => {
  const user = userEvent.setup()
  mocks = setupWizardApiMocks({
    extraGet: (url) => {
      if (url === '/api/verify/methods') {
        return {
          scope: 'channel.credential.read',
          methods: [{ method: 'password', available: true }],
          oauth_providers: [],
          password_encryption_enabled: false,
        }
      }
      if (url === '/api/option/') {
        return [
          {
            key: 'ChannelProviderCredentialMasks',
            value: JSON.stringify({
              featured: {
                slots: [{ id: 'slot-mwxg677x-1', api_key: 'sk-a****1' }],
              },
            }),
          },
        ]
      }
      return undefined
    },
  })
  mocks.postSpy.mockImplementation(async (url: string) => {
    if (url === '/api/verify') {
      return {
        data: {
          success: true,
          data: {
            proof_token: 'proof-slot',
            scope: 'channel.credential.read',
            method: 'password',
            expires_at: Math.floor(Date.now() / 1000) + 60,
          },
        },
      } as never
    }
    if (String(url).includes('/reveal')) {
      return {
        data: {
          success: true,
          data: { key: 'slot', value: 'sk-real-key' },
        },
      } as never
    }
    return { data: { success: true, data: {} } } as never
  })

  await openUterRoute(user)
  await user.click(await screen.findByTestId('credentials-autofill-button'))
  const dialogs = await screen.findAllByRole('dialog')
  const dialog = dialogs.at(-1) as HTMLElement
  const password = dialog.querySelector('input[type="password"]')
  await user.type(password as HTMLInputElement, 'login-password')
  await user.click(within(dialog).getByRole('button', { name: 'Verify' }))

  await waitFor(() =>
    expect(screen.getByDisplayValue('sk-real-key')).toBeVisible()
  )
  expect(api.post).toHaveBeenCalledWith(
    '/api/option/channel-provider/channel_provider.featured.slot_slot-mwxg677x-1_api_key/reveal',
    undefined,
    expect.anything()
  )
})

test('系统设置无保存凭证时点击自动获取给出明确提示，不弹验证框', async () => {
  const user = userEvent.setup()
  // 空掩码 + 无明文 login_url，属于「系统设置未配置 featured 组」场景。
  mocks = setupWizardApiMocks({
    providerCredentialMasks: {},
  })
  await openUterRoute(user)

  await user.click(await screen.findByTestId('credentials-autofill-button'))

  // 无密钥时不请求 proof，也不打开二次验证对话框。
  await waitFor(() =>
    expect(api.post).not.toHaveBeenCalledWith(
      '/api/verify',
      expect.anything(),
      expect.anything()
    )
  )
  // 两个区块的自动获取按钮都停留在初始态（没有进入 Fetching...）。
  expect(
    screen.getAllByRole('button', { name: 'Auto fill from settings' })
  ).toHaveLength(2)
})

test('Uter Route 身份验证自动获取：输密码后填入独立 API 地址与 API Key', async () => {
  const user = userEvent.setup()
  setupAutofillMocks()
  await openUterRoute(user)

  await user.click(await screen.findByTestId('credentials-autofill-button'))

  // 二次验证对话框要求输入登录密码。
  await screen.findAllByRole('dialog')
  const dialogs = screen.getAllByRole('dialog')
  const dialog = dialogs.at(-1) as HTMLElement
  const password = dialog.querySelector('input[type="password"]')
  expect(password).not.toBeNull()
  await user.type(password as HTMLInputElement, 'login-password')
  await user.click(within(dialog).getByRole('button', { name: 'Verify' }))

  await waitFor(() =>
    expect(
      screen.getByDisplayValue('https://featured-api.example.com')
    ).toBeVisible()
  )
  await waitFor(() =>
    expect(screen.getByDisplayValue('route-secret-key')).toBeVisible()
  )
})

test('编辑态托管渠道自动获取：系统设置在编辑态也会加载并填入凭证', async () => {
  const user = userEvent.setup()
  const row = makeEditingChannel({
    type: CHANNEL_TYPE_UTER_ROUTE,
    name: 'Uter Route existing',
    base_url: 'https://route.example.com',
    key: 'sk-existing',
  })
  // 编辑态：系统设置里只存了明文 login_url / username，没有需 step-up 的密码。
  mocks = setupWizardApiMocks({
    editingRow: row,
    extraGet: (url) => {
      if (url === '/api/option/') {
        return [
          {
            key: 'ChannelProviderCredentialMasks',
            value: JSON.stringify({
              featured: { api_key: 'route-key****one' },
            }),
          },
          {
            key: 'channel_provider.featured.login_url',
            value: 'https://featured.example.com',
          },
          {
            key: 'channel_provider.featured.username',
            value: 'featured-user',
          },
        ]
      }
      return undefined
    },
  })
  render(<WizardHarness client={mocks.client} currentRow={row} />)
  await user.click(
    await screen.findByRole('button', { name: 'Back to configuration' })
  )
  await screen.findByDisplayValue('Uter Route existing')

  // 回归核心：编辑态也必须拉取系统设置，否则自动填入只会报「仍在加载中」。
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/option/'))

  await user.click(await screen.findByTestId('console-autofill-button'))

  // 无密码掩码时不弹验证框，直接把明文地址 / 用户名填进表单。
  await waitFor(() =>
    expect(
      screen.getByDisplayValue('https://featured.example.com')
    ).toBeVisible()
  )
  await waitFor(() =>
    expect(screen.getByDisplayValue('featured-user')).toBeVisible()
  )
})

test('Uter Route 控制台自动获取：输密码后填入地址、用户名与密码', async () => {
  const user = userEvent.setup()
  setupAutofillMocks()
  await openUterRoute(user)

  await user.click(await screen.findByTestId('console-autofill-button'))

  await screen.findAllByRole('dialog')
  const dialogs = screen.getAllByRole('dialog')
  const dialog = dialogs.at(-1) as HTMLElement
  const password = dialog.querySelector('input[type="password"]')
  expect(password).not.toBeNull()
  await user.type(password as HTMLInputElement, 'login-password')
  await user.click(within(dialog).getByRole('button', { name: 'Verify' }))

  await waitFor(() =>
    expect(screen.getByDisplayValue('featured-user')).toBeVisible()
  )
  await waitFor(() =>
    expect(screen.getByDisplayValue('console-secret-password')).toBeVisible()
  )
  expect(api.post).toHaveBeenCalledWith(
    '/api/option/channel-provider/channel_provider.featured.password/reveal',
    undefined,
    expect.anything()
  )
  expect(api.post).toHaveBeenCalledWith(
    '/api/verify',
    expect.objectContaining({
      scope: 'channel.credential.read',
      method: 'password',
    }),
    expect.anything()
  )
})
