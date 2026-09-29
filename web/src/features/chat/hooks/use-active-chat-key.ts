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
import { useQuery } from '@tanstack/react-query'
import { t } from 'i18next'

import { createApiKey, fetchTokenKey, getApiKeys } from '@/features/keys/api'
import { API_KEY_STATUS } from '@/features/keys/constants'
import {
  getApiKeyFormDefaultValues,
  transformFormDataToPayload,
} from '@/features/keys/lib'
import {
  requireServerSuccess,
  createServerError,
} from '@/lib/server-error-message'
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

export async function fetchActiveChatKey() {
  const result = await getApiKeys({ p: 1, size: 50 })
  if (!result.success) {
    throw createServerError(result, t('Failed to load API keys'))
  }

  const items = result.data?.items ?? []
  const active = items.find((item) => item.status === API_KEY_STATUS.ENABLED)
  if (!active) {
    throw new NoActiveChatKeyError()
  }

  const keyResult = await fetchTokenKey(active.id)
  if (!keyResult.success || !keyResult.data?.key) {
    throw createServerError(keyResult, t('Failed to load API keys'))
  }

  return `sk-${keyResult.data.key}`
}

/**
 * Create the key used by chat shortcuts when the account has none yet.
 *
 * Reuses the API Keys page defaults so both entry points stay in sync, and
 * returns the freshly resolved key so the caller can keep going.
 */
export async function createDefaultChatKey() {
  const created = await createApiKey({
    ...transformFormDataToPayload(getApiKeyFormDefaultValues(false)),
    name: t('Default key'),
  })
  if (!created.success) {
    throw createServerError(created, t('Failed to create API key'))
  }

  return fetchActiveChatKey()
}

/**
 * Get the currently active API key for chat links
 */
export function useActiveChatKey(enabled: boolean) {
  const userId = useAuthStore((state) => state.auth.user?.id)

  return useQuery({
    queryKey: ['chat-active-key', userId],
    queryFn: async () => requireServerSuccess(await fetchActiveChatKey()),
    enabled: enabled && Boolean(userId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    // Every consumer renders its own inline state; avoid a duplicate toast.
    meta: { errorToast: false },
  })
}
