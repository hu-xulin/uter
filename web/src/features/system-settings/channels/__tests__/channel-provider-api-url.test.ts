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

import { getOptionValue } from '../../hooks/use-system-options'
import type { SystemOption } from '../../types'
import { defaultChannelProviderSettings } from '../channel-provider-settings-defaults'
import { applyChannelProviderMaskView } from '../channel-provider-settings-form'

describe('channel provider API address persistence', () => {
  const prefixes = ['featured', 'bailian', 'subscription'] as const

  it.each(prefixes)(
    '%s keeps the saved API address after system options load',
    (prefix) => {
      const optionKey = `channel_provider.${prefix}.api_url`
      const apiUrl = `https://api-${prefix}.example`
      const rawOptions: SystemOption[] = [
        { key: optionKey, value: apiUrl },
        { key: 'ChannelProviderCredentialMasks', value: '{}' },
      ]

      // This is the exact resolver chain used by SettingsPage on every load
      // and after every save refetch.
      const settings = applyChannelProviderMaskView(
        getOptionValue(rawOptions, defaultChannelProviderSettings),
        rawOptions
      )

      expect(settings[optionKey]).toBe(apiUrl)
    }
  )
})
