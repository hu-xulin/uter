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

For commercial licensing, please contact support@Uter.ai.com
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
function calculateTokenPrice(
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
  const price = applyRechargeRate(priceInUSD, showWithRecharge, priceRate, usdExchangeRate)
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
  if (ref && typeof ref.model_ratio === 'number' && Number.isFinite(ref.model_ratio)) {
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
  const price = applyRechargeRate(usd, showWithRecharge, priceRate, usdExchangeRate)
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
  /** Chinese "zhe" multiplier, e.g. 9 for "9折". */
  zhe: number
}

/**
 * Compare the platform price (model_ratio adjusted by the viewer's group
 * ratio) against the official preset price. A discount exists when the
 * platform price is lower than the official price.
 *
 * When the selected pricing preset has no entry for this model, fall back to
 * comparing the group-adjusted price against the platform list price
 * (group_ratio = 1), so models discounted only via group ratio still show
 * the "xx折" badge.
 */
export function getDiscountInfo(
  model: PricingModel,
  officialPrices?: Record<string, Record<string, number>>,
  selectedGroup?: string
): DiscountInfo {
  const official = getOfficialReferenceRatio(model, officialPrices)
  const platform = model.model_ratio
  const displayRatio = getDisplayGroupRatio(model, selectedGroup)

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
    if (
      Number.isFinite(effectiveInputUSD) &&
      effectiveInputUSD > 0 &&
      effectiveInputUSD < officialInputUSD - 1e-9
    ) {
      const ratio = effectiveInputUSD / officialInputUSD
      return {
        hasDiscount: true,
        percent: (1 - ratio) * 100,
        zhe: ratio * 10,
      }
    }
    return { hasDiscount: false, percent: 0, zhe: 10 }
  }

  if (
    official != null &&
    Number.isFinite(official) &&
    official > 0 &&
    Number.isFinite(platform) &&
    platform > 0
  ) {
    const effectivePlatform = platform * displayRatio
    if (effectivePlatform < official - 1e-9) {
      const ratio = effectivePlatform / official
      return {
        hasDiscount: true,
        percent: (1 - ratio) * 100,
        zhe: ratio * 10,
      }
    }
    return { hasDiscount: false, percent: 0, zhe: 10 }
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
    }
  }

  return { hasDiscount: false, percent: 0, zhe: 10 }
}
