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
import { describe, expect, it } from 'vitest'

import en from '../locales/en.json'
import fr from '../locales/fr.json'
import ja from '../locales/ja.json'
import ru from '../locales/ru.json'
import vi from '../locales/vi.json'
import zhTW from '../locales/zh-TW.json'
import zh from '../locales/zh.json'

// The Apiko catalogue block was once shifted by one language: en held Chinese,
// zh held Traditional Chinese, zh-TW held French, and so on. Keep every locale
// in its own script so the create-channel flow cannot regress to the wrong one.
const APIKO_KEYS = [
  'Apiko catalogue sync',
  'Sync the full model list published by the Apiko control plane. Existing entries are kept.',
  'Sync Apiko models',
  'Added {{count}} models from the Apiko catalogue',
  '{{total}} models after sync; {{added}} added',
  'Failed to sync Apiko models',
  'Save the channel before syncing models.',
] as const

const TRADITIONAL = /[設價確選個這們為與儲應連檔資開關啟檢測僅從會數據頻]/
const HAN = /[\u4e00-\u9fff]/

describe('Apiko create-channel locale block', () => {
  it('keeps English values free of Chinese text', () => {
    for (const key of APIKO_KEYS) {
      expect(en.translation[key], key).not.toMatch(HAN)
    }
  })

  it('keeps simplified Chinese values free of Traditional Chinese', () => {
    for (const key of APIKO_KEYS) {
      expect(zh.translation[key], key).not.toMatch(TRADITIONAL)
    }
  })

  it('keeps every locale in its own language', () => {
    expect(en.translation['Apiko catalogue sync']).toBe('Apiko catalogue sync')
    expect(zh.translation['Apiko catalogue sync']).toBe('Apiko 目录同步')
    expect(zhTW.translation['Apiko catalogue sync']).toBe('Apiko 目錄同步')
    expect(fr.translation['Apiko catalogue sync']).toMatch(/^Synchronisation/)
    expect(ja.translation['Apiko catalogue sync']).toMatch(/^Apiko カタログ/)
    expect(ru.translation['Apiko catalogue sync']).toMatch(/^Синхронизация/)
    expect(vi.translation['Apiko catalogue sync']).toMatch(/^Đồng bộ/)
  })
})
