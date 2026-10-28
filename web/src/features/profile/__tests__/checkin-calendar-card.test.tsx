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

You should have received a copy of the GNU Affero General License
along with this program. Not found? See <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { formatQuotaWithCurrency } from '@/lib/currency'

import { getCheckinStatus } from '../api'
import { CheckinCalendarCard } from '../components/checkin-calendar-card'
import type { CheckinStatusResponse } from '../types'

vi.mock('../api', () => ({
  getCheckinStatus: vi.fn(),
  performCheckin: vi.fn(),
}))

const mockedGetCheckinStatus = vi.mocked(getCheckinStatus)

// Uter.ai 账号的真实签到数据（quotaPerUnit = 500000，1 USD = 500000 额度）。
// 合计 1,340,277 额度 = $2.6806。
const realRecords = [
  { checkin_date: '2026-09-29', quota_awarded: 3 },
  { checkin_date: '2026-10-01', quota_awarded: 303844 },
  { checkin_date: '2026-10-02', quota_awarded: 191058 },
  { checkin_date: '2026-10-03', quota_awarded: 226139 },
  { checkin_date: '2026-10-07', quota_awarded: 63955 },
  { checkin_date: '2026-10-25', quota_awarded: 223463 },
  { checkin_date: '2026-10-27', quota_awarded: 212764 },
  { checkin_date: '2026-10-28', quota_awarded: 119051 },
]
const realTotalQuota = 1340277

const stats: CheckinStatusResponse['stats'] = {
  total_quota: realTotalQuota,
  total_checkins: realRecords.length,
  checkin_count: realRecords.length - 1,
  checked_in_today: true,
  today: '2026-10-28',
  records: realRecords,
}

function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <CheckinCalendarCard
        checkinEnabled
        turnstileEnabled={false}
        turnstileSiteKey=''
      />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  mockedGetCheckinStatus.mockResolvedValue({
    success: true,
    message: 'success',
    data: { enabled: true, min_quota: 50000, max_quota: 250000, stats },
  } as unknown as Awaited<ReturnType<typeof getCheckinStatus>>)
})

/**
 * 「本月」与「累计」两张卡必须显示**真实金额**，不能把美元截成整数。
 *
 * 回归背景：这两张卡曾传 `digitsLarge: 0`，把 $2.68 显示成 $3。签到单次奖励
 * 只有 $0.10–$0.50，截断后卡片只能在 $0/$1/$2 之间跳，用户看到的就是
 * 「月度/累计一直按 1 美元往上加」，与日历里每天 $0.2381 的奖励对不上。
 */
describe('CheckinCalendarCard 统计金额精度', () => {
  it('累计与本月显示到分，而不是被截成整美元', async () => {
    renderCard()

    // 与卡片同源的格式化结果：默认精度（≥1 两位小数、<1 四位小数）。
    const expected = formatQuotaWithCurrency(realTotalQuota)
    // 前提校验：截断后的确与真实金额不同，否则本用例抓不到回归。
    const truncated = formatQuotaWithCurrency(realTotalQuota, {
      digitsLarge: 0,
    })
    expect(truncated).not.toBe(expected)

    // 两张卡（本月 / 累计）都必须是真实金额。
    await waitFor(() => {
      expect(screen.getAllByText(expected)).toHaveLength(2)
    })
    expect(screen.queryByText(truncated)).toBeNull()
  })

  it('今日奖励与两张统计卡都只保留两位小数', async () => {
    const { container } = renderCard()

    // 今天（2026-10-28）的奖励是 119,051 额度 = $0.238102。
    // 默认精度（<1 四位小数）会原样显示 $0.2381，卡片上读起来像一串随机数。
    const raw = formatQuotaWithCurrency(119051)
    const rounded = formatQuotaWithCurrency(119051, {
      digitsLarge: 2,
      digitsSmall: 2,
    })
    // 前提校验：两位小数与默认精度确实不同，否则本用例抓不到回归。
    expect(rounded).not.toBe(raw)

    await waitFor(() => {
      expect(container.textContent).toContain(`+${rounded}`)
    })
    expect(container.textContent).not.toContain(`+${raw}`)
  })
})
