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
import {
  ALIPAY_RETURN_QUERY_ATTEMPTS,
  ALIPAY_RETURN_QUERY_INTERVAL_MS,
} from '../constants'

export type AlipayOrderStatus = 'success' | 'pending' | 'unpaid' | 'closed'

export interface PollAlipayOrderOptions {
  /** 支付宝查单请求，返回 { data: { status } }。 */
  query: (
    tradeNo: string
  ) => Promise<{ data?: { status?: string } } | undefined>
  /** 查到 success 时执行（刷新余额等）。 */
  onSuccess: () => void | Promise<void>
  /** 所有尝试都未确认时执行。 */
  onPending: () => void
  /**
   * 查到 unpaid / closed 时执行：这两者是终态，继续轮询不会有任何变化。
   * unpaid 表示支付宝侧查无此交易（用户从未付款），closed 表示交易已关闭。
   */
  onUnpaid?: (status: 'unpaid' | 'closed') => void | Promise<void>
  attempts?: number
  intervalMs?: number
  /** 注入等待实现，测试里可省掉真实定时器。 */
  wait?: (ms: number) => Promise<void>
  /** 组件卸载后中止，避免继续请求与调用回调。 */
  isCancelled?: () => boolean
}

/**
 * 支付宝收银台回跳后的主动查单轮询。
 *
 * 背景：异步回调（notify_url）在本地 / 内网环境不可达，且支付宝侧交易状态在
 * 付款后有几秒延迟。单次查单容易拿到 pending，导致订单一直显示「待确认」。
 * 这里做有限次重试：命中 success 立即返回并通知调用方刷新余额；全部尝试仍是
 * pending 才提示「支付确认中」。单次请求异常不中断重试。
 *
 * unpaid / closed 是终态：支付宝侧查无此交易或交易已关闭，再等一万次也不会
 * 变成功。遇到它们必须立刻停止重试并回调 onUnpaid，否则用户会一直看到
 * 「支付确认中」，而那条订单其实永远不会成功。
 */
export async function pollAlipayOrder(
  tradeNo: string,
  options: PollAlipayOrderOptions
): Promise<AlipayOrderStatus> {
  const attempts = options.attempts ?? ALIPAY_RETURN_QUERY_ATTEMPTS
  const intervalMs = options.intervalMs ?? ALIPAY_RETURN_QUERY_INTERVAL_MS
  const wait =
    options.wait ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))

  for (let attempt = 0; attempt < attempts; attempt++) {
    // 等待期间组件可能已卸载，进入下一次请求前先确认。
    if (options.isCancelled?.()) return 'pending'
    try {
      const response = await options.query(tradeNo)
      if (options.isCancelled?.()) return 'pending'
      const status = response?.data?.status
      if (status === 'success') {
        await options.onSuccess()
        return 'success'
      }
      if (status === 'unpaid' || status === 'closed') {
        await options.onUnpaid?.(status)
        return status
      }
    } catch {
      // 单次查单失败继续重试：异步回调仍可能随后到达。
    }
    if (options.isCancelled?.()) return 'pending'
    if (attempt < attempts - 1) {
      await wait(intervalMs)
    }
  }
  if (options.isCancelled?.()) return 'pending'
  options.onPending()
  return 'pending'
}
