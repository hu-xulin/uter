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
import { formatBillingCurrencyFromUSD } from '@/lib/currency'

import { QUOTA_TYPE_VALUES, TOKEN_UNIT_DIVISORS } from '../constants'
import type { PricingModel, TokenUnit, PriceType } from '../types'
import { getDynamicPricingTiers } from './dynamic-price'
import { getConfiguredGroupRatio, getDisplayGroupRatio } from './model-helpers'

// ----------------------------------------------------------------------------
// Price Calculation Utilities
// ----------------------------------------------------------------------------

/**
 * Strip trailing zeros from formatted price string while preserving currency symbols
 */
export function stripTrailingZeros(formatted: string): string {
  // Match currency symbol at start, number, and potential 'k' suffix
  const match = formatted.match(/^([^\d-]*)([-\d,]+\.?\d*)(k?)$/)
  if (!match) return formatted

  const [, symbol, number, suffix] = match

  // Remove commas for processing
  const cleanNumber = number.replaceAll(',', '')

  // Convert to number and back to remove trailing zeros
  const parsed = Number.parseFloat(cleanNumber)
  if (Number.isNaN(parsed)) return formatted

  // Convert to string, which automatically removes trailing zeros
  let result = parsed.toString()

  // If the result is in scientific notation, format it properly
  if (result.includes('e')) {
    result = parsed.toFixed(20).replace(/\.?0+$/, '')
  }

  return `${symbol}${result}${suffix}`
}

/**
 * Calculate token price in USD.
 *
 * Returns NaN when the required ratio field is missing/null so callers can
 * skip rendering that price type.
 */
export function calculateTokenPrice(
  model: PricingModel,
  type: PriceType,
  ratio: number
): number {
  const base = model.model_ratio * 2 * ratio

  switch (type) {
    case 'input':
      return base
    case 'output':
      return base * model.completion_ratio
    case 'cache':
      return hasRatio(model.cache_ratio)
        ? base * Number(model.cache_ratio)
        : Number.NaN
    case 'create_cache':
      return hasRatio(model.create_cache_ratio)
        ? base * Number(model.create_cache_ratio)
        : Number.NaN
    case 'image':
      return hasRatio(model.image_ratio)
        ? base * Number(model.image_ratio)
        : Number.NaN
    case 'audio_input':
      return hasRatio(model.audio_ratio)
        ? base * Number(model.audio_ratio)
        : Number.NaN
    case 'audio_output':
      return hasRatio(model.audio_ratio) &&
        hasRatio(model.audio_completion_ratio)
        ? base *
            Number(model.audio_ratio) *
            Number(model.audio_completion_ratio)
        : Number.NaN
  }
}

function hasRatio(value: number | null | undefined): boolean {
  return value !== undefined && value !== null && Number.isFinite(Number(value))
}

/**
 * Numeric token price in USD for a given group ratio (before the token-unit
 * divisor and currency formatting). Returns NaN when the dimension is not
 * configured for the model, so callers can skip that dimension.
 */
export function getTokenPriceUSD(
  model: PricingModel,
  type: PriceType,
  ratio: number
): number {
  return calculateTokenPrice(model, type, ratio)
}

/**
 * Apply recharge rate to price
 *
 * priceRate represents how much users need to recharge (in the display currency)
 * to get 1 USD credit. usdExchangeRate is the real exchange rate.
 *
 * The returned value will be formatted by formatBillingCurrencyFromUSD, which will
 * multiply by the display currency's exchange rate.
 *
 * Examples:
 *
 * 1. Display currency = USD:
 *    - Model: 1 USD
 *    - priceRate = 0.5 (recharge $0.5 to get $1 credit)
 *    - usdExchangeRate = 1
 *    - Return: 1 × 0.5 / 1 = 0.5
 *    - formatBillingCurrencyFromUSD(0.5) → $0.5 ✓
 *
 * 2. Display currency = CNY:
 *    - Model: 1 USD
 *    - priceRate = 4 (recharge ¥4 to get $1 credit)
 *    - usdExchangeRate = 7 (real rate: 1 USD = ¥7)
 *    - Return: 1 × 4 / 7 = 0.571
 *    - formatBillingCurrencyFromUSD(0.571) → 0.571 × 7 = ¥4 ✓
 *    - Normal price: ¥7, Recharge price: ¥4 (cheaper!)
 */
