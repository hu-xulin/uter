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

import { TOKEN_UNIT_DIVISORS } from '../constants'
import type {
  BillingUsageSchema,
  BillingUsageUnit,
  PricingModel,
  TokenUnit,
} from '../types'
import {
  BILLING_PRICING_VARS,
  getCurrentTimePricingTiers,
  parseTiersFromExpr,
  splitBillingExprAndRequestRules,
  tryParseRequestRuleExpr,
  type BillingVar,
  type ParsedTaskTier,
  type ParsedTier,
} from './billing-expr'
import { compileBillingExpression } from './billing-expression/parser'
import { getCachePriceLabels, getCachePricingMode } from './cache-pricing'
import { getDisplayGroupRatio } from './model-helpers'
import { withPluginPricing } from './plugin-pricing'
import {
  evaluateTaskVisualConfig,
  getTaskNumberFields,
  tryParseTaskVisualConfig,
} from './task-expr'
import { getTaskPricingDisplayTiers } from './task-matrix-display'

export type DynamicPriceOptions = {
  tokenUnit: TokenUnit
  modelName?: string
  showCurrencySymbol?: boolean
  showRechargePrice?: boolean
  priceRate?: number
  usdExchangeRate?: number
  groupRatioMultiplier?: number
  usageSchema?: BillingUsageSchema
  now?: Date
}

export type DynamicPriceLabelKind = 'i18n' | 'schema'

export type DynamicPriceEntry = {
  key: string
  field: string
  label: string
  shortLabel: string
  /** `schema` labels are raw usage-field names and must not go through `t()`. */
  labelKind: DynamicPriceLabelKind
  value: number
  formatted: string
  formattedRange?: string
  minValue?: number
  maxValue?: number
  unit: 'token' | BillingUsageUnit | 'request' | 'image'
  unitLabel?: string | Record<string, string>
  variable?: BillingVar
  description?: string | Record<string, string>
}

export type CardExamplePrice = {
  label: string
  total: number
  formatted: string
}

export type DynamicPricingTier = ParsedTier | ParsedTaskTier

export type DynamicPricingSummary = {
  tiers: DynamicPricingTier[]
  tier: DynamicPricingTier | null
  tierCount: number
  hasRequestRules: boolean
  isSpecialExpression: boolean
  rawExpression: string
  entries: DynamicPriceEntry[]
  primaryEntries: DynamicPriceEntry[]
  secondaryEntries: DynamicPriceEntry[]
  isTaskUsage: boolean
  isTimePricing?: boolean
  isMixedBilling?: boolean
  providerCount?: number
  hasUnconfiguredProviders?: boolean
}

export function getTaskUsageQuantityUnitLabelKey(
  unit: BillingUsageUnit | undefined
): string {
  if (unit === 'second') return 's'
  if (unit === 'token') return 'token (unit)'
  if (unit === 'credit') return 'credit'
  return 'unit'
}

export function getTaskUsagePriceUnitLabelKey(
  unit: BillingUsageUnit | undefined
): string {
  if (unit === 'second') return 'second'
  if (unit === 'token') return '1M token'
  if (unit === 'credit') return 'credit'
  return 'unit'
}

export function getDynamicPriceUnitLabelKey(
  entry: DynamicPriceEntry
): string | null {
  if (entry.unit === 'second') return 's'
  if (entry.unit === 'count') return 'unit'
  if (entry.unit === 'credit') return 'credit'
  // Chat token entries also use unit 'token' but keep the 1M-token label.
  if (entry.unit === 'token' && !entry.variable) return '1M token'
  if (entry.unit === 'request') return 'request'
  if (entry.unit === 'image') return 'image'
  return null
}

const PRIMARY_DYNAMIC_FIELDS = new Set(['inputPrice', 'outputPrice'])

function isTaskPricingTier(tier: DynamicPricingTier): tier is ParsedTaskTier {
  return (
    Object.hasOwn(tier, 'unitPrices') &&
    typeof (tier as ParsedTaskTier).unitPrices === 'object'
  )
}

