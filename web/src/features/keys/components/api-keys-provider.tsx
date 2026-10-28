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
import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import {
  SecureVerificationDialog,
  useSecureVerification,
} from '@/features/auth/secure-verification'
import useDialogState from '@/hooks/use-dialog'
import { handleServerError } from '@/lib/handle-server-error'
import { AuthOperationError } from '@/lib/secure-verification'

import { fetchTokenKey, fetchTokenKeysBatch } from '../api'
import { ERROR_MESSAGES } from '../constants'
import type { ApiKey, ApiKeysDialogType } from '../types'

type ApiKeysContextType = {
  open: ApiKeysDialogType | null
  setOpen: (str: ApiKeysDialogType | null) => void
  currentRow: ApiKey | null
  setCurrentRow: React.Dispatch<React.SetStateAction<ApiKey | null>>
  refreshTrigger: number
  triggerRefresh: () => void
  resolvedKey: string
  setResolvedKey: React.Dispatch<React.SetStateAction<string>>
  resolveRealKey: (id: number) => Promise<string | null>
  resolveRealKeysBatch: (ids: number[]) => Promise<Record<number, string>>
  resolvedKeys: Record<number, string>
  loadingKeys: Record<number, boolean>
  copiedKeyId: number | null
  markKeyCopied: (id: number) => void
}

const ApiKeysContext = React.createContext<ApiKeysContextType | null>(null)

export function ApiKeysProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  // 取回明文 sk- 属高危操作，所有 reveal 入口统一在此请求二次验证（Passkey / 2FA / 密码）。
  const verification = useSecureVerification()
  const requestVerification = verification.requestVerification
  const [open, setOpen] = useDialogState<ApiKeysDialogType>(null)
  const [currentRow, setCurrentRow] = useState<ApiKey | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [resolvedKey, setResolvedKey] = useState('')

  const [resolvedKeys, setResolvedKeys] = useState<Record<number, string>>({})
  const [loadingKeys, setLoadingKeys] = useState<Record<number, boolean>>({})
  const pendingRequests = useRef<Record<number, Promise<string | null>>>({})

  const [copiedKeyId, setCopiedKeyId] = useState<number | null>(null)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    return () => clearTimeout(copiedTimerRef.current)
  }, [])

  const markKeyCopied = useCallback((id: number) => {
    setCopiedKeyId(id)
    clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = setTimeout(() => setCopiedKeyId(null), 2000)
  }, [])

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1)
  }, [])

  const resolveRealKey = useCallback(
    async (id: number): Promise<string | null> => {
      if (resolvedKeys[id]) return resolvedKeys[id]
      if (id in pendingRequests.current) return pendingRequests.current[id]

      const request = (async () => {
        setLoadingKeys((prev) => ({ ...prev, [id]: true }))
        try {
          const proof = await requestVerification({ scope: 'token.key.read' })
          if (!proof) return null
          const res = await fetchTokenKey(id, proof.proof_token)
          if (res.success && res.data?.key) {
            const fullKey = `sk-${res.data.key}`
            setResolvedKeys((prev) => ({ ...prev, [id]: fullKey }))
            return fullKey
          }
          handleServerError(res, t(ERROR_MESSAGES.UNEXPECTED))
          return null
        } catch (error) {
          handleServerError(
            AuthOperationError.from(error),
            t(ERROR_MESSAGES.UNEXPECTED)
          )
          return null
        } finally {
          delete pendingRequests.current[id]
          setLoadingKeys((prev) => {
            const next = { ...prev }
            delete next[id]
            return next
          })
        }
      })()

      pendingRequests.current[id] = request
      return request
    },
    [resolvedKeys, t, requestVerification]
  )

  const resolveRealKeysBatch = useCallback(
    async (ids: number[]): Promise<Record<number, string>> => {
      const uncachedIds = ids.filter((id) => !resolvedKeys[id])
      if (uncachedIds.length === 0) {
        const result: Record<number, string> = {}
        for (const id of ids) result[id] = resolvedKeys[id]
        return result
      }

      for (const id of uncachedIds) {
        setLoadingKeys((prev) => ({ ...prev, [id]: true }))
      }

      try {
        const proof = await requestVerification({ scope: 'token.key.read' })
        if (!proof) return {}
        const res = await fetchTokenKeysBatch(uncachedIds, proof.proof_token)
        if (res.success && res.data?.keys) {
          const newKeys: Record<number, string> = {}
          for (const [idStr, key] of Object.entries(res.data.keys)) {
            newKeys[Number(idStr)] = `sk-${key}`
          }
          setResolvedKeys((prev) => ({ ...prev, ...newKeys }))

          const result: Record<number, string> = { ...newKeys }
          for (const id of ids) {
            if (resolvedKeys[id]) result[id] = resolvedKeys[id]
          }
          return result
        }
        handleServerError(res, t(ERROR_MESSAGES.UNEXPECTED))
        return {}
      } catch (error) {
        handleServerError(
          AuthOperationError.from(error),
          t(ERROR_MESSAGES.UNEXPECTED)
        )
        return {}
      } finally {
        for (const id of uncachedIds) {
          setLoadingKeys((prev) => {
            const next = { ...prev }
            delete next[id]
            return next
          })
        }
      }
    },
    [resolvedKeys, t, requestVerification]
  )

  return (
    <ApiKeysContext
      value={{
        open,
        setOpen,
        currentRow,
        setCurrentRow,
        refreshTrigger,
        triggerRefresh,
        resolvedKey,
        setResolvedKey,
        resolveRealKey,
        resolveRealKeysBatch,
        resolvedKeys,
        loadingKeys,
        copiedKeyId,
        markKeyCopied,
      }}
    >
      {children}
      {/*
       * 明文 sk- 的二次验证对话框必须由发起方渲染：本 provider 调用
       * requestVerification({scope:'token.key.read'})，但不渲染对话框时该 Promise
       * 永远挂起，密钥气泡会一直停在「加载中...」，用户无法查看/复制完整密钥。
       */}
      <SecureVerificationDialog {...verification.dialogProps} />
    </ApiKeysContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useApiKeys = () => {
  const apiKeysContext = React.useContext(ApiKeysContext)

  if (!apiKeysContext) {
    throw new Error('useApiKeys has to be used within <ApiKeysContext>')
  }

  return apiKeysContext
}
