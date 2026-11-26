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
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useSecureVerification } from '@/features/auth/secure-verification'
import { handleServerError } from '@/lib/handle-server-error'
import { AuthOperationError } from '@/lib/secure-verification'
import { createServerError } from '@/lib/server-error-message'

import { revealChannelProviderCredential } from '../api'

export type ChannelCredentialDisclosure = ReturnType<
  typeof useChannelCredentialDisclosure
>

/**
 * Step-up disclosure for System Settings → Channels. The proof is bound to the
 * exact option key, so revealing a password cannot unlock an API key (or a
 * different provider group) with the same proof.
 */
export function useChannelCredentialDisclosure() {
  const { t } = useTranslation()
  const verification = useSecureVerification()
  const cancelVerification = verification.cancel
  const requestVerification = verification.requestVerification
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const operation = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      operation.current?.abort()
      operation.current = null
      cancelVerification()
    },
    [cancelVerification]
  )

  const reveal = useCallback(
    async (optionKey: string) => {
      if (operation.current) return
      const current = new AbortController()
      operation.current = current
      setPendingKey(optionKey)
      try {
        const proof = await requestVerification({
          scope: 'channel.credential.read',
          context: { option_key: optionKey },
          title: t('Verify to view upstream credential'),
          description: t(
            'Use Passkey or 2FA to confirm your identity before revealing this credential.'
          ),
        })
        if (!proof || operation.current !== current) return
        const response = await revealChannelProviderCredential(
          optionKey,
          proof.proof_token,
          current.signal
        )
        if (operation.current !== current) return
        if (!response.success) {
          throw createServerError(response, t('Failed to reveal credential'))
        }
        setRevealed((previous) => ({
          ...previous,
          [optionKey]: response.data?.value ?? '',
        }))
        toast.success(t('Credential unlocked'))
      } catch (error) {
        if (operation.current === current && !current.signal.aborted) {
          handleServerError(AuthOperationError.from(error))
        }
      } finally {
        if (operation.current === current) {
          operation.current = null
          setPendingKey(null)
        }
      }
    },
    [requestVerification, t]
  )

  const hide = useCallback((optionKey: string) => {
    setRevealed((previous) => {
      if (!(optionKey in previous)) return previous
      const next = { ...previous }
      delete next[optionKey]
      return next
    })
  }, [])

  return {
    verification,
    reveal,
    hide,
    revealed,
    pendingKey,
    isRevealing: pendingKey !== null,
  }
}
