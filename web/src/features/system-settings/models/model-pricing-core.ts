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
import * as z from 'zod'

import {
  formatPricingAmount,
  USD_PRICING_CURRENCY,
  type PricingCurrency,
} from '@/features/model-pricing/currency'
import type {
  CacheWriteMode,
  LegacyBillingDetails,
} from '@/features/model-pricing/pricing'
import { combineBillingExpr } from '@/features/pricing/lib/billing-expr'
import { formatBillingCondition } from '@/features/pricing/lib/billing-expression/condition-display'

import { formatPricingNumber } from './pricing-format'

export const createModelPricingSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(1, t('Model name is required')),
    price: z.string().optional(),
    ratio: z.string().optional(),
    cacheRatio: z.string().optional(),
    createCacheRatio: z.string().optional(),
    completionRatio: z.string().optional(),
    imageRatio: z.string().optional(),
    audioRatio: z.string().optional(),
    audioCompletionRatio: z.string().optional(),
  })

export type ModelPricingFormValues = z.infer<
  ReturnType<typeof createModelPricingSchema>
>

export type PricingMode = 'per-token' | 'per-request' | 'tiered_expr'

export type LaneKey =
  | 'completion'
  | 'cache'
  | 'createCache'
  | 'image'
  | 'audioInput'
  | 'audioOutput'

export type ModelRatioData = {
  pluginBillingExpr?: Record<string, string>
  name: string
  price?: string
  ratio?: string
  cacheRatio?: string
  createCacheRatio?: string
  completionRatio?: string
  imageRatio?: string
  audioRatio?: string
  audioCompletionRatio?: string
  billingMode?: PricingMode
  billingExpr?: string
  requestRuleExpr?: string
}

export type PreviewRow = {
  unit?: 'image' | 'none'
  key: string
  label: string
  value: string
  multiline?: boolean
}

export const EMPTY_LANE_PRICES: Record<LaneKey, string> = {
  completion: '',
  cache: '',
  createCache: '',
  image: '',
  audioInput: '',
  audioOutput: '',
}

export const EMPTY_LANE_ENABLED: Record<LaneKey, boolean> = {
  completion: false,
  cache: false,
  createCache: false,
  image: false,
  audioInput: false,
  audioOutput: false,
}

export const ratioFieldByLane: Record<LaneKey, keyof ModelPricingFormValues> = {
  completion: 'completionRatio',
  cache: 'cacheRatio',
  createCache: 'createCacheRatio',
  image: 'imageRatio',
  audioInput: 'audioRatio',
  audioOutput: 'audioCompletionRatio',
}

export const laneConfigs: Array<{
  key: LaneKey
  titleKey: string
  descriptionKey: string
  placeholder: string
}> = [
  {
    key: 'completion',
    titleKey: 'Completion price',
    descriptionKey: 'Output token price for generated tokens.',
    placeholder: '15',
  },
  {
    key: 'cache',
    titleKey: 'Cache read price',
    descriptionKey: 'Token price for cache reads.',
    placeholder: '0.3',
  },
  {
    key: 'createCache',
    titleKey: 'Cache write price',
    descriptionKey: 'Token price for creating cache entries.',
    placeholder: '3.75',
  },
  {
    key: 'image',
    titleKey: 'Image input price',
    descriptionKey: 'Token price for image input.',
    placeholder: '2.5',
  },
  {
    key: 'audioInput',
    titleKey: 'Audio input price',
    descriptionKey: 'Token price for audio input.',
    placeholder: '3.81',
  },
  {
    key: 'audioOutput',
    titleKey: 'Audio output price',
    descriptionKey: 'Token price for audio output.',
    placeholder: '15.11',
  },
]

export function hasValue(value: unknown): boolean {
  return (
    value !== '' && value !== null && value !== undefined && value !== false
  )
}

