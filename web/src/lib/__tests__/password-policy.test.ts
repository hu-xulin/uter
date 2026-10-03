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

For commercial licensing, please contact support@Uter.ai.com
*/
import { describe, expect, it } from 'vitest'

import {
  ACCOUNT_PASSWORD_MAX_LENGTH,
  ACCOUNT_PASSWORD_MIN_LENGTH,
  PasswordIssueContainsAccount,
  PasswordIssueTooCommon,
  PasswordIssueTooLong,
  PasswordIssueTooShort,
  PasswordIssueTooSimple,
  accountPasswordSchema,
  inspectAccountPassword,
} from '../password-policy'

// The browser check must agree with common/password_policy.go: a password the
// server rejects should never pass here, otherwise users get a confusing
// round trip only to fail again server-side.
describe('inspectAccountPassword', () => {
  const accepted = [
    'Aa1!Aa1!',
    'c0rrect-h0rse!42',
    'Tr0ub4dor&3xK',
    '密码ABC123ab',
    'x7#kLpQ2',
    'mY-v3ry-L0ng!pass',
  ]

  it.each(accepted)('accepts %s', (password) => {
    expect(inspectAccountPassword(password)).toBeNull()
  })

  it('rejects passwords shorter than the minimum', () => {
    expect(inspectAccountPassword('')).toBe(PasswordIssueTooShort)
    expect(inspectAccountPassword('Ab1!Ab1')).toBe(PasswordIssueTooShort)
    expect(inspectAccountPassword('秘密秘密')).toBe(PasswordIssueTooShort)
  })

  it('rejects passwords longer than the maximum', () => {
    expect(inspectAccountPassword('Aa1!'.repeat(33))).toBe(PasswordIssueTooLong)
  })

  it('requires character variety', () => {
    for (const password of ['12345678', 'abcdefgh', 'ABCDEFGH', '!!!!!!!!']) {
      expect(inspectAccountPassword(password)).toBe(PasswordIssueTooSimple)
    }
  })

  it('rejects blocklisted values and their leet variants', () => {
    for (const password of [
      'password1',
      'P@ssw0rd',
      'P@ssw0rd123',
      'pass-word!',
      'qwerty123',
      'qwerty2024',
      'Abcd1234',
      'iloveyou2024',
      'Administrator1',
      'Trustno1!',
      'Woaini1314!',
    ]) {
      expect(inspectAccountPassword(password)).toBe(PasswordIssueTooCommon)
    }
  })

  it('rejects sequential and repeating runs', () => {
    for (const password of ['Abcd5678!', 'Xyzyx9876!', 'Qqqqqqq1!']) {
      expect(inspectAccountPassword(password)).toBe(PasswordIssueTooCommon)
    }
  })

  it('rejects passwords containing the account identifier', () => {
    expect(inspectAccountPassword('Str0ng-Pass!', { username: 'strong' })).toBe(
      PasswordIssueContainsAccount
    )
    expect(
      inspectAccountPassword('Alice2024!x', { email: 'alice@example.com' })
    ).toBe(PasswordIssueContainsAccount)
  })

  it('ignores identifiers shorter than four characters', () => {
    expect(
      inspectAccountPassword('Strong-Pass!42', { username: 'abc' })
    ).toBeNull()
  })
})

describe('accountPasswordSchema', () => {
  it('enforces the shared bounds without any form context', () => {
    expect(accountPasswordSchema.safeParse('Aa1!Aa1!').success).toBe(true)
    expect(accountPasswordSchema.safeParse('short1!').success).toBe(false)
    expect(accountPasswordSchema.safeParse('12345678').success).toBe(false)
  })

  it('exposes bounds matching the backend', () => {
    expect(ACCOUNT_PASSWORD_MIN_LENGTH).toBe(8)
    expect(ACCOUNT_PASSWORD_MAX_LENGTH).toBe(128)
  })
})
