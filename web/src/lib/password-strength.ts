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
import {
  ACCOUNT_PASSWORD_MAX_LENGTH,
  ACCOUNT_PASSWORD_MIN_LENGTH,
} from '@/lib/password-policy'

export type PasswordStrengthRuleId = 'length' | 'variety' | 'long'
export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4

export type PasswordStrengthRule = {
  id: PasswordStrengthRuleId
  label: string
  met: boolean
}

export type PasswordStrengthResult = {
  score: PasswordStrengthScore
  rules: PasswordStrengthRule[]
}

/** Length at which a password is considered long enough to earn full marks. */
export const PASSWORD_STRONG_LENGTH = 15

const LETTER = /\p{L}/u
const DIGIT = /\p{N}/u
const SYMBOL = /[\p{P}\p{S}]/u

/**
 * Scores a password against the same rules the account policy enforces.
 * The score is presentational only: `accountPasswordSchema` remains the sole
 * gate for acceptance, and these hints never block a submission.
 */
export function evaluatePasswordStrength(
  value: string
): PasswordStrengthResult {
  const length =
    value.length >= ACCOUNT_PASSWORD_MIN_LENGTH &&
    value.length <= ACCOUNT_PASSWORD_MAX_LENGTH
  const variety =
    [LETTER, DIGIT, SYMBOL].filter((pattern) => pattern.test(value)).length >= 2
  const long = value.length >= PASSWORD_STRONG_LENGTH
  const rules: PasswordStrengthRule[] = [
    {
      id: 'length',
      label: `Use ${ACCOUNT_PASSWORD_MIN_LENGTH}–${ACCOUNT_PASSWORD_MAX_LENGTH} characters.`,
      met: length,
    },
    {
      id: 'variety',
      label:
        'Password must include at least two of the following: letters, numbers, and special characters.',
      met: variety,
    },
    {
      id: 'long',
      label: `${PASSWORD_STRONG_LENGTH} or more characters`,
      met: long,
    },
  ]
  const metCount = rules.filter((rule) => rule.met).length
  const score = (
    value.length === 0 ? 0 : Math.min(4, metCount + 1)
  ) as PasswordStrengthScore
  return { score, rules }
}
