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

import { mergeUpstreamModelsWithRedirects } from '../model-mapping-validation'

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
