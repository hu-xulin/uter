/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public
License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/

import i18next from 'i18next'
import { toast } from 'sonner'

/**
 * 支付跳转的统一入口。
 *
 * 各支付服务商返回的跳转地址都由后端下发，前端必须在跳转前校验：
 *  - 只允许 http/https（`javascript:` / `data:` 之类一律拒绝）；
 *  - 生产环境要求 HTTPS，仅当当前站点本身是 HTTP（本地开发/自建内网）
 *    才放行明文 HTTP；
 *  - 已知服务商按主机名白名单校验，未知服务商至少做协议校验；
 *  - 新窗口一律带 `noopener,noreferrer`，避免目标页通过 `window.opener`
 *    反向操纵本页；
 *  - 弹窗被拦截时明确报错，而不是静默「成功」后关闭对话框。
 */

export type PaymentRedirectProvider = 'stripe' | 'creem' | 'waffo' | 'unknown'

/**
 * 已知支付服务商的主机名白名单。
 * 匹配规则：主机名等于条目，或以 `.条目` 结尾（覆盖子域名）。
 *
 * 未列出的服务商走 `unknown`：**只做协议与 HTTPS 校验**，不做主机名限制 ——
 * 私有部署的聚合支付网关域名由站长自定义，硬编码白名单会直接打断收款。
 */
const PROVIDER_HOST_ALLOWLIST: Record<
  Exclude<PaymentRedirectProvider, 'unknown'>,
  readonly string[]
> = {
  stripe: ['stripe.com'],
  creem: ['creem.io'],
  waffo: [],
}

function matchesHostSuffix(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase()
  const target = domain.toLowerCase()
  return host === target || host.endsWith(`.${target}`)
}

/**
 * 校验后端下发的支付跳转地址。返回规范化后的 URL，非法时返回 null。
 */
export function resolvePaymentRedirectUrl(
  rawUrl: unknown,
  provider: PaymentRedirectProvider = 'unknown'
): string | null {
  if (typeof rawUrl !== 'string') return null
  const trimmed = rawUrl.trim()
  if (!trimmed) return null

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null
  }

  // 明文 HTTP 只在当前站点本身就是 HTTP 时可接受（本地开发 / 内网自建）。
  const siteIsInsecure =
    typeof window !== 'undefined' && window.location.protocol === 'http:'
  if (parsed.protocol === 'http:' && !siteIsInsecure) {
    return null
  }

  if (provider !== 'unknown') {
    const allowlist = PROVIDER_HOST_ALLOWLIST[provider]
    if (
      allowlist.length > 0 &&
      !allowlist.some((domain) => matchesHostSuffix(parsed.hostname, domain))
    ) {
      return null
    }
  }

  return parsed.toString()
}

/**
 * 在新标签页打开支付跳转地址。
 *
 * 返回 false 表示没有真正跳转（地址非法，或弹窗被浏览器拦截），
 * 调用方必须据此提示用户并保持对话框打开，而不是当成成功。
 */
export function openPaymentRedirect(
  rawUrl: unknown,
  provider: PaymentRedirectProvider = 'unknown'
): boolean {
  const url = resolvePaymentRedirectUrl(rawUrl, provider)
  if (!url) {
    toast.error(i18next.t('Invalid payment redirect URL'))
    return false
  }

  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (!opened) {
    toast.error(
      i18next.t(
        'The payment page was blocked by your browser. Allow pop-ups for this site and try again.'
      )
    )
    return false
  }

  return true
}
