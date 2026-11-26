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

import { revealDeploymentRegistrySecret } from '../api'

type DeploymentSecretDisclosure = {
  /** 按部署 ID 揭示其镜像仓库凭据明文。 */
  reveal: (deploymentId: string | number) => Promise<void>
  hide: (deploymentId: string | number) => void
  revealed: Record<string, string>
  pendingId: string | null
  isRevealing: boolean
}

const DeploymentSecretDisclosureContext =
  React.createContext<DeploymentSecretDisclosure | null>(null)

/**
 * 部署页掩码字段的一次性揭示入口。与系统设置分开：部署接口是 AdminAuth，
 * 揭示端点按部署 ID 校验，而不是按全局 option key。证明绑定 system.secret.read
 * scope 与 deployment.<id>.registry_secret，后端中间件据此核对。
 */
export function DeploymentSecretDisclosureProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const verification = useSecureVerification()
  const cancelVerification = verification.cancel
  const requestVerification = verification.requestVerification
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [pendingId, setPendingId] = useState<string | null>(null)
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
    async (deploymentId: string | number) => {
      const id = String(deploymentId)
      if (!id || operation.current) return
      const current = new AbortController()
      operation.current = current
      setPendingId(id)
      try {
        const optionKey = `deployment.${id}.registry_secret`
        const proof = await requestVerification({
          scope: 'system.secret.read',
          context: { option_key: optionKey },
          title: t('Verify to view saved secret'),
          description: t(
            'Use Passkey or 2FA to confirm your identity before revealing this saved value.'
          ),
        })
        if (!proof || operation.current !== current) return
        const response = await revealDeploymentRegistrySecret(
          deploymentId,
          proof.proof_token,
          current.signal
        )
        if (operation.current !== current) return
        if (!response.success) {
          throw createServerError(
            response,
            t('Failed to reveal secret')
          )
        }
        setRevealed((previous) => ({
          ...previous,
          [id]: response.data?.value ?? '',
        }))
      } catch (error) {
        if (operation.current === current && !current.signal.aborted) {
          handleServerError(AuthOperationError.from(error))
        }
      } finally {
        if (operation.current === current) {
          operation.current = null
          setPendingId(null)
        }
      }
    },
    [requestVerification, t]
  )

  const hide = useCallback((deploymentId: string | number) => {
    const id = String(deploymentId)
    setRevealed((previous) => {
      if (!(id in previous)) return previous
      const next = { ...previous }
      delete next[id]
      return next
    })
  }, [])

  const value = React.useMemo<DeploymentSecretDisclosure>(
    () => ({
      reveal,
      hide,
      revealed,
      pendingId,
      isRevealing: pendingId !== null,
    }),
    [reveal, hide, revealed, pendingId]
  )

  return (
    <DeploymentSecretDisclosureContext.Provider value={value}>
      {children}
      <SecureVerificationDialog {...verification.dialogProps} />
    </DeploymentSecretDisclosureContext.Provider>
  )
}

const fallbackDeploymentSecretDisclosure: DeploymentSecretDisclosure = {
  reveal: async () => {},
  hide: () => {},
  revealed: {},
  pendingId: null,
  isRevealing: false,
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDeploymentSecretDisclosure() {
  // 组件单测或局部预览未挂载 provider 时保持只读掩码，绝不退回明文。
  return (
    React.useContext(DeploymentSecretDisclosureContext) ??
    fallbackDeploymentSecretDisclosure
  )
}
