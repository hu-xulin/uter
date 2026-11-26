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
import { describe, expect, test } from 'vitest'

import type { ChannelUpstreamQuoteView } from '../../types'
import {
  AUTHORITATIVE_CHANNEL_PRICE_BASES,
  canDisplayChannelPrice,
  isAuthoritativeChannelQuote,
} from '../channel-price-display'

function quote(price_basis: string): ChannelUpstreamQuoteView {
  return {
    price_basis,
    currency: 'USD',
    unit: 'per_1m_token',
    input_per_million_usd: 10,
    output_per_million_usd: 50,
    source: 'uterroute-official',
  }
}

describe('isAuthoritativeChannelQuote', () => {
  test('只接受真实渠道报价 basis', () => {
    for (const basis of AUTHORITATIVE_CHANNEL_PRICE_BASES) {
      expect(isAuthoritativeChannelQuote(quote(basis))).toBe(true)
    }
  })

  test('ratio 推算与官方价回落都不是权威渠道价', () => {
    // 这两条正是历史上"修一个错就掉到另一个"的 fallback 来源。
    expect(isAuthoritativeChannelQuote(quote('DERIVED_FROM_RATIOS'))).toBe(
      false
    )
    expect(isAuthoritativeChannelQuote(quote('OFFICIAL_REFERENCE'))).toBe(false)
    expect(isAuthoritativeChannelQuote(quote('official_reference'))).toBe(false)
  })

  test('空报价不是权威渠道价', () => {
    expect(isAuthoritativeChannelQuote(undefined)).toBe(false)
    expect(isAuthoritativeChannelQuote(null)).toBe(false)
  })

  test('后端未来新增的 basis 默认不可展示（fail-closed）', () => {
    expect(isAuthoritativeChannelQuote(quote('BRAND_NEW_FALLBACK'))).toBe(false)
  })
})

describe('canDisplayChannelPrice', () => {
  test('权威渠道价 + configured 行可展示', () => {
    expect(
      canDisplayChannelPrice({
        pricing_status: 'configured',
        upstream_quote: quote('CHANNEL_DISCOUNT'),
      })
    ).toBe(true)
    // official_only 的绝对供应商，CHANNEL_CATALOG 就是真实上游报价。
    expect(
      canDisplayChannelPrice({
        pricing_status: 'official_only',
        upstream_quote: quote('CHANNEL_CATALOG'),
      })
    ).toBe(true)
  })

  test('needs_review 行即使带权威 basis 也不展示', () => {
    // 截图里 claude-fable-5 等 6 行属于此类：必须显示"不可用"而非官方价。
    expect(
      canDisplayChannelPrice({
        pricing_status: 'needs_review',
        upstream_quote: quote('CHANNEL_DISCOUNT'),
      })
    ).toBe(false)
  })

  test('OFFICIAL_REFERENCE 回落行一律不展示（核心回归）', () => {
    expect(
      canDisplayChannelPrice({
        pricing_status: 'needs_review',
        upstream_quote: quote('OFFICIAL_REFERENCE'),
      })
    ).toBe(false)
    expect(
      canDisplayChannelPrice({
        pricing_status: 'configured',
        upstream_quote: quote('OFFICIAL_REFERENCE'),
      })
    ).toBe(false)
  })

  test('无报价行不展示', () => {
    expect(
      canDisplayChannelPrice({
        pricing_status: 'configured',
        upstream_quote: undefined,
      })
    ).toBe(false)
  })
})
