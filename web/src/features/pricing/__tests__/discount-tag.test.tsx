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

  it('renders a neutral x1.0 badge when the two prices are equal', () => {
    render(
      <DiscountTag
        model={pricingModel({ model_ratio: 1 })}
        officialPrices={official(1)}
      />
    )
    // 2026-11-02 用户裁定：与官方价持平也要有角标（中性灰），不能什么都不显示。
    const badge = screen.getByText('x1.0')
    expect(badge).toHaveClass('bg-muted')
    expect(badge).toHaveClass('text-fg-secondary')
    expect(badge).not.toHaveClass('bg-destructive-hover')
    expect(badge).not.toHaveClass('bg-success-hover')
    expect(badge).toHaveAttribute('title', '0%')
  })

  /**
   * 溢价小于 0.5% 时两位小数会取整成 1.00 —— 渲染中性 x1.0（按持平口径），
   * 而不是误导性的红色「x1.00」。
   */
  it('renders a neutral x1.0 badge when the markup rounds down to 1.00', () => {
    render(
      <DiscountTag
        model={pricingModel({ model_ratio: 1.002 })}
        officialPrices={official(1)}
      />
    )
    expect(screen.getByText('x1.0')).toBeVisible()
  })

  /** 同一口径的另一侧：折扣小到取整回 1 也渲染中性 x1.0。 */
  it('renders a neutral x1.0 badge when a tiny discount rounds up to x1', () => {
    render(
      <DiscountTag
        model={pricingModel({ model_ratio: 0.998 })}
        officialPrices={official(1)}
      />
    )
    expect(screen.getByText('x1.0')).toBeVisible()
  })

  /** 无官方参照（无从比价）时保持静默：x1.0 只在有官方价时才有意义。 */
  it('stays silent without an official reference even when the group ratio is 1', () => {
    const { container } = render(
      <DiscountTag model={pricingModel({ model_ratio: 1 })} />
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

  /**
   * 回归背景（2026-11-04 用户反馈）：wan3.0-video 卡片显示 `×586.25`，
   * wan3.0-video-prime 显示 `×390.83`，实际都是 -30% 折扣。
   *
   * 根因是按秒计费模型的官方价（美元/秒）被当成「美元/1M tokens」÷2 换算成
   * model_ratio，前端再拿名义 model_ratio=26.25 去除它 → 586 倍溢价。
   *
   * 修好后：官方秒价走 `official_price_per_second`，与 billing_expr 里的
   * 秒价同单位相比，得到 0.7 → x0.7（-30%）。
   */
  it('compares per-second video models by the same per-second unit', () => {
    const perSecondModel = pricingModel({
      model_ratio: 26.25,
      model_price: 0,
      billing_mode: 'tiered_expr',
      // 兜底档（720p）就是后端视为「官方秒价」的那一档：表达式最右侧的系数。
      billing_expr:
        'u("resolution") == "1080P" ? tier("1080p", (duration > 0 ? duration : 5) * 0.12537315) : (u("resolution") == "480P" ? tier("480p", (duration > 0 ? duration : 5) * 0.03134327) : tier("720p", (duration > 0 ? duration : 5) * 0.06268654))',
      billing_usage_schema: {
        seconds: { type: 'number', unit: 'second' },
        resolution: { type: 'string', enum: ['480P', '720P', '1080P'] },
      },
    })
    render(
      <DiscountTag
        model={perSecondModel}
        officialPrices={{
          'example-model': { official_price_per_second: 0.0895522 },
        }}
      />
    )
    // 0.06268654 / 0.0895522 = 0.7 → x0.7，而不是 ×586.25。
    expect(screen.getByText('x0.7')).toBeVisible()
    expect(screen.queryByText('x586.25')).not.toBeInTheDocument()
  })

  /**
   * 回归背景（2026-11-28 用户反馈）：MiniMax-H3 / MiniMax-H3-Max 卡片价格行有
   * -45%，但模型名后没有角标。上游 2026-11 起把按秒表达式写成裸
   * `duration * <单价>`（省略括号），后端解析器已同时支持两种写法，前端
   * getTaskPerSecondUSD 却只认带括号形式，按秒单价解析失败后角标静默消失。
   * 这里用真实表达式与官方秒价锁住修复，并校验角标倍率与价格行一致。
   */
  it.each([
    {
      name: 'MiniMax-H3',
      expr: 'has(lower(param("metadata.parameters.resolution")), "2k") || has(lower(param("metadata.resolution")), "2k") || has(lower(param("size")), "2k") ? tier("2k", duration * 0.0656716419) : tier("768p", duration * 0.0410447762)',
    },
    {
      name: 'MiniMax-H3-Max',
      expr: 'has(lower(param("metadata.parameters.resolution")), "480") || has(lower(param("metadata.resolution")), "480") || has(lower(param("size")), "480") ? tier("480p", duration * 0.0270895523) : tier("768p", duration * 0.0410447762)',
    },
  ])(
    'renders the per-second badge for bare-duration model $name',
    ({ name, expr }) => {
      // 完全复刻接口真实下发：model_ratio=0、default 分组倍率=1、裸 duration
      // 兜底档 0.0410447762、官方秒价 0.0746268657。future 若把倍率做进 group_ratio，
      // 本用例会失去对裸 duration 解析的覆盖，因此刻意保持真实字段形态。
      const perSecondModel = pricingModel({
        model_name: name,
        model_ratio: 0,
        model_price: 0,
        billing_mode: 'tiered_expr',
        billing_expr: expr,
        billing_usage_schema: {
          seconds: { type: 'number', unit: 'second' },
          resolution: { type: 'string', enum: ['480P', '768P', '2K'] },
        },
        enable_groups: ['default'],
        group_ratio: { default: 1 },
      })
      render(
        <DiscountTag
          model={perSecondModel}
          officialPrices={{
            [name]: { official_price_per_second: 0.0746268657 },
          }}
          selectedGroup='default'
        />
      )
      // 兜底档 0.0410447762 / 官方 0.0746268657 ≈ 0.55 → x0.55 / -45%。
      const badge = screen.getByText('x0.55')
      expect(badge).toBeVisible()
      expect(badge).toHaveAttribute('title', '-45%')
    }
  )

  /**
   * 没有官方秒价时不得退化成拿 model_ratio 硬比（那会重现 ×586 的荒谬值）。
   */
  it('never falls back to the token ratio for a per-second model without an official per-second price', () => {
    const perSecondModel = pricingModel({
      model_ratio: 26.25,
      billing_mode: 'tiered_expr',
      billing_expr: 'tier("720p", (duration > 0 ? duration : 5) * 0.06268654)',
      billing_usage_schema: { seconds: { type: 'number', unit: 'second' } },
      group_ratio: { default: 1 },
    })
    const { container } = render(
      <DiscountTag
        model={perSecondModel}
        officialPrices={{ 'example-model': { model_ratio: 0.0447761 } }}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  /**
   * `wan3.0-video-prime` 的实测比价是 `0.09402988 / 0.1343284`，浮点结果正好是
   * `0.7000000000000001`。`badgeFromRatio` 存的是 `ratio * 10 = 7.000000000000001`，
   * `discount-tag` 再 `/10` 还原，误差会一路留到渲染 —— 必须靠 `formatMultiplier`
   * 的两位小数取整吃掉，不允许把 `x0.7000000000000001` 泄露给用户。
   */
  it('rounds the multiplier so float noise never reaches the badge text', () => {
    const primeModel = pricingModel({
      model_name: 'wan3.0-video-prime',
      model_ratio: 26.25,
      model_price: 0,
      billing_mode: 'tiered_expr',
      billing_expr:
        'u("resolution") == "1080P" ? tier("1080p", (duration > 0 ? duration : 5) * 0.18805969) : (u("resolution") == "480P" ? tier("480p", (duration > 0 ? duration : 5) * 0.04701494) : tier("720p", (duration > 0 ? duration : 5) * 0.09402988))',
      billing_usage_schema: {
        seconds: { type: 'number', unit: 'second' },
        resolution: { type: 'string', enum: ['480P', '720P', '1080P'] },
      },
    })
    render(
      <DiscountTag
        model={primeModel}
        officialPrices={{
          'wan3.0-video-prime': { official_price_per_second: 0.1343284 },
        }}
      />
    )
    const badge = screen.getByText('x0.7')
    expect(badge).toHaveAttribute('title', '-30%')
    expect(badge).toHaveClass('bg-success-hover')
    expect(screen.queryByText(/x0\.7000000/)).not.toBeInTheDocument()
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
