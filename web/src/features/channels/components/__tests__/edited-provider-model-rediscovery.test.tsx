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

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { WizardHarness } from './wizard-harness'
import {
  makeEditingChannel,
  setupWizardApiMocks,
  wizardOriginalAuth,
  type WizardMockState,
} from './wizard-harness-data'

vi.setConfig({ testTimeout: 60_000 })

let mocks: WizardMockState

function configuredPricingRow(modelName: string) {
  return {
    channel_id: 42,
    model_name: modelName,
    provider: 'openai',
    region: '',
    deployment_id: '',
    currency: 'USD',
    pricing_source: 'test:configured',
    pricing_status: 'configured',
    pricing_version: 'v1',
    price_supported: true,
    fetched_at: 1,
    updated_at: 1,
    stale: false,
    fetched_age_hours: 0,
  }
}

beforeEach(() => {
  mocks = setupWizardApiMocks({
    pricingRows: [
      configuredPricingRow('upstream-model'),
      configuredPricingRow('deepseek-model'),
    ],
  })
})

afterEach(() => {
  cleanup()
  mocks.client.clear()
  useAuthStore.setState({ auth: wizardOriginalAuth })
  vi.restoreAllMocks()
})

async function enterEditingWizard(user: ReturnType<typeof userEvent.setup>) {
  const back = await screen.findByRole('button', {
    name: 'Back to configuration',
  })
  await user.click(back)
  return screen.findByDisplayValue('Existing channel')
}

test('编辑态改选不同供应商后进入获取模型步骤会用 channel_id 重新 POST 获取模型', async () => {
  const user = userEvent.setup()
  mocks.postSpy.mockResolvedValue({
    data: { success: true, data: ['deepseek-model'] },
  } as never)
  render(
    <WizardHarness client={mocks.client} currentRow={makeEditingChannel()} />
  )
  await enterEditingWizard(user)

  // 编辑态浏览器只有脱敏 key；即使表单里填入明文，也不能发给服务端。
  fireEvent.change(screen.getByLabelText('API Key *'), {
    target: { value: 'plaintext-secret' },
  })
  await user.click(screen.getByRole('button', { name: 'Change provider' }))
  await user.click(await screen.findByRole('option', { name: /^DeepSeek / }))
  await user.click(screen.getByRole('tab', { name: /Fetch models/ }))

  await waitFor(() =>
    expect(mocks.postSpy).toHaveBeenCalledWith(
      '/api/channel/fetch_models',
      expect.objectContaining({ type: 43, channel_id: 42 }),
      expect.anything()
    )
  )
  const payload = mocks.postSpy.mock.calls[0]?.[1] as Record<string, unknown>
  expect(payload.type).toBe(43)
  expect(payload.channel_id).toBe(42)
  expect(payload.key).toBeUndefined()
  expect(api.get).not.toHaveBeenCalledWith(
    '/api/channel/fetch_models/42',
    expect.anything()
  )
  expect(
    await screen.findByRole('checkbox', { name: 'deepseek-model' })
  ).toBeVisible()
})

test('编辑态重新确认原供应商后进入获取模型步骤仍从已存渠道获取模型', async () => {
  const user = userEvent.setup()
  render(
    <WizardHarness client={mocks.client} currentRow={makeEditingChannel()} />
  )
  await enterEditingWizard(user)

  await user.click(screen.getByRole('button', { name: 'Change provider' }))
  await user.click(
    await screen.findByRole('option', { name: 'OpenAI Type #1' })
  )
  await user.click(screen.getByRole('tab', { name: /Fetch models/ }))
  await user.click(screen.getByRole('button', { name: 'Fetch from Upstream' }))

  await screen.findByRole('checkbox', { name: 'upstream-model' })
  expect(api.get).toHaveBeenCalledWith(
    '/api/channel/fetch_models/42',
    expect.anything()
  )
  expect(mocks.postSpy).not.toHaveBeenCalled()
})
