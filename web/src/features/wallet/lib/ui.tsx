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
import i18next from 'i18next'
import { CreditCard, Landmark } from 'lucide-react'
import type { ReactNode } from 'react'

import { IconAlipay, IconWeChatPay, IconStripe } from '@/assets/brand-icons'
import { isGenericWechatIconName } from '@/components/payment-wechat-alias'
import { ReactIconByName } from '@/components/react-icon-by-name'

import { PAYMENT_TYPES, PAYMENT_ICON_COLORS } from '../constants'

// ============================================================================
// UI Helper Functions
// ============================================================================

/**
 * 微信支付的两个通道类型。
 *
 * 它们要用「微信支付」的品牌标（绿色气泡里带一道勾），而不是微信聊天应用的
 * 双气泡标 —— 后端 `pay_methods` 的默认图标恰好是 `SiWechat`，直接用会把
 * 支付入口画成聊天软件。
 */
const WECHAT_PAY_TYPES = new Set<string>([
  PAYMENT_TYPES.WECHAT,
  PAYMENT_TYPES.WECHAT_PAY_WEB,
])

function isWechatPayType(paymentType: string | undefined): boolean {
  return paymentType != null && WECHAT_PAY_TYPES.has(paymentType)
}

/**
 * Resolves a backend-provided image URL to https only. Rejects http:,
 * data:, blob:, file:, relative paths, and URLs with userinfo, which are unsafe
 * or ambiguous in <img src/>.
 */
function normalizeHttpIconUrl(raw: string | undefined | null): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null
  if (!/^https:\/\//i.test(s)) return null

  let url: URL
  try {
    url = new URL(s)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') {
    return null
  }
  if (url.username || url.password) {
    return null
  }
  return url.toString()
}

/**
 * Get payment method icon component
 *
 * When icon is provided, render a safe http(s) image URL or resolve it as a
 * react-icons component name. Invalid configured icons intentionally render
 * nothing instead of falling back to the payment type.
 *
 * 品牌色**不因运营配置了图标名而丢失**：后端默认的 pay_methods 就带
 * `icon: "SiAlipay"` / `"SiWechat"`，早期实现走到 react-icons 分支后不再套色，
 * 收银台因此显示成黑白图标。品牌色只由 `paymentType` 决定（运营改图标不改品牌），
 * 自定义图片 URL 无法重新着色，保持原图。
 */
export function getPaymentIcon(
  paymentType: string | undefined,
  className: string = 'h-4 w-4',
  icon?: string,
  altName?: string
): ReactNode {
  const iconValue = icon?.trim()
  const safeIconUrl = normalizeHttpIconUrl(iconValue)
  if (safeIconUrl) {
    return (
      <img
        src={safeIconUrl}
        alt={altName || paymentType || 'payment'}
        className={className}
        style={{ objectFit: 'contain' }}
        loading='lazy'
        decoding='async'
        referrerPolicy='no-referrer'
      />
    )
  }
  const brandColor = paymentType ? PAYMENT_ICON_COLORS[paymentType] : undefined
  if (iconValue) {
    // 「通用微信」别名在微信支付上下文里升级成支付标（isGenericWechatIconName，
    // 共享清单见 components/payment-icon-by-name.tsx）。
    // 运营配置的显示名（`altName`）要跟着走，否则无障碍名称会退回英文默认值。
    if (isWechatPayType(paymentType) && isGenericWechatIconName(iconValue)) {
      return (
        <IconWeChatPay
          className={className}
          style={{ color: brandColor }}
          title={altName}
        />
      )
    }
    return (
      <ReactIconByName
        name={iconValue}
        className={className}
        color={brandColor}
        title={altName || paymentType || iconValue}
      />
    )
  }

  if (!paymentType) {
    return <CreditCard className={className} />
  }

  switch (paymentType) {
    case PAYMENT_TYPES.ALIPAY:
      return (
        <IconAlipay
          className={className}
          style={{ color: PAYMENT_ICON_COLORS[PAYMENT_TYPES.ALIPAY] }}
        />
      )
    case PAYMENT_TYPES.WECHAT:
      return (
        <IconWeChatPay
          className={className}
          style={{ color: PAYMENT_ICON_COLORS[PAYMENT_TYPES.WECHAT] }}
          title={altName}
        />
      )
    case PAYMENT_TYPES.STRIPE:
      return (
        <IconStripe
          className={className}
          style={{ color: PAYMENT_ICON_COLORS[PAYMENT_TYPES.STRIPE] }}
        />
      )
    case PAYMENT_TYPES.CREEM:
      return (
        <Landmark
          className={className}
          style={{ color: PAYMENT_ICON_COLORS[PAYMENT_TYPES.CREEM] }}
        />
      )
    case PAYMENT_TYPES.WAFFO:
      return (
        <CreditCard
          className={className}
          style={{ color: PAYMENT_ICON_COLORS[PAYMENT_TYPES.WAFFO] }}
        />
      )
    case PAYMENT_TYPES.ALIPAY_WEB:
      return (
        <IconAlipay
          className={className}
          style={{ color: PAYMENT_ICON_COLORS[PAYMENT_TYPES.ALIPAY_WEB] }}
        />
      )
    case PAYMENT_TYPES.WECHAT_PAY_WEB:
      // 官方直连微信支付与易支付·微信走同一个品牌标：都是「微信支付」，
      // 用聊天软件的双气泡标会让人以为要点开微信扫码聊天。
      return (
        <IconWeChatPay
          className={className}
          style={{
            color: PAYMENT_ICON_COLORS[PAYMENT_TYPES.WECHAT_PAY_WEB],
          }}
          title={altName}
        />
      )
    case PAYMENT_TYPES.WAFFO_PANCAKE:
      // The W glyph fills only ~40% of its viewBox vertically (wide and
      // short letterform); scale(2) brings its rendered height in line
      // with Stripe's S and Creem's Landmark.
      return (
        <span
          className={`inline-flex items-center justify-center ${className}`}
          style={{ transform: 'scale(2)' }}
        >
          <img
            src='/waffo-logo-light.svg'
            alt={i18next.t('Waffo')}
            className='block h-full w-full object-contain dark:hidden'
          />
          <img
            src='/waffo-logo-dark.svg'
            alt={i18next.t('Waffo')}
            className='hidden h-full w-full object-contain dark:block'
          />
        </span>
      )
    default:
      return <CreditCard className={className} />
  }
}
