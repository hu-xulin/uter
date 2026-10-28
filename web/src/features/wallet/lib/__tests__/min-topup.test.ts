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

import { DEFAULT_MIN_TOPUP } from '../../constants'
import type { TopupInfo } from '../../types'
import { generatePresetAmounts, getMinTopupAmount } from '../payment'

function buildTopupInfo(overrides: Partial<TopupInfo> = {}): TopupInfo {
  return {
    amount_options: [],
    discount: {},
    enable_online_topup: false,
    enable_stripe_topup: false,
    enable_waffo_topup: false,
    enable_waffo_pancake_topup: false,
    enable_alipay_topup: false,
    enable_wechat_pay_topup: false,
    min_topup: 0,
    stripe_min_topup: 1,
    ...overrides,
  } as TopupInfo
}

describe('getMinTopupAmount', () => {
  // 真实故障（2026-10-28）：运营把「支付网关 → 最低充值」设成 0.01，支付宝
  // 充值时钱包页仍提示「最低 1 美元」。原因是这里只认 enable_online_topup
  // （易支付），支付宝/微信两个分支直接落到写死的 DEFAULT_MIN_TOPUP。
  test.each([
    ['alipay', { enable_alipay_topup: true }],
    ['wechat pay', { enable_wechat_pay_topup: true }],
    ['epay', { enable_online_topup: true }],
  ])('uses the configured min_topup for %s', (_label, flags) => {
    const info = buildTopupInfo({ ...flags, min_topup: 0.01 })
    expect(getMinTopupAmount(info)).toBe(0.01)
  })

  test('keeps a configured zero as “no lower bound”', () => {
    const info = buildTopupInfo({ enable_alipay_topup: true, min_topup: 0 })
    expect(getMinTopupAmount(info)).toBe(0)
  })

  test('falls back to the stripe minimum when only stripe is enabled', () => {
    const info = buildTopupInfo({
      enable_stripe_topup: true,
      stripe_min_topup: 5,
    })
    expect(getMinTopupAmount(info)).toBe(5)
  })

  test('falls back to the built-in default when nothing is enabled', () => {
    expect(getMinTopupAmount(buildTopupInfo())).toBe(DEFAULT_MIN_TOPUP)
    expect(getMinTopupAmount(null)).toBe(DEFAULT_MIN_TOPUP)
  })
})

describe('generatePresetAmounts', () => {
  test('scales presets by the minimum amount', () => {
    const presets = generatePresetAmounts(2)
    expect(presets[0].value).toBe(2)
    expect(presets.every((preset) => preset.value > 0)).toBe(true)
  })

  // 最低额是 0 时若直接相乘，整排预设都会变成 0 元按钮。
  test('never generates zero-valued presets when the minimum is zero', () => {
    const presets = generatePresetAmounts(0)
    expect(presets.every((preset) => preset.value > 0)).toBe(true)
    expect(presets[0].value).toBe(DEFAULT_MIN_TOPUP)
  })
})
