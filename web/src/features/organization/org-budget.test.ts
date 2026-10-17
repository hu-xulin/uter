/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public
License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/

import { describe, expect, it } from 'vitest'

import { parseSubQuotaAmount } from './sub-quota'

const QUOTA_PER_UNIT = 500_000

/**
 * 组织预算表单（创建 + 超管编辑）把用户输入的金额换算成 quota。
 * quota=0 在后端语义里是「不限额」，因此任何无法解析的输入都绝不能落到 0，
 * 否则一次输错就凭空放开了整个组织的额度上限。
 */
describe('organization budget conversion', () => {
  it('maps an empty budget to unlimited', () => {
    expect(parseSubQuotaAmount('', QUOTA_PER_UNIT)).toEqual({
      kind: 'unlimited',
      quota: 0,
    })
    expect(parseSubQuotaAmount('   ', QUOTA_PER_UNIT)).toEqual({
      kind: 'unlimited',
      quota: 0,
    })
  })

  it('maps an explicit zero to unlimited', () => {
    expect(parseSubQuotaAmount('0', QUOTA_PER_UNIT)).toEqual({
      kind: 'unlimited',
      quota: 0,
    })
  })

  it('converts a positive amount to quota rounded up', () => {
    expect(parseSubQuotaAmount('12.5', QUOTA_PER_UNIT)).toEqual({
      kind: 'quota',
      quota: 6_250_000,
    })
    expect(parseSubQuotaAmount('0.000003', QUOTA_PER_UNIT)).toEqual({
      kind: 'quota',
      quota: 2,
    })
  })

  it.each([
    ['-1', 'negative budget'],
    ['-0.5', 'negative fraction'],
    ['abc', 'non-numeric text'],
    ['NaN', 'literal NaN'],
    ['Infinity', 'literal Infinity'],
    ['1e+100', 'value overflowing the safe integer range'],
  ])(
    'rejects %s (%s) instead of silently creating an unlimited budget',
    (raw) => {
      expect(parseSubQuotaAmount(raw, QUOTA_PER_UNIT)).toEqual({
        kind: 'invalid',
      })
    }
  )

  it('rejects a half-typed number input even though its value string is empty', () => {
    // <input type="number"> 在输入 "-" / "1e" 时 value 为空但 badInput 为真。
    // 只看 value 会把它当成「未填写 → 不限额」。
    expect(parseSubQuotaAmount('', QUOTA_PER_UNIT, true)).toEqual({
      kind: 'invalid',
    })
  })

  it('rejects a broken conversion factor rather than dividing by zero', () => {
    expect(parseSubQuotaAmount('10', 0)).toEqual({ kind: 'invalid' })
    expect(parseSubQuotaAmount('10', Number.NaN)).toEqual({ kind: 'invalid' })
  })
})
