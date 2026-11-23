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

import { isUterRouteBaseUrl } from '../uterroute'

describe('isUterRouteBaseUrl', () => {
  test('matches the configured host and its subdomains', () => {
    expect(
      isUterRouteBaseUrl(
        'https://example-upstream.test/v1',
        'example-upstream.test'
      )
    ).toBe(true)
    expect(
      isUterRouteBaseUrl('api.example-upstream.test', 'example-upstream.test')
    ).toBe(true)
    expect(
      isUterRouteBaseUrl(
        'https://EXAMPLE-UPSTREAM.TEST',
        'example-upstream.test'
      )
    ).toBe(true)
  })

  test('rejects lookalike hosts and missing configuration', () => {
    expect(
      isUterRouteBaseUrl(
        'https://example-upstream.test.evil.example',
        'example-upstream.test'
      )
    ).toBe(false)
    expect(
      isUterRouteBaseUrl(
        'https://evil-example-upstream.test',
        'example-upstream.test'
      )
    ).toBe(false)
    expect(
      isUterRouteBaseUrl('https://api.example.com', 'example-upstream.test')
    ).toBe(false)
    expect(isUterRouteBaseUrl('https://example-upstream.test', '')).toBe(false)
    expect(isUterRouteBaseUrl('', 'example-upstream.test')).toBe(false)
  })
})
