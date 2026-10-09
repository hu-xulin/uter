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
import { useCallback, useState } from 'react'
import { t } from 'i18next'

import { createApiKey, fetchTokenKey, getApiKeys } from '@/features/keys/api'
import { API_KEY_STATUS } from '@/features/keys/constants'
import {
  getApiKeyFormDefaultValues,
  transformFormDataToPayload,
} from '@/features/keys/lib'
import {
  createServerError,
} from '@/lib/server-error-message'
import { useSecureVerification } from '@/features/auth/secure-verification'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Raised when the account holds no enabled API key to fill into a chat client.
 * Callers branch on this type to offer creating one instead of dead-ending.
 */
export class NoActiveChatKeyError extends Error {
  constructor() {
    super(t('No enabled tokens available'))
    this.name = 'NoActiveChatKeyError'
  }
}

/**
 * Resolve the plaintext key of the account's enabled API key. Requires a
 * one-time security proof (Passkey / 2FA / password) because this exposes the
 * raw `sk-` secret — callers should obtain it via `useActiveChatKey().reveal()`
 * which performs the verification, or pass an existing `proofToken`.
 */
export async function fetchActiveChatKey(proofToken?: string) {
  const result = await getApiKeys({ p: 1, size: 50 })
  if (!result.success) {
    throw createServerError(result, t('Failed to load API keys'))
  }

  const items = result.data?.items ?? []
  const active = items.find((item) => item.status === API_KEY_STATUS.ENABLED)
  if (!active) {
    throw new NoActiveChatKeyError()
  }

  const keyResult = await fetchTokenKey(active.id, proofToken)
  if (!keyResult.success || !keyResult.data?.key) {
    throw createServerError(keyResult, t('Failed to load API keys'))
  }

  return `sk-${keyResult.data.key}`
}

/**
 * Create the key used by chat shortcuts when the account has none yet.
 *
 * Reuses the API Keys page defaults so both entry points stay in sync, and
 * returns the freshly resolved key so the caller can keep going. The resolved
 * key requires a security proof (see `fetchActiveChatKey`).
 */
export async function createDefaultChatKey(proofToken?: string) {
  const created = await createApiKey({
    ...transformFormDataToPayload(getApiKeyFormDefaultValues(false)),
    name: t('Default key'),
  })
  if (!created.success) {
    throw createServerError(created, t('Failed to create API key'))
  }

  return fetchActiveChatKey(proofToken)
}

export interface ActiveChatKeyState {
  activeKey: string | null
  isPending: boolean
  isError: boolean
  error: unknown
  /**
   * Trigger a step-up verification and, on success, resolve + return the
   * active chat key. Returns null if the user cancels the verification.
   */
  reveal: () => Promise<string | null>
}

/**
 * Get the currently active API key for chat links.
 *
 * The key is a plaintext `sk-` secret, so it is only resolved on demand after
 * the user passes step-up verification — it is never auto-fetched on mount.
 */
export function useActiveChatKey(): ActiveChatKeyState {
  const userId = useAuthStore((state) => state.auth.user?.id)
  const verification = useSecureVerification()
  const [state, setState] = useState<{
    key: string | null
    status: 'idle' | 'pending' | 'error'
    error?: unknown
  }>({ key: null, status: 'idle' })

  const reveal = useCallback(async (): Promise<string | null> => {
    if (!userId) return null
    setState({ key: null, status: 'pending' })
    try {
      const proof = await verification.requestVerification({
        scope: 'token.key.read',
      })
      if (!proof) {
        setState({ key: null, status: 'idle' })
        return null
      }
      const key = await fetchActiveChatKey(proof.proof_token)
      setState({ key, status: 'idle' })
      return key
    } catch (error) {
      setState({ key: null, status: 'error', error })
      throw error
    }
  }, [userId, verification])

  return {
    activeKey: state.key,
    isPending: state.status === 'pending',
    isError: state.status === 'error',
    error: state.error,
    reveal,
  }
}
