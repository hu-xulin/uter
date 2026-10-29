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
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import i18next from 'i18next'
import { useEffect, useRef } from 'react'

import {
  getWeChatWebFlowOrigin,
  wechatWebLoginByCode,
} from '@/features/auth/api'
import { consumeOAuthLoginRedirect } from '@/features/auth/lib/oauth-callback-mode'
import { sanitizeAuthRedirect } from '@/features/auth/lib/auth-redirect'
import { applyAuthBundle, isAuthBundle } from '@/lib/api'
import { handleServerError } from '@/lib/handle-server-error'
import { AuthOperationError } from '@/lib/secure-verification'
import { createServerError } from '@/lib/server-error-message'

function sameHost(a: string | null | undefined, b: string): boolean {
  if (!a) return false
  try {
    return new URL(a).host === new URL(b).host
  } catch {
    return false
  }
}

/**
 * WeChat website-app (开放平台网站应用) callback.
 *
 * 微信固定回跳到「授权回调域」（ICP 备案域，如 wx.uter.cc），而登录发起在
 * 主站（如 uter.ai），oauth_login_nonce Cookie 也只存在于发起域。因此本页是
 * 双模回调：
 * 1. 当前域 = flow 记录的发起域（或 flow 未记录）→ 就地调用登录 API 完成登录，
 *   会话 Cookie 落在当前（主站）域；
 * 2. 当前域 ≠ 发起域 → 把一次性 code/state 原样转发回发起域的同一路由，由
 *   发起域的本次加载走分支 1。发起 origin 由服务端在创建 flow 时按白名单
 *   （主站 / 回调域 / 请求 Host）校验，杜绝被引向外部域。
 */
function WeChatWebCallbackComponent() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/(auth)/oauth/wechat-web' }) as {
    code?: string
    state?: string
  }

  // 与 /(auth)/oauth 相同的约束：换码登录一个 mount 只允许执行一次，避免
  // router store 重放触发并发登录竞态。
  const loginStartedRef = useRef(false)

  useEffect(() => {
    if (loginStartedRef.current) return
    loginStartedRef.current = true
    ;(async () => {
      const { code, state } = search ?? {}
      if (!code || !state) {
        handleServerError(new AuthOperationError(i18next.t('OAuth failed')))
        navigate({ to: '/sign-in', replace: true })
        return
      }
      try {
        const startedOrigin = await getWeChatWebFlowOrigin(state)
        if (!sameHost(startedOrigin, window.location.origin)) {
          const targetOrigin = startedOrigin || window.location.origin
          const hop = new URL('/oauth/wechat-web', targetOrigin)
          hop.searchParams.set('code', code)
          hop.searchParams.set('state', state)
          window.location.replace(hop.toString())
          return
        }
        const res = await wechatWebLoginByCode(code, state)
        if (res?.success && isAuthBundle(res.data)) {
          applyAuthBundle(res.data)
          const redirect = consumeOAuthLoginRedirect(state)
          const target =
            sanitizeAuthRedirect(redirect, window.location.origin) ??
            '/dashboard'
          navigate({ href: target, replace: true })
          return
        }
        throw createServerError(res, i18next.t('OAuth failed'))
      } catch (error: unknown) {
        handleServerError(
          AuthOperationError.from(error, i18next.t('OAuth failed'))
        )
      }
      navigate({ to: '/sign-in', replace: true })
    })()
  }, [navigate, search])

  return null
}

export const Route = createFileRoute('/(auth)/oauth/wechat-web')({
  component: WeChatWebCallbackComponent,
})
