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
import { expect, test, vi } from 'vitest'

import { fetchModelsWithCurrentAddress } from '../channel-address-refresh'

test('refreshing from a changed address sends the current base_url with the saved channel id', async () => {
  const fetcher = vi.fn(async () => ({
    success: true,
    data: ['new-a', 'new-b'],
  }))

  const models = await fetchModelsWithCurrentAddress(fetcher, {
    channelId: 42,
    baseUrl: 'https://new-gateway.example.com',
    type: 65,
  })

  expect(fetcher).toHaveBeenCalledWith(
    expect.objectContaining({
      channel_id: 42,
      base_url: 'https://new-gateway.example.com',
      type: 65,
    })
  )
  expect(models).toEqual(['new-a', 'new-b'])
})

test('refreshing from a changed address propagates server failures', async () => {
  const fetcher = vi.fn(async () => ({
    success: false,
    message: 'upstream unreachable',
    data: [],
  }))

  await expect(
    fetchModelsWithCurrentAddress(fetcher, {
      channelId: 42,
      baseUrl: 'https://new-gateway.example.com',
      type: 65,
    })
  ).rejects.toThrow('upstream unreachable')
})
