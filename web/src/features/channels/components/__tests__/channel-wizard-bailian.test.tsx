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
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth-store'

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

// The front-end has no named constant for Alibaba Bailian; the backend's
// constant.ChannelTypeAli is 17.
const CHANNEL_TYPE_ALI = 17

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

async function pickBailian(user: ReturnType<typeof userEvent.setup>) {
  render(<WizardHarness client={mocks.client} />)
  // CHANNEL_TYPES[17] is 'Ali' in the front-end option list.
  const option = await screen.findByRole('option', {
    name: /^Ali\b/i,
  })
  await user.click(option)
}

// ── 创建态：六步与面板 ─────────────────────────────────────────

test('百炼创建向导展示六步，Fetch models 显示百炼专属面板', async () => {
  const user = userEvent.setup()
  await pickBailian(user)

  expect(screen.getAllByRole('tab')).toHaveLength(6)
  await user.click(screen.getByRole('tab', { name: /Fetch models/ }))
  expect(await screen.findByText('Alibaba Bailian')).toBeVisible()
  expect(
    screen.getByText(
      'Sync the upstream catalog, model metadata and reference prices before choosing models.'
    )
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: /Sync model information/ })
  ).toBeNull()
})

test('百炼创建态显示凭证分组、密钥形式与逐行掩码', async () => {
  const user = userEvent.setup()
  await pickBailian(user)

  expect(
    await screen.findByText(
      /Credential group: Uter Bailian\. Key format: multi-line, one key per line; a single key occupies one line\./
    )
  ).toBeVisible()
  const hint = await screen.findByTestId('bailian-saved-key-hint')
  expect(hint.textContent).toContain(
    'Leave empty to use the Alibaba Bailian key saved in System Settings'
  )
  expect(hint.textContent).toContain('1. bailian-key****one')
})

test('百炼 Fetch prices 步骤展示官方目录来源文案', async () => {
  const user = userEvent.setup()
  await pickBailian(user)

  await user.click(screen.getByRole('tab', { name: /Fetch prices/ }))
  expect(
    screen.getByText('Prices are fetched from the official catalog')
  ).toBeVisible()
})

// ── 草稿门禁：无 key / 无 base_url 不自动建草稿 ──────────────────

test('百炼无 key 时不自动创建草稿', async () => {
  const user = userEvent.setup()
  await pickBailian(user)
  await user.click(screen.getByRole('tab', { name: /Fetch models/ }))
  await screen.findByText('Alibaba Bailian')

  expect(mocks.postSpy).not.toHaveBeenCalledWith(
    '/api/channel/draft',
    expect.anything(),
    expect.anything()
  )
})

test('百炼创建态支持三种密钥添加模式', async () => {
  const user = userEvent.setup()
  await pickBailian(user)

  await user.click(screen.getByRole('combobox', { name: 'Add Mode' }))
  for (const option of [
    'Single Key',
    'Batch Add (one key per line)',
    'Multi-Key Mode (multiple keys, one channel)',
  ]) {
    expect(await screen.findByRole('option', { name: option })).toBeVisible()
  }
  await user.click(
    await screen.findByRole('option', {
      name: 'Multi-Key Mode (multiple keys, one channel)',
    })
  )

  expect(
    await screen.findByRole('combobox', { name: 'Multi-Key Strategy' })
  ).toBeVisible()
})

test('百炼多密钥草稿价格目录为空时，从上游获取仍展示已发现模型', async () => {
  const user = userEvent.setup()
  mocks.postSpy.mockImplementation(async (url: string) => {
    if (url === '/api/channel/draft') {
      return { data: { success: true, data: { id: 77 } } } as never
    }
    if (url === '/api/channel/fetch_models') {
      return {
        data: { success: true, data: ['upstream-model'] },
      } as never
    }
    return { data: { success: true, data: {} } } as never
  })

  await pickBailian(user)
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
    { target: { value: 'sk-ws-a\nsk-ws-b\nsk-ws-c' } }
  )

  // The Bailian wizard exposes draft creation from the pricing step, not the
  // Uter Route-specific "Prepare draft channel" button.
  await user.click(screen.getByRole('tab', { name: /Configure prices/ }))
  await user.click(
    await screen.findByRole('button', { name: 'Configure pricing now' })
  )
  await user.click(
    await screen.findByRole('button', { name: 'Create draft channel' })
  )
  await waitFor(() =>
    expect(mocks.postSpy).toHaveBeenCalledWith(
      '/api/channel/draft',
      expect.objectContaining({
        mode: 'multi_to_single',
        multi_key_mode: 'polling',
        key: 'sk-ws-a\nsk-ws-b\nsk-ws-c',
      }),
      expect.anything()
    )
  )

  await user.click(screen.getByRole('tab', { name: /Fetch models/ }))
  await user.click(screen.getByRole('button', { name: 'Fetch from Upstream' }))

  // The draft has no selected models yet, so the Bailian catalogue has not
  // written any price row. That must not turn a successful upstream
  // discovery into "the upstream returned no models".
  expect(
    await screen.findByRole('checkbox', { name: 'upstream-model' })
  ).toBeVisible()
  expect(screen.queryByText('No models returned by the upstream')).toBeNull()
})

