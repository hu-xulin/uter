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
import {
  SORT_OPTIONS,
  FILTER_ALL,
  QUOTA_TYPES,
  QUOTA_TYPE_VALUES,
  ENDPOINT_TYPES,
  CONTEXT_SIZE_TAG_PATTERN,
  type SortOption,
} from '../constants'
import type { PricingFacetModels, PricingModel } from '../types'
import {
  getCardExamplePrice,
  getDynamicPricingSummary,
  hasTaskUsageSchema,
  isUnconfiguredTaskUsageModel,
} from './dynamic-price'
import { isTokenBasedModel } from './model-helpers'
import { calculateTokenPrice, getDiscountInfo } from './price'

// ----------------------------------------------------------------------------
// Filter Utilities
// ----------------------------------------------------------------------------

/**
 * Filter models by search query
 */
export function filterBySearch(
  models: PricingModel[],
  query: string
): PricingModel[] {
  if (!query) return models

  const lowerQuery = query.toLowerCase()
  return models.filter(
    (m) =>
      m.model_name?.toLowerCase().includes(lowerQuery) ||
      m.description?.toLowerCase().includes(lowerQuery) ||
      m.tags?.toLowerCase().includes(lowerQuery) ||
      m.vendor_name?.toLowerCase().includes(lowerQuery)
  )
}

/**
 * Filter models by vendor
 */
export function filterByVendor(
  models: PricingModel[],
  vendor: string
): PricingModel[] {
  if (vendor === FILTER_ALL) return models
  return models.filter((m) => m.vendor_name === vendor)
}

/**
 * Filter models by the enabled channel that serves them (管理-渠道的展示名).
 */
export function filterByChannel(
  models: PricingModel[],
  channel: string
): PricingModel[] {
  if (channel === FILTER_ALL) return models
  return models.filter((m) => m.channels?.includes(channel))
}

/**
 * Filter models by quota type
 */
export function filterByQuotaType(
  models: PricingModel[],
  quotaType: string
): PricingModel[] {
  if (quotaType === QUOTA_TYPES.ALL) return models
  // Task-usage models form their own bucket, disjoint from token/request.
  if (quotaType === QUOTA_TYPES.TASK) {
    return models.filter((m) => hasTaskUsageSchema(m))
  }
  const targetType =
    quotaType === QUOTA_TYPES.TOKEN
      ? QUOTA_TYPE_VALUES.TOKEN
      : QUOTA_TYPE_VALUES.REQUEST
  return models.filter(
    (m) => m.quota_type === targetType && !hasTaskUsageSchema(m)
  )
}

/**
 * Filter models by endpoint type
 */
export function filterByEndpointType(
  models: PricingModel[],
  endpointType: string
): PricingModel[] {
  if (endpointType === ENDPOINT_TYPES.ALL) return models
  return models.filter((m) =>
    m.supported_endpoint_types?.includes(endpointType)
  )
}

type SortPriceKind = 'input' | 'output' | 'request'

const PRICE_SORTS: Partial<
  Record<SortOption, { kind: SortPriceKind; dir: 1 | -1 }>
> = {
  [SORT_OPTIONS.INPUT_PRICE_LOW]: { kind: 'input', dir: 1 },
  [SORT_OPTIONS.INPUT_PRICE_HIGH]: { kind: 'input', dir: -1 },
  [SORT_OPTIONS.OUTPUT_PRICE_LOW]: { kind: 'output', dir: 1 },
  [SORT_OPTIONS.OUTPUT_PRICE_HIGH]: { kind: 'output', dir: -1 },
  [SORT_OPTIONS.REQUEST_PRICE_LOW]: { kind: 'request', dir: 1 },
  [SORT_OPTIONS.REQUEST_PRICE_HIGH]: { kind: 'request', dir: -1 },
}

/**
 * Base USD price shown on the model card: input/output per 1M tokens, request
 * per call (task models use their first usage example). Undefined when the
 * model has no price of that kind.
 */