function applyRechargeRate(
  price: number,
  showWithRecharge: boolean,
  priceRate: number,
  usdExchangeRate: number
): number {
  if (!showWithRecharge) return price
  return (price * priceRate) / usdExchangeRate
}

/**
 * Format token-based price for display
 */
export function formatPrice(
  model: PricingModel,
  type: PriceType,
  tokenUnit: TokenUnit,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  selectedGroup?: string,
  showCurrencySymbol = true
): string {
  if (model.quota_type === QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const displayGroupRatio = getDisplayGroupRatio(model, selectedGroup)

  let priceInUSD = calculateTokenPrice(model, type, displayGroupRatio)
  priceInUSD = applyRechargeRate(
    priceInUSD,
    showWithRecharge,
    priceRate,
    usdExchangeRate
  )

  const price = priceInUSD / TOKEN_UNIT_DIVISORS[tokenUnit]
  return formatBillingCurrencyFromUSD(price, {
    showSymbol: showCurrencySymbol,
    digitsLarge: 4,
    digitsSmall: 6,
    abbreviate: false,
  })
}

/**
 * Format price for a specific group (token-based)
 */
export function formatGroupPrice(
  model: PricingModel,
  group: string,
  type: PriceType,
  tokenUnit: TokenUnit,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  groupRatio: Record<string, number>
): string {
  if (model.quota_type === QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const ratio = getConfiguredGroupRatio(groupRatio, group)
  let priceInUSD = calculateTokenPrice(model, type, ratio)

  priceInUSD = applyRechargeRate(
    priceInUSD,
    showWithRecharge,
    priceRate,
    usdExchangeRate
  )

  const price = priceInUSD / TOKEN_UNIT_DIVISORS[tokenUnit]
  return formatBillingCurrencyFromUSD(price, {
    digitsLarge: 4,
    digitsSmall: 6,
    abbreviate: false,
  })
}

/**
 * Format fixed price for pay-per-request models (with specific group)
 */
export function formatFixedPrice(
  model: PricingModel,
  group: string,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  groupRatio: Record<string, number>
): string {
  if (model.quota_type !== QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const ratio = getConfiguredGroupRatio(groupRatio, group)
  let priceInUSD = (model.model_price || 0) * ratio

  priceInUSD = applyRechargeRate(
    priceInUSD,
    showWithRecharge,
    priceRate,
    usdExchangeRate
  )

  return formatBillingCurrencyFromUSD(priceInUSD, {
    digitsLarge: 4,
    digitsSmall: 4,
    abbreviate: false,
  })
}

/**
 * Format fixed price for pay-per-request models (minimum price from all groups)
 */
export function formatRequestPrice(
  model: PricingModel,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  selectedGroup?: string,
  showCurrencySymbol = true
): string {
  if (model.quota_type !== QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const displayGroupRatio = getDisplayGroupRatio(model, selectedGroup)

  let priceInUSD = (model.model_price || 0) * displayGroupRatio

  priceInUSD = applyRechargeRate(
    priceInUSD,
    showWithRecharge,
    priceRate,
    usdExchangeRate
  )

  return formatBillingCurrencyFromUSD(priceInUSD, {
    showSymbol: showCurrencySymbol,
    digitsLarge: 4,
    digitsSmall: 4,
    abbreviate: false,
  })
}

/**
 * Official (standard) price — the model's list price at `group_ratio = 1`,
 * i.e. before any user-group discount/markup is applied. This is the upstream
 * official price the platform owner configured in the ratio table. No backend
 * change required: `model_ratio` already carries this value.
 */
export function formatOfficialPrice(
  model: PricingModel,
  type: PriceType,
  tokenUnit: TokenUnit,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  showCurrencySymbol = true
): string {
  if (model.quota_type === QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const priceInUSD = calculateTokenPrice(model, type, 1)

  const price = applyRechargeRate(
    priceInUSD,
    showWithRecharge,
    priceRate,
    usdExchangeRate
  )

  return formatBillingCurrencyFromUSD(price / TOKEN_UNIT_DIVISORS[tokenUnit], {
    showSymbol: showCurrencySymbol,
    digitsLarge: 4,
    digitsSmall: 6,
    abbreviate: false,
  })
}

/**
 * Official (standard) price for pay-per-request models at `group_ratio = 1`.
 */
export function formatOfficialRequestPrice(
  model: PricingModel,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  showCurrencySymbol = true
): string {
  if (model.quota_type !== QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const priceInUSD = (model.model_price || 0) * 1

  const price = applyRechargeRate(
    priceInUSD,
    showWithRecharge,
    priceRate,
    usdExchangeRate
  )

  return formatBillingCurrencyFromUSD(price, {
    showSymbol: showCurrencySymbol,
    digitsLarge: 4,
    digitsSmall: 4,
    abbreviate: false,
  })
}

/**
 * Official price for token models at an explicit reference ratio (e.g. the
 * selected pricing preset's model_ratio), used by the plaza discount badge.
 */
export function formatOfficialPriceAtRatio(
  model: PricingModel,
  type: PriceType,
  ratio: number,
  tokenUnit: TokenUnit,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  showCurrencySymbol = true
): string {
  if (model.quota_type === QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }
  const priceInUSD = calculateTokenPrice(model, type, ratio)
  const price = applyRechargeRate(
    priceInUSD,
    showWithRecharge,
    priceRate,
    usdExchangeRate
  )
  return formatBillingCurrencyFromUSD(price / TOKEN_UNIT_DIVISORS[tokenUnit], {
    showSymbol: showCurrencySymbol,
    digitsLarge: 4,
    digitsSmall: 6,
    abbreviate: false,
  })
}

/**
 * Official reference ratio (model_ratio) for a model from the selected pricing
 * preset. Used by the plaza discount badge. Returns undefined when the preset
 * has no entry for the model.
 */
export function getOfficialReferenceRatio(
  model: PricingModel,
  officialPrices?: Record<string, Record<string, number>>
): number | undefined {
  const ref = officialPrices?.[model.model_name]
  if (
    ref &&
    typeof ref.model_ratio === 'number' &&
    Number.isFinite(ref.model_ratio)
  ) {
    return ref.model_ratio
  }
  return undefined
}

// ----------------------------------------------------------------------------
// Official preset (官方价格) helpers
//
// The platform's own price data may carry an admin-applied discount (the
// editor bakes the折后价 into model_ratio / billing_expr), so the plaza's
// "official" row must be derived from the pricing preset's ratio fields —
// never from the platform's own prices.
// ----------------------------------------------------------------------------

/** USD price per 1M tokens for a plaza price type, from preset ratios. */
export function getOfficialPresetTokenUSD(
  entry: Record<string, number> | undefined,
  type: PriceType
): number {
  if (!entry) return Number.NaN
  const modelRatio = entry.model_ratio
  if (
    typeof modelRatio !== 'number' ||
    !Number.isFinite(modelRatio) ||
    modelRatio <= 0
  ) {
    return Number.NaN
  }
  const base = modelRatio * 2
  const ratioOf = (key: string): number => {
    const value = entry[key]
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? value
      : Number.NaN
  }
  switch (type) {
    case 'input':
      return base
    case 'output':
      return base * ratioOf('completion_ratio')
    case 'cache':
      return base * ratioOf('cache_ratio')
    case 'create_cache':
      return base * ratioOf('create_cache_ratio')
    case 'image':
      return base * ratioOf('image_ratio')
    case 'audio_input':
      return base * ratioOf('audio_ratio')
    case 'audio_output': {
      const audio = ratioOf('audio_ratio')
      const audioCompletion = ratioOf('audio_completion_ratio')
      return audio * audioCompletion
    }
  }
}

/** USD price per request from the preset's model_price. NaN when absent. */
export function getOfficialPresetRequestUSD(
  entry: Record<string, number> | undefined
): number {
  const price = entry?.model_price
  return typeof price === 'number' && Number.isFinite(price) && price > 0
    ? price
    : Number.NaN
}

/** Format a USD per-1M-token price with the plaza's display semantics. */
export function formatUSDTokenPrice(
  usdPerMillionTokens: number,
  tokenUnit: TokenUnit,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  showCurrencySymbol = true
): string {
  const price = applyRechargeRate(
    usdPerMillionTokens,
    showWithRecharge,
    priceRate,
    usdExchangeRate
  )
  return formatBillingCurrencyFromUSD(price / TOKEN_UNIT_DIVISORS[tokenUnit], {
    showSymbol: showCurrencySymbol,
    digitsLarge: 4,
    digitsSmall: 6,
    abbreviate: false,
  })
}

/** Format a USD per-request price with the plaza's display semantics. */
export function formatUSDRequestPrice(
  usd: number,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  showCurrencySymbol = true
): string {
  const price = applyRechargeRate(
    usd,
    showWithRecharge,
    priceRate,
    usdExchangeRate
  )
  return formatBillingCurrencyFromUSD(price, {
    showSymbol: showCurrencySymbol,
    digitsLarge: 4,
    digitsSmall: 4,
    abbreviate: false,
  })
}

/**
 * Cheapest token-tier input price (USD per 1M) encoded in the model's
 * billing expression, or null when the model is not expression-billed with
 * token tiers. Request-only tiers are ignored.
 */
function getDynamicInputPriceUSD(model: PricingModel): number | null {
  if (!model.billing_expr) return null
  const values: number[] = []
  for (const tier of getDynamicPricingTiers(model)) {
    if ('unitPrices' in tier) continue
    if (tier.billingUnit === 'request') continue
    const value = Number(tier.inputPrice)
    if (Number.isFinite(value) && value >= 0) values.push(value)
  }
  return values.length > 0 ? Math.min(...values) : null
}

export type DiscountInfo = {
  hasDiscount: boolean
  /** Percentage saved vs official, e.g. 10 for "省 10%". */
  percent: number
  /** Chinese "zhe" multiplier, e.g. 9 for a 0.9 price ratio (rendered `x0.9`). */
  zhe: number
  /**
   * 溢价倍数（Uter 价 ÷ 官方价），**只在严格大于 1 时非空**。
   *
   * 角标过去只表达「比官方便宜」：算出来比官方贵时什么都不显示，用户看到的
   * 是一张没有任何提示的卡片，无法判断自己正在被加价。这里把同一个比例反向
   * 暴露出来，调用点据此渲染 `x1.05` 这类溢价角标。
   *
   * 已按两位小数取整并过滤：取整后 ≤ 1（即溢价 < 0.5%）返回 null —— 否则会
   * 渲染出 `x1.00` 这种「显示加价但数字看不出加价」的角标。
   */
  markup: number | null
  /**
   * 原始比价结果（Uter 价 ÷ 官方价），**只在存在官方参照价时非空**。
   *
   * 折扣/溢价角标各取比例的一侧，比值恰好为 1（或小到两位小数取整回 1）时
   * 两侧都不表达 —— 调用点据此渲染中性的 `x1.0`「与官方价一致」角标，而不是
   * 什么都没有（2026-11-02 定价广场用户反馈 seedance-2.0-ab「缺失折扣角标」）。
   * 没有官方参照（无从比价）时为 null，此时不得渲染 x1.0。
   */
  ratio: number | null
}

/**
 * 单维度溢价倍数：`uterUSD ÷ officialUSD`，两位小数取整后仍 > 1 才返回。
 *
 * 与 `DiscountInfo.markup` 同一口径（同一个取整规则），保证「模型名后的角标」
 * 与「价格行里的角标」不会一个说 x1.05、另一个说 x1.00。
 */
export function getMarkupMultiplier(
  uter: number,
  official: number
): number | null {
  if (
    !Number.isFinite(uter) ||
    !Number.isFinite(official) ||
    official <= 0 ||
    uter <= 0
  ) {
    return null
  }
  const rounded = Math.round((uter / official) * 100) / 100
  return rounded > 1 ? rounded : null
}

/**
 * 由「Uter 价 ÷ 官方价」的比值派生角标数据。
 *
 * 折扣与溢价是同一个比例的两侧，必须从同一个 ratio 派生，否则会出现
 * 「打了 8 折却显示 x1.05」这种自相矛盾的角标。
 */
function badgeFromRatio(ratio: number): DiscountInfo {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return {
      hasDiscount: false,
      percent: 0,
      zhe: 10,
      markup: null,
      ratio: null,
    }
  }
  if (ratio < 1 - 1e-9) {
    return {
      hasDiscount: true,
      percent: (1 - ratio) * 100,
      zhe: ratio * 10,
      markup: null,
      ratio,
    }
  }
  // 两位小数取整后仍然 > 1 才算「看得见的溢价」。
  const rounded = Math.round(ratio * 100) / 100
  return {
    hasDiscount: false,
    percent: 0,
    zhe: 10,
    markup: rounded > 1 ? rounded : null,
    ratio,
  }
}

/**
 * Compare the platform price (model_ratio adjusted by the viewer's group
 * ratio) against the official preset price. A discount exists when the
 * platform price is lower than the official price; a markup (`x1.05`) exists
 * when it is higher.
 *
 * When the selected pricing preset has no entry for this model, fall back to
 * comparing the group-adjusted price against the platform list price
 * (group_ratio = 1), so models discounted only via group ratio still show
 * the `x0.9` badge.
 */
export function getDiscountInfo(
  model: PricingModel,
  officialPrices?: Record<string, Record<string, number>>,
  selectedGroup?: string
): DiscountInfo {
  const official = getOfficialReferenceRatio(model, officialPrices)
  const platform = model.model_ratio
  const displayRatio = getDisplayGroupRatio(model, selectedGroup)

  // Pay-per-request models (image / video) carry their price in `model_price`
  // rather than `model_ratio`, so the ratio comparison below can never see
  // them — every such card used to render without a discount badge even when
  // the platform sells it below the upstream catalogue price.
  if (model.quota_type === QUOTA_TYPE_VALUES.REQUEST) {
    const officialRequest = officialPrices?.[model.model_name]?.model_price
    const platformRequest = model.model_price
    if (
      typeof officialRequest === 'number' &&
      Number.isFinite(officialRequest) &&
      officialRequest > 0 &&
      typeof platformRequest === 'number' &&
      Number.isFinite(platformRequest) &&
      platformRequest > 0
    ) {
      return badgeFromRatio((platformRequest * displayRatio) / officialRequest)
    }
    return {
      hasDiscount: false,
      percent: 0,
      zhe: 10,
      markup: null,
      ratio: null,
    }
  }

  // Expression-billed models keep the admin discount inside billing_expr
  // (model_ratio is not the effective price), so compare the cheapest token
  // tier's input price against the preset's input price instead.
  const dynamicInputUSD = getDynamicInputPriceUSD(model)
  if (
    official != null &&
    Number.isFinite(official) &&
    official > 0 &&
    dynamicInputUSD != null
  ) {
    const officialInputUSD = official * 2
    const effectiveInputUSD = dynamicInputUSD * displayRatio
    if (Number.isFinite(effectiveInputUSD) && effectiveInputUSD > 0) {
      return badgeFromRatio(effectiveInputUSD / officialInputUSD)
    }
    return {
      hasDiscount: false,
      percent: 0,
      zhe: 10,
      markup: null,
      ratio: null,
    }
  }

  if (
    official != null &&
    Number.isFinite(official) &&
    official > 0 &&
    Number.isFinite(platform) &&
    platform > 0
  ) {
    return badgeFromRatio((platform * displayRatio) / official)
  }

  if (
    Number.isFinite(platform) &&
    platform > 0 &&
    displayRatio > 0 &&
    displayRatio < 1
  ) {
    return {
      hasDiscount: true,
      percent: (1 - displayRatio) * 100,
      zhe: displayRatio * 10,
      markup: null,
      // 无官方参照，仅组倍率折扣：无从比价，不提供 ratio。
      ratio: null,
    }
  }

  return {
    hasDiscount: false,
    percent: 0,
    zhe: 10,
    markup: null,
    ratio: null,
  }
}
