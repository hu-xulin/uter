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
import { createFileRoute, redirect } from '@tanstack/react-router'

import { AuthenticatedLayout } from '@/components/layout'
import { resolveAuthentication } from '@/lib/auth-session'
import { useAuthStore } from '@/stores/auth-store'

// 续期被限流（429）或服务端瞬时故障（5xx）属于**可恢复**状态：用户的会话本身仍然
// 有效，只是这一刻没拿到访问令牌。冷启动时内存里没有令牌，若此时立刻判定「未认证」
// 就会把登录态的用户送去登录页 —— 需要退避重试，而不是马上放弃。
const transientRefreshRetryDelays = [600, 1200]

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    // The root guard may have skipped its refresh because no session hint was
    // present. That skip is an optimization for public pages and must not
    // decide a protected route, so resolve against the server before
    // redirecting. An in-memory session returns without a request.
    //
    // What the root guard does decide is an *anonymous* verdict: a visitor it
    // found anonymous (no session hint, nothing in memory) stays anonymous for
    // this page session, so opening a protected route sends them to sign-in
    // instead of silently refreshing a cookie they were never shown as signed
    // in with. A transient refresh failure is retried below.
    let outcome = await resolveAuthentication()

    for (const delay of transientRefreshRetryDelays) {
      if (outcome.kind !== 'transient_error') break
      await new Promise((resolve) => setTimeout(resolve, delay))
      outcome = await resolveAuthentication()
    }

    const { auth } = useAuthStore.getState()

    if (!auth.user || !auth.accessToken) {
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.href },
      })
    }
  },
  component: AuthenticatedLayout,
})
