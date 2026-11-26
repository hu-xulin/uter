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
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth-store'

import { CHANNEL_TYPE_UTER_API } from '../../constants'
import { WizardHarness } from './wizard-harness'
import {
  makeEditingChannel,
  setupWizardApiMocks,
  wizardOriginalAuth,
  type WizardMockState,
} from './wizard-harness-data'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}))

vi.setConfig({ testTimeout: 60_000 })

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

async function pickUterApi(user: ReturnType<typeof userEvent.setup>) {
  render(<WizardHarness client={mocks.client} />)
  await user.click(
    await screen.findByRole('option', { name: /Uter\.api.*#64/i })
  )
}

async function pickGroup(
  user: ReturnType<typeof userEvent.setup>,
  name: string
) {
  await user.click(screen.getByRole('combobox', { name: 'Group' }))
  await user.click(await screen.findByRole('option', { name }))
}

function typeKeys(value: string) {
  fireEvent.change(screen.getByLabelText('API keys'), { target: { value } })
}

// ── 创建态：六步结构（每一步可达） ──────────────────────────────

test('Uter.api 创建向导展示全部六步且每一步都可切换', async () => {
  const user = userEvent.setup()
  await pickUterApi(user)

  const steps = [
    /Connect channel/,
    /Fetch models/,
    /Fetch prices/,
    /Configure prices/,
    /Automatic updates/,
    /Other settings/,
  ]
  expect(screen.getAllByRole('tab')).toHaveLength(6)
  for (const step of steps) {
    const tab = screen.getByRole('tab', { name: step })
    await user.click(tab)
    expect(tab).toHaveAttribute('aria-selected', 'true')
  }
})

test('Uter.api 单个分组卡片只显示分组字段，不重复显示分组标题', async () => {
  const user = userEvent.setup()
  await pickUterApi(user)

  expect(screen.queryByText('Group 1')).not.toBeInTheDocument()
  expect(screen.getByText('Group', { exact: true })).toBeVisible()
})

// ── 创建态：提交前置校验（未选分组 / 无密钥） ───────────────────

test('Uter.api 未选分组直接创建：报错并跳回连接步骤，不发请求', async () => {
  const user = userEvent.setup()
  await pickUterApi(user)

  await user.click(screen.getByRole('tab', { name: /Other settings/ }))
  await user.click(screen.getByRole('button', { name: 'Create Channel' }))

  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      'Choose a group and enter at least one API key'
    )
  )
  expect(screen.getByRole('tab', { name: /Connect channel/ })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  expect(mocks.postSpy).not.toHaveBeenCalled()
})

test('Uter.api 选了分组但密钥为空：报错且不发请求', async () => {
  const user = userEvent.setup()
  mocks = setupWizardApiMocks({ providerCredentialMasks: {} })
  await pickUterApi(user)
  await pickGroup(user, 'Claude Standard')

  await user.click(screen.getByRole('tab', { name: /Other settings/ }))
  await user.click(screen.getByRole('button', { name: 'Create Channel' }))

  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      'Enter an API key for every group, or leave it empty to use the saved key'
    )
  )
  expect(mocks.postSpy).not.toHaveBeenCalled()
})

test('Uter.api 密钥仅含空白行：视为无密钥，不发请求', async () => {
  const user = userEvent.setup()
  mocks = setupWizardApiMocks({ providerCredentialMasks: {} })
  await pickUterApi(user)
  await pickGroup(user, 'Claude Standard')
  typeKeys('   \n\t\n  ')

  await user.click(screen.getByRole('tab', { name: /Other settings/ }))
  await user.click(screen.getByRole('button', { name: 'Create Channel' }))

  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      'Enter an API key for every group, or leave it empty to use the saved key'
    )
  )
  expect(mocks.postSpy).not.toHaveBeenCalled()
})

// ── 创建态：密钥去重与单分组提交载荷 ────────────────────────────

async function pickMode(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  index = 1
) {
  const label = index === 1 ? 'Add Mode' : `Add Mode ${index}`
  await user.click(screen.getByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name }))
}

test('Uter.api 单密钥模式只提交第一行 key', async () => {
  const user = userEvent.setup()
  await pickUterApi(user)
  await pickGroup(user, 'Claude Standard')
  typeKeys('sk-a\nsk-b')

  await user.click(screen.getByRole('tab', { name: /Other settings/ }))
  await user.click(screen.getByRole('button', { name: 'Create Channel' }))

  await waitFor(() => expect(mocks.postSpy).toHaveBeenCalledTimes(1))
  const [url, payload] = mocks.postSpy.mock.calls[0]
  expect(url).toBe('/api/channel/uterapi')
  expect(payload.slots).toEqual([
    { name: 'Uter.api-Claude-max', group: 'Claude-max', keys: ['sk-a'] },
  ])
})

