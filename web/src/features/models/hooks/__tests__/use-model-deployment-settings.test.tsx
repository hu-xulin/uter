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
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getDeploymentSettings = vi.hoisted(() => vi.fn())
const testDeploymentConnection = vi.hoisted(() => vi.fn())

vi.mock('../../api', () => ({
  getDeploymentSettings,
  testDeploymentConnection,
}))

type SettingsResponse = { success: boolean; data: { enabled: boolean } }
type ConnectionResponse = { success: boolean; message?: string }

const enabledResponse: SettingsResponse = {
  success: true,
  data: { enabled: true },
}
const disabledResponse: SettingsResponse = {
  success: true,
  data: { enabled: false },
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

// 每个用例都重新加载模块：旧的实现把连接缓存放在模块作用域，
// 不隔离模块就无法保证用例之间互不污染。
async function loadHook() {
  vi.resetModules()
  const mod = await import('../use-model-deployment-settings')
  return mod.useModelDeploymentSettings
}

beforeEach(() => {
  getDeploymentSettings.mockReset()
  testDeploymentConnection.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('useModelDeploymentSettings fetchAll race', () => {
  it('lets only the newest concurrent fetchAll win', async () => {
    const useModelDeploymentSettings = await loadHook()

    // 第一次调用（挂载时的初始加载）：settings 请求挂起，稍后返回「旧值」。
    const staleSettings = deferred<SettingsResponse>()
    getDeploymentSettings.mockReturnValueOnce(staleSettings.promise)

    const { result } = renderHook(() => useModelDeploymentSettings())

    // 第二次调用（模拟窗口 focus 触发的 refresh）：立即返回「新值」。
    getDeploymentSettings.mockResolvedValueOnce(enabledResponse)
    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.isIoNetEnabled).toBe(true)

    // 迟到的第一次请求现在才返回：绝不能把界面拉回旧值。
    await act(async () => {
      staleSettings.resolve(disabledResponse)
      await staleSettings.promise
    })

    expect(result.current.isIoNetEnabled).toBe(true)
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })

  it('does not let a stale connection result overwrite a newer one', async () => {
    const useModelDeploymentSettings = await loadHook()

    // 第一次调用走「已启用 → 测连接」路径，且连接请求挂起不返回。
    const slowConnection = deferred<ConnectionResponse>()
    testDeploymentConnection.mockReturnValue(slowConnection.promise)
    getDeploymentSettings.mockResolvedValueOnce(enabledResponse)

    const { result } = renderHook(() => useModelDeploymentSettings())
    await waitFor(() => {
      expect(result.current.connectionLoading).toBe(true)
    })

    // 第二次调用返回「已禁用」，立刻收敛到终态。
    getDeploymentSettings.mockResolvedValueOnce(disabledResponse)
    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.isIoNetEnabled).toBe(false)
    expect(result.current.connectionOk).toBeNull()

    // 迟到的旧连接结果（失败）不得污染新一轮的状态。
    await act(async () => {
      slowConnection.resolve({ success: false, message: 'stale failure' })
      await slowConnection.promise
    })

    expect(result.current.isIoNetEnabled).toBe(false)
    expect(result.current.connectionOk).toBeNull()
    expect(result.current.connectionError).toBeNull()
  })

  it('stops driving the fetch chain once unmounted', async () => {
    const useModelDeploymentSettings = await loadHook()

    const settings = deferred<SettingsResponse>()
    getDeploymentSettings.mockReturnValue(settings.promise)

    const { result, unmount } = renderHook(() => useModelDeploymentSettings())
    expect(result.current.loading).toBe(true)

    unmount()

    // 卸载后才 resolve：fetchAll 必须就此短路，不得再发起后续的连接探测
    // （那既是无谓的网络请求，也意味着卸载后仍在推进异步流程）。
    await act(async () => {
      settings.resolve(enabledResponse)
      await settings.promise
    })

    expect(testDeploymentConnection).not.toHaveBeenCalled()
  })

  it('aborts the in-flight request when unmounted', async () => {
    const useModelDeploymentSettings = await loadHook()

    const settings = deferred<SettingsResponse>()
    getDeploymentSettings.mockReturnValue(settings.promise)

    const signals: AbortSignal[] = []
    const RealAbortController = globalThis.AbortController
    vi.stubGlobal(
      'AbortController',
      class extends RealAbortController {
        constructor() {
          super()
          signals.push(this.signal)
        }
      }
    )

    const { unmount } = renderHook(() => useModelDeploymentSettings())
    expect(signals.length).toBeGreaterThan(0)

    unmount()

    expect(signals.some((signal) => signal.aborted)).toBe(true)
    vi.unstubAllGlobals()
  })

  it('keeps the connection cache scoped per hook instance', async () => {
    const useModelDeploymentSettings = await loadHook()

    getDeploymentSettings.mockResolvedValue(enabledResponse)
    testDeploymentConnection.mockResolvedValue({ success: true })

    const first = renderHook(() => useModelDeploymentSettings())
    await waitFor(() => {
      expect(first.result.current.loading).toBe(false)
    })
    expect(first.result.current.connectionOk).toBe(true)
    const callsAfterFirst = testDeploymentConnection.mock.calls.length
    expect(callsAfterFirst).toBe(1)

    // 第二个实例必须自己重新探测，不能复用上一个实例写入的缓存。
    getDeploymentSettings.mockResolvedValue(enabledResponse)
    const second = renderHook(() => useModelDeploymentSettings())
    await waitFor(() => {
      expect(second.result.current.loading).toBe(false)
    })

    expect(second.result.current.connectionOk).toBe(true)
    expect(testDeploymentConnection.mock.calls.length).toBe(2)
  })

  it('does not let one instance clear another instance cache on refresh', async () => {
    const useModelDeploymentSettings = await loadHook()

    getDeploymentSettings.mockResolvedValue(enabledResponse)
    testDeploymentConnection.mockResolvedValue({ success: true })

    const first = renderHook(() => useModelDeploymentSettings())
    await waitFor(() => {
      expect(first.result.current.loading).toBe(false)
    })
    expect(testDeploymentConnection.mock.calls.length).toBe(1)

    // 第二个实例被 focus 触发一次 refresh（内部会清缓存）。
    getDeploymentSettings.mockResolvedValue(enabledResponse)
    const second = renderHook(() => useModelDeploymentSettings())
    await waitFor(() => {
      expect(second.result.current.loading).toBe(false)
    })
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() => {
      expect(testDeploymentConnection.mock.calls.length).toBeGreaterThan(1)
    })

    // 第一个实例随后 focus，应命中自己那份缓存而不必重新探测。
    const callsBefore = testDeploymentConnection.mock.calls.length
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(testDeploymentConnection.mock.calls.length).toBe(callsBefore)
  })
})