export function isDynamicPricingModel(model: PricingModel): boolean {
  if (model.billing_plugin_variants?.length) {
    return model.billing_plugin_variants.some(
      (variant) =>
        variant.billing_mode !== 'ratio' && Boolean(variant.billing_expr)
    )
  }
  return model.billing_mode === 'tiered_expr' && Boolean(model.billing_expr)
}

export function hasTaskUsageSchema(model: PricingModel): boolean {
  return Object.keys(model.billing_usage_schema ?? {}).length > 0
}

const INFERABLE_USAGE_FIELDS = new Set([
  'duration',
  'second',
  'seconds',
  'video_duration',
  'audio_duration',
  'clips',
  'images',
  'image_count',
  'characters',
])

/**
 * 部分上游（uterroute）用 tiered_expr + 用量计费，却不下发 billing_usage_schema。
 * 条件 tier 表达式落到简化解析器会返回空档位，卡片因此把整条公式直接展示出来。
 * 从 `tier("label", <field> * <number>)` 推断用量字段并补齐 schema，让 task
 * 解析器还原可读价格档位（如 MiniMax-H3 的 duration 秒价）。
 *
 * 两种情形生效：① 完全没有 schema；② 已有 schema 但没有任何 second 用量
 * 字段、而表达式用 duration/second 乘数。若 schema 已声明 second 字段则保持
 * 原样（额外补第二个会让 secondsField 产生歧义）。普通 token/请求计费表达式
 * 原样返回。
 */
