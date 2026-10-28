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
import { getServerMessage } from '@/lib/server-error-message'

import {
  PAYMENT_TYPES,
  DEFAULT_PRESET_MULTIPLIERS,
  DEFAULT_PAYMENT_TYPE,
  DEFAULT_MIN_TOPUP,
} from '../constants'
import type { PaymentMethod, PresetAmount, TopupInfo } from '../types'
import { formatCNYAmount } from './format'
import { resolvePaymentRedirectUrl } from './payment-redirect'

// ============================================================================
// Payment Processing Functions
// ============================================================================

/**
 * Payment endpoints answer errors as {"message": "error", "data": text}. When
 * the response also carries a message_key, this is its translation; callers
 * fall back to the text they already read.
 */
export function getPaymentErrorTranslation(
  response: unknown
): string | undefined {
  if (!response || typeof response !== 'object') return undefined
  const body = response as Record<string, unknown>
  if (typeof body.message_key !== 'string' || !body.message_key) {
    return undefined
  }
  return getServerMessage(body)
}

/**
 * Check if browser is Safari
 */
function isSafariBrowser(): boolean {
  return (
    navigator.userAgent.includes('Safari') &&
    !navigator.userAgent.includes('Chrome')
  )
}

/**
 * Submit payment form (for non-Stripe payments)
 *
 * 表单 action 同样来自后端下发，必须先过协议校验：
 * 未校验的 `javascript:` action 会让挂起的表单成为一次脚本执行。
 */
export function submitPaymentForm(
  url: string,
  params: Record<string, unknown>
): void {
  const safeUrl = resolvePaymentRedirectUrl(url)
  if (!safeUrl) {
    throw new Error('Invalid payment redirect URL')
  }

  const form = document.createElement('form')
  form.action = safeUrl
  form.method = 'POST'
  form.rel = 'noopener noreferrer'

  // Don't open in new tab for Safari
  if (!isSafariBrowser()) {
    form.target = '_blank'
  }

  // Add form parameters
  Object.entries(params).forEach(([key, value]) => {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = key
    input.value = String(value)
    form.appendChild(input)
  })

  document.body.appendChild(form)
  form.submit()
  document.body.removeChild(form)
}

/**
 * Check if payment method is Stripe
 */
export function isStripePayment(paymentType: string): boolean {
  return paymentType === PAYMENT_TYPES.STRIPE
}

/**
 * Check if payment method is Waffo
 */
export function isWaffoPayment(paymentType: string): boolean {
  return paymentType === PAYMENT_TYPES.WAFFO
}

/**
 * Check if payment method is Waffo Pancake
 *
 * Pancake is a metered-style payment that goes through a dedicated checkout
 * URL flow rather than the generic epay form submission, so it must be
 * special-cased in payment dispatch logic.
 */
export function isWaffoPancakePayment(paymentType: string): boolean {
  return paymentType === PAYMENT_TYPES.WAFFO_PANCAKE
}

/**
 * Check if payment method is official Alipay website payment
 * (alipay.trade.page.pay on PC / alipay.trade.wap.pay on mobile).
 */
export function isAlipayWebPayment(paymentType: string): boolean {
  return paymentType === PAYMENT_TYPES.ALIPAY_WEB
}

/**
 * Check if payment method is official WeChat Pay website payment
 * (Native QR on PC / H5 on mobile).
 */
export function isWechatPayWebPayment(paymentType: string): boolean {
  return paymentType === PAYMENT_TYPES.WECHAT_PAY_WEB
}

/**
 * Check if payment method is an official China website payment settled in a
 * web cashier (QR code on PC, app/H5 redirect on mobile).
 *
 * This is the main channel for web top-ups: payment happens in a browser, so
 * it is not subject to Apple IAP (mini-program virtual goods are charged 12%
 * on iOS), keeping the effective rate around 0.6%.
 */
export function isCnWebPayment(paymentType: string): boolean {
  return isAlipayWebPayment(paymentType) || isWechatPayWebPayment(paymentType)
}

/**
 * Format a payable amount with the symbol of the currency it is actually
 * charged in — the currency is decided by the payment channel, NOT by the
 * admin's quotaDisplayType:
 *
 * - regular（易支付 Epay / 官方直连支付宝·微信）→ 人民币 ¥：
 *   后端 getPayMoney = amount × Price（Price 是每美元额度的人民币价），
 *   下单金额原样提交给境内网关，恒为人民币。
 * - stripe / waffo / waffo_pancake / creem → 美元 $：境外网关以美元结算。
 *
 * 历史包袱：这些金额曾用不带符号的 formatCurrency 或跟随 quotaDisplayType 的
 * formatLocalCurrencyAmount 展示，系统配 USD 显示时会把人民币金额显示成
 * `$73`，与真实扣款币种不符。
 */
