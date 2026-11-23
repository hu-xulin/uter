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
  CHANNEL_TYPE_OPTIONS,
  CHANNEL_TYPE_TASK_PLUGIN,
  CHANNEL_TYPE_UTER,
  CHANNEL_TYPE_UTER_API,
  channelTypeOptionsForTaskPluginBind,
} from '../../constants'

describe('channel type numbering', () => {
  test('every option number is unique', () => {
    const numbers = CHANNEL_TYPE_OPTIONS.map((option) => option.value)

    expect(new Set(numbers).size).toBe(numbers.length)
  })

  test('Uter and Uter.api use distinct numbers and labels', () => {
    expect(CHANNEL_TYPE_UTER).toBe(60)
    expect(CHANNEL_TYPE_UTER_API).toBe(64)
    const labels = new Map(
      CHANNEL_TYPE_OPTIONS.map((option) => [option.value, option.label])
    )

    expect(labels.get(CHANNEL_TYPE_UTER)).toBe('Uter')
    expect(labels.get(CHANNEL_TYPE_UTER_API)).toBe('Uter.api')
  })
})

describe('channel type options for task plugin bind', () => {
  test('hides the task plugin type when the caller cannot bind', () => {
    const options = channelTypeOptionsForTaskPluginBind(false)

    expect(
      options.some((option) => option.value === CHANNEL_TYPE_TASK_PLUGIN)
    ).toBe(false)
  })

  test('shows the task plugin type when the caller can bind', () => {
    const options = channelTypeOptionsForTaskPluginBind(true)

    expect(options).toEqual(CHANNEL_TYPE_OPTIONS)
    expect(
      options.some((option) => option.value === CHANNEL_TYPE_TASK_PLUGIN)
    ).toBe(true)
  })
})
