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
import type {
  ChannelModelPricingRecord,
  ChannelUpstreamQuoteView,
} from '../types'

/**
 * 唯一权威的"渠道价"来源白名单。
 *
 * upstream_quote 历史上被四种语义不同的来源填充：
 *   - CHANNEL_CATALOG  / CHANNEL_DISCOUNT : 上游真实渠道报价，可展示
 *   - DERIVED_FROM_RATIOS                 : 由 model_ratio 推算，仅供参考
 *   - OFFICIAL_REFERENCE                  : 官方标价，不是渠道价
 *
 * 后端仍会保留全部 basis 供审计，但展示侧只允许白名单内、且未被标记待审的
 * 报价显示为"渠道价"。这样即便后端新增 fallback 分支，也不会再把非渠道价
 * 冒充渠道价——判定收敛到这一处，避免反复打补丁。
 */
export const AUTHORITATIVE_CHANNEL_PRICE_BASES = new Set([
  'CHANNEL_CATALOG',
  'CHANNEL_DISCOUNT',
])

/** 该报价是否来自上游真实渠道报价（而非推算或官方标价回落）。 */
export function isAuthoritativeChannelQuote(
  quote: ChannelUpstreamQuoteView | undefined | null
): boolean {
  if (!quote) return false
  return AUTHORITATIVE_CHANNEL_PRICE_BASES.has(quote.price_basis)
}

/**
 * 该行的"渠道价"是否可展示。
 *
 * needs_review 行没有可信的渠道采购价；即便后端用 OFFICIAL_REFERENCE
 * 填了 upstream_quote，也必须在界面上显示待审，绝不把官方标价渲染成渠道价。
 *
 * official_only 不在此列：绝对供应商可能只有官方目录价而无 Uter 销售价，
 * 此时 CHANNEL_CATALOG 就是它的真实上游报价，仍然可展示。
 */
export function canDisplayChannelPrice(
  item: Pick<ChannelModelPricingRecord, 'pricing_status'> & {
    upstream_quote?: ChannelUpstreamQuoteView
  }
): boolean {
  if (item.pricing_status === 'needs_review') return false
  return isAuthoritativeChannelQuote(item.upstream_quote)
}
