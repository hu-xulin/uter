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

import { CHANNEL_TYPE_UTER_ROUTE } from '../../constants'
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

async function pickUterRoute(user: ReturnType<typeof userEvent.setup>) {
  render(<WizardHarness client={mocks.client} />)
  await user.click(
    await screen.findByRole('option', { name: /Uter Route.*#65/i })
  )
}

// ── 创建态：六步与专属面板 ─────────────────────────────────────

test('Uter Route 创建向导的六步中，Fetch models 显示专属面板而非通用模型同步', async () => {
  const user = userEvent.setup()
  await pickUterRoute(user)

  expect(screen.getAllByRole('tab')).toHaveLength(6)
  await user.click(screen.getByRole('tab', { name: /Fetch models/ }))
  // The catalogue panel owns model discovery for this provider.
  expect(
    await screen.findByRole('button', { name: /Sync Uter Route catalog/ })
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: /Sync model information/ })
  ).toBeNull()
})

test('Uter Route 创建态显示凭证分组、密钥形式与逐行掩码', async () => {
  const user = userEvent.setup()
  await pickUterRoute(user)

  expect(
    await screen.findByText(
      /Credential group: Uter Select\. Key format: multi-line, one key per line; a single key occupies one line\./
    )
  ).toBeVisible()
  const hint = await screen.findByTestId('uterroute-saved-key-hint')
  expect(hint.textContent).toContain(
    'Leave empty to use the Uter Route key saved in System Settings'
  )
  expect(hint.textContent).toContain('1. route-key****one')
  expect(hint.textContent).toContain('2. route-key****two')
})

test('Uter Route Fetch prices 步骤展示定价目录来源文案', async () => {
  const user = userEvent.setup()
  await pickUterRoute(user)

  await user.click(screen.getByRole('tab', { name: /Fetch prices/ }))
  expect(
    screen.getByText('Prices are fetched from the Uter Route catalog')
  ).toBeVisible()
  expect(
    screen.getByText(/Generate a draft channel and sync the upstream catalog/)
  ).toBeVisible()
})

// ── 草稿：无草稿时手动准备 + 失败重试 ───────────────────────────

test('Uter Route 无草稿时提供手动 Prepare draft channel，点击触发草稿创建', async () => {
  const user = userEvent.setup()
  mocks = setupWizardApiMocks({
    // No draft exists: snapshot unsynced and endpoint resolves.
    uterRouteSnapshot: { synced: false },
  })
  mocks.postSpy.mockResolvedValue({
    data: { success: true, data: { id: 77 } },
  } as never)
  await pickUterRoute(user)
  await user.click(screen.getByRole('tab', { name: /Fetch models/ }))

  const prepare = await screen.findByRole('button', {
    name: 'Prepare draft channel',
  })
  await user.click(prepare)

  await waitFor(() =>
    expect(mocks.postSpy).toHaveBeenCalledWith(
      '/api/channel/draft',
      expect.objectContaining({ type: CHANNEL_TYPE_UTER_ROUTE }),
      expect.anything()
    )
  )
})

test('Uter Route 创建态可选择多密钥模式并写入草稿', async () => {
  const user = userEvent.setup()
  mocks = setupWizardApiMocks({
    // No draft exists so the models step creates one from the current form.
    uterRouteSnapshot: { synced: false },
  })
  mocks.postSpy.mockResolvedValue({
    data: { success: true, data: { id: 77 } },
  } as never)

  await pickUterRoute(user)
  await user.click(screen.getByRole('combobox', { name: 'Add Mode' }))
  await user.click(
    await screen.findByRole('option', {
      name: 'Multi-Key Mode (multiple keys, one channel)',
    })
  )
  await user.click(screen.getByRole('combobox', { name: 'Multi-Key Strategy' }))
  await user.click(await screen.findByRole('option', { name: 'Polling' }))
  fireEvent.change(
    screen.getByPlaceholderText('Enter one key per line for batch creation'),
    { target: { value: 'route-key-a\nroute-key-b' } }
  )

  await user.click(screen.getByRole('tab', { name: /Fetch models/ }))
  await user.click(
    await screen.findByRole('button', { name: 'Prepare draft channel' })
  )

  await waitFor(() =>
    expect(mocks.postSpy).toHaveBeenCalledWith(
      '/api/channel/draft',
      expect.objectContaining({
        type: CHANNEL_TYPE_UTER_ROUTE,
        mode: 'multi_to_single',
        multi_key_mode: 'polling',
      }),
      expect.anything()
    )
  )
})

test('Uter Route 草稿创建失败时提示错误，重试可再次触发', async () => {
  const user = userEvent.setup()
  mocks.postSpy
    .mockRejectedValueOnce(new Error('draft unavailable'))
    .mockResolvedValueOnce({
      data: { success: true, data: { id: 77 } },
    } as never)
  await pickUterRoute(user)
  await user.click(screen.getByRole('tab', { name: /Fetch models/ }))

  const prepare = await screen.findByRole('button', {
    name: 'Prepare draft channel',
  })
  await user.click(prepare)
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith('draft unavailable')
  )
  await user.click(prepare)
  await waitFor(() => expect(mocks.postSpy).toHaveBeenCalledTimes(2))
})

