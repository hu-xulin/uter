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
import { isCancelledError } from '@tanstack/react-query'
import { isCancel } from 'axios'
import i18next from 'i18next'

export const safeServerErrorMessage = Symbol('safeServerErrorMessage')

const serverErrorMessageKeys = {
  TELEGRAM_OAUTH_NOT_CONFIGURED:
    "Telegram login isn't set up. Ask your administrator to turn it on.",
  TELEGRAM_OAUTH_CONFLICT:
    'That provider name is reserved by Telegram. Ask your administrator to rename the conflicting custom provider.',
  TELEGRAM_OAUTH_FAILED: 'Telegram sign-in failed. Please try again.',
  TELEGRAM_ACCOUNT_NOT_BOUND:
    "This Telegram account isn't linked yet. Sign in another way and link it first.",
  TELEGRAM_LEGACY_AUTH_REMOVED:
    'Telegram login changed. Refresh the page and start Telegram sign-in again.',
  AUTH_INTERNAL_ERROR:
    'Something went wrong on our side. Please try again later.',
  EMAIL_DOMAIN_NOT_SUPPORTED:
    "That email domain isn't allowed. Use an email from a supported domain.",
  EMAIL_ALIAS_NOT_SUPPORTED:
    "Email aliases aren't supported. Use an address without +, -, _ or . before the @, then try again.",
  EMAIL_ADDRESS_REJECTED: 'Please enter a valid email address.',
  EMAIL_ALREADY_TAKEN: 'That email is already in use.',
  EMAIL_BINDING_DELIVERY_FAILED:
    "We couldn't send the verification email. Start email verification again.",
  SECURITY_VERIFICATION_FAILED: 'Verification failed. Please try again.',
  PASSKEY_RP_ID_UNAVAILABLE:
    "This Passkey domain isn't available here. Use its original site or another sign-in method.",
  PASSKEY_RP_ID_INVALID:
    "That Passkey domain isn't valid. Enter a domain with no scheme, port, path or wildcard.",
  SECURITY_VERIFICATION_FLOW_REQUIRED:
    'This step needs its own verification flow.',
  SECURITY_VERIFICATION_LOCKED:
    'Two-step verification is temporarily locked. Try again later.',
  OAUTH_ACCOUNT_MISMATCH:
    "This OAuth account doesn't match the one linked to your profile.",
  TWOFA_CODE_INVALID: 'That authenticator code is wrong.',
  TWOFA_ALREADY_ENABLED: 'Two-step verification is already on.',
  TWOFA_NOT_ENABLED: "Two-step verification isn't enabled yet.",
  PASSKEY_NOT_FOUND: "You don't have a Passkey yet.",
  AUTH_FLOW_INVALID: 'This verification step has expired.',
  SECURITY_PROOF_REQUIRED: 'Extra verification is needed.',
  SECURITY_PROOF_EXPIRED: 'Verification expired. Please verify again.',
  SECURITY_PROOF_INVALID:
    'Verification is no longer valid. Please verify again.',
  SECURITY_PROOF_SCOPE_MISMATCH: "Verification doesn't match this action.",
  SECURITY_PROOF_CONSUMED:
    'This verification was already used. Please verify again.',
  SECURITY_PROOF_CONTEXT_MISMATCH:
    "Verification doesn't match this action's details. Please verify again.",
  SECURITY_CONTEXT_INVALID: "Those action details aren't valid.",
  SECURITY_ACTION_FORBIDDEN: "You don't have permission to do this.",
  SECURITY_PROOF_METHOD_MISMATCH:
    "This verification method isn't allowed for this action.",
  SECURITY_METHOD_UNAVAILABLE:
    'This verification method is unavailable right now.',
  TWOFA_SETUP_INVALID:
    'The two-step setup expired or changed. Start setup again.',
  AUTH_SESSION_LIMIT:
    "You have too many active sessions. On a signed-in device, open Login sessions and sign out the others. If you can't, reset your password to sign out everywhere.",
  AUTH_SESSION_ISSUANCE_LIMIT:
    'Too many sessions were created recently. Wait a bit, then try again.',
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
  TELEGRAM_BIND_INTERNAL_ERROR: 'Telegram binding failed. Please try again.',
} as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