export function toNumberOrNull(value: unknown): number | null {
  if (!hasValue(value) && value !== 0) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

// ----------------------------------------------------------------------------
// Official price reference & discount
//
// The public pricing plaza exposes an "official price" preset (selected via the
// PricingSource option) as `official_prices`: a `model -> field -> ratio` map
// carrying the same ratio fields used by the platform (model_ratio,
// completion_ratio, cache_ratio, ...). The platform's own (editable) price is
// the "Uter price" (优特定价). The discount per dimension is the Uter price
// divided by the official price — i.e. the ratio of the two ratio products,
// which is currency-independent because the $2-per-1M baseline cancels out.
// ----------------------------------------------------------------------------

export type OfficialRatios = Record<string, number>

/**
 * Maps each editable price dimension (the input price plus every lane) to the
 * snake_case ratio field used by the official preset.
 */
export const DIMENSION_OFFICIAL_FIELD: Record<
  'input' | LaneKey,
  keyof OfficialRatios
> = {
  input: 'model_ratio',
  completion: 'completion_ratio',
  cache: 'cache_ratio',
  createCache: 'create_cache_ratio',
  image: 'image_ratio',
  audioInput: 'audio_ratio',
  audioOutput: 'audio_completion_ratio',
}

export type DiscountTone = 'discount' | 'markup' | 'flat'

export type DimensionDiscount = {
  tone: DiscountTone
  /** Percentage difference vs official: positive when Uter is cheaper. */
  percent: number
  /** Chinese "zhe" multiplier (×10), e.g. 9 for 9折. Only for discounts. */
  zhe?: number
}

/**
 * Official token price in USD per 1M tokens for a dimension, derived from the
 * official preset ratios. Token prices follow new-api's $2-per-1M baseline:
 * base = model_ratio * 2, dimension price = base * dimension_ratio. Returns
 * null when the preset has no usable ratio for the dimension.
 */
export function officialDimensionPriceUSD(
  official: OfficialRatios | undefined,
  dimension: keyof typeof DIMENSION_OFFICIAL_FIELD
): number | null {
  if (!official) return null
  const modelRatio = official['model_ratio']
  if (
    typeof modelRatio !== 'number' ||
    !Number.isFinite(modelRatio) ||
    modelRatio <= 0
  ) {
    return null
  }
  const dimRatio = official[DIMENSION_OFFICIAL_FIELD[dimension]]
  if (
    typeof dimRatio !== 'number' ||
    !Number.isFinite(dimRatio) ||
    dimRatio <= 0
  ) {
    return null
  }
  return modelRatio * 2 * dimRatio
}

/**
 * Official fixed (per-request) price in USD, taken directly from the preset's
 * model_price. Returns null when the preset has no usable value.
 */
export function officialRequestPriceUSD(
  official: OfficialRatios | undefined
): number | null {
  if (!official) return null
  const price = official['model_price']
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return null
  }
  return price
}

/**
 * Discount of a Uter price vs the official price for the same dimension.
 * Returns null when either side is missing or the official price is zero.
 */
export function computeDimensionDiscount(
  uterPrice: number | null,
  officialPrice: number | null
): DimensionDiscount | null {
  if (
    uterPrice == null ||
    officialPrice == null ||
    !Number.isFinite(uterPrice) ||
    !Number.isFinite(officialPrice) ||
    officialPrice <= 0
  ) {
    return null
  }
  if (uterPrice <= 0) {
    return { tone: 'flat', percent: 0 }
  }
  const ratio = uterPrice / officialPrice
  if (Math.abs(ratio - 1) < 1e-9) return { tone: 'flat', percent: 0 }
  if (ratio < 1) {
    return {
      tone: 'discount',
      percent: (1 - ratio) * 100,
      zhe: ratio * 10,
    }
  }
  return { tone: 'markup', percent: (ratio - 1) * 100 }
}

function ratioToBasePrice(ratio: unknown): string {
  const num = toNumberOrNull(ratio)
  if (num === null) return ''
  return formatPricingNumber(num * 2)
}

function deriveLanePrice(
  ratio: unknown,
  denominator: unknown,
  fallback = ''
): string {
  const ratioNumber = toNumberOrNull(ratio)
  const denominatorNumber = toNumberOrNull(denominator)
  if (ratioNumber === null || denominatorNumber === null) return fallback
  return formatPricingNumber(ratioNumber * denominatorNumber)
}

export function createInitialLaneState(data?: ModelRatioData | null) {
  if (!data) {
    return {
      promptPrice: '',
      prices: { ...EMPTY_LANE_PRICES },
      enabled: { ...EMPTY_LANE_ENABLED },
    }
  }

  const promptPrice = ratioToBasePrice(data.ratio)
  const audioInputPrice = deriveLanePrice(data.audioRatio, promptPrice)
  const prices: Record<LaneKey, string> = {
    completion: deriveLanePrice(data.completionRatio, promptPrice),
    cache: deriveLanePrice(data.cacheRatio, promptPrice),
    createCache: deriveLanePrice(data.createCacheRatio, promptPrice),
    image: deriveLanePrice(data.imageRatio, promptPrice),
    audioInput: audioInputPrice,
    audioOutput: deriveLanePrice(data.audioCompletionRatio, audioInputPrice),
  }

  return {
    promptPrice,
    prices,
    enabled: {
      completion: hasValue(data.completionRatio),
      cache: hasValue(data.cacheRatio),
      createCache: hasValue(data.createCacheRatio),
      image: hasValue(data.imageRatio),
      audioInput: hasValue(data.audioRatio),
      audioOutput: hasValue(data.audioCompletionRatio),
    },
  }
}

