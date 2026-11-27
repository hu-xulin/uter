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
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  auditPricingCatalog,
  type CatalogIssueKind,
} from '../lib/catalog-health'
import type { PricingModel } from '../types'
import defaultCatalog from './fixtures/pricing-catalog.json'

/**
 * 默认审计随仓库提交的真实目录快照；设置 UTER_PRICING_CATALOG_FIXTURE
 * 指向新抓取的 /api/pricing 精简 JSON（见 fixtures/pricing-catalog.json
 * 的形状）即可对最新数据审计，无需改测试代码。这样运营/定时任务可随时
 * 用同一套门禁校验线上目录，不必人工逐卡排查。
 */
const fixturePath = process.env.UTER_PRICING_CATALOG_FIXTURE
const catalog = fixturePath
  ? JSON.parse(readFileSync(resolve(fixturePath), 'utf8'))
  : defaultCatalog

/**
 * 定价目录健康门禁。
 *
 * Fixture 是从生产 /api/pricing 抓取的精简快照（见 fixtures/pricing-catalog.json），
 * 覆盖真实模型的 icon、计费方式、表达式、按秒价与官方价字段。任何导致
 * 「logo 不可解析 / 未配置定价 / 无官方价 / 表达式原文直出」的代码回退，或
 * 新增模型带病入库，都会让本测试失败——把过去靠人工逐卡排查的问题变成
 * 自动拦截。
 */
describe('定价目录健康门禁', () => {
  it('生产目录快照零异常', () => {
    const issues = auditPricingCatalog(
      catalog.models as PricingModel[],
      catalog.official_prices
    )
    expect(issues).toEqual([])
  })

  it.each<[CatalogIssueKind, Partial<PricingModel>, Record<string, number>]>([
    [
      'logo-unresolved',
      {
        model_name: 'broken-logo',
        icon: 'DefinitelyNotARealBrand.Color',
        quota_type: 0,
        model_ratio: 1,
        completion_ratio: 1,
        enable_groups: ['default'],
      },
      { model_ratio: 2 },
    ],
    [
      'price-unconfigured',
      {
        model_name: 'no-price',
        quota_type: 0,
        model_ratio: 0,
        completion_ratio: 0,
        model_price: 0,
        enable_groups: ['default'],
        billing_usage_schema: { seconds: { type: 'number', unit: 'second' } },
      },
      { model_ratio: 2 },
    ],
    [
      'official-price-missing',
      {
        model_name: 'no-official',
        icon: 'Claude.Color',
        quota_type: 0,
        model_ratio: 1,
        completion_ratio: 1,
        enable_groups: ['default'],
      },
      {},
    ],
    [
      'raw-expression',
      {
        model_name: 'raw-expr',
        icon: 'Claude.Color',
        quota_type: 0,
        model_ratio: 0,
        completion_ratio: 0,
        model_price: 0,
        enable_groups: ['default'],
        billing_mode: 'tiered_expr',
        billing_expr: 'convoluted(unknown_fn(param("x"))) * nonsense',
      },
      { model_ratio: 2 },
    ],
  ])('能捕获注入的 %s 异常', (kind, model, official) => {
    const modelName = String(model.model_name ?? 'injected-model')
    const issues = auditPricingCatalog(
      [{ ...model, model_name: modelName } as PricingModel],
      { [modelName]: official }
    )
    expect(issues.some((issue) => issue.kind === kind)).toBe(true)
  })

  it('能捕获 tiered_expr 按秒任务模型缺失的官方秒价', () => {
    // MiniMax-H3 这类模型没有 channel_internal_per_second_usd，过去缺
    // official_price_per_second 时审计静默通过，卡片却显示 "-"。
    const model = {
      model_name: 'MiniMax-H3-missing-official',
      icon: 'Minimax.Color',
      quota_type: 0,
      model_ratio: 0,
      completion_ratio: 0,
      model_price: 0,
      enable_groups: ['default'],
      billing_mode: 'tiered_expr',
      billing_expr: 'tier("2k", duration * 0.0656716419)',
    } as PricingModel
    const issues = auditPricingCatalog([model], {
      'MiniMax-H3-missing-official': { model_ratio: 1 },
    })
    expect(
      issues.some(
        (issue) =>
          issue.kind === 'official-price-missing' &&
          issue.detail.includes('按秒')
      )
    ).toBe(true)
  })
})
