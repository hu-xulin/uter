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
import { render, screen } from '@testing-library/react'
import { createInstance, type i18n } from 'i18next'
import { useState } from 'react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'

import ja from '@/i18n/locales/ja.json'
import zhTW from '@/i18n/locales/zh-TW.json'
import zh from '@/i18n/locales/zh.json'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { ChannelProviderSettingsSection } from '../channel-provider-settings-section'
import type { ChannelCredentialDisclosure } from '../use-channel-credential-disclosure'

vi.mock('../../hooks/use-update-option', () => ({
  useUpdateOption: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  }),
}))

vi.mock('../../../channels/api', () => ({
  getUterAPIPricingGroups: vi.fn().mockResolvedValue({
    success: true,
    data: { groups: [] },
  }),
}))

let testI18n: i18n

function Fixture() {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  )
  const disclosure: ChannelCredentialDisclosure = {
    verification: {} as never,
    reveal: vi.fn(),
    hide: vi.fn(),
    revealed: {},
    pendingKey: null,
    isRevealing: false,
  }

  return (
    <I18nextProvider i18n={testI18n}>
      <QueryClientProvider client={client}>
        <div ref={setContainer} />
        <SettingsPageProvider actionsContainer={container}>
          <ChannelProviderSettingsSection
            title='Uter Bailian'
            description='saved values fill empty connection fields on the server.'
            prefix='bailian'
            values={{
              loginUrl: '',
              username: '',
              password: '',
              apiKey: '',
              slots: [],
            }}
            disclosure={disclosure}
          />
        </SettingsPageProvider>
      </QueryClientProvider>
    </I18nextProvider>
  )
}

async function initLang(lng: string, resources: Record<string, unknown>) {
  testI18n = createInstance()
  await testI18n.init({
    lng,
    fallbackLng: lng,
    resources: { [lng]: { translation: resources } },
    interpolation: { escapeValue: false },
  })
}

describe('ChannelProviderSettingsSection grouped keys i18n', () => {
  const cases = [
    {
      lng: 'zh',
      resources: zh,
      heading: '分组 API 密钥',
      groupLabel: '密钥分组 1',
      savedHint: '已保存的密钥以掩码显示。输入新密钥即可替换。',
    },
    {
      lng: 'zh-TW',
      resources: zhTW,
      heading: '分組 API 金鑰',
      groupLabel: '金鑰分組 1',
      savedHint: '已儲存的金鑰以遮罩顯示。輸入新金鑰即可取代。',
    },
    {
      lng: 'ja',
      resources: ja,
      heading: 'グループ化された API キー',
      groupLabel: 'キーグループ 1',
      savedHint:
        '保存済みのキーはマスク表示されます。新しいキーを入力すると置き換えられます。',
    },
  ]

  it.each(cases)(
    '$lng 环境下分组密钥区显示本地化文案而非英文原文',
    async ({ lng, resources, heading, groupLabel, savedHint }) => {
      await initLang(lng, resources.translation)
      render(<Fixture />)
      expect(await screen.findByText(heading)).toBeVisible()
      expect(screen.getByLabelText(groupLabel)).toBeInTheDocument()
      expect(screen.getAllByText(savedHint).length).toBeGreaterThan(0)
      expect(screen.queryByText('Grouped API keys')).toBeNull()
    }
  )
})
