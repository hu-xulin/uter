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
import { describe, expect, it, vi } from 'vitest'

const getSetupStatus = vi.hoisted(() => vi.fn())
const bootstrapAuthentication = vi.hoisted(() => vi.fn())

vi.mock('@/features/setup/api', () => ({ getSetupStatus }))
vi.mock('@/lib/auth-session', () => ({
  bootstrapAuthentication,
  clearAuthenticatedClientState: vi.fn(),
  clearAuthentication: vi.fn(),
}))

const { createSetupStatusGate } = await import('../__root')

describe('createSetupStatusGate', () => {
  it('keeps checking while unresolved', () => {
    const gate = createSetupStatusGate()
    expect(gate.shouldCheck('/keys')).toBe(true)
    expect(gate.shouldCheck('/models')).toBe(true)
  })

  it('never checks the /setup routes themselves', () => {
    const gate = createSetupStatusGate()
    expect(gate.shouldCheck('/setup')).toBe(false)
    expect(gate.shouldCheck('/setup/')).toBe(false)
  })

  it('stops checking permanently once resolved (setup completed)', () => {
    const gate = createSetupStatusGate()
    gate.markResolved()

    expect(gate.shouldCheck('/keys')).toBe(false)
    expect(gate.shouldCheck('/models')).toBe(false)
    expect(gate.shouldCheck('/')).toBe(false)
  })

  it('stops checking once resolved even when setup was NOT completed', () => {
    // 「请求成功但未 setup」也必须停止重复检查：用户此刻正被重定向到 /setup，
    // 再查一次既无意义也会放大 /api/status 负载。
    const gate = createSetupStatusGate()
    gate.markResolved()

    expect(gate.shouldCheck('/')).toBe(false)
    // 冷却期不适用，成功路径没有 TTL。
    expect(gate.shouldCheck('/setup')).toBe(false)
  })

  it('suppresses retries within the TTL after a failure', () => {
    let clock = 1_000
    const gate = createSetupStatusGate({
      failureTtl: 5_000,
      now: () => clock,
    })

    gate.markFailed(clock)
    expect(gate.shouldCheck('/keys')).toBe(false)

    // 高频路由切换：连续多次切换都不应再次触发检查。
    clock += 1_000
    expect(gate.shouldCheck('/keys')).toBe(false)
    clock += 3_999
    expect(gate.shouldCheck('/keys')).toBe(false)
  })

  it('allows a retry once the failure TTL expires', () => {
    let clock = 1_000
    const gate = createSetupStatusGate({
      failureTtl: 5_000,
      now: () => clock,
    })

    gate.markFailed(clock)
    clock += 5_000
    expect(gate.shouldCheck('/keys')).toBe(true)

    // 重试仍未成功时重新进入冷却，不会变成打爆接口的热循环。
    gate.markFailed(clock)
    expect(gate.shouldCheck('/keys')).toBe(false)
  })

  it('does not loop forever: a permanently failing endpoint settles into cooldown', () => {
    let clock = 0
    const gate = createSetupStatusGate({
      failureTtl: 5_000,
      now: () => clock,
    })

    // 模拟 100 次路由切换，每次检查都失败。
    let checks = 0
    for (let i = 0; i < 100; i++) {
      if (gate.shouldCheck('/keys')) {
        checks++
        gate.markFailed(clock)
      }
      clock += 100
    }

    // 10 秒内 100 次切换最多触发 2 次检查，而不是 100 次。
    expect(checks).toBeLessThanOrEqual(2)
    expect(checks).toBeGreaterThan(0)
  })

  it('markResolved clears a previous failure cooldown', () => {
    const clock = 0
    const gate = createSetupStatusGate({
      failureTtl: 5_000,
      now: () => clock,
    })

    gate.markFailed(clock)
    gate.markResolved()

    expect(gate.shouldCheck('/keys')).toBe(false)
  })
})

describe('root beforeLoad setup status check', () => {
  // 每个用例都重新加载模块，以获得全新的闸门状态（模块内为单例）。
  async function loadRoute() {
    vi.resetModules()
    bootstrapAuthentication.mockReset()
    bootstrapAuthentication.mockResolvedValue(undefined)
    const mod = await import('../__root')
    const beforeLoad = mod.Route.options.beforeLoad as (ctx: {
      location: typeof location
    }) => Promise<void>
    return beforeLoad
  }

  const location = { href: 'http://localhost/keys', pathname: '/keys' }

  it('requests /api/status once across repeated navigations after success', async () => {
    const beforeLoad = await loadRoute()
    getSetupStatus.mockReset()
    getSetupStatus.mockResolvedValue({ success: true, data: { status: true } })

    await beforeLoad({ location })
    await beforeLoad({ location })
    await beforeLoad({ location })

    expect(getSetupStatus).toHaveBeenCalledTimes(1)
  })

  it('does not re-request after a successful "not set up" response', async () => {
    const beforeLoad = await loadRoute()
    getSetupStatus.mockReset()
    getSetupStatus.mockResolvedValue({
      success: true,
      data: { status: false },
    })

    // 首次会重定向到 /setup。
    await expect(beforeLoad({ location })).rejects.toThrow()

    // 随后的路由切换不应再打接口。
    await beforeLoad({ location })
    await beforeLoad({ location })
    expect(getSetupStatus).toHaveBeenCalledTimes(1)
  })

  it('throttles retries when the request keeps failing', async () => {
    const beforeLoad = await loadRoute()
    getSetupStatus.mockReset()
    getSetupStatus.mockRejectedValue(new Error('network down'))

    // 默认 TTL 为 5s，连续切换只应触发一次请求。
    await beforeLoad({ location })
    await beforeLoad({ location })
    await beforeLoad({ location })

    expect(getSetupStatus).toHaveBeenCalledTimes(1)
    // 检查失败不应阻断导航。
    expect(bootstrapAuthentication).toHaveBeenCalled()
  })

  it('still redirects to /setup when the service is not initialized', async () => {
    const beforeLoad = await loadRoute()
    getSetupStatus.mockReset()
    getSetupStatus.mockResolvedValue({
      success: true,
      data: { status: false },
    })

    await expect(beforeLoad({ location })).rejects.toMatchObject({
      options: { to: '/setup' },
    })
  })
})
