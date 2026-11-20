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

import {
  CHANNEL_TYPE_APIKO,
  CLAUDE_FIELD_PASSTHROUGH_TYPES,
  FIELD_PASSTHROUGH_TYPES,
  MODEL_FETCHABLE_TYPES,
  OPENAI_FIELD_PASSTHROUGH_TYPES,
} from '../../constants'
import { CHANNEL_FORM_DEFAULT_VALUES, channelFormSchema } from '../channel-form'
import { getChannelTypeConfig } from '../channel-type-config'
import { getChannelTypeIcon } from '../channel-utils'

function apikoForm(overrides: Record<string, unknown> = {}) {
  return {
    ...CHANNEL_FORM_DEFAULT_VALUES,
    type: CHANNEL_TYPE_APIKO,
    name: 'apiko',
    key: 'sk-test',
    models: 'gpt-6.2-sol',
    group: ['default'],
    ...overrides,
  }
}

describe('Apiko channel type', () => {
  test('requires the base URL so requests never resolve to a relative path', () => {
    const result = channelFormSchema.safeParse(apikoForm({ base_url: '' }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === 'base_url')
      ).toBe(true)
    }
  })

  test('accepts the documented relay host', () => {
    const result = channelFormSchema.safeParse(
      apikoForm({ base_url: 'https://api.apiko.app' })
    )
    expect(result.success).toBe(true)
  })

  test('keeps a dedicated icon instead of the generic placeholder', () => {
    expect(getChannelTypeIcon(CHANNEL_TYPE_APIKO)).toBe('Apiko')
    expect(getChannelTypeConfig(CHANNEL_TYPE_APIKO).icon).toBe('Apiko')
  })

  test('is offered by the model-fetch and passthrough controls', () => {
    expect(MODEL_FETCHABLE_TYPES.has(CHANNEL_TYPE_APIKO)).toBe(true)
    expect(FIELD_PASSTHROUGH_TYPES.has(CHANNEL_TYPE_APIKO)).toBe(true)
    expect(OPENAI_FIELD_PASSTHROUGH_TYPES.has(CHANNEL_TYPE_APIKO)).toBe(true)
    expect(CLAUDE_FIELD_PASSTHROUGH_TYPES.has(CHANNEL_TYPE_APIKO)).toBe(true)
  })
})
