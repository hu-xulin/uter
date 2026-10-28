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
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DiscountTag } from '../components/discount-tag'
import { getMarkupMultiplier } from '../lib/price'
import type { PricingModel } from '../types'

function pricingModel(overrides: Partial<PricingModel> = {}): PricingModel {
  return {
    id: 1,
    model_name: 'example-model',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 3,
    enable_groups: ['default'],
    group_ratio: { default: 1 },
    ...overrides,
  }
}

/** 官方价只带 model_ratio，其余维度由 `getOfficialPresetTokenUSD` 推导。 */
const official = (modelRatio: number) => ({
  'example-model': { model_ratio: modelRatio },
})

describe('DiscountTag', () => {
  it('renders the multiplier badge when the platform price is below the official one', () => {
    render(
      <DiscountTag
        model={pricingModel({ model_ratio: 0.9 })}
        officialPrices={official(1)}
      />
    )
    const badge = screen.getByText('x0.9')
    // 折扣角标：`--hover-success`（#15803D）实心 + `--ds-color-text-on-emphasis`（#FFFFFF）。
    expect(badge).toHaveClass('bg-success-hover')
    expect(badge).toHaveClass('text-on-emphasis')
    expect(badge).not.toHaveClass('bg-success-soft')
    expect(badge).toHaveAttribute('title', '-10%')
  })

  /**
   * 折扣与溢价必须用同一套「倍率」写法：过去折扣写「6折」、溢价写「x1.05」，
   * 同一张卡片上两套计数法，读者要先换算才能比较。
   */
  it('writes both discounts and markups as a price multiplier', () => {
    const { unmount } = render(
      <DiscountTag
        model={pricingModel({ model_ratio: 0.6 })}
        officialPrices={official(1)}
      />
    )
    expect(screen.getByText('x0.6')).toBeVisible()
    unmount()

    render(
      <DiscountTag
        model={pricingModel({ model_ratio: 0.75 })}
        officialPrices={official(1)}
      />
    )
    expect(screen.getByText('x0.75')).toBeVisible()
  })

  /**
   * 回归背景：角标过去只表达折扣。算出来比官方贵时角标直接消失，卡片上看不出
   * 任何「正在被加价」的痕迹。现在必须显示 `x1.05`。
   */
  it('renders an xN badge when the platform price exceeds the official one', () => {
    render(
      <DiscountTag
        model={pricingModel({ model_ratio: 1.05 })}
        officialPrices={official(1)}
      />
    )
    const badge = screen.getByText('x1.05')
    // 溢价用红色（#EF4444）：绿色在这套界面里恒表示「对用户有利」。
    expect(badge).toHaveClass('bg-destructive-hover')
    expect(badge).toHaveClass('text-on-emphasis')
    expect(badge).not.toHaveClass('bg-success-hover')
    expect(badge).not.toHaveClass('bg-success-soft')
    expect(badge).toHaveAttribute('title', '+5%')
  })

  it('renders nothing when the two prices are equal', () => {
    const { container } = render(
      <DiscountTag
        model={pricingModel({ model_ratio: 1 })}
        officialPrices={official(1)}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  /**
   * 溢价小于 0.5% 时两位小数会取整成 1.00，渲染出来就是「x1.00」——
   * 一个声称加价却看不出加价的角标。这种情况宁可不显示。
   */
  it('stays silent when the markup rounds down to 1.00', () => {
    const { container } = render(
      <DiscountTag
        model={pricingModel({ model_ratio: 1.002 })}
        officialPrices={official(1)}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  /** 同一口径的另一侧：折扣不到 0.5% 时倍率会取整回 1，别渲染「x1」。 */
  it('stays silent when a tiny discount rounds up to x1', () => {
    const { container } = render(
      <DiscountTag
        model={pricingModel({ model_ratio: 0.998 })}
        officialPrices={official(1)}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('compares per-request prices too', () => {
    render(
      <DiscountTag
        model={pricingModel({
          quota_type: 1,
          model_ratio: 0,
          model_price: 2.1,
        })}
        officialPrices={{ 'example-model': { model_ratio: 1, model_price: 2 } }}
      />
    )
    expect(screen.getByText('x1.05')).toBeVisible()
  })
})

describe('getMarkupMultiplier', () => {
  it.each([
    [1.05, 1, 1.05],
    [2.1, 2, 1.05],
    [1.1, 1, 1.1],
    [1, 1, null],
    [0.9, 1, null],
    [1.002, 1, null],
    [1, 0, null],
    [Number.NaN, 1, null],
    [0, 1, null],
  ])('getMarkupMultiplier(%s, %s) → %s', (uter, officialPrice, expected) => {
    expect(getMarkupMultiplier(uter, officialPrice)).toBe(expected)
  })
})