function getSortPrice(
  model: PricingModel,
  kind: SortPriceKind
): number | undefined {
  if (kind === 'request') {
    const example = getCardExamplePrice(model, { tokenUnit: 'M' })
    if (example) return example.total
  }
  const summary = getDynamicPricingSummary(model, { tokenUnit: 'M' })
  if (kind === 'request') {
    if (summary) {
      return summary.entries.find(
        (entry) => entry.field === 'fixedPrice' || entry.field === 'modelPrice'
      )?.value
    }
    return isTokenBasedModel(model) ? undefined : model.model_price
  }
  if (summary) {
    const field = kind === 'input' ? 'inputPrice' : 'outputPrice'
    return summary.entries.find(
      (entry) => entry.field === field && entry.unit === 'token'
    )?.value
  }
  if (!isTokenBasedModel(model) || isUnconfiguredTaskUsageModel(model)) {
    return undefined
  }
  return calculateTokenPrice(model, kind, 1)
}

type ModelNameToken =
  | { kind: 'text'; value: string }
  | { kind: 'number'; value: number }

/** Split a model name into alternating text / numeric tokens. */
function tokenizeModelName(name: string): ModelNameToken[] {
  const tokens: ModelNameToken[] = []
  const numeric = /(\d+)/g
  let cursor = 0
  let match: RegExpExecArray | null
  while ((match = numeric.exec(name)) !== null) {
    if (match.index > cursor) {
      tokens.push({ kind: 'text', value: name.slice(cursor, match.index) })
    }
    tokens.push({ kind: 'number', value: Number(match[0]) })
    cursor = match.index + match[0].length
  }
  if (cursor < name.length) {
    tokens.push({ kind: 'text', value: name.slice(cursor) })
  }
  return tokens
}

/**
 * Compare model names the way the pricing cards read them: letters ascend,
 * version numbers descend, and a more specific version wins over its prefix.
 *
 * `gpt-5-5` and `gpt-5.5` tokenize to [gpt-, 5, -, 5] / [gpt-, 5, ., 5], so
 * both outrank `gpt-5` (a longer token list wins when one is a prefix), and
 * `gpt-4-8` loses to `gpt-5` because the first numeric token is smaller.
 */
function compareModelNames(a: string, b: string): number {
  const left = tokenizeModelName(a)
  const right = tokenizeModelName(b)
  const shared = Math.min(left.length, right.length)
  for (let i = 0; i < shared; i++) {
    const x = left[i]
    const y = right[i]
    if (x.kind === 'number' && y.kind === 'number') {
      if (x.value !== y.value) return y.value - x.value
      continue
    }
    if (x.kind === 'text' && y.kind === 'text') {
      if (x.value === y.value) continue
      return x.value < y.value ? -1 : 1
    }
    // A numeric token sorts ahead of a text token at the same position.
    return x.kind === 'number' ? -1 : 1
  }
  // A more specific name (extra version/date suffix) ranks before its prefix.
  return right.length - left.length
}

/**
 * 名称维度的严格字母比较：只按 model_name 排，不掺入发布日期；`numeric`
 * 让 gpt-5 排在 gpt-10 之前，`sensitivity: 'base'` 忽略大小写差异。
 * 方向由 dir 决定（1 = A→Z，-1 = Z→A）。
 */
