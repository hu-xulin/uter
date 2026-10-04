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
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Account password policy
//
// These rules mirror the server-side implementation in
// common/password_policy.go. The browser check exists only to give immediate
// feedback and save a round trip; it is trivially bypassable, so the server
// always re-validates and remains the authority.
// ---------------------------------------------------------------------------

/** Mirrors common.PasswordMinLength. */
export const ACCOUNT_PASSWORD_MIN_LENGTH = 8
/** Mirrors common.PasswordMaxLength. */
export const ACCOUNT_PASSWORD_MAX_LENGTH = 18

// These English strings double as i18next keys: FormMessage renders validation
// messages with t(), so each one must exist in every locale file and must stay
// consistent with the backend user.password_* messages.
export const PasswordIssueTooShort =
  'Password must be at least 8 characters long.'
export const PasswordIssueTooLong =
  'Password cannot be longer than 18 characters.'
export const PasswordIssueTooSimple =
  'Password must include at least two of the following: letters, numbers, and special characters.'
export const PasswordIssueTooCommon =
  'This password is too common or follows an obvious pattern. Please choose a different one.'
export const PasswordIssueContainsAccount =
  'Password must not contain your username or email address.'

export type AccountPasswordContext = {
  username?: string
  email?: string
}

/**
 * Punctuation mapped onto the letters it commonly replaces, so "P@ssw0rd"
 * collapses onto "passw0rd". Separators (-, _, .) are intentionally absent:
 * they are dropped rather than rewritten, otherwise real word patterns would
 * hide behind decoration.
 */
const symbolSubstitutions: Record<string, string> = {
  '@': 'a',
  $: 's',
  '!': 'i',
  '+': 't',
  '(': 'c',
}

/**
 * Digits mapped onto the letters they replace. Applied only when comparing a
 * password against an account identifier, so "strong" is still caught inside
 * "Str0ng!Pass".
 */
const digitSubstitutions: Record<string, string> = {
  '0': 'o',
  '1': 'l',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '6': 'g',
  '7': 't',
  '8': 'b',
  '9': 'g',
}

/** Values that dominate real-world breach corpora; matched exactly. */
const weakPasswords = new Set([
  '111111',
  '000000',
  '11111111',
  '88888888',
  '123123',
  '123321',
  '654321',
  '123456',
  '234567',
  '345678',
  '1234567',
  '12345678',
  '123456789',
  '1234567890',
  '0123456789',
  'password',
  'passwd',
  'password1',
  'password123',
  'passw0rd',
  'abc123',
  'abcd1234',
  'abc12345',
  'aa123456',
  'qwerty',
  'qwertyuiop',
  'qwerty123',
  'asdfgh',
  'asdfghjkl',
  'zxcvbnm',
  'iloveyou',
  'letmein',
  'admin123',
  'administrator',
  'welcome',
  'changeme',
  'secret',
  'sunshine',
  'princess',
  'football',
  'baseball',
  'dragon',
  'monkey',
  'master',
  'shadow',
  'superman',
  'trustno1',
  'whatever',
  'internet',
  'woaini1314',
  'wang1234',
  '5201314',
])

/**
 * Fragments of at least six characters that are safe to substring match, so
 * derived variants such as "qwerty2024" or "iloveyouforever" are also caught.
 */
const weakFragments = new Set([
  '123456',
  'abcdef',
  'password',
  'letmein',
  'iloveyou',
  'qwerty',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
  'woaini',
  'changeme',
  'administrator',
])

/** Matches the backend's Unicode code point count (not UTF-16 length). */
function passwordLength(password: string): number {
  return [...password].length
}

function hasCharacterVariety(password: string): boolean {
  let hasLetter = false
  let hasDigit = false
  let hasOther = false
  for (const char of password) {
    if (/\p{L}/u.test(char)) {
      hasLetter = true
    } else if (/\p{N}/u.test(char)) {
      hasDigit = true
    } else {
      hasOther = true
    }
  }
  return [hasLetter, hasDigit, hasOther].filter(Boolean).length >= 2
}

/**
 * Lowercases the password and keeps only letters and digits, applying the given
 * substitution map first. Symbols and separators are dropped so "pass-word" and
 * "pass word" cannot evade comparisons.
 */
