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
export interface ConsoleCredentialInput {
  console_login_url?: string
  console_username?: string
  console_password?: string
}

/**
 * 本次提交是否携带了新的上游控制台密码。
 *
 * 判断必须与 channel-form.ts#transformChannelFormToSettings 的写入条件一致：
 * 只有 login_url 与 username 同时非空、且密码非空时才算"新增凭据"。
 */
export function isSavingNewConsoleCredentials(
  data: ConsoleCredentialInput
): boolean {
  return Boolean(
    data.console_login_url?.trim() &&
      data.console_username?.trim() &&
      data.console_password
  )
}

/**
 * 价格 preflight 是否应该拦截本次保存。
 *
 * 保存新凭据时跳过价格门禁：后端 UpdateChannel 不校验价格，若前端坚持拦截，
 * 就会形成"价格未定不能保存凭据 → 没有凭据无法确定价格"的死锁。
 * 凭据保存与计费价格正交，跳过不降低任何计费安全性——发布草稿仍有独立的
 * 服务端 draftPublishBlockers 门禁。
 */
export function shouldBlockSubmitForPricing(args: {
  hasPricingData: boolean
  blockingCount: number
  formData: ConsoleCredentialInput
}): boolean {
  if (isSavingNewConsoleCredentials(args.formData)) return false
  return args.hasPricingData && args.blockingCount > 0
}
