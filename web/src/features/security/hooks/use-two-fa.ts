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
import { useState, useEffect, useCallback } from 'react'

import type { TwoFAStatus } from '@/features/profile/types'
import { AuthOperationError } from '@/lib/secure-verification'

import { get2FAStatus } from '../api'

// ============================================================================
// Two-FA Hook
// ============================================================================

const DEFAULT_STATUS: TwoFAStatus = {
  enabled: false,
  locked: false,
  backup_codes_remaining: 0,
}

export function useTwoFA(enabled = true) {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<TwoFAStatus>(DEFAULT_STATUS)
  const [error, setError] = useState<string>()

  const fetchStatus = useCallback(async () => {
    if (!enabled) return

    try {
      setLoading(true)
      setError(undefined)
      setStatus(await get2FAStatus())
    } catch (error) {
      setError(AuthOperationError.from(error).message)
    } finally {
      setLoading(false)
    }
  }, [enabled])

  // 首次加载独立于 refetch：effect 只负责与外部系统同步，并在 enabled
  // 变化或卸载时取消过期结果，避免在 effect 里同步写入 loading/error。
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void (async () => {
      try {
        const nextStatus = await get2FAStatus()
        if (!cancelled) setStatus(nextStatus)
      } catch (error) {
        if (!cancelled) setError(AuthOperationError.from(error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  return {
    status,
    loading,
    error,
    refetch: fetchStatus,
  }
}
