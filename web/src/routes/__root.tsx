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
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import {
  createRootRouteWithContext,
  Outlet,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { useEffect } from 'react'

// 顶部加载进度条目前停用：渲染处与下面的 import 都注释掉了。组件
// `components/navigation-progress` 与 `react-top-loading-bar` 依赖原样保留，
// 需要时取消这两处注释即可恢复，勿删组件或依赖。
// import { NavigationProgress } from '@/components/navigation-progress'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Toaster } from '@/components/ui/sonner'
import { ThemeCustomizationProvider } from '@/context/theme-customization-provider'
import { saveAffiliateCode } from '@/features/auth/lib/storage'
import { GeneralError } from '@/features/errors/general-error'
import { NotFoundError } from '@/features/errors/not-found-error'
import { getSetupStatus } from '@/features/setup/api'
import { useSystemConfig } from '@/hooks/use-system-config'
import {
  bootstrapAuthentication,
  clearAuthenticatedClientState,
  clearAuthentication,
} from '@/lib/auth-session'
import { subscribeAuthSessionEvents } from '@/lib/auth-session-sync'
import { resolveLegacyRoute } from '@/lib/legacy-route'
import { useAuthStore } from '@/stores/auth-store'
import { CustomerServiceWidget } from '@/features/customer-service/CustomerServiceWidget'

function RootComponent() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Load system configuration (logo, system name, etc.) from backend
  useSystemConfig({ autoLoad: true })

  useEffect(() => {
    const aff = new URLSearchParams(window.location.search).get('aff')?.trim()
    if (aff) {
      saveAffiliateCode(aff)
    }
  }, [])

  // 智能客服挂件：改用 Uter 原生 <CustomerServiceWidget />（见下方 return）。
  // 该组件按 /api/status 下发的 customer_service_url **浏览器直连**独立仓库
  // uter-ai/uter-cs 的服务，Uter 后端不再持有其代码、也不做反向代理；
  // 地址为空时不渲染挂件入口。

  useEffect(
    () =>
      useAuthStore.subscribe((state, previousState) => {
        const sid = state.auth.session?.sid
        const previousSID = previousState.auth.session?.sid
        if (sid !== previousSID) {
          queryClient.clear()
        }
      }),
    [queryClient]
  )

  useEffect(
    () =>
      subscribeAuthSessionEvents((event) => {
        const currentSID = useAuthStore.getState().auth.session?.sid

        if (event.kind === 'authenticated') {
          if (event.sid === currentSID) return
          if (currentSID) {
            clearAuthentication(false)
          }
          window.location.reload()
          return
        }

        if (currentSID && event.sid === currentSID) {
          clearAuthenticatedClientState(queryClient, false)
          void navigate({ to: '/sign-in', replace: true })
        }
      }),
    [navigate, queryClient]
  )

  return (
    <ThemeCustomizationProvider>
      {/*
        顶部路由加载进度条已按要求停用：它在路由pending 时从左至右推进，
        读起来像浏览器在「加载」，与站点即时反馈的观感冲突，且无实际信息量
        （页面本身并不阻塞交互）。这里仅停止渲染，组件
        `components/navigation-progress` 与 `react-top-loading-bar`
        依赖都原样保留，需要时把下面这行改回 `<NavigationProgress />`
        即可恢复，勿删组件或依赖。
      */}
      {/* <NavigationProgress /> */}
      <ErrorBoundary>
        <Outlet />
        <Toaster closeButton duration={5000} position='top-center' richColors />
        {import.meta.env.MODE === 'development' && (
          <>
            <ReactQueryDevtools
              buttonPosition='bottom-right'
              initialIsOpen={false}
            />
            <TanStackRouterDevtools
              position='bottom-left'
              initialIsOpen={false}
            />
          </>
        )}
      </ErrorBoundary>
      <CustomerServiceWidget />
    </ThemeCustomizationProvider>
  )
}

/**
 * setup 状态检查的节流闸门。
 *
 * 背景：`beforeLoad` 会在每次路由切换时运行，若闸门不关闭就会反复请求
 * `/api/status`。这里把三种结果区分开：
 *  - 请求成功且已完成 setup —— 永久关闭，后续路由切换不再请求；
 *  - 请求成功但未 setup —— 同样关闭本次会话的检查（用户正被重定向到
 *    `/setup`，重复请求既无意义也只会放大负载）；
 *  - 请求失败 —— 允许重试，但受一个短 TTL 约束，避免高频路由切换打爆接口。
 */
export const SETUP_STATUS_FAILURE_TTL = 5_000

type SetupStatusGate = {
  /** 本次路由切换是否需要发起 setup 状态检查 */
  shouldCheck: (pathname: string) => boolean
  /** 检查成功（无论是否已 setup）：关闭后续检查 */
  markResolved: () => void
  /** 检查失败：记录失败时间，进入 TTL 冷却 */
  markFailed: (now: number) => void
}

export function createSetupStatusGate(options?: {
  failureTtl?: number
  now?: () => number
}): SetupStatusGate {
  const failureTtl = options?.failureTtl ?? SETUP_STATUS_FAILURE_TTL
  const now = options?.now ?? Date.now

  let resolved = false
  let lastFailureAt: number | null = null

  return {
    shouldCheck(pathname) {
      if (resolved) return false
      if (pathname.startsWith('/setup')) return false
      // 失败后处于冷却期：跳过本次检查，等待 TTL 到期再试。
      if (lastFailureAt !== null && now() - lastFailureAt < failureTtl) {
        return false
      }
      return true
    },
    markResolved() {
      resolved = true
      lastFailureAt = null
    },
    markFailed(failedAt) {
      lastFailureAt = failedAt
    },
  }
}

// 同一页面会话内避免重复检查；刷新后重新校验当前服务实例。
const setupStatusGate = createSetupStatusGate()

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  // 应用初始化与路由解析前统一校验会话
  beforeLoad: async ({ location }) => {
    const legacyTarget = resolveLegacyRoute(location.href)
    if (legacyTarget) {
      throw redirect({ href: legacyTarget, replace: true })
    }

    const pathname = location?.pathname || ''
    const authBootstrap = bootstrapAuthentication()

    // 只检查 setup 状态（如果需要）
    if (setupStatusGate.shouldCheck(pathname)) {
      let failed = false
      const [status] = await Promise.all([
        getSetupStatus().catch((error) => {
          failed = true
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.warn('[root.beforeLoad] setup status check failed', error)
          }
          return null
        }),
        authBootstrap,
      ])

      if (failed) {
        // 失败可重试，但进入 TTL 冷却，避免每次路由切换都打一次接口。
        setupStatusGate.markFailed(Date.now())
      } else {
        // 成功即关闭闸门：`status.data.status` 为假说明未 setup，下面直接重定向，
        // 此时无需（也不应）再为当前会话重复检查。
        setupStatusGate.markResolved()

        if (status?.success && status.data && !status.data.status) {
          throw redirect({ to: '/setup' })
        }
      }
    } else {
      await authBootstrap
    }
  },
  component: RootComponent,
  notFoundComponent: NotFoundError,
  errorComponent: GeneralError,
})