export function withInferredUsageSchema(model: PricingModel): PricingModel {
  if (model.billing_mode !== 'tiered_expr' || !model.billing_expr) {
    return model
  }
  const fields = new Set<string>()
  const tierUsage =
    /\btier\(\s*(?:"[^"]*"|'[^']*')\s*,\s*([A-Za-z_$][\w$]*)\s*\*/g
  for (const match of model.billing_expr.matchAll(tierUsage)) {
    // Only unmistakable task-usage dimensions qualify. Token expressions use
    // short aliases such as `p` / `c` and must stay on the token parser.
    if (INFERABLE_USAGE_FIELDS.has(match[1].toLowerCase())) {
      fields.add(match[1])
    }
  }
  if (fields.size === 0) return model
  const existing = model.billing_usage_schema ?? {}
  // 已有 schema 时，只有当它**没有**任何 second 用量字段、而表达式的 tier
  // 乘数用的是 duration/second 时，才补一个可推断的秒字段。
  // 注意：secondsField() 要求 schema 中恰好一个 second 字段才能把裸
  // `duration` 解析成秒价。若 schema 已声明 second 字段（哪怕名字不叫
  // duration，如 MiniMax-H3 的 `seconds`），补第二个会造成歧义并让解析
  // 彻底失败——因此这里必须按「是否已有 second 字段」判断，而不是按
  // 「表达式变量名是否在 schema 中」判断。
  const hasSecondField = Object.values(existing).some(
    (definition) => definition.type === 'number' && definition.unit === 'second'
  )
  const secondFields = [...fields].filter((field) =>
    /second|duration|time/i.test(field)
  )
  if (hasSecondField || secondFields.length === 0) return model
  const schema: BillingUsageSchema = { ...existing }
  for (const field of secondFields) {
    schema[field] = { type: 'number', unit: 'second' }
  }
  return { ...model, billing_usage_schema: schema }
}

export function isTaskUsagePricingModel(model: PricingModel): boolean {
  return model.billing_mode === 'tiered_expr' && hasTaskUsageSchema(model)
}

export function isUnconfiguredTaskUsageModel(model: PricingModel): boolean {
  if (model.billing_plugin_variants?.length) {
    return model.billing_plugin_variants.every((variant) =>
      variant.billing_mode === 'ratio'
        ? isUnconfiguredTaskUsageModel(withPluginPricing(model, variant))
        : !variant.billing_expr
    )
  }
  // 只有「有任务用量 schema、无表达式、且没有任何可用定价」才算未配置。
  // doubao-seedance-* 带 resolution/video_input schema，但用量字段里的
  // `tokens`（单位 token）表明它其实按 token 口径计价且 model_ratio 已配置；
  // 过去仅凭「有 schema + 无表达式」就判未配置，会把这类有价模型显示成
  // 「尚未配置定价」。纯任务用量（seconds / clips）模型不受此豁免影响。
  const usesTokenUsage = Object.values(model.billing_usage_schema ?? {}).some(
    (definition) => definition.type === 'number' && definition.unit === 'token'
  )
  if (usesTokenUsage && (model.model_ratio ?? 0) > 0) {
    return false
  }
  // 按秒计费模型（wan3.0-video 等）的定价在 channel_internal_per_second_usd，
  // 不走 billing_expr；卡片已有 per-second 分支展示，并非「未配置定价」。
  if ((model.channel_internal_per_second_usd ?? 0) > 0) {
    return false
  }
  return (
    model.quota_type !== 1 &&
    hasTaskUsageSchema(model) &&
    !isDynamicPricingModel(model)
  )
}

export function getDynamicDisplayGroupRatio(
  model: PricingModel,
  selectedGroup?: string
): number {
  return getDisplayGroupRatio(model, selectedGroup)
}

function applyRechargeRate(
  price: number,
  showWithRecharge: boolean,
  priceRate: number,
  usdExchangeRate: number
): number {
  if (!showWithRecharge) return price
  return (price * priceRate) / usdExchangeRate
}

export function formatDynamicUnitPrice(
  valuePerMillionTokens: number,
  options: DynamicPriceOptions
): string {
  const groupRatio = options.groupRatioMultiplier ?? 1
  const priceRate = options.priceRate ?? 1
  const usdExchangeRate = options.usdExchangeRate ?? 1
  const priceUSD =
    (valuePerMillionTokens * groupRatio) /
    TOKEN_UNIT_DIVISORS[options.tokenUnit]
  const displayPrice = applyRechargeRate(
    priceUSD,
    options.showRechargePrice ?? false,
    priceRate,
    usdExchangeRate
  )

  return formatBillingCurrencyFromUSD(displayPrice, {
    showSymbol: options.showCurrencySymbol ?? true,
    digitsLarge: 4,
    digitsSmall: 6,
    abbreviate: false,
  })
}

export function formatTaskUsageUnitPrice(
  valuePerUnit: number,
  options: DynamicPriceOptions
): string {
  const groupRatio = options.groupRatioMultiplier ?? 1
  const priceRate = options.priceRate ?? 1
  const usdExchangeRate = options.usdExchangeRate ?? 1
  const priceUSD = valuePerUnit * groupRatio
  const displayPrice = applyRechargeRate(
    priceUSD,
    options.showRechargePrice ?? false,
    priceRate,
    usdExchangeRate
  )

  return formatBillingCurrencyFromUSD(displayPrice, {
    showSymbol: options.showCurrencySymbol ?? true,
    digitsLarge: 4,
    digitsSmall: 6,
    abbreviate: false,
  })
}

export function getDynamicPricingTiers(
  model: PricingModel
): DynamicPricingTier[] {
  model = withInferredUsageSchema(model)
  if (model.billing_plugin_variants?.length) {
    return model.billing_plugin_variants.flatMap((variant) =>
      getDynamicPricingTiers(withPluginPricing(model, variant))
    )
  }
  if (!isDynamicPricingModel(model)) return []
  const { billingExpr } = splitBillingExprAndRequestRules(
    model.billing_expr || ''
  )
  if (isTaskUsagePricingModel(model)) {
    return getTaskPricingDisplayTiers(billingExpr, model.billing_usage_schema)
  }
  return parseTiersFromExpr(billingExpr)
}

export function hasDynamicRequestRules(model: PricingModel): boolean {
  if (model.billing_plugin_variants?.length) {
    return model.billing_plugin_variants.some((variant) =>
      hasDynamicRequestRules(withPluginPricing(model, variant))
    )
  }
  if (!isDynamicPricingModel(model)) return false
  const { requestRuleExpr } = splitBillingExprAndRequestRules(
    model.billing_expr || ''
  )
  if (tryParseRequestRuleExpr(requestRuleExpr || '')?.length) return true
  const compiled = compileBillingExpression(model.billing_expr || '')
  return compiled.status === 'ready' && compiled.requestRules.length > 0
}

export function getDynamicPriceEntries(
  tier: DynamicPricingTier | null,
  options: DynamicPriceOptions
): DynamicPriceEntry[] {
  if (!tier) return []
  if (
    !isTaskPricingTier(tier) &&
    tier.billingUnit === 'request' &&
    typeof tier.fixedPrice === 'number'
  ) {
    return [
      {
        key: 'fixed',
        field: 'fixedPrice',
        label: tier.imageCount ? 'Price per image' : 'Price per request',
        shortLabel: tier.imageCount ? 'Per image' : 'Per-call',
        labelKind: 'i18n',
        value: tier.fixedPrice,
        formatted: formatTaskUsageUnitPrice(tier.fixedPrice, options),
        unit: tier.imageCount ? 'image' : 'request',
      },
    ]
  }

  if (isTaskPricingTier(tier) && options.usageSchema) {
    const usageEntries: DynamicPriceEntry[] = getTaskNumberFields(
      options.usageSchema
    ).flatMap(([field, definition]) => {
      const value = Number(tier.unitPrices[field])
      if (!Number.isFinite(value) || value < 0 || !definition.unit) return []
      return [
        {
          key: field,
          field,
          label: field,
          shortLabel: field,
          labelKind: 'schema',
          value,
          formatted: formatTaskUsageUnitPrice(value, options),
          unit: definition.unit,
          unitLabel: definition.unitLabel,
          description: definition.description,
        } satisfies DynamicPriceEntry,
      ]
    })
    if (tier.constant > 0) {
      usageEntries.push({
        key: 'constant',
        field: 'constant',
        label: 'Additional charge',
        shortLabel: 'Additional charge',
        labelKind: 'i18n',
        value: tier.constant,
        formatted: formatTaskUsageUnitPrice(tier.constant, options),
        unit: 'request',
      })
    }
    return usageEntries
  }

  const cacheMode = getCachePricingMode(
    BILLING_PRICING_VARS.filter(
      (variable) =>
        variable.field &&
        typeof (tier as ParsedTier)[variable.field] === 'number'
    ).map((variable) => variable.key),
    options.modelName
  )
  return BILLING_PRICING_VARS.flatMap((variable) => {
    if (!variable.field) return []
    const value = Number((tier as ParsedTier)[variable.field])
    if (!Number.isFinite(value) || value < 0) return []
    // Same-price reads can stay in the expression to preserve accounting for
    // overlapping usage. They do not need a separate displayed price. Keep
    // explicit zero prices visible, even when the input itself is free.
    if (
      variable.key === 'cr' &&
      value !== 0 &&
      value === (tier as ParsedTier).inputPrice
    ) {
      return []
    }

    const labels = getCachePriceLabels(variable, cacheMode)
    return [
      {
        key: variable.key,
        field: variable.field,
        label: labels.label,
        shortLabel: labels.shortLabel,
        labelKind: 'i18n' as const,
        value,
        formatted: formatDynamicUnitPrice(value, options),
        unit: 'token' as const,
        variable,
      },
    ]
  }).sort((a, b) => {
    const aPrimary = PRIMARY_DYNAMIC_FIELDS.has(a.field)
    const bPrimary = PRIMARY_DYNAMIC_FIELDS.has(b.field)
    if (aPrimary !== bPrimary) return aPrimary ? -1 : 1
    return 0
  })
}

export function getDynamicPricingSummary(
  model: PricingModel,
  options: DynamicPriceOptions
): DynamicPricingSummary | null {
  model = withInferredUsageSchema(model)
  const variants = model.billing_plugin_variants
  if (variants?.length) {
    const summaries = variants.flatMap((variant) => {
      const summary = getDynamicPricingSummary(
        withPluginPricing(model, variant),
        options
      )
      return summary ? [summary] : []
    })
    const perCallEntries: DynamicPriceEntry[] = []
    if (
      model.quota_type === 1 &&
      typeof model.model_price === 'number' &&
      variants.some((variant) => variant.billing_mode === 'ratio')
    ) {
      perCallEntries.push({
        key: 'modelPrice',
        field: 'modelPrice',
        label: 'Price per request',
        shortLabel: 'Per-call',
        labelKind: 'i18n',
        value: model.model_price,
        formatted: formatTaskUsageUnitPrice(model.model_price, options),
        unit: 'request',
      })
    }
    const ranges = new Map<
      string,
      { entry: DynamicPriceEntry; min: number; max: number }
    >()
    for (const providerEntries of [
      ...summaries.map((summary) => summary.entries),
      perCallEntries,
    ]) {
      for (const entry of providerEntries) {
        // Identical field names with different units describe different prices.
        const key = `${entry.field}:${entry.unit}`
        const range = ranges.get(key)
        const merged = range?.entry ?? { ...entry, key }
        if (
          !merged.unitLabel ||
          (typeof merged.unitLabel === 'object' &&
            Object.keys(merged.unitLabel).length === 0)
        ) {
          merged.unitLabel = entry.unitLabel
        }
        ranges.set(key, {
          entry: merged,
          min: Math.min(range?.min ?? Infinity, entry.minValue ?? entry.value),
          max: Math.max(range?.max ?? -Infinity, entry.maxValue ?? entry.value),
        })
      }
    }
    const entries = [...ranges.values()].map(({ entry, min, max }) => ({
      ...entry,
      value: min,
      minValue: min,
      maxValue: max,
      formatted: formatTaskUsageUnitPrice(min, options),
      formattedRange:
        min === max
          ? undefined
          : `${formatTaskUsageUnitPrice(min, options)} – ${formatTaskUsageUnitPrice(max, options)}`,
    }))
    const primaryKeys = new Set(
      summaries.flatMap((summary) =>
        summary.primaryEntries
          .slice(0, 1)
          .map((entry) => `${entry.field}:${entry.unit}`)
      )
    )
    const primary = entries.filter(
      (entry) =>
        (entry.unit !== 'request' && entry.unit !== 'image') ||
        entry.field === 'modelPrice'
    )
    primary.sort(
      (a, b) => Number(primaryKeys.has(b.key)) - Number(primaryKeys.has(a.key))
    )
    const tiers = summaries.flatMap((summary) => summary.tiers)
    return {
      tiers,
      tier: summaries[0]?.tier ?? null,
      tierCount: tiers.length,
      hasRequestRules: summaries.some((summary) => summary.hasRequestRules),
      isSpecialExpression:
        perCallEntries.length === 0 &&
        summaries.length > 0 &&
        summaries.every((summary) => summary.isSpecialExpression),
      rawExpression: summaries[0]?.rawExpression ?? '',
      entries,
      primaryEntries: primary,
      secondaryEntries: entries.filter(
        (entry) =>
          (entry.unit === 'request' || entry.unit === 'image') &&
          entry.field !== 'modelPrice'
      ),
      isTaskUsage: true,
      providerCount: variants.length >= 2 ? variants.length : undefined,
      hasUnconfiguredProviders: variants.some((variant) =>
        variant.billing_mode === 'ratio'
          ? isUnconfiguredTaskUsageModel(withPluginPricing(model, variant))
          : !variant.billing_expr
      ),
    }
  }
  if (!isDynamicPricingModel(model)) return null

  const tiers = getDynamicPricingTiers(model)
  const isTaskUsage = isTaskUsagePricingModel(model)
  const baseExpression = splitBillingExprAndRequestRules(
    model.billing_expr || ''
  ).billingExpr
  const timeTiers = isTaskUsage
    ? null
    : getCurrentTimePricingTiers(baseExpression, options.now ?? new Date())
  const summaryTiers = timeTiers ?? tiers
  const tier = isTaskUsage
    ? (summaryTiers.at(-1) ?? null)
    : (summaryTiers[0] ?? null)
  let entries = getDynamicPriceEntries(tier, {
    ...options,
    usageSchema: model.billing_usage_schema,
  })
  let isMixedBilling = false
  if (!isTaskUsage) {
    const tokenTier = summaryTiers.find(
      (item) => !isTaskPricingTier(item) && item.billingUnit !== 'request'
    )
    const requestTier = summaryTiers.find(
      (item) => !isTaskPricingTier(item) && item.billingUnit === 'request'
    )
    if (tokenTier && requestTier) {
      isMixedBilling = true
      entries = [
        ...getDynamicPriceEntries(tokenTier, options),
        ...getDynamicPriceEntries(requestTier, options),
      ]
    }
  }
  if (isTaskUsage) {
    const priceRanges = new Map<string, { min: number; max: number }>()
    for (const [field] of getTaskNumberFields(model.billing_usage_schema)) {
      let min = Number.POSITIVE_INFINITY
      let max = Number.NEGATIVE_INFINITY
      for (const taskTier of tiers) {
        if (!isTaskPricingTier(taskTier)) continue
        const value = Number(taskTier.unitPrices[field])
        if (!Number.isFinite(value) || value < 0) continue
        min = Math.min(min, value)
        max = Math.max(max, value)
      }
      if (Number.isFinite(min) && Number.isFinite(max)) {
        priceRanges.set(field, { min, max })
      }
    }
    entries = entries.map((entry) => {
      const range = priceRanges.get(entry.field)
      if (!range) return entry
      return {
        ...entry,
        minValue: range.min,
        maxValue: range.max,
        formattedRange:
          range.min === range.max
            ? undefined
            : `${formatTaskUsageUnitPrice(range.min, options)} – ${formatTaskUsageUnitPrice(range.max, options)}`,
      }
    })
  }
  const rawExpression = model.billing_expr || ''

  return {
    tiers,
    tier,
    tierCount: tiers.length,
    hasRequestRules: hasDynamicRequestRules(model),
    isSpecialExpression: rawExpression.trim().length > 0 && tiers.length === 0,
    rawExpression,
    entries,
    primaryEntries: isTaskUsage
      ? entries.filter(
          (entry) => entry.unit !== 'request' && entry.unit !== 'image'
        )
      : entries.filter(
          (entry) =>
            entry.unit === 'request' ||
            entry.unit === 'image' ||
            PRIMARY_DYNAMIC_FIELDS.has(entry.field)
        ),
    secondaryEntries: isTaskUsage
      ? entries.filter(
          (entry) => entry.unit === 'request' || entry.unit === 'image'
        )
      : entries.filter(
          (entry) =>
            entry.unit !== 'request' &&
            entry.unit !== 'image' &&
            !PRIMARY_DYNAMIC_FIELDS.has(entry.field)
        ),
    isTaskUsage,
    isTimePricing: timeTiers !== null,
    ...(isMixedBilling ? { isMixedBilling } : {}),
  }
}

export function getCardExamplePrice(
  model: PricingModel,
  options: DynamicPriceOptions
): CardExamplePrice | null {
  if (model.billing_plugin_variants?.length) {
    const variant = model.billing_plugin_variants.find(
      (provider) => provider.billing_expr
    )
    return variant
      ? getCardExamplePrice(withPluginPricing(model, variant), options)
      : null
  }
  if (!isTaskUsagePricingModel(model)) return null
  const schema = model.billing_usage_schema
  const firstExample = model.billing_usage_examples?.[0]
  if (!schema || !firstExample) return null

  const { billingExpr } = splitBillingExprAndRequestRules(
    model.billing_expr || ''
  )
  const config = tryParseTaskVisualConfig(billingExpr, schema)
  if (!config) return null

  const result = evaluateTaskVisualConfig(config, firstExample.facts, schema)
  if (!result) return null

  return {
    label: firstExample.label,
    total: result.total,
    formatted: formatTaskUsageUnitPrice(result.total, options),
  }
}