function compareModelsByName(
  a: PricingModel,
  b: PricingModel,
  dir: 1 | -1
): number {
  return (
    dir *
    (a.model_name ?? '').localeCompare(b.model_name ?? '', undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  )
}

/**
 * Pricing-card order: newest release first; models without a release date
 * (or sharing one) fall back to alphabetical order with larger version
 * numbers ahead. ISO `YYYY-MM`/`YYYY-MM-DD` strings sort chronologically as
 * plain strings, so no date parsing is needed.
 */
export function compareModelsForCard(a: PricingModel, b: PricingModel): number {
  const dateA = (a.release_date ?? '').trim()
  const dateB = (b.release_date ?? '').trim()
  if (dateA && dateB && dateA !== dateB) {
    return dateA < dateB ? 1 : -1
  }
  if (dateA && !dateB) return -1
  if (!dateA && dateB) return 1
  return compareModelNames(a.model_name ?? '', b.model_name ?? '')
}

/**
 * 时间维度的严格比较（用于「时间」排序按钮的主维度）：
 * 新→旧时 release_date 降序，旧→新时升序。无发布日期的模型在两种方向下
 * 都排最后（与价格排序的缺失值惯例一致），避免缺数据的模型在反向时被顶到最前。
 * 同日期用「字母升序 → 版本号大→小」细分。
 */
export function compareModelsByTime(
  a: PricingModel,
  b: PricingModel,
  direction: 'newest-to-oldest' | 'oldest-to-newest'
): number {
  const dateA = (a.release_date ?? '').trim()
  const dateB = (b.release_date ?? '').trim()
  if (!dateA && !dateB) {
    return compareModelNames(a.model_name ?? '', b.model_name ?? '')
  }
  if (!dateA) return 1
  if (!dateB) return -1
  if (dateA !== dateB) {
    const cmp = dateA < dateB ? -1 : 1
    return direction === 'newest-to-oldest' ? -cmp : cmp
  }
  return compareModelNames(a.model_name ?? '', b.model_name ?? '')
}

/**
 * 折扣倍率（平台价 ÷ 官方价），即角标上的 `x0.2` / `x0.3`。
 * 0.2 = 2 折，0.3 = 3 折；「折扣从低到高」要求 2 折在 3 折之前，
 * 因此按该 ratio 数值升序。没有官方参照（ratio=null）返回 undefined，
 * 排序时两种方向都排最后。
 */
export function getDiscountRatio(
  model: PricingModel,
  officialPrices?: Record<string, Record<string, number>>,
  selectedGroup?: string
): number | undefined {
  return (
    getDiscountInfo(model, officialPrices, selectedGroup).ratio ?? undefined
  )
}

/**
 * 折扣主维度 + 三级次级的复合比较器。主维度按 ratio 排序（方向由 dir 决定），
 * 同折扣依次按「发布时间新→旧 → 名称字母 → 版本号大→小」——这一整段次级
 * 正是 compareModelsForCard，复用保证卡片默认顺序与折扣排序口径一致。
 */
function compareModelsByDiscount(
  a: PricingModel,
  b: PricingModel,
  dir: 1 | -1,
  officialPrices?: Record<string, Record<string, number>>,
  selectedGroup?: string
): number {
  const ratioA = getDiscountRatio(a, officialPrices, selectedGroup)
  const ratioB = getDiscountRatio(b, officialPrices, selectedGroup)
  if (ratioA === undefined && ratioB === undefined) {
    return compareModelsForCard(a, b)
  }
  if (ratioA === undefined) return 1
  if (ratioB === undefined) return -1
  if (ratioA !== ratioB) return dir * (ratioA - ratioB)
  return compareModelsForCard(a, b)
}

/**
 * Sort models by specified option
 */
export function sortModels(
  models: PricingModel[],
  sortBy: string,
  officialPrices?: Record<string, Record<string, number>>,
  selectedGroup?: string
): PricingModel[] {
  const sorted = [...models]

  switch (sortBy) {
    case SORT_OPTIONS.DISCOUNT_LOW_TO_HIGH:
      return sorted.sort((a, b) =>
        compareModelsByDiscount(a, b, 1, officialPrices, selectedGroup)
      )
    case SORT_OPTIONS.DISCOUNT_HIGH_TO_LOW:
      return sorted.sort((a, b) =>
        compareModelsByDiscount(a, b, -1, officialPrices, selectedGroup)
      )
    case SORT_OPTIONS.TIME_NEWEST_TO_OLDEST:
      return sorted.sort((a, b) =>
        compareModelsByTime(a, b, 'newest-to-oldest')
      )
    case SORT_OPTIONS.TIME_OLDEST_TO_NEWEST:
      return sorted.sort((a, b) =>
        compareModelsByTime(a, b, 'oldest-to-newest')
      )
  }

  const priceSort = PRICE_SORTS[sortBy as SortOption]
  if (priceSort) {
    // Extracting the price parses the billing expression, so compute once
    const price = new Map(
      sorted.map((m) => [m, getSortPrice(m, priceSort.kind)])
    )
    // Models without this kind of price stay last in both directions
    sorted.sort((a, b) => {
      const priceA = price.get(a)
      const priceB = price.get(b)
      if (priceA === undefined || priceB === undefined) {
        return Number(priceA === undefined) - Number(priceB === undefined)
      }
      return priceSort.dir * (priceA - priceB)
    })
    return sorted
  }

  switch (sortBy) {
    case SORT_OPTIONS.NAME:
      sorted.sort((a, b) => compareModelsByName(a, b, 1))
      break
    case SORT_OPTIONS.NAME_DESC:
      sorted.sort((a, b) => compareModelsByName(a, b, -1))
      break
  }

  return sorted
}

/**
 * Apply all filters and sorting to models
 */
export function filterAndSortModels(
  models: PricingModel[],
  filters: {
    search: string
    vendor: string
    channel: string
    quotaType: string
    endpointType: string
    tag: string
    sortBy: string
  },
  officialPrices?: Record<string, Record<string, number>>,
  selectedGroup?: string
): PricingModel[] {
  let result = filterBySearch(models, filters.search)
  result = filterByVendor(result, filters.vendor)
  result = filterByChannel(result, filters.channel)
  result = filterByQuotaType(result, filters.quotaType)
  result = filterByEndpointType(result, filters.endpointType)
  result = filterByTag(result, filters.tag)
  result = sortModels(result, filters.sortBy, officialPrices, selectedGroup)

  return result
}

/**
 * Build one model set per filter section for faceted option counts. Each set
 * keeps every other active filter but resets the section's own filter, so a
 * selected channel narrows vendors/tags/pricing types/endpoints without
 * eliminating the channel list itself.
 */
export function buildFacetModels(
  models: PricingModel[],
  filters: {
    search: string
    vendor: string
    channel: string
    quotaType: string
    endpointType: string
    tag: string
  }
): PricingFacetModels {
  const base = { ...filters, sortBy: SORT_OPTIONS.NAME }
  // Facet sets only feed option counts, not the visible card order. Keep their
  // enumeration alphabetical so the new release/version card ordering does not
  // silently reshuffle sidebar filter options.
  const alphabetical = (rows: PricingModel[]) =>
    [...rows].sort((a, b) =>
      (a.model_name || '').localeCompare(b.model_name || '')
    )
  return {
    channel: alphabetical(
      filterAndSortModels(models, { ...base, channel: FILTER_ALL })
    ),
    vendor: alphabetical(
      filterAndSortModels(models, { ...base, vendor: FILTER_ALL })
    ),
    tag: alphabetical(
      filterAndSortModels(models, { ...base, tag: FILTER_ALL })
    ),
    quotaType: alphabetical(
      filterAndSortModels(models, { ...base, quotaType: QUOTA_TYPES.ALL })
    ),
    endpointType: alphabetical(
      filterAndSortModels(models, { ...base, endpointType: ENDPOINT_TYPES.ALL })
    ),
  }
}

/**
 * Parse tags from comma-separated string
 *
 * Context-window size labels (`8K`, `1M`, `1.1M`, …) are dropped here so they
 * neither reach the tag filter options nor get rendered on model cards. Doing
 * it in the single shared parser keeps the filter counts, the card badges and
 * the detail sheet consistent with each other.
 */
export function parseTags(tagsString?: string): string[] {
  if (!tagsString) return []
  return tagsString
    .split(/[,;|\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((tag) => !CONTEXT_SIZE_TAG_PATTERN.test(tag))
}

/**
 * Extract all unique tags from models
 */
export function extractAllTags(models: PricingModel[]): string[] {
  const tagSet = new Set<string>()

  models.forEach((model) => {
    if (model.tags) {
      const tags = parseTags(model.tags)
      tags.forEach((tag) => {
        tagSet.add(tag.toLowerCase())
      })
    }
  })

  return [...tagSet].sort((a, b) => a.localeCompare(b))
}

/**
 * Filter models by capability category (the sidebar's "Model Tags" section).
 * Categories are assigned by the backend and mirror the API reference's ten
 * groups; capability badges shown on cards still come from `tags`.
 */
export function filterByTag(
  models: PricingModel[],
  tag: string
): PricingModel[] {
  if (tag === FILTER_ALL) return models

  const category = tag.toLowerCase()
  return models.filter((m) => m.category?.toLowerCase() === category)
}
