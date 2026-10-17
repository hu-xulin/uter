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

import { PAYMENT_TYPES } from '../constants'
import { isPayableAmount, requestPaymentAmount } from './use-payment'

const calculators = {
  regular: async () => ({ success: true, data: '1' }),
  stripe: async () => ({ success: true, data: '2' }),
  waffo: async () => ({ success: true, data: '3' }),
  waffoPancake: async () => ({ success: true, data: '4' }),
}

describe('payment amount routing', () => {
  test('uses the dedicated Waffo amount calculator', async () => {
    const calls: string[] = []
    const amount = await requestPaymentAmount(120, PAYMENT_TYPES.WAFFO, {
      regular: async () => {
        calls.push('regular')
        return { success: true, data: '1' }
      },
      stripe: async () => {
        calls.push('stripe')
        return { success: true, data: '2' }
      },
      waffo: async (request) => {
        calls.push(`waffo:${request.amount}`)
        return { success: true, data: '18.75' }
      },
      waffoPancake: async () => {
        calls.push('pancake')
        return { success: true, data: '4' }
      },
    })

    expect(amount).toBe(18.75)
    expect(calls).toEqual(['waffo:120'])
  })
})

/**
 * 计价失败曾被折成 0 返回，而钱包页不看返回值直接打开付款确认框，
 * 用户会看到「应付 0 元」并走进收款流程。这里钉住失败必须显式为 null。
 */
describe('payment amount failure handling', () => {
  test('returns null when the pricing request fails', async () => {
    const amount = await requestPaymentAmount(120, PAYMENT_TYPES.STRIPE, {
      ...calculators,
      stripe: async () => ({ success: false, message: 'upstream down' }),
    })
    expect(amount).toBeNull()
  })

  test('returns null when the pricing response has no data', async () => {
    const amount = await requestPaymentAmount(120, PAYMENT_TYPES.STRIPE, {
      ...calculators,
      stripe: async () => ({ success: true }),
    })
    expect(amount).toBeNull()
  })

  test.each([
    ['abc', 'non-numeric'],
    ['', 'empty string'],
    ['0', 'zero'],
    ['-5', 'negative'],
  ])('returns null for %s (%s) instead of a payable amount', async (data) => {
    const amount = await requestPaymentAmount(120, PAYMENT_TYPES.STRIPE, {
      ...calculators,
      stripe: async () => ({ success: true, data }),
    })
    expect(amount).toBeNull()
  })

  test('propagates a thrown pricing error', async () => {
    await expect(
      requestPaymentAmount(120, PAYMENT_TYPES.STRIPE, {
        ...calculators,
        stripe: async () => {
          throw new Error('network down')
        },
      })
    ).rejects.toThrow('network down')
  })
})

describe('isPayableAmount', () => {
  test('accepts only finite positive amounts', () => {
    expect(isPayableAmount(0.01)).toBe(true)
    expect(isPayableAmount(120)).toBe(true)
  })

  test.each([
    0,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    null,
    undefined,
    '10',
  ])('rejects %s', (value) => {
    expect(isPayableAmount(value)).toBe(false)
  })
})