export function buildPreviewRows(
  values: ModelPricingFormValues,
  mode: PricingMode,
  billingExpr: string,
  requestRuleExpr: string,
  promptPrice: string,
  lanePrices: Record<LaneKey, string>,
  laneEnabled: Record<LaneKey, boolean>,
  t: (key: string) => string,
  currency: PricingCurrency = USD_PRICING_CURRENCY,
  cacheWriteMode?: CacheWriteMode,
  billingDetails?: LegacyBillingDetails
): PreviewRow[] {
  if (mode === 'tiered_expr') {
    const effectiveExpr = combineBillingExpr(billingExpr, requestRuleExpr)
    return [
      { key: 'mode', label: t('Pricing'), value: t('Expression') },
      {
        key: 'expr',
        label: `${t('Expression')} (USD)`,
        value: effectiveExpr || t('Empty'),
        multiline: true,
      },
    ]
  }

  if (mode === 'per-request') {
    return [
      {
        key: 'price',
        label: billingDetails?.image_count
          ? t('Price per image')
          : t('Fixed price'),
        ...(billingDetails?.image_count ? { unit: 'image' as const } : {}),
        value: values.price
          ? formatPricingAmount(values.price, currency)
          : t('Empty'),
      },
      ...pricingAdjustmentRows(billingDetails, t),
    ]
  }

  let audioInputValue =
    laneEnabled.audioInput && lanePrices.audioInput
      ? formatPricingAmount(lanePrices.audioInput, currency)
      : t('Empty')
  let audioOutputValue =
    laneEnabled.audioOutput && lanePrices.audioOutput
      ? formatPricingAmount(lanePrices.audioOutput, currency)
      : t('Empty')
  if (billingDetails?.audio_input_price !== undefined) {
    audioInputValue = formatPricingAmount(
      billingDetails.audio_input_price,
      currency
    )
  }
  if (billingDetails?.audio_output_price !== undefined) {
    audioOutputValue = formatPricingAmount(
      billingDetails.audio_output_price,
      currency
    )
  }
  const rows: PreviewRow[] = [
    {
      key: 'inputPrice',
      label: t('Input price'),
      value: promptPrice
        ? formatPricingAmount(promptPrice, currency)
        : t('Empty'),
    },
    {
      key: 'completion',
      label: t('Completion price'),
      value:
        laneEnabled.completion && lanePrices.completion
          ? formatPricingAmount(lanePrices.completion, currency)
          : t('Empty'),
    },
    {
      key: 'cache',
      label: t('Cache read price'),
      value:
        laneEnabled.cache && lanePrices.cache
          ? formatPricingAmount(lanePrices.cache, currency)
          : t('Empty'),
    },
    {
      key: 'createCache',
      label:
        cacheWriteMode === 'claude_ttl'
          ? t('Cache Creation (5m)')
          : t('Cache write price'),
      value:
        laneEnabled.createCache && lanePrices.createCache
          ? formatPricingAmount(lanePrices.createCache, currency)
          : t('Empty'),
    },
    {
      key: 'image',
      label: t('Image input price'),
      value:
        laneEnabled.image && lanePrices.image
          ? formatPricingAmount(lanePrices.image, currency)
          : t('Empty'),
    },
    {
      key: 'audio',
      label: t('Audio input price'),
      value: audioInputValue,
    },
    {
      key: 'audioCompletion',
      label: t('Audio output price'),
      value: audioOutputValue,
    },
  ]
  if (
    cacheWriteMode === 'claude_ttl' &&
    laneEnabled.createCache &&
    lanePrices.createCache
  ) {
    rows.splice(4, 0, {
      key: 'createCache1h',
      label: t('Cache create (1h) price'),
      value: formatPricingAmount(
        Number(lanePrices.createCache) * (6 / 3.75),
        currency
      ),
    })
  }
  const showCacheWrite = cacheWriteMode
    ? cacheWriteMode !== 'none'
    : hasValue(values.createCacheRatio)
  const imageRatio = toNumberOrNull(values.imageRatio) ?? 1
  const cacheRatio = toNumberOrNull(values.cacheRatio) ?? 1
  return [
    ...rows.filter(
      (row) =>
        (row.key !== 'image' || imageRatio !== 1) &&
        (row.key !== 'cache' || cacheRatio !== 1) &&
        (row.key !== 'createCache' || showCacheWrite)
    ),
    ...pricingAdjustmentRows(billingDetails, t),
  ]
}

export function pricingAdjustmentRows(
  details: LegacyBillingDetails | undefined,
  t: (key: string) => string
): PreviewRow[] {
  const rows: PreviewRow[] = []
  if (details?.audio_text_branches) {
    rows.push({
      key: 'audioTextBranches',
      label: t('Pricing'),
      value: t('Audio and text-only requests keep their respective pricing.'),
      unit: 'none',
    })
  }
  if (details?.image_count) {
    rows.push({
      key: 'imageCount',
      label: t('Image count'),
      value: t('Reserve requested images; settle returned images.'),
      unit: 'none',
    })
  }
  for (const [index, rule] of (details?.request_rules ?? []).entries()) {
    rows.push({
      key: `adjustment-${index}`,
      label: formatBillingCondition(rule.condition, t) || rule.condition,
      value: `× ${rule.multiplier}`,
      unit: 'none',
    })
  }
  return rows
}