test('百炼编辑态价格目录为空时，从上游获取仍展示已发现模型', async () => {
  const user = userEvent.setup()
  const row = makeEditingChannel({
    type: CHANNEL_TYPE_ALI,
    name: 'Bailian empty price catalogue',
    base_url: 'https://myws.cn-beijing.maas.aliyuncs.com/api/v1',
    key: 'sk-existing',
    models: 'existing-model',
  })
  mocks = setupWizardApiMocks({ editingRow: row, pricingRows: [] })
  render(<WizardHarness client={mocks.client} currentRow={row} />)
  await user.click(
    await screen.findByRole('button', { name: 'Back to configuration' })
  )
  await screen.findByDisplayValue('Bailian empty price catalogue')
  await user.click(screen.getByRole('tab', { name: /Fetch models/ }))

  await user.click(screen.getByRole('button', { name: 'Fetch from Upstream' }))

  expect(
    await screen.findByRole('checkbox', { name: 'upstream-model' })
  ).toBeVisible()
  expect(
    screen.queryByText('Models without a usable price are hidden.')
  ).toBeNull()
})

// ── 手动同步：refresh / apply ───────────────────────────────────

test('百炼创建态无草稿时不展示目录同步按钮', async () => {
  const user = userEvent.setup()
  await pickBailian(user)
  await user.click(screen.getByRole('tab', { name: /Fetch models/ }))
  await screen.findByText('Alibaba Bailian')

  // The sync/apply controls require a persisted channel; before the draft is
  // created the panel only shows the region/workspace editor.
  expect(
    screen.queryByRole('button', { name: 'Sync channel catalog' })
  ).toBeNull()
  expect(
    screen.queryByRole('button', { name: 'Apply catalog metadata' })
  ).toBeNull()
})

test('百炼编辑态可手动 Sync channel catalog 并写入 refresh 请求', async () => {
  const user = userEvent.setup()
  const row = makeEditingChannel({
    type: CHANNEL_TYPE_ALI,
    name: 'Bailian existing',
    base_url: 'https://myws.cn-beijing.maas.aliyuncs.com/api/v1',
    key: 'sk-existing',
  })
  mocks = setupWizardApiMocks({ editingRow: row })
  mocks.postSpy.mockResolvedValue({
    data: { success: true, data: { actual_models: 2 } },
  } as never)
  render(<WizardHarness client={mocks.client} currentRow={row} />)
  await user.click(
    await screen.findByRole('button', { name: 'Back to configuration' })
  )
  await screen.findByDisplayValue('Bailian existing')
  await user.click(screen.getByRole('tab', { name: /Fetch models/ }))

  await user.click(
    await screen.findByRole('button', { name: 'Sync channel catalog' })
  )
  await waitFor(() =>
    expect(mocks.postSpy).toHaveBeenCalledWith(
      '/api/ratio_sync/bailian/catalog/refresh',
      expect.objectContaining({ channel_id: 42 })
    )
  )
})

// ── 编辑态：不自动拉价、baseUrlChanged 警告 ──────────────────────

test('百炼编辑态不自动触发 catalog apply', async () => {
  const user = userEvent.setup()
  const row = makeEditingChannel({
    type: CHANNEL_TYPE_ALI,
    name: 'Bailian existing',
    base_url: 'https://myws.cn-beijing.maas.aliyuncs.com/api/v1',
    key: 'sk-existing',
  })
  mocks = setupWizardApiMocks({ editingRow: row })
  mocks.postSpy.mockResolvedValue({
    data: { success: true, data: {} },
  } as never)
  render(<WizardHarness client={mocks.client} currentRow={row} />)
  await user.click(
    await screen.findByRole('button', { name: 'Back to configuration' })
  )
  await screen.findByDisplayValue('Bailian existing')
  await user.click(screen.getByRole('tab', { name: /Fetch models/ }))
  await screen.findByText('Alibaba Bailian')

  expect(mocks.postSpy).not.toHaveBeenCalledWith(
    '/api/ratio_sync/bailian/catalog/apply',
    expect.anything()
  )
})

test('百炼编辑态可切换 Region 与 Workspace ID', async () => {
  const user = userEvent.setup()
  const row = makeEditingChannel({
    type: CHANNEL_TYPE_ALI,
    name: 'Bailian existing',
    base_url: 'https://myws.cn-beijing.maas.aliyuncs.com/api/v1',
    key: 'sk-existing',
  })
  mocks = setupWizardApiMocks({ editingRow: row })
  render(<WizardHarness client={mocks.client} currentRow={row} />)
  await user.click(
    await screen.findByRole('button', { name: 'Back to configuration' })
  )
  await screen.findByDisplayValue('Bailian existing')
  await user.click(screen.getByRole('tab', { name: /Fetch models/ }))
  await screen.findByText('Alibaba Bailian')

  expect(await screen.findByDisplayValue('myws')).toBeVisible()
  expect(screen.getByRole('combobox', { name: 'Region' })).toBeVisible()
  // BaseUrlChanged refresh is a Uter Route-only behaviour; Bailian must not
  // surface it.
  expect(screen.queryByText('Gateway address changed')).toBeNull()
})
