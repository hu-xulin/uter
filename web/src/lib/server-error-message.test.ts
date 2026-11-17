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
import i18next from 'i18next'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

import {
  getServerErrorMessage,
  getServerErrorMessageKey,
  translateServerText,
} from './server-error-message'

describe('server error message mapping', () => {
  test('maps the active-session limit to recovery instructions', () => {
    const message = getServerErrorMessageKey({ code: 'AUTH_SESSION_LIMIT' })

    expect(message ?? '').toMatch(/sign out the others/)
    expect(message ?? '').toMatch(/reset your password/)
  })

  test('maps an Axios-shaped issuance limit to rolling-window guidance', () => {
    const message = getServerErrorMessageKey({
      response: { data: { code: 'AUTH_SESSION_ISSUANCE_LIMIT' } },
    })

    expect(message ?? '').toMatch(/created recently/)
    expect(message ?? '').toMatch(/try again/)
    expect(getServerErrorMessageKey({ code: 'UNKNOWN_CODE' })).toBe(null)
  })

  test('maps stable Telegram bind errors without exposing server text', () => {
    const expected = {
      TELEGRAM_BIND_DISABLED: 'Telegram binding is turned off.',
      TELEGRAM_BIND_INVALID_REQUEST:
        'This Telegram sign-in request is invalid or expired.',
      TELEGRAM_BIND_FLOW_INVALID:
        'This Telegram binding request expired or was already used.',
      TELEGRAM_BIND_SESSION_INVALID:
        'The session that started this Telegram binding is no longer valid.',
      TELEGRAM_BIND_ALREADY_BOUND: 'This Telegram account is already linked.',
      TELEGRAM_BIND_USER_DELETED: 'This account no longer exists.',
      TELEGRAM_BIND_USER_DISABLED: 'This account is disabled.',
      TELEGRAM_BIND_INTERNAL_ERROR:
        'Telegram binding failed. Please try again.',
    }

    for (const [code, message] of Object.entries(expected)) {
      expect(getServerErrorMessageKey({ code })).toBe(message)
    }

    expect(
      getServerErrorMessageKey({
        response: {
          data: { code: 'TELEGRAM_BIND_INTERNAL_ERROR', message: 'raw detail' },
        },
      })
    ).toBe(expected.TELEGRAM_BIND_INTERNAL_ERROR)
  })

  test('translates message_key with message_params in the active language', async () => {
    i18next.addResourceBundle('zhCN', 'translation', {
      'Quota value exceeds valid range, maximum is {{max}}':
        '额度超出有效范围，最大为 {{max}}',
    })
    await i18next.changeLanguage('zhCN')
    try {
      const data = {
        success: false,
        message: 'Quota value exceeds valid range, maximum is 100',
        message_key: 'Quota value exceeds valid range, maximum is {{max}}',
        message_params: { max: 100 },
      }

      expect(getServerErrorMessage(data)).toBe('额度超出有效范围，最大为 100')
      expect(
        getServerErrorMessage({ isAxiosError: true, response: { data } })
      ).toBe('额度超出有效范围，最大为 100')
    } finally {
      await i18next.changeLanguage('en')
    }
  })

  test('renders the backend verification-code key in Chinese from the shipped catalog', async () => {
    // 该 message_key 曾未进入语言包，中文界面直接漏出英文（登录验证码错误）。
    const key = 'Verification code is incorrect or has expired'
    const locales = ['en', 'zh', 'zh-TW', 'fr', 'ja', 'ru', 'vi']
    const catalogs = Object.fromEntries(
      locales.map((locale) => [
        locale,
        JSON.parse(
          readFileSync(
            join(process.cwd(), 'src/i18n/locales', `${locale}.json`),
            'utf8'
          )
        ).translation as Record<string, string>,
      ])
    )
    for (const locale of locales) {
      expect(catalogs[locale][key], locale).toBeTruthy()
    }

    i18next.addResourceBundle('zhCN', 'translation', catalogs.zh, true, true)
    await i18next.changeLanguage('zhCN')
    try {
      expect(
        getServerErrorMessage({
          success: false,
          message: key,
          message_key: key,
        })
      ).toBe('验证码错误或已过期')
    } finally {
      await i18next.changeLanguage('en')
    }
  })

  test('renders an untranslated message_key as English text', () => {
    expect(
      getServerErrorMessage({
        success: false,
        message: 'Channel 7 does not exist',
        message_key: 'Channel {{id}} does not exist',
        message_params: { id: 7 },
      })
    ).toBe('Channel 7 does not exist')
  })

  test('translates a backend source key and leaves upstream text as written', async () => {
    i18next.addResourceBundle('zhCN', 'translation', {
      'Task timed out': '任务超时',
    })
    await i18next.changeLanguage('zhCN')
    try {
      expect(translateServerText(i18next.t, 'Task timed out')).toBe('任务超时')
      const upstream = 'upstream said {{bad}} and $t(Task timed out)'
      expect(translateServerText(i18next.t, upstream)).toBe(upstream)
    } finally {
      await i18next.changeLanguage('en')
    }
  })
})
