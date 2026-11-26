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

import { isMaskedSecret, maskMultilineSecret, maskSecret } from './secret'

/**
 * 掩码规则必须与后端 common.MaskSecretValue 完全一致，
 * 否则会出现「保存后前端二次掩码，显示成掩码的掩码」。
 */
describe('maskSecret', () => {
  it('keeps empty values empty', () => {
    expect(maskSecret('')).toBe('')
  })

  it('fully masks values of length <= 4', () => {
    expect(maskSecret('a')).toBe('*')
    expect(maskSecret('abcd')).toBe('****')
  })

  it('keeps head only for length between 5 and 8', () => {
    expect(maskSecret('abcde')).toBe('abcd*')
    expect(maskSecret('abcdefgh')).toBe('abcd****')
  })

  it('keeps head and tail for longer values', () => {
    expect(maskSecret('abcdefghijkl')).toBe('abcd****ijkl')
  })

  it('caps the middle stars at 12', () => {
    const long = 'sk-0123456789abcdefghijklmnopqrstuvwxyz'
    expect(maskSecret(long)).toBe(`sk-0${'*'.repeat(12)}wxyz`)
  })

  it('never returns the plaintext for non-empty input', () => {
    for (const value of [
      'a',
      'abcd',
      'abcde',
      'abcdefgh',
      'sk-real-secret-key-value-123456',
    ]) {
      expect(maskSecret(value)).not.toBe(value)
    }
  })
})
describe('isMaskedSecret', () => {
  it('detects masked values produced by maskSecret', () => {
    for (const value of [
      '****',
      'abcd*',
      'abcd****ijkl',
      `sk-0${'*'.repeat(12)}wxyz`,
    ]) {
      expect(isMaskedSecret(value)).toBe(true)
    }
  })

  it('treats real credentials as unmasked', () => {
    for (const value of [
      '',
      '0123456789abcdef0123456789abcdef',
      '-----BEGIN PRIVATE KEY-----MIIEvgIBADANBg-----END PRIVATE KEY-----',
      'whsec_abcdef1234567890',
    ]) {
      expect(isMaskedSecret(value)).toBe(false)
    }
  })

  it('round-trips maskSecret output', () => {
    expect(isMaskedSecret(maskSecret('sk-real-secret-key-value-123456'))).toBe(
      true
    )
  })
})

describe('maskMultilineSecret', () => {
  it('masks each line and keeps the line structure (one key per line)', () => {
    const input =
      'sk-key-one-aaaabbbb\nsk-key-two-ccccdddd\nsk-key-three-eeeeffff'
    const masked = maskMultilineSecret(input)
    expect(masked.split('\n')).toHaveLength(3)
    expect(masked.split('\n')[0]).toBe(maskSecret('sk-key-one-aaaabbbb'))
    expect(masked.split('\n')[1]).toBe(maskSecret('sk-key-two-ccccdddd'))
    expect(masked.split('\n')[2]).toBe(maskSecret('sk-key-three-eeeeffff'))
  })

  it('normalizes CRLF like the backend MaskMultilineSecret', () => {
    expect(maskMultilineSecret('abcdefghij\r\nklmnopqrst')).toBe(
      `${maskSecret('abcdefghij')}\n${maskSecret('klmnopqrst')}`
    )
  })

  it('delegates single-line values to maskSecret', () => {
    expect(maskMultilineSecret('sk-single-key-1234')).toBe(
      maskSecret('sk-single-key-1234')
    )
  })

  it('keeps blank lines intact so saved key positions are visible', () => {
    expect(maskMultilineSecret('abcdefghij\n\nklmnopqrst')).toBe(
      `${maskSecret('abcdefghij')}\n\n${maskSecret('klmnopqrst')}`
    )
  })

  it('never leaks plaintext of any line', () => {
    for (const line of maskMultilineSecret(
      'sk-key-one-aaaabbbb\nsk-key-two-ccccdddd'
    ).split('\n')) {
      expect(isMaskedSecret(line)).toBe(true)
    }
  })
})
