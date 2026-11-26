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
import { expect, test } from 'vitest'

import { filterPricingRowsToPublishedAliases } from '../model-mapping-validation'

function row(modelName: string, status = 'configured', provider = 'uterroute') {
  return {
    model_name: modelName,
    provider,
    region: '',
    deployment_id: '',
    status,
  }
}

test('只保留已发布别名，避免别名与上游原名各占一行', () => {
  const rows = [
    row('MiniMax-H3-Max'),
    row('MiniMax-H3-Max-dr'),
    row('Other-Model'),
  ]

  const visible = filterPricingRowsToPublishedAliases(
    rows,
    '{"MiniMax-H3-Max-dr":"MiniMax-H3-Max"}',
    ['MiniMax-H3-Max-dr']
  )

  expect(visible.map((item) => item.model_name)).toEqual(['MiniMax-H3-Max-dr'])
})

test('上游原名价格行会展开为所有已发布别名，且每个别名只出现一次', () => {
  const rows = [row('upstream-model')]

  const visible = filterPricingRowsToPublishedAliases(
    rows,
    '{"alias-one":"upstream-model","alias-two":"upstream-model"}',
    ['alias-one', 'alias-two']
  )

  expect(visible.map((item) => item.model_name)).toEqual([
    'alias-one',
    'alias-two',
  ])
})

test('不同 provider 的同名别名行仍分别保留', () => {
  const rows = [
    row('alias-model', 'configured', 'uterroute'),
    row('alias-model', 'needs_review', 'newapi-compatible'),
  ]

  const visible = filterPricingRowsToPublishedAliases(
    rows,
    '{"alias-model":"upstream-model"}',
    ['alias-model']
  )

  expect(visible).toHaveLength(2)
  expect(visible.map((item) => item.provider)).toEqual([
    'uterroute',
    'newapi-compatible',
  ])
})

test('其他渠道的映射也只保留该渠道已发布别名', () => {
  const rows = [
    row('gpt-5-upstream'),
    row('gpt-5-upstream-dr'),
    row('claude-upstream'),
    row('claude-upstream-dr'),
  ]

  const visible = filterPricingRowsToPublishedAliases(
    rows,
    '{"gpt-5-upstream-dr":"gpt-5-upstream"}',
    ['gpt-5-upstream-dr']
  )

  expect(visible.map((item) => item.model_name)).toEqual(['gpt-5-upstream-dr'])
})

test.each([
  ['alias to upstream', '{"gpt-5-upstream-dr":"gpt-5-upstream"}'],
  ['upstream to alias', '{"gpt-5-upstream":"gpt-5-upstream-dr"}'],
])('两种映射方向都只保留已发布别名 %s', (_label, mapping) => {
  const visible = filterPricingRowsToPublishedAliases(
    [row('gpt-5-upstream'), row('gpt-5-upstream-dr'), row('Other')],
    mapping,
    ['gpt-5-upstream-dr']
  )
  expect(visible.map((item) => item.model_name)).toEqual(['gpt-5-upstream-dr'])
})

test('映射为空或损坏时保持原列表，不隐藏没有别名的数据', () => {
  const rows = [row('plain-model'), row('other-model')]

  expect(
    filterPricingRowsToPublishedAliases(rows, '', ['plain-model'])
  ).toEqual(rows)
  expect(
    filterPricingRowsToPublishedAliases(rows, 'not-json', ['plain-model'])
  ).toEqual(rows)
})
