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
import { render, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import type { PaymentMethod } from '../../../types'
import { CnPayWebDialog } from '../cn-pay-web-dialog'

// vi.mock 会被 vitest 提升到所有 import 之前，所以被测模块照常写在顶部导入即可。
const mocks = vi.hoisted(() => ({
  requestAlipayWebPayment: vi.fn(),
  requestWechatWebPayment: vi.fn(),
}))

vi.mock('../../../api', () => ({
  requestAlipayWebPayment: mocks.requestAlipayWebPayment,
  requestWechatWebPayment: mocks.requestWechatWebPayment,
  isApiSuccess: (response: { success?: boolean; message?: string }) =>
    response?.success === true || response?.message === 'success',
}))

// The dialog polls the wallet after opening; keep it off the network.
vi.mock('@/lib/api', () => ({
  getSelf: vi.fn().mockResolvedValue({ success: false }),
}))
vi.mock('@/lib/handle-server-error', () => ({
  handleServerError: vi.fn(),
}))

const alipayMethod = { name: '支付宝', type: 'alipay_web' } as PaymentMethod

function renderDialog(topupAmount: number) {
  return render(
    <CnPayWebDialog
      open
      onOpenChange={() => undefined}
      topupAmount={topupAmount}
      paymentAmount={0.07}
      initialQuota={0}
      paymentMethod={alipayMethod}
      onSuccess={() => undefined}
    />
  )
}

describe('CnPayWebDialog order amount', () => {
  // 真实故障（2026-10-28）：最低充值改成 0.01 后点支付宝仍提示「创建订单
  // 失败」。收银台用 Math.floor(topupAmount) 把 0.01 截成 0 发给后端，后端
  // 最小额校验（0 < 0.01）直接拒绝。这里锁死「弹窗请求里的 amount 就是用户
  // 输入的小额」，而不是被取整成 0。
  test('sends the sub-dollar amount as-is instead of truncating to 0', async () => {
    mocks.requestAlipayWebPayment.mockResolvedValue({ message: 'error' })
    renderDialog(0.01)

    await waitFor(() => {
      expect(mocks.requestAlipayWebPayment).toHaveBeenCalledTimes(1)
    })
    expect(mocks.requestAlipayWebPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 0.01, payment_method: 'alipay_web' })
    )
  })
})