// ── 同步：目录同步失败与成功 ────────────────────────────────────

test('Uter Route 编辑态目录同步失败时展示错误 toast', async () => {
  const user = userEvent.setup()
  const row = makeEditingChannel({
    type: CHANNEL_TYPE_UTER_ROUTE,
    name: 'Uter Route existing',
    base_url: 'https://route.example.com',
    key: 'sk-existing',
  })
  mocks = setupWizardApiMocks({
    editingRow: row,
    uterRouteSnapshot: {
      synced: true,
      summary: {
        models: 1,
        groups: 1,
        pricing_version: 'v1',
        fetched_at: 'now',
        price_basis: 'ratio',
      },
      models: [],
      discount_groups: ['default', 'vip'],
      discount_group: 'default',
    },
  })
  mocks.postSpy.mockRejectedValue(new Error('catalog down'))
  render(<WizardHarness client={mocks.client} currentRow={row} />)
  await user.click(
    await screen.findByRole('button', { name: 'Back to configuration' })
  )
  await screen.findByDisplayValue('Uter Route existing')
  await user.click(screen.getByRole('tab', { name: /Fetch models/ }))

  await user.click(
    await screen.findByRole('button', { name: /Sync Uter Route catalog/ })
  )
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('catalog down'))
})

test('Uter Route 编辑态切换折扣组按新组重新同步', async () => {
  const user = userEvent.setup()
  const row = makeEditingChannel({
    type: CHANNEL_TYPE_UTER_ROUTE,
    name: 'Uter Route existing',
    base_url: 'https://route.example.com',
    key: 'sk-existing',
  })
  mocks = setupWizardApiMocks({
    editingRow: row,
    uterRouteSnapshot: {
      synced: true,
      summary: {
        models: 1,
        groups: 1,
        pricing_version: 'v1',
        fetched_at: 'now',
        price_basis: 'ratio',
      },
      models: [],
      discount_groups: ['default', 'vip'],
      discount_group: 'default',
    },
  })
  mocks.postSpy.mockResolvedValue({
    data: {
      success: true,
      data: {
        channel_pricing_written: 1,
        discount_groups: ['default', 'vip'],
        discount_group: 'vip',
        models: 1,
        groups: 1,
        pricing_version: 'v1',
        fetched_at: 'now',
        price_basis: 'ratio',
      },
    },
  } as never)
  render(<WizardHarness client={mocks.client} currentRow={row} />)
  await user.click(
    await screen.findByRole('button', { name: 'Back to configuration' })
  )
  await screen.findByDisplayValue('Uter Route existing')
  await user.click(screen.getByRole('tab', { name: /Fetch models/ }))

  await user.click(
    await screen.findByRole('combobox', { name: 'Discount group' })
  )
  await user.click(await screen.findByRole('option', { name: 'vip' }))

  await waitFor(() =>
    expect(mocks.postSpy).toHaveBeenCalledWith(
      '/api/upstream/uterroute/sync',
      expect.objectContaining({ channel_id: 42, discount_group: 'vip' })
    )
  )
})

// ── 端点异常：仍可进入向导 ─────────────────────────────────────

test('Uter Route endpoint 查询失败时仍可进入向导', async () => {
  const user = userEvent.setup()
  mocks = setupWizardApiMocks({ uterRouteEndpoint: null })
  await pickUterRoute(user)

  expect(
    screen.getByRole('button', { name: 'Change provider' })
  ).toHaveTextContent('Uter Route')
  expect(screen.getAllByRole('tab')).toHaveLength(6)
})

// ── 编辑态：type 65 不自动建草稿，面板无 Prepare ────────────────

test('Uter Route 编辑态显示专属面板但没有 Prepare draft，且不自动建草稿', async () => {
  const user = userEvent.setup()
  const row = makeEditingChannel({
    type: CHANNEL_TYPE_UTER_ROUTE,
    name: 'Uter Route existing',
    base_url: 'https://route.example.com',
    key: 'sk-existing',
  })
  mocks = setupWizardApiMocks({ editingRow: row })
  render(<WizardHarness client={mocks.client} currentRow={row} />)
  await user.click(
    await screen.findByRole('button', { name: 'Back to configuration' })
  )
  await screen.findByDisplayValue('Uter Route existing')
  await user.click(screen.getByRole('tab', { name: /Fetch models/ }))

  expect(
    await screen.findByRole('button', { name: /Sync Uter Route catalog/ })
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Prepare draft channel' })
  ).toBeNull()
  expect(mocks.postSpy).not.toHaveBeenCalledWith(
    '/api/channel/draft',
    expect.anything()
  )
})
