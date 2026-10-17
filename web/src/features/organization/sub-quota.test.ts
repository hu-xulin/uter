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

import { parseSubQuotaAmount } from './sub-quota'

describe('parseSubQuotaAmount', () => {
  it('treats an empty amount as unlimited', () => {
    expect(parseSubQuotaAmount('', 500_000)).toEqual({
      kind: 'unlimited',
      quota: 0,
    })
  })

  it('treats an explicit zero as unlimited', () => {
    expect(parseSubQuotaAmount('0', 500_000)).toEqual({
      kind: 'unlimited',
      quota: 0,
    })
  })

  it('rounds positive currency amounts up to an integer quota', () => {
    expect(parseSubQuotaAmount('0.000001', 500_000)).toEqual({
      kind: 'quota',
      quota: 1,
    })
    expect(parseSubQuotaAmount('1.01', 500_000)).toEqual({
      kind: 'quota',
      quota: 505_000,
    })
  })

  it.each(['abc', '-1', 'NaN', 'Infinity'])(
    'rejects invalid or negative input %s instead of clearing the limit',
    (value) => {
      expect(parseSubQuotaAmount(value, 500_000)).toEqual({ kind: 'invalid' })
    }
  )

  it('rejects browser number-input badInput even when value is empty', () => {
    expect(parseSubQuotaAmount('', 500_000, true)).toEqual({
      kind: 'invalid',
    })
  })

  it('rejects an invalid conversion factor', () => {
    expect(parseSubQuotaAmount('1', 0)).toEqual({ kind: 'invalid' })
  })

  it('rejects values that overflow the safe integer quota range', () => {
    expect(parseSubQuotaAmount('1e+100', 500_000)).toEqual({
      kind: 'invalid',
    })
  })
})