test('Uter.api 批量模式每个 key 建一个渠道并去重', async () => {
  const user = userEvent.setup()
  await pickUterApi(user)
  await pickGroup(user, 'Claude Standard')
  await pickMode(user, 'Batch Add (one key per line)')
  typeKeys('sk-a\n\nsk-b\nsk-a\n  sk-c  \n')

  await user.click(screen.getByRole('tab', { name: /Other settings/ }))
  await user.click(screen.getByRole('button', { name: 'Create Channel' }))

  await waitFor(() => expect(mocks.postSpy).toHaveBeenCalledTimes(1))
  const [, payload] = mocks.postSpy.mock.calls[0]
  expect(payload.slots).toEqual([
    { name: 'Uter.api-Claude-max 1', group: 'Claude-max', keys: ['sk-a'] },
    { name: 'Uter.api-Claude-max 2', group: 'Claude-max', keys: ['sk-b'] },
    { name: 'Uter.api-Claude-max 3', group: 'Claude-max', keys: ['sk-c'] },
  ])
})

test('Uter.api 多密钥模式把去重后的 key 放在同一个渠道', async () => {
  const user = userEvent.setup()
  await pickUterApi(user)
  await pickGroup(user, 'Claude Standard')
  await pickMode(user, 'Multi-Key Mode (multiple keys, one channel)')
  typeKeys('sk-a\n\nsk-b\nsk-a\n  sk-c  \n')

  await user.click(screen.getByRole('tab', { name: /Other settings/ }))
  await user.click(screen.getByRole('button', { name: 'Create Channel' }))

  await waitFor(() => expect(mocks.postSpy).toHaveBeenCalledTimes(1))
  const [, payload] = mocks.postSpy.mock.calls[0]
  expect(payload.slots).toEqual([
    {
      name: 'Uter.api-Claude-max',
      group: 'Claude-max',
      keys: ['sk-a', 'sk-b', 'sk-c'],
    },
  ])
})

test('Uter.api 不同分组可使用不同密钥模式一次提交', async () => {
  const user = userEvent.setup()
  await pickUterApi(user)
  await pickGroup(user, 'Claude Standard')
  await pickMode(user, 'Multi-Key Mode (multiple keys, one channel)')
  typeKeys('sk-a\nsk-b')

  await user.click(screen.getByRole('button', { name: 'Add group' }))
  await user.click(screen.getByRole('combobox', { name: 'Group 2' }))
  await user.click(
    await screen.findByRole('option', { name: 'Claude Economy' })
  )
  await pickMode(user, 'Single Key', 2)
  await user.type(screen.getByLabelText('API keys 2'), 'sk-c')

  await user.click(screen.getByRole('tab', { name: /Other settings/ }))
  await user.click(screen.getByRole('button', { name: 'Create Channel' }))

  await waitFor(() => expect(mocks.postSpy).toHaveBeenCalledTimes(1))
  const [, payload] = mocks.postSpy.mock.calls[0]
  expect(payload.slots).toEqual([
    {
      name: 'Uter.api-Claude-max',
      group: 'Claude-max',
      keys: ['sk-a', 'sk-b'],
    },
    { name: 'Uter.api-Claude-kiro', group: 'Claude-kiro', keys: ['sk-c'] },
  ])
})

// ── 创建态：提交成功 / 部分价格失败 / 服务端异常 / created=0 ─────

test('Uter.api 创建成功：提示成功并关闭抽屉', async () => {
  const user = userEvent.setup()
  mocks.postSpy.mockResolvedValue({
    data: { success: true, data: { created: 1, channels: [] } },
  } as never)
  await pickUterApi(user)
  await pickGroup(user, 'Claude Economy')
  typeKeys('sk-ok')

  await user.click(screen.getByRole('tab', { name: /Other settings/ }))
  await user.click(screen.getByRole('button', { name: 'Create Channel' }))

  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith('Uter.api channel created')
  )
  expect(toast.warning).not.toHaveBeenCalled()
  await waitFor(() =>
    expect(screen.queryByRole('tab', { name: /Connect channel/ })).toBeNull()
  )
})