/** Walk only error origins, never request configs or arbitrary response data. */
export function getServerErrorSources(
  value: unknown
): Record<string | symbol, unknown>[] {
  const sources: Record<string | symbol, unknown>[] = []
  const pending = [value]
  const seen = new Set<object>()
  for (let index = 0; index < pending.length; index++) {
    const source = pending[index]
    if (!isRecord(source) || seen.has(source)) continue
    seen.add(source)
    sources.push(source)
    if (isRecord(source.response)) pending.push(source.response.data)
    pending.push(source.cause, source.error)
  }
  return sources
}

export function getServerErrorMessageKey(value: unknown): string | null {
  for (const source of getServerErrorSources(value)) {
    if (typeof source.code === 'string') {
      const key =
        serverErrorMessageKeys[
          source.code as keyof typeof serverErrorMessageKeys
        ]
      if (key) return key
    }
    if (source[safeServerErrorMessage]) break
  }
  return null
}

export function getServerErrorStatus(value: unknown): number | undefined {
  for (const source of getServerErrorSources(value)) {
    const status = isRecord(source.response)
      ? source.response.status
      : source.status
    if (typeof status === 'number') return status
  }
  return undefined
}

export function isServerErrorCancelled(value: unknown): boolean {
  return getServerErrorSources(value).some(
    (source) =>
      isCancel(source) ||
      isCancelledError(source) ||
      source.name === 'AbortError'
  )
}

function messageText(value: unknown): string | undefined {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.trim() === 'success'
  ) {
    return undefined
  }
  // A proxy's HTML error document is not an actionable API error message.
  if (/^\s*(?:<!doctype|<html[\s>])/i.test(value)) return undefined
  return value
}

/**
 * The backend sends web console messages as English source text in
 * `message_key` (a key of the locale files) plus `message_params`, and keeps
 * the rendered English text in `message` for other API callers.
 */
export function getServerMessage(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined
  if (typeof value.message_key === 'string' && value.message_key) {
    return i18next.t(
      value.message_key,
      isRecord(value.message_params) ? value.message_params : undefined
    )
  }
  return messageText(value.message)
}

/**
 * Translate text the backend stores or sends as an English source key without
 * params (task fail reasons, built-in group descriptions). The same fields also
 * carry upstream errors and administrator text; those have no locale entry and
 * are shown exactly as written, so interpolation and nesting stay off.
 */
export function translateServerText(
  t: (key: string, options?: Record<string, unknown>) => string,
  text: string
): string {
  return t(text, { skipInterpolation: true })
}

export function getServerErrorMessage(
  value: unknown,
  fallback?: string
): string {
  const sources = getServerErrorSources(value)
  // AuthOperationError deliberately hides internal server details. Never unwrap
  // its cause for presentation, even when a caller wraps it in another Error.
  const safe = sources.find((source) => source[safeServerErrorMessage])
  if (safe) {
    return i18next.t(
      getServerErrorMessageKey(safe) ||
        messageText(safe.message) ||
        fallback ||
        'Something went wrong!'
    )
  }
  const key = getServerErrorMessageKey(value)
  if (key) return i18next.t(key)
  for (const source of sources) {
    if (
      source instanceof Error ||
      source.isAxiosError ||
      isRecord(source.response)
    ) {
      continue
    }
    const detail = isRecord(source.error)
      ? messageText(source.error.message)
      : messageText(source.error)
    const message =
      getServerMessage(source) || detail || messageText(source.title)
    if (message) return message
  }
  const status = getServerErrorStatus(value)
  if (status === 304) return i18next.t('Content not modified!')
  if (status === 204) return i18next.t('Content not found.')
  for (const source of sources) {
    const message = messageText(source.message)
    if (message) return message
  }
  return messageText(value) || (fallback ?? i18next.t('Something went wrong!'))
}

/** Preserve the payload/cause so every layer can recognize the same failure. */
export function createServerError(value: unknown, fallback?: string): Error {
  return new Error(getServerErrorMessage(value, fallback ?? ''), {
    cause: value,
  })
}

/** Queries reject failed business responses without changing the raw API contract. */
export function requireServerSuccess<T>(response: T): T {
  if (isRecord(response) && response.success === false) {
    throw createServerError(response)
  }
  return response
}
