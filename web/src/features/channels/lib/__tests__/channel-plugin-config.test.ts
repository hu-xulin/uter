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
import assert from 'node:assert/strict'
import { describe, test } from 'vitest'

import {
  channelConfigFields,
  parsePluginConfigObject,
  pluginConfigFieldValue,
  pluginConfigNumberText,
  pluginConfigNumberValue,
  setPluginConfigField,
} from '../channel-plugin-config'

describe('channel plugin config schema', () => {
  test('lists top-level primitive fields and skips nested shapes', () => {
    const fields = channelConfigFields({
      type: 'object',
      properties: {
        region: {
          type: 'string',
          title: { en: 'Region' },
          enum: ['us', 'eu'],
          default: 'us',
        },
        timeout: { type: 'number', description: { en: 'Seconds' } },
        enabled: { type: 'boolean' },
        regions: {
          type: 'object',
          additionalProperties: { type: 'string' },
        },
        list: { type: 'array' },
      },
    })
    assert.deepEqual(
      fields.map((field) => field.name),
      ['region', 'timeout', 'enabled']
    )
    assert.deepEqual(fields[0].enum, ['us', 'eu'])
    assert.equal(channelConfigFields(null).length, 0)
  })

  test('reads saved values, falls back to defaults and clears on undefined', () => {
    const fields = channelConfigFields({
      type: 'object',
      properties: { region: { type: 'string', default: 'us' } },
    })
    const field = fields[0]
    assert.equal(pluginConfigFieldValue({}, field), 'us')
    assert.equal(pluginConfigFieldValue({ region: 'eu' }, field), 'eu')

    const cleared = setPluginConfigField({ region: 'eu' }, field, undefined)
    assert.deepEqual(cleared, {})
    const set = setPluginConfigField({}, field, 'eu')
    assert.deepEqual(set, { region: 'eu' })
  })

  test('parses only JSON objects and converts numbers safely', () => {
    assert.deepEqual(parsePluginConfigObject(''), {})
    assert.deepEqual(parsePluginConfigObject('{"a":1}'), { a: 1 })
    assert.equal(parsePluginConfigObject('[]'), null)
    assert.equal(parsePluginConfigObject('not json'), null)

    assert.equal(pluginConfigNumberText(30), '30')
    assert.equal(pluginConfigNumberText('x'), 'x')
    assert.equal(pluginConfigNumberValue(' 30 '), 30)
    assert.equal(pluginConfigNumberValue(''), undefined)
    assert.equal(pluginConfigNumberValue('x'), undefined)
  })
})