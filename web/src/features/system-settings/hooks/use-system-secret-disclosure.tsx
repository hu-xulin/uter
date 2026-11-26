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

import { revealSystemSecret } from '../api'

type SystemSecretDisclosure = {
  reveal: (optionKey: string) => Promise<void>
  hide: (optionKey: string) => void
  revealed: Record<string, string>
  pendingKey: string | null
  isRevealing: boolean
}

const SystemSecretDisclosureContext =
  React.createContext<SystemSecretDisclosure | null>(null)

/**
 * 系统设置里所有掩码字段共用的一次性揭示入口。
 *
 * 浏览器平时只持有后端下发的掩码串；只有用户主动点击眼睛并完成二次验证后，
 * 才会按需取回单个字段的明文。证明绑定到具体 option key，不能用一个字段的
 * 验证结果打开另一个字段。验证对话框在 provider 内只渲染一次。
 */
export function SystemSecretDisclosureProvider({
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
    async (optionKey: string) => {
      if (!optionKey || operation.current) return
      const current = new AbortController()
      operation.current = current
      setPendingKey(optionKey)
      try {
        const proof = await requestVerification({
          scope: 'system.secret.read',
          context: { option_key: optionKey },
          title: t('Verify to view saved secret'),
          description: t(
            'Use Passkey or 2FA to confirm your identity before revealing this saved value.'
          ),
        })
        if (!proof || operation.current !== current) return
        const response = await revealSystemSecret(
          optionKey,
          proof.proof_token,
          current.signal
        )
        if (operation.current !== current) return
        if (!response.success) {
          throw createServerError(response, t('Failed to reveal secret'))
        }
        setRevealed((previous) => ({
          ...previous,
          [optionKey]: response.data?.value ?? '',
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

  const hide = useCallback((optionKey: string) => {
    setRevealed((previous) => {
      if (!(optionKey in previous)) return previous
      const next = { ...previous }
      delete next[optionKey]
      return next
    })
  }, [])

  const value = React.useMemo<SystemSecretDisclosure>(
    () => ({
      reveal,
      hide,
      revealed,
      pendingKey,
      isRevealing: pendingKey !== null,
    }),
    [reveal, hide, revealed, pendingKey]
  )

  return (
    <SystemSecretDisclosureContext.Provider value={value}>
      {children}
      <SecureVerificationDialog {...verification.dialogProps} />
    </SystemSecretDisclosureContext.Provider>
  )
}

const fallbackSystemSecretDisclosure: SystemSecretDisclosure = {
  reveal: async () => {},
  hide: () => {},
  revealed: {},
  pendingKey: null,
  isRevealing: false,
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSystemSecretDisclosure() {
  // 组件单测或局部预览可能没有挂载 provider：此时保持只读掩码，绝不退回
  // 明文。生产路由由 SystemSettings 统一提供验证能力。
  return (
    React.useContext(SystemSecretDisclosureContext) ??
    fallbackSystemSecretDisclosure
  )
}
