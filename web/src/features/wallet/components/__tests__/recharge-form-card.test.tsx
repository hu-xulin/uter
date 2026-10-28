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
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import type { PresetAmount, TopupInfo } from '../../types'
import { RechargeFormCard } from '../recharge-form-card'

function topupInfo(overrides: Partial<TopupInfo> = {}): TopupInfo {
  return {
    amount_options: [],
    discount: {},
    enable_online_topup: false,
    enable_stripe_topup: false,
    enable_waffo_topup: false,
    enable_waffo_pancake_topup: false,
    enable_alipay_topup: true,
    enable_wechat_pay_topup: false,
    min_topup: 0.01,
    stripe_min_topup: 1,
    ...overrides,
  } as TopupInfo
}

function renderCard(props: {
  presetAmounts?: PresetAmount[]
  onTopupAmountChange?: (amount: number) => void
  topupAmount?: number
}) {
  return render(
    <RechargeFormCard
      topupInfo={topupInfo()}
      presetAmounts={props.presetAmounts ?? []}
      selectedPreset={null}
      onSelectPreset={() => undefined}
      topupAmount={props.topupAmount ?? 0}
      onTopupAmountChange={props.onTopupAmountChange ?? (() => undefined)}
      paymentAmount={0}
      calculating={false}
      onPaymentMethodSelect={() => undefined}
      paymentLoading={null}
      redemptionCode=''
      onRedemptionCodeChange={() => undefined}
      onRedeem={() => undefined}
      redeeming={false}
      priceRatio={7.3}
      usdExchangeRate={1}
    />
  )
}

describe('RechargeFormCard custom amount', () => {
  /**
   * 回归背景（2026-10-28）：`handleAmountChange` 用 `Number.parseInt`，运营把
   * 「最低充值」改成 0.01 后，用户输入 0.5 会被截成 0 —— 输入框里显示 0.5，
   * 提交给后端的是 0，0.01 起充等于没生效。
   */
  test('keeps the decimal part the user types', async () => {
    const onTopupAmountChange = vi.fn()
    renderCard({ onTopupAmountChange })
    const user = userEvent.setup()
    const input = screen.getByLabelText('Custom Amount')

    await user.clear(input)
    await user.type(input, '0.5')

    expect(input).toHaveValue(0.5)
    expect(onTopupAmountChange).toHaveBeenLastCalledWith(0.5)
  })

  /**
   * 同步 effect 曾把 `topupAmount.toString()` 直接写回输入框：输入 `1.` 时
   * 数值仍是 1，effect 就把 `1.` 回写成 `1`，小数点永远打不进去。
   */
  test('does not rewrite an in-progress decimal while typing', async () => {
    const onTopupAmountChange = vi.fn()
    renderCard({ onTopupAmountChange })
    const user = userEvent.setup()
    const input = screen.getByLabelText('Custom Amount')

    await user.clear(input)
    await user.type(input, '1.25')

    expect(input).toHaveValue(1.25)
    expect(onTopupAmountChange).toHaveBeenLastCalledWith(1.25)
  })
})

describe('RechargeFormCard discount badge', () => {
  /**
   * 折扣（< 1）绿底 #15803D，加价（≥ 1）红底 #EF4444 —— 与定价页角标同一套
   * Token（`DiscountBadge`）。此前这里是纯文字 `text-success`，没有底色。
   */
  test('paints a discount green and a markup red', () => {
    renderCard({
      presetAmounts: [
        { value: 10, discount: 0.8 },
        { value: 20, discount: 1.2 },
      ],
    })

    const discount = screen.getByText('20% OFF')
    expect(discount).toHaveClass('bg-success-hover')
    expect(discount).toHaveClass('text-on-emphasis')

    const markup = screen.getByText('+20%')
    expect(markup).toHaveClass('bg-destructive-hover')
    expect(markup).toHaveClass('text-on-emphasis')
  })

  test('renders no badge when the preset has no price difference', () => {
    renderCard({ presetAmounts: [{ value: 10, discount: 1 }] })
    expect(screen.queryByText('0% OFF')).not.toBeInTheDocument()
  })
})