test('Uter.api 任一分渠道价格同步失败：提示 warning 而非 success', async () => {
  const user = userEvent.setup()
  mocks.postSpy.mockResolvedValue({
    data: {
      success: true,
      data: {
        created: 1,
        channels: [{ id: 1, pricing_error: 'catalog fetch failed' }],
      },
    },
  } as never)
  await pickUterApi(user)
  await pickGroup(user, 'Claude Standard')
  typeKeys('sk-ok')

  await user.click(screen.getByRole('tab', { name: /Other settings/ }))
  await user.click(screen.getByRole('button', { name: 'Create Channel' }))

  await waitFor(() =>
    expect(toast.warning).toHaveBeenCalledWith(
      'Uter.api channel created, but pricing sync failed'
    )
  )
  expect(toast.success).not.toHaveBeenCalled()
})

test('Uter.api 创建请求抛错：提示服务端错误且不误报成功', async () => {
  const user = userEvent.setup()
  mocks.postSpy.mockRejectedValue(new Error('500 upstream down'))
  await pickUterApi(user)
  await pickGroup(user, 'Claude Standard')
  typeKeys('sk-ok')

  await user.click(screen.getByRole('tab', { name: /Other settings/ }))
  await user.click(screen.getByRole('button', { name: 'Create Channel' }))

  // handleServerError preserves the concrete server reason over the fallback.
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith('500 upstream down')
  )
  expect(toast.success).not.toHaveBeenCalled()
})

test('Uter.api created=0：服务端业务失败不误报成功、抽屉保持打开', async () => {
  const user = userEvent.setup()
  mocks.postSpy.mockResolvedValue({
    data: {
      success: false,
      message: 'no Uter.api channel could be created',
      data: { created: 0, channels: [] },
    },
  } as never)
  await pickUterApi(user)
  await pickGroup(user, 'Claude Standard')
  typeKeys('sk-ok')

  await user.click(screen.getByRole('tab', { name: /Other settings/ }))
  await user.click(screen.getByRole('button', { name: 'Create Channel' }))

  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      'no Uter.api channel could be created'
    )
  )
  expect(toast.success).not.toHaveBeenCalled()
  expect(
    screen.getByRole('tab', { name: /Other settings/ })
  ).toBeInTheDocument()
})

// ── 分组查询失败 / 空目录 ──────────────────────────────────────

test('Uter.api 分组列表为空：分组下拉无可选项且无法创建', async () => {
  const user = userEvent.setup()
  mocks = setupWizardApiMocks({ groups: [] })
  await pickUterApi(user)

  await user.click(screen.getByRole('combobox', { name: 'Group' }))
  await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0))
  await user.click(screen.getByRole('tab', { name: /Other settings/ }))
  await user.click(screen.getByRole('button', { name: 'Create Channel' }))
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      'Choose a group and enter at least one API key'
    )
  )
})

test('Uter.api 价格预览返回空目录：Fetch prices 显示空状态', async () => {
  const user = userEvent.setup()
  mocks = setupWizardApiMocks({ pricePreviewItems: () => [] })
  await pickUterApi(user)
  await pickGroup(user, 'Claude Standard')

  await user.click(screen.getByRole('tab', { name: /Fetch prices/ }))
  expect(
    await screen.findByText('No published prices for this group.')
  ).toBeVisible()
})

// ── 编辑态：type 64 走普通编辑路径 ──────────────────────────────

test('Uter.api 编辑态走 PUT 更新：无分组 UI、保留 Base URL 与 Key 输入', async () => {
  const user = userEvent.setup()
  const row = makeEditingChannel({
    type: CHANNEL_TYPE_UTER_API,
    name: 'Uter.api existing',
    base_url: 'https://uter.api.example',
    key: 'sk-existing',
  })
  mocks = setupWizardApiMocks({ editingRow: row })
  render(<WizardHarness client={mocks.client} currentRow={row} />)
  await user.click(
    await screen.findByRole('button', { name: 'Back to configuration' })
  )
  await screen.findByDisplayValue('Uter.api existing')

  expect(screen.queryByRole('combobox', { name: 'Group' })).toBeNull()
  expect(screen.getByRole('textbox', { name: 'Base URL' })).toBeVisible()
  // The stored key is masked until reveal; assert the key textarea by name.
  expect(screen.getByRole('textbox', { name: 'API Key *' })).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'Update Channel' }))
  await waitFor(() => expect(mocks.putSpy).toHaveBeenCalled())
  expect(mocks.postSpy).not.toHaveBeenCalled()
})
