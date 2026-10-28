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
import { describe, expect, it, vi } from 'vitest'

import { pollAlipayOrder } from '../alipay-return'

/** 用固定序列模拟连续查单结果，记录调用次数。 */
function sequenceQuery(statuses: Array<string | Error>) {
  let index = 0
  const query = vi.fn(async () => {
    const status = statuses[Math.min(index, statuses.length - 1)]
    index++
    if (status instanceof Error) throw status
    return { data: { status } }
  })
  return query
}

describe('pollAlipayOrder', () => {
  it('returns success on the first confirmed query and refreshes the balance', async () => {
    const query = sequenceQuery(['success'])
    const onSuccess = vi.fn()
    const onPending = vi.fn()
    const wait = vi.fn(async () => {})

    const status = await pollAlipayOrder('T1', {
      query,
      onSuccess,
      onPending,
      wait,
    })

    expect(status).toBe('success')
    expect(query).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenCalledWith('T1')
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onPending).not.toHaveBeenCalled()
    expect(wait).not.toHaveBeenCalled()
  })

  it('keeps retrying while the gateway still reports pending, then succeeds', async () => {
    // 复现线上现象：回调没到 + 支付宝状态延迟，前两次都是 pending。
    const query = sequenceQuery(['pending', 'pending', 'success'])
    const onSuccess = vi.fn()
    const onPending = vi.fn()
    const wait = vi.fn(async () => {})

    const status = await pollAlipayOrder('T1', {
      query,
      onSuccess,
      onPending,
      wait,
    })

    expect(status).toBe('success')
    expect(query).toHaveBeenCalledTimes(3)
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onPending).not.toHaveBeenCalled()
    expect(wait).toHaveBeenCalledTimes(2)
  })

  it('reports pending after exhausting attempts instead of leaving the order silent', async () => {
    const query = sequenceQuery(['pending'])
    const onSuccess = vi.fn()
    const onPending = vi.fn()
    const wait = vi.fn(async () => {})

    const status = await pollAlipayOrder('T1', {
      query,
      onSuccess,
      onPending,
      attempts: 4,
      wait,
    })

    expect(status).toBe('pending')
    expect(query).toHaveBeenCalledTimes(4)
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onPending).toHaveBeenCalledTimes(1)
    // 4 次尝试之间只等 3 次，最后一次不再空等。
    expect(wait).toHaveBeenCalledTimes(3)
  })

  it('survives transient request errors and still confirms the order', async () => {
    const query = sequenceQuery([new Error('network'), 'success'])
    const onSuccess = vi.fn()
    const onPending = vi.fn()

    const status = await pollAlipayOrder('T1', {
      query,
      onSuccess,
      onPending,
      wait: async () => {},
    })

    expect(status).toBe('success')
    expect(query).toHaveBeenCalledTimes(2)
    expect(onPending).not.toHaveBeenCalled()
  })

  it('stops querying once the page is unmounted', async () => {
    const query = sequenceQuery(['pending'])
    const onSuccess = vi.fn()
    const onPending = vi.fn()
    let cancelled = false

    const status = await pollAlipayOrder('T1', {
      query,
      onSuccess,
      onPending,
      wait: async () => {
        cancelled = true
      },
      isCancelled: () => cancelled,
    })

    expect(status).toBe('pending')
    expect(query).toHaveBeenCalledTimes(1)
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onPending).not.toHaveBeenCalled()
  })

  it('stops polling as soon as the gateway says the order was never paid', async () => {
    // 线上现象：用户下单后没有真正付款，支付宝侧查无此交易。继续重试只会让
    // 用户一直看到「支付确认中」，而那条订单永远不会成功。
    const query = sequenceQuery(['unpaid'])
    const onSuccess = vi.fn()
    const onPending = vi.fn()
    const onUnpaid = vi.fn()
    const wait = vi.fn(async () => {})

    const status = await pollAlipayOrder('T1', {
      query,
      onSuccess,
      onPending,
      onUnpaid,
      wait,
    })

    expect(status).toBe('unpaid')
    expect(query).toHaveBeenCalledTimes(1)
    expect(onUnpaid).toHaveBeenCalledWith('unpaid')
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onPending).not.toHaveBeenCalled()
    expect(wait).not.toHaveBeenCalled()
  })

  it('treats a closed trade as terminal and reports it separately', async () => {
    const query = sequenceQuery(['closed'])
    const onUnpaid = vi.fn()
    const onPending = vi.fn()
    const wait = vi.fn(async () => {})

    const status = await pollAlipayOrder('T1', {
      query,
      onSuccess: vi.fn(),
      onPending,
      onUnpaid,
      wait,
    })

    expect(status).toBe('closed')
    expect(query).toHaveBeenCalledTimes(1)
    expect(onUnpaid).toHaveBeenCalledWith('closed')
    expect(onPending).not.toHaveBeenCalled()
    expect(wait).not.toHaveBeenCalled()
  })

  it('keeps waiting while the trade exists but the buyer has not paid yet', async () => {
    // pending 与 unpaid 必须区分开：交易已存在只是还没付清时，等几秒就会变成
    // success，提前放弃会让刚付完款的用户收到「未支付」的错误提示。
    const query = sequenceQuery(['pending', 'success'])
    const onUnpaid = vi.fn()
    const onSuccess = vi.fn()

    const status = await pollAlipayOrder('T1', {
      query,
      onSuccess,
      onPending: vi.fn(),
      onUnpaid,
      wait: async () => {},
    })

    expect(status).toBe('success')
    expect(query).toHaveBeenCalledTimes(2)
    expect(onUnpaid).not.toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('uses the configured attempt count and interval by default', async () => {
    const query = sequenceQuery(['pending'])
    const wait = vi.fn(async () => {})

    await pollAlipayOrder('T1', {
      query,
      onSuccess: vi.fn(),
      onPending: vi.fn(),
      wait,
    })

    // 常量：4 次尝试、间隔 2000ms。
    expect(query).toHaveBeenCalledTimes(4)
    expect(wait).toHaveBeenCalledTimes(3)
    expect(wait).toHaveBeenCalledWith(2000)
  })
})
