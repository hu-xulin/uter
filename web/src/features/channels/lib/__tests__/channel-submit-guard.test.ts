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
import { describe, expect, test } from 'vitest'

import {
  isSavingNewConsoleCredentials,
  shouldBlockSubmitForPricing,
} from '../channel-submit-guard'

describe('isSavingNewConsoleCredentials', () => {
  test('三字段齐全才算新增凭据', () => {
    expect(
      isSavingNewConsoleCredentials({
        console_login_url: 'https://dreamrouter.ai',
        console_username: 'user',
        console_password: 'secret',
      })
    ).toBe(true)
  })

  test('缺任一字段都不算（与 form 写入条件一致）', () => {
    expect(
      isSavingNewConsoleCredentials({
        console_login_url: 'https://dreamrouter.ai',
        console_username: 'user',
        console_password: '',
      })
    ).toBe(false)
    expect(
      isSavingNewConsoleCredentials({
        console_login_url: '  ',
        console_username: 'user',
        console_password: 'secret',
      })
    ).toBe(false)
    expect(isSavingNewConsoleCredentials({})).toBe(false)
  })
})

describe('shouldBlockSubmitForPricing', () => {
  test('有待审价格且无新凭据时拦截（保持原有门禁）', () => {
    expect(
      shouldBlockSubmitForPricing({
        hasPricingData: true,
        blockingCount: 17,
        formData: {},
      })
    ).toBe(true)
  })

  test('携带新凭据时放行，打破凭据/价格死锁', () => {
    expect(
      shouldBlockSubmitForPricing({
        hasPricingData: true,
        blockingCount: 17,
        formData: {
          console_login_url: 'https://dreamrouter.ai',
          console_username: 'user',
          console_password: 'secret',
        },
      })
    ).toBe(false)
  })

  test('无待审价格时不拦截', () => {
    expect(
      shouldBlockSubmitForPricing({
        hasPricingData: true,
        blockingCount: 0,
        formData: {},
      })
    ).toBe(false)
    expect(
      shouldBlockSubmitForPricing({
        hasPricingData: false,
        blockingCount: 17,
        formData: {},
      })
    ).toBe(false)
  })
})
