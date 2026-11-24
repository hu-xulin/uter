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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { ChannelPricingScheduleSection } from '../channel-pricing-schedule-section'

beforeEach(() => {
  vi.restoreAllMocks()
})

test('enabling a never-saved schedule submits valid defaults instead of empty basis/mode', async () => {
  // Mirrors the Go zero-value JSON for a channel with no persisted schedule.
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: {
        channel_id: 7,
        enabled: false,
        schedule: {
          enabled: false,
          basis: '',
          mode: '',
          value: 0,
          apply_on_sync: false,
          interval_minutes: 0,
          review_mode: '',
          threshold_percent: 0,
          model_sync_interval_minutes: 0,
          official_sync_interval_minutes: 0,
          channel_sync_interval_minutes: 0,
        },
      },
    },
  })
  const put = vi.spyOn(api, 'put').mockResolvedValue({
    data: { success: true, data: {} },
  })

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={client}>
      <ChannelPricingScheduleSection channelId={7} />
    </QueryClientProvider>
  )

  // The default interval proves the zero-value response was treated as unset.
  await waitFor(() =>
    expect(
      screen.getByLabelText('Official price interval (minutes)')
    ).toHaveValue('1440')
  )

  await user.click(screen.getByRole('switch'))
  await user.click(screen.getByRole('button', { name: 'Save schedule' }))

  await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
  const [, body] = put.mock.calls[0] as [string, Record<string, unknown>]
  expect(body.enabled).toBe(true)
  expect(body.basis).toBe('official')
  expect(body.mode).toBe('multiply')
  expect(body.value).toBe(0.6)
})
