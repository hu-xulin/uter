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

import { getDeploymentSettings, testDeploymentConnection } from '../api'

interface ConnectionState {
  loading: boolean
  ok: boolean | null
  error: string | null
}

// Connection cache TTL (5 minutes)
const CONNECTION_CACHE_TTL = 5 * 60 * 1000

type LoadingPhase = 'idle' | 'settings' | 'connection' | 'done'

export function useModelDeploymentSettings() {
  const [loading, setLoading] = useState(true)
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>('settings')
  const [settings, setSettings] = useState<Record<string, unknown>>({
    'model_deployment.ionet.enabled': false,
  })
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    loading: false,
    ok: null,
    error: null,
  })
  const initialLoadRef = useRef(true)

  // 连接探测结果按 hook 实例隔离：模块级共享会让多个实例互相污染，
  // 一个实例的手动重试会清掉另一个实例刚拿到的缓存。
  const connectionCacheRef = useRef<{
    ok: boolean
    timestamp: number
  } | null>(null)

  const readCachedConnection = useCallback((): boolean | null => {
    const cached = connectionCacheRef.current
    if (!cached) return null
    if (Date.now() - cached.timestamp > CONNECTION_CACHE_TTL) {
      connectionCacheRef.current = null
      return null
    }
    return cached.ok
  }, [])

  const writeCachedConnection = useCallback((ok: boolean) => {
    connectionCacheRef.current = { ok, timestamp: Date.now() }
  }, [])

  const clearConnectionCache = useCallback(() => {
    connectionCacheRef.current = null
  }, [])

  // 世代令牌 + AbortController：窗口 focus 等场景会并发触发多次 fetchAll，
  // 而 fetchAll 内部是两段串行 await，后发的请求可能先返回。没有世代校验时
  // 旧响应会在新响应之后写回 state，用户会看到「刚改完设置又跳回旧值」。
  const generationRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const beginRequest = useCallback(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    generationRef.current += 1
    const generation = generationRef.current
    return {
      isStale: () =>
        generation !== generationRef.current || controller.signal.aborted,
    }
  }, [])

  // 卸载后中止在途请求并作废当前世代，避免异步回调继续 setState。
  useEffect(() => {
    return () => {
      generationRef.current += 1
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [])

  // Parallel fetch: settings + connection test (when enabled)
  const fetchAll = useCallback(
    async (useCache = true) => {
      const { isStale } = beginRequest()
      setLoading(true)
      setLoadingPhase('settings')

      try {
        // Step 1: Fetch settings first (usually fast)
        const response = await getDeploymentSettings()
        if (isStale()) return
        const isEnabled = response?.success && response?.data?.enabled === true

        setSettings({
          'model_deployment.ionet.enabled': isEnabled,
        })

        if (!isEnabled) {
          // Not enabled, done
          setConnectionState({ loading: false, ok: null, error: null })
          return
        }

        // Step 2: Check connection (check cache first)
        if (useCache) {
          const cached = readCachedConnection()
          if (cached !== null) {
            setConnectionState({ loading: false, ok: cached, error: null })
            return
          }
        }

        // Test connection
        setLoadingPhase('connection')
        setConnectionState({ loading: true, ok: null, error: null })

        try {
          const connResponse = await testDeploymentConnection()
          if (isStale()) return
          if (connResponse?.success) {
            writeCachedConnection(true)
            setConnectionState({ loading: false, ok: true, error: null })
          } else {
            const message = connResponse?.message || 'Connection failed'
            writeCachedConnection(false)
            setConnectionState({ loading: false, ok: false, error: message })
          }
        } catch (error: unknown) {
          if (isStale()) return
          const errMsg =
            error instanceof Error ? error.message : 'Connection failed'
          writeCachedConnection(false)
          setConnectionState({ loading: false, ok: false, error: errMsg })
        }
      } catch {
        // Settings fetch failed, use defaults
        if (!isStale()) {
          setConnectionState({ loading: false, ok: null, error: null })
        }
      } finally {
        // 过期世代不得收尾，否则会把新一轮请求的 loading 状态提前清掉。
        if (!isStale()) {
          setLoadingPhase('done')
          setLoading(false)
        }
      }
    },
    [beginRequest, readCachedConnection, writeCachedConnection]
  )

  // Initial load
  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false
      fetchAll(true)
    }
  }, [fetchAll])

  const isIoNetEnabled = Boolean(settings['model_deployment.ionet.enabled'])

  // Manual retry (skip cache)
  const testConnection = useCallback(async () => {
    clearConnectionCache()
    const { isStale } = beginRequest()
    setConnectionState({ loading: true, ok: null, error: null })
    setLoadingPhase('connection')

    try {
      const response = await testDeploymentConnection()
      if (isStale()) return
      if (response?.success) {
        writeCachedConnection(true)
        setConnectionState({ loading: false, ok: true, error: null })
        return
      }
      const message = response?.message || 'Connection failed'
      writeCachedConnection(false)
      setConnectionState({ loading: false, ok: false, error: message })
    } catch (error: unknown) {
      if (isStale()) return
      const errMsg =
        error instanceof Error ? error.message : 'Connection failed'
      writeCachedConnection(false)
      setConnectionState({ loading: false, ok: false, error: errMsg })
    } finally {
      if (!isStale()) setLoadingPhase('done')
    }
  }, [beginRequest, clearConnectionCache, writeCachedConnection])

  // Refresh all (skip cache)
  const refresh = useCallback(() => {
    clearConnectionCache()
    return fetchAll(false)
  }, [clearConnectionCache, fetchAll])

  // Refresh on window focus (useful after saving settings in another page)
  useEffect(() => {
    const handler = () => {
      // Use cache on focus to avoid unnecessary requests
      fetchAll(true)
    }
    window.addEventListener('focus', handler)
    return () => window.removeEventListener('focus', handler)
  }, [fetchAll])

  return {
    loading,
    loadingPhase,
    settings,
    isIoNetEnabled,
    refresh,
    connectionLoading: connectionState.loading,
    connectionOk: connectionState.ok,
    connectionError: connectionState.error,
    testConnection,
  }
}