function normalizePassword(
  password: string,
  substitutions?: Record<string, string>
): string {
  let result = ''
  for (const char of password.toLowerCase()) {
    const mapped = substitutions?.[char]
    if (mapped) {
      result += mapped
      continue
    }
    if (/[\p{L}\p{N}]/u.test(char)) {
      result += char
    }
  }
  return result
}

function removeRepeats(value: string): string {
  const chars = [...value]
  let result = ''
  chars.forEach((char, index) => {
    if (index > 0 && chars[index - 1] === char) return
    result += char
  })
  return result
}

function hasSequentialRun(value: string, minLength: number): boolean {
  const chars = [...value]
  if (chars.length < minLength) return false
  let ascending = 1
  let descending = 1
  for (let index = 1; index < chars.length; index += 1) {
    const step =
      (chars[index].codePointAt(0) ?? 0) -
      (chars[index - 1].codePointAt(0) ?? 0)
    if (step === 1) {
      ascending += 1
      descending = 1
    } else if (step === -1) {
      descending += 1
      ascending = 1
    } else {
      ascending = 1
      descending = 1
    }
    if (ascending >= minLength || descending >= minLength) return true
  }
  return false
}

function matchesWeakPattern(skeleton: string): boolean {
  if (weakPasswords.has(skeleton)) return true
  for (const fragment of weakFragments) {
    if (skeleton.includes(fragment)) return true
  }
  if (hasSequentialRun(skeleton, 4)) return true
  // Nothing but one repeating character, or a two-character cycle.
  return [...removeRepeats(skeleton)].length <= 2
}

/**
 * Applies both maps at once, so a password can also be compared after a full
 * "de-leet". This is the only form that catches mixed evasions such as
 * "P@ssw0rd123" -> "passwordl2e", which neither single normalisation sees.
 */
const combinedSubstitutions: Record<string, string> = {
  ...digitSubstitutions,
  ...symbolSubstitutions,
}

function isWeakPattern(password: string): boolean {
  // Several normalisations because none alone catches every evasion style:
  // rewriting symbols into letters finds intentional leet ("P@ssw0rd"), and
  // dropping them finds punctuation used as decoration ("Trustno1!"), while
  // rewriting symbols *and* digits finds mixtures such as "P@ssw0rd123".
  for (const substitutions of [
    symbolSubstitutions,
    undefined,
    combinedSubstitutions,
  ]) {
    const skeleton = normalizePassword(password, substitutions)
    if (!skeleton || matchesWeakPattern(skeleton)) return true
  }
  return false
}

function containsIdentifier(password: string, identifier?: string): boolean {
  const normalized = (identifier ?? '').trim().toLowerCase()
  // Identifiers shorter than four characters cause false positives.
  if (normalized.length < 4) return false
  if (password.toLowerCase().includes(normalized)) return true
  return normalizePassword(password, digitSubstitutions).includes(normalized)
}

function emailLocalPart(email?: string): string {
  if (!email) return ''
  const [local] = email.split('@')
  return local ?? ''
}

/**
 * Returns the first violated rule as an i18n message key, or null when the
 * password satisfies the policy. Pass username/email so passwords built from
 * the account identifier itself can be rejected.
 */
export function inspectAccountPassword(
  password: string,
  context: AccountPasswordContext = {}
): string | null {
  const length = passwordLength(password)
  if (length < ACCOUNT_PASSWORD_MIN_LENGTH) return PasswordIssueTooShort
  if (length > ACCOUNT_PASSWORD_MAX_LENGTH) return PasswordIssueTooLong
  if (
    containsIdentifier(password, context.username) ||
    containsIdentifier(password, emailLocalPart(context.email))
  ) {
    return PasswordIssueContainsAccount
  }
  if (!hasCharacterVariety(password)) return PasswordIssueTooSimple
  if (isWeakPattern(password)) return PasswordIssueTooCommon
  return null
}

/**
 * Shared schema for every form that sets an account password (registration,
 * password change, admin-created users, setup wizard). Context-aware checks run
 * in the form, which knows the username and email.
 */
export const accountPasswordSchema = z.string().superRefine((password, ctx) => {
  const issue = inspectAccountPassword(password)
  if (issue) {
    ctx.addIssue({ code: 'custom', message: issue })
  }
})
