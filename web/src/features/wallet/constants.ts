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
import { PAYMENT_BRAND_COLORS } from '@/design-system/tokens/brand-colors'

// ============================================================================
// Wallet Constants
// ============================================================================

/**
 * Default preset amount multipliers
 * Used to generate quick select amounts based on minimum topup
 */
export const DEFAULT_PRESET_MULTIPLIERS = [1, 5, 10, 30, 50, 100, 300, 500]

/**
 * Payment method types
 */
export const PAYMENT_TYPES = {
  ALIPAY: 'alipay',
  WECHAT: 'wxpay',
  // 官方直连 · 网站支付（Web 收银台）：
  // 支付宝走「电脑网站支付」（PC 跳转页面收银台）与「手机网站支付」（移动端跳转支付方 App / H5）；
  // 微信支付走 Native 扫码（PC）与 H5 支付（移动端）。
  ALIPAY_WEB: 'alipay_web',
  WECHAT_PAY_WEB: 'wechat_web',
  STRIPE: 'stripe',
  CREEM: 'creem',
  WAFFO: 'waffo',
  WAFFO_PANCAKE: 'waffo_pancake',
} as const

/**
 * Default payment type
 */
export const DEFAULT_PAYMENT_TYPE = PAYMENT_TYPES.ALIPAY

/**
 * Payment icon colors (HEX format for react-icons)
 *
 * 支付宝的蓝、微信支付的绿是对方的商标配色，改成语义 Token 等于改人家 logo，
 * 所以取值集中声明在 `design-system/tokens/brand-colors`，这里只做枚举映射。
 */
export const PAYMENT_ICON_COLORS: Record<string, string> = {
  [PAYMENT_TYPES.ALIPAY]: PAYMENT_BRAND_COLORS[PAYMENT_TYPES.ALIPAY],
  [PAYMENT_TYPES.WECHAT]: PAYMENT_BRAND_COLORS[PAYMENT_TYPES.WECHAT],
  [PAYMENT_TYPES.ALIPAY_WEB]: PAYMENT_BRAND_COLORS[PAYMENT_TYPES.ALIPAY_WEB],
  [PAYMENT_TYPES.WECHAT_PAY_WEB]:
    PAYMENT_BRAND_COLORS[PAYMENT_TYPES.WECHAT_PAY_WEB],
  [PAYMENT_TYPES.STRIPE]: PAYMENT_BRAND_COLORS[PAYMENT_TYPES.STRIPE],
  [PAYMENT_TYPES.CREEM]: PAYMENT_BRAND_COLORS[PAYMENT_TYPES.CREEM],
  [PAYMENT_TYPES.WAFFO]: PAYMENT_BRAND_COLORS[PAYMENT_TYPES.WAFFO],
  [PAYMENT_TYPES.WAFFO_PANCAKE]:
    PAYMENT_BRAND_COLORS[PAYMENT_TYPES.WAFFO_PANCAKE],
}

/**
 * Default discount rate (no discount)
 */
export const DEFAULT_DISCOUNT_RATE = 1.0

/**
 * Default minimum topup amount
 */
export const DEFAULT_MIN_TOPUP = 1