export function formatPaymentAmount(
  amount: number | string,
  paymentType: string | undefined
): string {
  const isUsdChannel =
    isStripePayment(paymentType ?? '') ||
    isWaffoPayment(paymentType ?? '') ||
    isWaffoPancakePayment(paymentType ?? '') ||
    paymentType === PAYMENT_TYPES.CREEM

  if (isUsdChannel) {
    const numeric =
      typeof amount === 'number' ? amount : Number.parseFloat(String(amount))
    if (!Number.isFinite(numeric)) return '-'
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      currencyDisplay: 'narrowSymbol',
      // 与人民币一侧同口径：金额固定两位小数（$12.5 → $12.50），
      // 不足 1 美元时放宽到 4 位，避免 $0.0098 被舍成 $0.00。
      minimumFractionDigits: 2,
      maximumFractionDigits: Math.abs(numeric) >= 1 ? 2 : 4,
    }).format(numeric)
  }

  return formatCNYAmount(amount)
}

/**
 * Detect the cashier form factor for the China website payment gateways.
 *
 * Mobile browsers must use the redirect cashier (Alipay wap / WeChat H5) so the
 * provider app can be launched; desktops get the QR code cashier. The server
 * whitelists the value anyway, so a wrong guess only degrades UX, never safety.
 */
export function detectPayClient(): 'pc' | 'mobile' {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'pc'
  }
  const mobileUA =
    /Android|iPhone|iPad|iPod|Windows Phone|HarmonyOS|Mobile/i.test(
      navigator.userAgent
    )
  return mobileUA || window.innerWidth < 768 ? 'mobile' : 'pc'
}

export interface PaymentProcessors {
  regular: (topupAmount: number, paymentType: string) => Promise<boolean>
  waffo: (topupAmount: number, payMethodIndex: number) => Promise<boolean>
  waffoPancake: (topupAmount: number) => Promise<boolean>
}

export async function dispatchSelectedPayment(
  paymentMethod: PaymentMethod,
  topupAmount: number,
  waffoMethodIndex: number | null,
  processors: PaymentProcessors
): Promise<boolean> {
  if (isWaffoPayment(paymentMethod.type)) {
    if (waffoMethodIndex === null) {
      return false
    }
    return processors.waffo(topupAmount, waffoMethodIndex)
  }

  if (isWaffoPancakePayment(paymentMethod.type)) {
    return processors.waffoPancake(topupAmount)
  }

  return processors.regular(topupAmount, paymentMethod.type)
}

/**
 * Get default payment type from topup info
 */
export function getDefaultPaymentType(topupInfo: TopupInfo | null): string {
  if (!topupInfo) {
    return DEFAULT_PAYMENT_TYPE
  }

  // Return first available payment method or default
  if (topupInfo.pay_methods?.length > 0) {
    return topupInfo.pay_methods[0].type
  }

  if (topupInfo.enable_stripe_topup) {
    return PAYMENT_TYPES.STRIPE
  }

  if (topupInfo.enable_waffo_topup) {
    return PAYMENT_TYPES.WAFFO
  }

  if (topupInfo.enable_waffo_pancake_topup) {
    return PAYMENT_TYPES.WAFFO_PANCAKE
  }

  return DEFAULT_PAYMENT_TYPE
}

/**
 * Get minimum topup amount from topup info
 */
export function getMinTopupAmount(topupInfo: TopupInfo | null): number {
  if (!topupInfo) {
    return DEFAULT_MIN_TOPUP
  }

  // 支付宝 / 微信支付 / 易支付都以人民币结算，后端统一下发同一个 min_topup
  // （operation_setting.MinTopUp）。此前这里只在 enable_online_topup（易支付）
  // 分支读它，运营把最低额改成 0.01 后，用支付宝/微信充值时前端仍按写死的 1
  // 拦截 —— 配置保存成功、库里也是 0.01，钱包页却坚持「最低 1 美元」。
  if (
    topupInfo.enable_online_topup ||
    topupInfo.enable_alipay_topup ||
    topupInfo.enable_wechat_pay_topup
  ) {
    return topupInfo.min_topup ?? DEFAULT_MIN_TOPUP
  }

  if (topupInfo.enable_stripe_topup) {
    return topupInfo.stripe_min_topup
  }

  if (topupInfo.enable_waffo_topup) {
    return topupInfo.waffo_min_topup || DEFAULT_MIN_TOPUP
  }

  if (topupInfo.enable_waffo_pancake_topup) {
    return topupInfo.waffo_pancake_min_topup || DEFAULT_MIN_TOPUP
  }

  return DEFAULT_MIN_TOPUP
}

/**
 * Generate preset amounts based on minimum topup
 */
export function generatePresetAmounts(minAmount: number): PresetAmount[] {
  // 最低额可以是 0（运营主动关闭下限）。此时按 1 生成预设，否则整排按钮都是 0。
  const base = minAmount > 0 ? minAmount : DEFAULT_MIN_TOPUP
  return DEFAULT_PRESET_MULTIPLIERS.map((multiplier) => ({
    value: base * multiplier,
  }))
}

/**
 * Merge custom preset amounts with discounts
 */
export function mergePresetAmounts(
  amountOptions: number[],
  discounts: Record<number, number>
): PresetAmount[] {
  if (!amountOptions || amountOptions.length === 0) {
    return []
  }

  return amountOptions.map((amount) => ({
    value: amount,
    discount: discounts[amount] || 1.0,
  }))
}
