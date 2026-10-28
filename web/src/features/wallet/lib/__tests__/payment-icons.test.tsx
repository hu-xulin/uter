/*
Copyright (C) 2023-2026 QuantumNous

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

For commercial licensing, please contact support@quantumnous.com
*/
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { PAYMENT_ICON_COLORS, PAYMENT_TYPES } from '../../constants'
import { getPaymentIcon } from '../ui'

test.each([
  [PAYMENT_TYPES.ALIPAY, 'Alipay'],
  [PAYMENT_TYPES.WECHAT, 'WeChat Pay'],
  [PAYMENT_TYPES.STRIPE, 'Stripe'],
])(
  'the built-in %s icon preserves the requested size and payment color',
  (type, label) => {
    render(getPaymentIcon(type, 'h-6 w-6'))
    const icon = screen.getByRole('img', { name: label })
    expect(icon).toHaveClass('h-6', 'w-6')
    expect(icon).toHaveStyle({ color: PAYMENT_ICON_COLORS[type] })
  }
)

/**
 * 「微信支付」必须用支付品牌标，不是微信聊天应用的「双气泡」标。
 *
 * 回归背景：后端 `pay_methods` 的默认图标是 `SiWechat`，收银台一度把
 * 「微信支付」画成聊天软件 —— 用户以为是点开微信扫码聊天。两个标靠 viewBox
 * 区分：支付标是收紧到图形边界的 24 网格（`2 3.4 20.1 17.8`），聊天标是 1024×1024。
 */
test.each([PAYMENT_TYPES.WECHAT, PAYMENT_TYPES.WECHAT_PAY_WEB])(
  '%s renders the WeChat Pay brand mark, not the chat logo',
  (type) => {
    const { container } = render(getPaymentIcon(type, 'h-6 w-6'))
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('viewBox', '2 3.4 20.1 17.8')
    expect(svg?.querySelector('title')?.textContent).toBe('WeChat Pay')
  }
)

/**
 * 运营把图标配成通用微信别名（`SiWechat` 等）时，上下文恒为「微信支付」，
 * 因此要升级成支付标；自定义显示名不能丢。
 */
test.each(['SiWechat', 'RiWechatFill', 'FaWeixin'])(
  'the generic %s alias is upgraded to the WeChat Pay mark',
  async (iconName) => {
    render(
      getPaymentIcon(
        PAYMENT_TYPES.WECHAT,
        'h-4 w-4',
        iconName,
        'Configured WeChat'
      )
    )
    const title = await screen.findByTitle('Configured WeChat')
    const svg = title.closest('svg')
    expect(svg).toHaveAttribute('viewBox', '2 3.4 20.1 17.8')
    expect(svg).toHaveStyle({
      color: PAYMENT_ICON_COLORS[PAYMENT_TYPES.WECHAT],
    })
  }
)

test('an admin-configured Simple Icon still resolves through the lazy icon loader', async () => {
  render(
    getPaymentIcon(
      PAYMENT_TYPES.ALIPAY,
      'h-4 w-4',
      'SiAlipay',
      'Configured Alipay'
    )
  )
  const title = await screen.findByTitle('Configured Alipay')
  expect(title.closest('svg')).toHaveClass('h-4', 'w-4')
})

/**
 * 后端默认 pay_methods 就带 `icon: "SiAlipay"` / `"SiWechat"`，收银台走的是
 * react-icons 分支。这条用例锁住「配置了图标名也要套品牌色」—— 早期实现只给
 * 内置分支上色，收银台的支付宝/微信图标因此是黑的。
 */
test('a configured Alipay icon keeps the payment brand color', async () => {
  render(
    getPaymentIcon(
      PAYMENT_TYPES.ALIPAY,
      'h-4 w-4',
      'SiAlipay',
      'Configured Alipay'
    )
  )
  const svg = (await screen.findByTitle('Configured Alipay')).closest('svg')
  expect(svg).not.toBeNull()
  // react-icons 把 color 写进内联 style，而不是 svg 属性。
  expect(svg).toHaveStyle({ color: PAYMENT_ICON_COLORS[PAYMENT_TYPES.ALIPAY] })
})
