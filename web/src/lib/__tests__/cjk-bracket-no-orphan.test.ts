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
import { describe, expect, it } from 'vitest'

import { segmentCjkWords } from '../cjk-text'

/**
 * 回归（2026-11-26 用户截图）：文档表格首列的中文括号不得单独落在一行。
 *
 * 用户裁决：括号要么跟前面内容在同一行，要么跟后面内容在同一行，
 * 不允许「额度（Quota」+「）」这种把右括号孤立到下一行的断法。
 *
 * 实现契约：右括号必须并入前一个分词片段（形成 `Quota）`），
 * 左括号允许作为独立片段跟在前面中文词之后（`额度` + `（`），
 * 因此浏览器换行时左括号随前文、右括号随括注内容，两者都不会孤立。
 */
describe('中文括号不单独成行（表格首列）', () => {
  const cases = [
    'API 密钥（API Key）',
    '额度（Quota）',
    'API 接入地址（Base URL）',
  ]

  for (const text of cases) {
    it(`${text}：右括号不得单独成词`, () => {
      const parts = segmentCjkWords(text)
      // 拼接恒等：断点只允许移动，不得增删字符。
      expect(parts.join('')).toBe(text)
      // 右括号不能是自成一体的片段。
      expect(parts.some((part) => part === '）')).toBe(false)
      // 右括号必须与紧跟其前的括注内容同属一个片段。
      expect(parts.at(-1)?.endsWith('）')).toBe(true)
    })
  }

  it('左括号不引入行首孤立：前面必有中文词片段', () => {
    for (const text of cases) {
      const parts = segmentCjkWords(text)
      const openIndex = parts.indexOf('（')
      expect(openIndex, text).toBeGreaterThan(0)
    }
  })
})
