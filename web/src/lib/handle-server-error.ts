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
import { toast } from 'sonner'

import { isAuthTeardownInProgress } from './auth-session'
import {
  getServerErrorMessage,
  getServerErrorSources,
  isServerErrorCancelled,
} from './server-error-message'

const reportedErrors = new WeakSet<object>()

/** Also used when a failure has already been presented inline. */
export function markServerErrorHandled(error: unknown): void {
  for (const source of getServerErrorSources(error)) reportedErrors.add(source)
}

export function handleServerError(
  error: unknown,
  fallbackMessage?: string,
  presentation?: { title: string; description?: string }
): void {
  // 退出登录/会话被注销的过渡期内，静默所有服务器错误提示，
  // 避免"无权XXX"之类的迟到错误盖过"退出登录"提示。
  if (isAuthTeardownInProgress()) return
  if (isServerErrorCancelled(error)) return
  const sources = getServerErrorSources(error)
  const reported = sources.some((source) => reportedErrors.has(source))
  markServerErrorHandled(error)
  if (reported) return
  const message =
    presentation?.title || getServerErrorMessage(error, fallbackMessage)
  if (presentation?.description) {
    toast.error(message, { description: presentation.description })
  } else {
    toast.error(message)
  }
}
