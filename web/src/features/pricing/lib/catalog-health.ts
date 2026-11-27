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
import { getLobeIconNames, resolveModelIconKey } from '@/lib/lobe-icon'

import type { PricingModel } from '../types'
import {
  getDynamicPricingSummary,
  isUnconfiguredTaskUsageModel,
} from './dynamic-price'
import { pricingModelIconKey } from './model-helpers'
import { getOfficialPerSecondUSD } from './price'

/**
 * 定价目录健康审计。
 *
 * 定价页曾反复出现四类「卡片上不合理」的问题：logo 解析不到真实图标、
 * 有定价却被判为未配置、按秒模型拿不到官方价、表达式被原文直出。这些
 * 问题过去只能靠人工逐卡排查。此审计把四类判定收敛到与卡片完全相同的
 * 解析函数（`getDynamicPricingSummary` / `isUnconfiguredTaskUsageModel` /
 * `resolveModelIconKey`），使任何新增或变更的模型都能在测试门禁里自动
 * 校验，避免同类问题再次流入生产。
 */

export type CatalogIssueKind =
  | 'logo-unresolved'
  | 'price-unconfigured'
  | 'official-price-missing'
  | 'raw-expression'

export type CatalogIssue = {
  model: string
  kind: CatalogIssueKind
  detail: string
}

export type CatalogAuditOptions = {
  tokenUnit?: 'M' | 'K'
}

const SUMMARY_OPTIONS = {
  tokenUnit: 'M',
  showRechargePrice: false,
  priceRate: 1,
  usdExchangeRate: 1,
} as const

function hasUsablePrice(model: PricingModel): boolean {
  if ((model.model_ratio ?? 0) > 0 || (model.model_price ?? 0) > 0) return true
  if ((model.channel_internal_per_second_usd ?? 0) > 0) return true
  return Boolean(model.billing_expr || model.billing_plugin_variants?.length)
}

/**
 * 审计整个定价目录，返回所有不健康的模型项。返回空数组代表目录健康。
 */
export function auditPricingCatalog(
  models: PricingModel[],
  officialPrices: Record<string, Record<string, number>> = {},
  _options: CatalogAuditOptions = {}
): CatalogIssue[] {
  const issues: CatalogIssue[] = []
  const availableIcons = new Set(getLobeIconNames())
  for (const model of models) {
    const name = model.model_name

    // 1) logo：声明了 icon，但解析后的键不在已安装图标注册表 → 卡片退化成首字母。
    const iconKey = pricingModelIconKey(model.icon)
    if (model.icon) {
      const resolved = resolveModelIconKey(iconKey).split('.')[0]
      const registered =
        availableIcons.has(iconKey) || availableIcons.has(resolved)
      if (!iconKey || !registered) {
        issues.push({
          model: name,
          kind: 'logo-unresolved',
          detail: `icon=${model.icon} 无法解析到真实图标`,
        })
      }
    }

    const summary = getDynamicPricingSummary(model, SUMMARY_OPTIONS)
    const hasPerSecond = (model.channel_internal_per_second_usd ?? 0) > 0

    // 2) 定价：被判为未配置、或压根没有任何可用价格字段。
    if (
      isUnconfiguredTaskUsageModel(model) ||
      (!hasUsablePrice(model) && !summary)
    ) {
      issues.push({
        model: name,
        kind: 'price-unconfigured',
        detail: '卡片没有可用定价（未配置定价/无价格字段）',
      })
    }

    // 3) 官方价：优特价存在但官方条目缺失。按秒口径用 official_price_per_second，
    //    其余口径用是否有任意 official 条目判断。
    const officialEntry = officialPrices[name]
    if (!officialEntry || Object.keys(officialEntry).length === 0) {
      issues.push({
        model: name,
        kind: 'official-price-missing',
        detail: '官方价条目缺失',
      })
    } else if (hasPerSecond && getOfficialPerSecondUSD(officialEntry) == null) {
      issues.push({
        model: name,
        kind: 'official-price-missing',
        detail: '按秒模型缺少 official_price_per_second',
      })
    }

    // 4) 表达式原文直出：表达式存在但解析不出任何可读档位。
    if (summary?.isSpecialExpression) {
      issues.push({
        model: name,
        kind: 'raw-expression',
        detail: '计费表达式被直接展示（未解析为可读价格档位）',
      })
    }
  }
  return issues
}
