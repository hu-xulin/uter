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

import { callbackAddressWarning } from '../payment-callback-address'

describe('callbackAddressWarning', () => {
  it('accepts a public https origin', () => {
    expect(callbackAddressWarning('https://uter.cc')).toBeNull()
    expect(callbackAddressWarning('https://pay.uter.ai')).toBeNull()
  })

  it('rejects http, localhost, private addresses and paths', () => {
    expect(callbackAddressWarning('http://uter.cc')).toBe('http')
    expect(callbackAddressWarning('https://localhost:3000')).toBe('private')
    expect(callbackAddressWarning('https://127.0.0.1')).toBe('private')
    expect(callbackAddressWarning('https://192.168.1.7')).toBe('private')
    expect(callbackAddressWarning('https://uter.cc/api/user/alipay/notify')).toBe(
      'path'
    )
    expect(callbackAddressWarning('not-a-url')).toBe('invalid')
  })
})
