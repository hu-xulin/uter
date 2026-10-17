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
import { createFileRoute, useSearch } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

import {
  ResetPasswordConfirm,
  type ResetPasswordSearchParams,
} from '@/features/auth/reset-password-confirm'

export const Route = createFileRoute('/(auth)/reset')({
  component: ResetPassword,
})

function ResetPassword() {
  const search = useSearch({
    from: '/(auth)/reset',
  }) as ResetPasswordSearchParams

  // 重置链接里的 email/token 是可直接兑换新密码的一次性凭证。参数取到后立刻
  // 从地址栏抹掉，避免它们留在浏览器历史、被复制进截图/工单，或作为 Referer
  // 发往后续导航。取到的值保存在 ref 里继续提交，不依赖 URL。
  const credentialsRef = useRef<ResetPasswordSearchParams>({})
  if (!credentialsRef.current.token && !credentialsRef.current.email) {
    credentialsRef.current = {
      email: search?.email,
      token: search?.token,
    }
  }

  useEffect(() => {
    if (!search?.email && !search?.token) return
    window.history.replaceState({}, '', window.location.pathname)
  }, [search?.email, search?.token])

  return (
    <ResetPasswordConfirm
      email={credentialsRef.current.email}
      token={credentialsRef.current.token}
    />
  )
}
