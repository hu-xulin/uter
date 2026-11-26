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
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  SecureVerificationDialog,
  useSecureVerification,
} from '@/features/auth/secure-verification'
import { handleServerError } from '@/lib/handle-server-error'
import { AuthOperationError } from '@/lib/secure-verification'
import { createServerError } from '@/lib/server-error-message'

import { revealUserSecret } from '../api'

type UserSecretDisclosure = {
  reveal: (secretKey: string) => Promise<void>
  hide: (secretKey: string) => void
  revealed: Record<string, string>
  pendingKey: string | null
}

const UserSecretDisclosureContext =
  React.createContext<UserSecretDisclosure | null>(null)

/** 个人通知凭据的验证揭示入口：掩码常驻，明文只在验证后临时出现。 */
export function UserSecretDisclosureProvider({
  children,
}: {
  children: React.ReactNode
}) {
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
    async (secretKey: string) => {
      if (!secretKey || operation.current) return
      const current = new AbortController()
      operation.current = current
      setPendingKey(secretKey)
      try {
        const proof = await requestVerification({
          scope: 'user.secret.read',
          context: { secret_key: secretKey },
          title: t('Verify to view saved secret'),
          description: t(
            'Use Passkey or 2FA to confirm your identity before revealing this saved value.'
          ),
        })
        if (!proof || operation.current !== current) return
        const response = await revealUserSecret(
          secretKey,
          proof.proof_token,
          current.signal
        )
        if (operation.current !== current) return
        if (!response.success) {
          throw createServerError(response, t('Failed to reveal secret'))
        }
        setRevealed((previous) => ({
          ...previous,
          [secretKey]: response.data?.value ?? '',
        }))
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

  const hide = useCallback((secretKey: string) => {
    setRevealed((previous) => {
      if (!(secretKey in previous)) return previous
      const next = { ...previous }
      delete next[secretKey]
      return next
    })
  }, [])

  const value = React.useMemo<UserSecretDisclosure>(
    () => ({ reveal, hide, revealed, pendingKey }),
    [reveal, hide, revealed, pendingKey]
  )

  return (
    <UserSecretDisclosureContext.Provider value={value}>
      {children}
      <SecureVerificationDialog {...verification.dialogProps} />
    </UserSecretDisclosureContext.Provider>
  )
}

const fallbackUserSecretDisclosure: UserSecretDisclosure = {
  reveal: async () => {},
  hide: () => {},
  revealed: {},
  pendingKey: null,
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUserSecretDisclosure() {
  // 没有 provider 时只保留掩码，不提供揭示入口；生产路由统一挂载 provider。
  return (
    React.useContext(UserSecretDisclosureContext) ??
    fallbackUserSecretDisclosure
  )
}
