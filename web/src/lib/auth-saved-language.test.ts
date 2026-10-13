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
import i18n from 'i18next'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import {
  useAuthStore,
  type AuthBundle,
  type AuthUser,
} from '../stores/auth-store'
import { applyAuthBundle, applySavedLanguage } from './auth-session'

const user: AuthUser = {
  id: 42,
  username: 'test-user',
  role: 1,
}

const bundle: AuthBundle = {
  access_token: 'access-token',
  token_type: 'Bearer',
  access_expires_at: Math.floor(Date.now() / 1000) + 600,
  user,
  session: {
    sid: 'session-a',
    current: true,
    login_method: 'password',
    ip: '127.0.0.1',
    user_agent: 'test',
    created_at: 100,
    last_active_at: 100,
    expires_at: 1000,
  },
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
})

afterEach(() => {
  useAuthStore.getState().auth.reset('idle')
})

describe('account language applied without a fresh sign-in', () => {
  test('switches the interface to the language saved in the account setting', async () => {
    applySavedLanguage({
      ...user,
      setting: JSON.stringify({ language: 'zhCN' }),
    })
    expect(i18n.language).toBe('zhCN')
  })

  test('accepts the BCP-47 spelling the API stores', async () => {
    applySavedLanguage({
      ...user,
      setting: JSON.stringify({ language: 'zh-CN' }),
    })
    expect(i18n.language).toBe('zhCN')
  })

  test('reads the top-level language field when the setting is absent', async () => {
    applySavedLanguage({ ...user, language: 'ja' })
    expect(i18n.language).toBe('ja')
  })

  test('leaves the detected language alone when the account has no preference', async () => {
    applySavedLanguage({
      ...user,
      setting: JSON.stringify({ notify_type: 'email' }),
    })
    expect(i18n.language).toBe('en')

    applySavedLanguage({ ...user, setting: '{' })
    expect(i18n.language).toBe('en')
  })

  test('does not touch i18next when the language already matches', async () => {
    await i18n.changeLanguage('zhCN')
    let changes = 0
    const listener = () => {
      changes += 1
    }
    i18n.on('languageChanged', listener)
    try {
      applySavedLanguage({
        ...user,
        setting: JSON.stringify({ language: 'zh-CN' }),
      })
      expect(changes).toBe(0)
    } finally {
      i18n.off('languageChanged', listener)
    }
  })

  test('a session restored through a bundle carries the account language with it', () => {
    applyAuthBundle({
      ...bundle,
      user: { ...user, setting: JSON.stringify({ language: 'zhTW' }) },
    })
    expect(i18n.language).toBe('zhTW')
  })
})
