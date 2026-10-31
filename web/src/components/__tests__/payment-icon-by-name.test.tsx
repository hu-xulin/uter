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
import { expect, test } from 'vitest'

import { PaymentIconByName } from '../payment-icon-by-name'

/**
 * 通用微信别名（含后端默认的 `SiWechat`）必须渲染为微信支付品牌标，
 * 不是微信聊天应用的「双气泡」标。两个标靠 viewBox 区分：支付标收紧到
 * `2 3.4 20.1 17.8`，聊天标是 1024×1024。
 *
 * 回归背景：后台支付方式编辑器与对话框预览此前直接走 ReactIconByName，
 * 运营配置 `SiWechat` 时后台看到的还是聊天标，与收银台的支付标不一致。
 */
test.each(['SiWechat', 'SiWeixin', 'RiWechatFill', 'FaWeixin'])(
  'the generic wechat alias %s renders the WeChat Pay brand mark',
  (iconName) => {
    const { container } = render(
      <PaymentIconByName name={iconName} title={iconName} />
    )
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('viewBox', '2 3.4 20.1 17.8')
    expect(screen.getByTitle(iconName)).toBeTruthy()
  }
)

test('a non-wechat icon name still resolves through the lazy icon loader', async () => {
  render(<PaymentIconByName name='SiAlipay' title='Configured Alipay' />)
  const title = await screen.findByTitle('Configured Alipay')
  // simple-icons 是 24×24 满版画布，与收紧后的支付标（20.1×17.8）区分。
  expect(title.closest('svg')).toHaveAttribute('viewBox', '0 0 24 24')
})

test('an unknown icon name renders nothing', () => {
  const { container } = render(<PaymentIconByName name='SiNoSuchIcon' />)
  expect(container.querySelector('svg')).toBeNull()
})
