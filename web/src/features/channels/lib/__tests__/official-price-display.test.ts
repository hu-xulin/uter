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
import { describe, expect, test } from 'vitest'

import type { ChannelOfficialPricingView } from '../../types'
import { resolveOfficialDisplayTier } from '../official-price-display'

const tier = (name: string) => ({ range_name: name, unit: 'per_1m_token' })
const officialView = (
  overrides: Partial<ChannelOfficialPricingView>
): ChannelOfficialPricingView => ({
  currency: 'USD',
  unit: 'per_1m_token',
  tiers: [],
  source: 'test',
  fetched_at: 1,
  ...overrides,
})

describe('resolveOfficialDisplayTier', () => {
  test('prefers the authoritative official tier', () => {
    const official = officialView({
      tiers: [tier('official')],
      channel_price_tiers: [tier('catalog')],
    })

    expect(resolveOfficialDisplayTier(official)?.range_name).toBe('official')
  })

  test('does not present a Bailian channel quote as an official price', () => {
    const official = officialView({
      tiers: [],
      channel_price_tiers: [tier('catalog')],
    })

    expect(resolveOfficialDisplayTier(official)).toBeUndefined()
  })

  test('returns undefined when neither tier list has a price', () => {
    expect(resolveOfficialDisplayTier(undefined)).toBeUndefined()
    expect(resolveOfficialDisplayTier(officialView({}))).toBeUndefined()
  })
})
