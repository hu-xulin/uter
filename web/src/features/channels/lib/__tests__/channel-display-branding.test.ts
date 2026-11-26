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

import { getChannelDisplayBranding } from '../channel-utils'

describe('getChannelDisplayBranding', () => {
  test('renders branding logo on non-advanced-custom channels (regression: channel 1270, type 64)', () => {
    const settings = JSON.stringify({
      branding: {
        display_name: 'Claude Basic',
        logo: 'data:image/png;base64,AAAA',
        logo_dark: 'data:image/png;base64,BBBB',
      },
    })
    expect(getChannelDisplayBranding(settings, false)).toEqual({
      displayName: 'Claude Basic',
      logo: 'data:image/png;base64,AAAA',
    })
    expect(getChannelDisplayBranding(settings, true)).toEqual({
      displayName: 'Claude Basic',
      logo: 'data:image/png;base64,BBBB',
    })
  })

  test('renders advanced_custom logo on type 58 channels', () => {
    const settings = JSON.stringify({
      advanced_custom: {
        display_name: 'Custom Relay',
        logo: 'https://cdn.example/light.svg',
        logo_dark: 'https://cdn.example/dark.svg',
      },
    })
    expect(getChannelDisplayBranding(settings, false).logo).toBe(
      'https://cdn.example/light.svg'
    )
    expect(getChannelDisplayBranding(settings, true).logo).toBe(
      'https://cdn.example/dark.svg'
    )
  })

  test('falls back to light logo in dark mode when dark logo is absent', () => {
    const settings = JSON.stringify({
      branding: { logo: 'https://cdn.example/light.svg' },
    })
    expect(getChannelDisplayBranding(settings, true).logo).toBe(
      'https://cdn.example/light.svg'
    )
  })

  test('branding takes priority over stale advanced_custom values', () => {
    const settings = JSON.stringify({
      branding: {
        display_name: 'New Name',
        logo: 'https://cdn.example/new.svg',
      },
      advanced_custom: {
        display_name: 'Old Name',
        logo: 'https://cdn.example/old.svg',
      },
    })
    expect(getChannelDisplayBranding(settings, false)).toEqual({
      displayName: 'New Name',
      logo: 'https://cdn.example/new.svg',
    })
  })

  test('returns empty branding for null, empty, malformed or logo-less settings', () => {
    for (const settings of [
      null,
      undefined,
      '',
      '{}',
      'not json',
      '{"other":1}',
    ]) {
      expect(getChannelDisplayBranding(settings, false)).toEqual({
        displayName: '',
        logo: '',
      })
    }
    expect(
      getChannelDisplayBranding(
        JSON.stringify({ branding: { display_name: '  ', logo: '  ' } }),
        false
      )
    ).toEqual({ displayName: '', logo: '' })
  })
})
