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

import { isMaskedSecret } from '@/lib/secret'

import type { SystemOption } from '../../types'
import { readChannelProviderCredentialSlots } from '../channel-provider-credential-slots'
import { defaultChannelProviderSettings } from '../channel-provider-settings-defaults'
import { applyChannelProviderMaskView } from '../channel-provider-settings-form'

type Prefix = 'featured' | 'bailian' | 'subscription'
const prefixes: Prefix[] = ['featured', 'bailian', 'subscription']

function slotFixture(prefix: Prefix, apiKeyValue: string) {
  const slotId = `slot-${prefix}`
  const metadata = JSON.stringify([
    {
      id: slotId,
      group: 'default',
      label: '',
      mode: 'single',
      strategy: 'random',
    },
  ])
  const rawOptions: SystemOption[] = [
    {
      key: `channel_provider.${prefix}.credential_slots`,
      value: metadata,
    },
    {
      key: `channel_provider.${prefix}.slot_${slotId}_api_key`,
      value: apiKeyValue,
    },
  ]
  // Simulate getOptionValue(): dynamic slot keys are not in defaults.
  const settingsAfterFilter = {
    ...defaultChannelProviderSettings,
    [`channel_provider.${prefix}.credential_slots`]: '',
  }
  return { prefix, rawOptions, settingsAfterFilter, slotId }
}

describe('channel provider credential mask fallback', () => {
  it.each(prefixes)(
    '%s keeps the saved slot key mask when the derived mask view is absent',
    (prefix) => {
      const savedMask = 'sk-A****1234'
      const fixture = slotFixture(prefix, savedMask)

      const resolved = applyChannelProviderMaskView(
        fixture.settingsAfterFilter,
        fixture.rawOptions
      )
      const slots = readChannelProviderCredentialSlots(resolved, prefix)

      expect(slots).toHaveLength(1)
      expect(slots[0]?.apiKey).toBe(savedMask)
    }
  )

  it('masks a raw slot value instead of exposing it when the derived mask view is absent', () => {
    const rawValue = 'sk-plaintext-secret-1234567890'
    const fixture = slotFixture('subscription', rawValue)

    const resolved = applyChannelProviderMaskView(
      fixture.settingsAfterFilter,
      fixture.rawOptions
    )
    const slots = readChannelProviderCredentialSlots(resolved, 'subscription')

    expect(slots).toHaveLength(1)
    expect(slots[0]?.apiKey).not.toBe(rawValue)
    expect(isMaskedSecret(slots[0]?.apiKey ?? '')).toBe(true)
  })
})
