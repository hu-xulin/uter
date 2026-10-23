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

import { CHANNEL_TYPE_NEW_API } from '../../constants'
import {
  CHANNEL_TYPE_ADVANCED_CUSTOM,
  CHANNEL_TYPE_BRANDED_AGGREGATE,
  CHANNEL_TYPE_BRANDED_PROXY,
  CHANNEL_TYPE_BRANDED_SHARED,
} from '../advanced-custom'
import { getChannelTypeConfig } from '../channel-type-config'
import { getChannelTypeIcon } from '../channel-utils'

describe('channel type icon keys', () => {
  // `@lobehub/icons` has no "Uter" entry; the keys below must stay registered
  // in `CUSTOM_ICONS` (@/lib/lobe-icon) or every one of these channel types
  // renders the grey single-letter placeholder instead of a logo.
  test.each([
    [CHANNEL_TYPE_ADVANCED_CUSTOM, 'Uter'],
    [CHANNEL_TYPE_NEW_API, 'Uter'],
    [CHANNEL_TYPE_BRANDED_SHARED, 'UterShared'],
    [CHANNEL_TYPE_BRANDED_AGGREGATE, 'UterAggregate'],
    [CHANNEL_TYPE_BRANDED_PROXY, 'UterProxy'],
  ])('maps channel type %i to %s', (type, iconKey) => {
    expect(getChannelTypeIcon(type)).toBe(iconKey)
    expect(getChannelTypeConfig(type).icon).toBe(iconKey)
  })

  test('keeps the three branded variants visually distinct', () => {
    const keys = [
      getChannelTypeIcon(CHANNEL_TYPE_BRANDED_SHARED),
      getChannelTypeIcon(CHANNEL_TYPE_BRANDED_AGGREGATE),
      getChannelTypeIcon(CHANNEL_TYPE_BRANDED_PROXY),
    ]
    expect(new Set(keys).size).toBe(3)
  })

  test('falls back to a real provider glyph for unknown types', () => {
    expect(getChannelTypeIcon(999_999)).toBe('OpenAI')
  })
})
