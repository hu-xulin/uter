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
  mergeUpstreamModelsWithRedirects,
  normalizeSelectedModelsForRedirect,
} from '../model-mapping-validation'

describe('mergeUpstreamModelsWithRedirects', () => {
  test('批量全选时跳过已重定向的上游原名，避免 82 个模型翻倍成 164', () => {
    const upstream = Array.from({ length: 82 }, (_, i) => `model-${i}`)
    // 请求别名 -> 上游原名（用户调用别名，平台转发到原名）
    const mapping = JSON.stringify(
      Object.fromEntries(upstream.map((name) => [`${name}-dr`, name]))
    )
    const current = upstream.map((name) => `${name}-dr`)

    const merged = mergeUpstreamModelsWithRedirects(current, upstream, mapping)

    expect(merged).toHaveLength(82)
    expect(merged.every((name) => name.endsWith('-dr'))).toBe(true)
  })

  test('没有重定向映射时保持原有合并与去重行为', () => {
    expect(
      mergeUpstreamModelsWithRedirects(['a', 'b'], ['b', 'c'], '')
    ).toEqual(['a', 'b', 'c'])
  })

  test('只跳过被重定向的原名，未重定向的上游模型仍可加入', () => {
    const mapping = JSON.stringify({ 'alias-a': 'model-a' })
    expect(
      mergeUpstreamModelsWithRedirects(
        ['alias-a'],
        ['model-a', 'model-b'],
        mapping
      )
    ).toEqual(['alias-a', 'model-b'])
  })

  test('映射为无效 JSON 时不跳过任何原名', () => {
    expect(
      mergeUpstreamModelsWithRedirects(['alias-a'], ['model-a'], '{bad json')
    ).toEqual(['alias-a', 'model-a'])
  })
})

describe('normalizeSelectedModelsForRedirect', () => {
  // The "配置模型" dialog applies a whole new selection. Unlike the upstream
  // merge it must translate, not just skip: dropping a lone upstream name
  // would silently remove a model the operator meant to keep serving.
  const mapping = JSON.stringify({
    'claude-haiku-4-5-dr': 'claude-haiku-4-5',
    'claude-opus-4-6-dr': 'claude-opus-4-6',
  })

  test('别名与原名同时选中时去掉上游原名，避免列表翻倍并暴露供应原名', () => {
    expect(
      normalizeSelectedModelsForRedirect(
        ['claude-haiku-4-5-dr', 'claude-haiku-4-5', 'unrelated'],
        mapping
      )
    ).toEqual(['claude-haiku-4-5-dr', 'unrelated'])
  })

  test('只选中上游原名时替换为请求别名，模型不丢失', () => {
    expect(
      normalizeSelectedModelsForRedirect(['claude-opus-4-6'], mapping)
    ).toEqual(['claude-opus-4-6-dr'])
  })

  test('同一原名对应多个别名且都已选中时只保留别名', () => {
    expect(
      normalizeSelectedModelsForRedirect(
        ['a-dr', 'b-dr', 'upstream', 'upstream'],
        JSON.stringify({ 'a-dr': 'upstream', 'b-dr': 'upstream' })
      )
    ).toEqual(['a-dr', 'b-dr'])
  })

  test('无映射或映射无效时保持原选择不变', () => {
    expect(normalizeSelectedModelsForRedirect(['model-a'], '')).toEqual([
      'model-a',
    ])
    expect(
      normalizeSelectedModelsForRedirect(['model-a'], '{bad json')
    ).toEqual(['model-a'])
  })
})
