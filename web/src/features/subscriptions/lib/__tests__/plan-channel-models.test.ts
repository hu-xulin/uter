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
import { describe, expect, it } from 'vitest'

import { parseChannelModels } from '../channel-models'
import { formValuesToPlanPayload, planToFormValues } from '../plan-form'

describe('parseChannelModels', () => {
  it('parses a channel -> models map', () => {
    expect(
      parseChannelModels('{"12":["gpt-4","claude"],"30":["gemini"]}')
    ).toEqual({ 12: ['gpt-4', 'claude'], 30: ['gemini'] })
  })

  it('treats empty and malformed values as unrestricted', () => {
    expect(parseChannelModels('')).toEqual({})
    expect(parseChannelModels('{}')).toEqual({})
    expect(parseChannelModels('not json')).toEqual({})
    expect(parseChannelModels('[]')).toEqual({})
  })

  it('drops non-array and blank entries', () => {
    expect(
      parseChannelModels('{"12":["gpt-4", "", 5],"bad":"x"}')
    ).toEqual({ 12: ['gpt-4'] })
  })
})

describe('plan form channel models round trip', () => {
  it('carries allowed_channel_models through form conversions', () => {
    const raw = '{"12":["gpt-4"]}'
    const values = planToFormValues({
      id: 1,
      title: 'Plan',
      price_amount: 10,
      currency: 'USD',
      duration_unit: 'month',
      duration_value: 1,
      quota_reset_period: 'never',
      enabled: true,
      sort_order: 0,
      allow_balance_pay: true,
      allow_wallet_overflow: true,
      max_purchase_per_user: 0,
      total_amount: 0,
      allowed_channel_models: raw,
    })
    expect(values.allowed_channel_models).toBe(raw)

    const payload = formValuesToPlanPayload(values)
    expect(payload.plan.allowed_channel_models).toBe(raw)
  })
})
