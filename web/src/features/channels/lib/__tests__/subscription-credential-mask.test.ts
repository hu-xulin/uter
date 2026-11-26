import { describe, expect, it } from 'vitest'

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
import type { SystemOption } from '@/features/system-settings/types'

import {
  readChannelProviderKeyMask,
  readSubscriptionKeyMask,
} from '../subscription-credential-mask'

function optionsWithMask(value: string): SystemOption[] {
  return [
    {
      key: 'ChannelProviderCredentialMasks',
      value: JSON.stringify({
        subscription: { password: 'pw********', api_key: value },
        featured: { api_key: 'featured****key' },
        bailian: { api_key: 'bailian****key' },
      }),
    },
  ]
}

describe('readSubscriptionKeyMask', () => {
  it('reads the subscription api_key per-line masks, not other groups', () => {
    expect(
      readSubscriptionKeyMask(optionsWithMask('abcd****wxyz\nkey2****9999'))
    ).toEqual(['abcd****wxyz', 'key2****9999'])
  })

  it('returns empty when no options or no mask option', () => {
    expect(readSubscriptionKeyMask(undefined)).toEqual([])
    expect(readSubscriptionKeyMask([])).toEqual([])
  })

  it('returns empty on invalid JSON or wrong shape', () => {
    expect(
      readSubscriptionKeyMask([
        { key: 'ChannelProviderCredentialMasks', value: 'not-json' },
      ])
    ).toEqual([])
    expect(
      readSubscriptionKeyMask([
        { key: 'ChannelProviderCredentialMasks', value: '[]' },
      ])
    ).toEqual([])
  })

  it('returns empty when subscription api_key is blank or missing', () => {
    expect(readSubscriptionKeyMask(optionsWithMask(''))).toEqual([])
    expect(readSubscriptionKeyMask(optionsWithMask('   \n  '))).toEqual([])
    expect(
      readSubscriptionKeyMask([
        {
          key: 'ChannelProviderCredentialMasks',
          value: JSON.stringify({ subscription: {} }),
        },
      ])
    ).toEqual([])
  })

  it('drops blank lines but keeps each saved key on its own line', () => {
    expect(
      readSubscriptionKeyMask(optionsWithMask('abcd****wxyz\n\nkey2****9999\n'))
    ).toEqual(['abcd****wxyz', 'key2****9999'])
  })
})

describe('readChannelProviderKeyMask', () => {
  const options = optionsWithMask('subscription****key')

  it.each([
    ['featured', ['featured****key']],
    ['bailian', ['bailian****key']],
    ['subscription', ['subscription****key']],
  ] as const)('reads the %s group api_key masks', (group, expected) => {
    expect(readChannelProviderKeyMask(options, group)).toEqual(expected)
  })

  it('returns empty for a group without a saved api_key', () => {
    expect(
      readChannelProviderKeyMask(
        [
          {
            key: 'ChannelProviderCredentialMasks',
            value: JSON.stringify({ featured: { password: 'pw********' } }),
          },
        ],
        'featured'
      )
    ).toEqual([])
  })
})
