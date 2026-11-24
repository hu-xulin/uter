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
import type { FetchModelsResponse } from '../types'

export type CurrentAddressRefreshInput = {
  channelId: number
  baseUrl: string
  type: number
  key?: string
  advancedCustom?: string
  headerOverride?: string
  proxy?: string
}

export type FetchModelsFetcher = (
  data: FetchModelsApiPayload
) => Promise<FetchModelsResponse>

type FetchModelsApiPayload = {
  base_url: string
  type: number
  key?: string
  channel_id?: number
  advanced_custom?: string
  header_override?: string
  proxy?: string
}

/**
 * Re-discover upstream models using the form's current Base URL while letting
 * the server reuse the saved channel credential (channel_id with no key).
 * Editing a Uter Route gateway address otherwise keeps reading the old saved
 * address, so operators need an explicit refresh bound to the new value.
 */
export async function fetchModelsWithCurrentAddress(
  fetcher: FetchModelsFetcher,
  input: CurrentAddressRefreshInput
): Promise<string[]> {
  const response = await fetcher({
    base_url: input.baseUrl,
    type: input.type,
    key: input.key,
    channel_id: input.channelId,
    advanced_custom: input.advancedCustom,
    header_override: input.headerOverride,
    proxy: input.proxy,
  })
  if (!response.success) {
    throw new Error(response.message || 'Failed to fetch models')
  }
  return response.data ?? []
}
