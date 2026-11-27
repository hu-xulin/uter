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

import { cardTeaser, firstSentence } from '../teaser'

describe('firstSentence', () => {
  it('stops at the first CJK full stop', () => {
    expect(
      firstSentence('游乐场用于在线测试模型。 用户可以输入问题并查看结果。')
    ).toBe('游乐场用于在线测试模型。')
  })

  it('stops at the first Latin sentence end', () => {
    expect(
      firstSentence(
        'The playground is used for simple online testing. Users can input questions.'
      )
    ).toBe('The playground is used for simple online testing.')
  })

  it('keeps periods that do not end a sentence', () => {
    expect(firstSentence('Visit Uter.ai or v1.0 docs before you start.')).toBe(
      'Visit Uter.ai or v1.0 docs before you start.'
    )
  })

  it('returns the whole text when no sentence terminator exists', () => {
    expect(firstSentence('  No terminator here  ')).toBe('No terminator here')
  })

  it('caps a single overlong opening sentence', () => {
    const teaser = firstSentence(`${'a'.repeat(200)}.`)
    expect(teaser).toHaveLength(141)
    expect(teaser.endsWith('…')).toBe(true)
  })
})

describe('cardTeaser', () => {
  it('pads a short one-liner with the child-document supplement', () => {
    const result = cardTeaser('文档重排序', '根据查询与文档的相关性对候选文档重新排序，返回相关度分数。')
    expect(result).toContain('文档重排序')
    expect(result).toContain('相关性')
    expect(result.endsWith('…')).toBe(false)
  })

  it('clips text longer than two lines and ends with an ellipsis', () => {
    const long = '视频生成是一个需要提交任务并轮询状态的异步过程，同时提供多种入口与大量供应商格式。'.repeat(3)
    const result = cardTeaser(long)
    expect(result.endsWith('…')).toBe(true)
    expect(result.length).toBeLessThan(long.length)
  })

  it('keeps the opening sentence when it fits, dropping an overlong supplement', () => {
    const result = cardTeaser('钱包保存你的额度余额。', '充值卡片提供多个预设金额及对应支付价格，并支持在最低限额之上自定义金额。选择支付方式。')
    expect(result.startsWith('钱包保存你的额度余额。')).toBe(true)
    expect(result.endsWith('…')).toBe(true)
  })

  it('returns an empty string for empty input', () => {
    expect(cardTeaser('', '')).toBe('')
  })

  it('never exceeds roughly two full-width lines', () => {
    const cjk = '原生OpenAI格式、原生Gemini格式、通义千问OpenAI格式、更多格式持续更新。'.repeat(4)
    const result = cardTeaser(cjk)
    const units = [...result].reduce(
      (sum, ch) => sum + ((ch.codePointAt(0) ?? 0x10000) <= 0xff ? 0.5 : 1),
      0
    )
    expect(units).toBeLessThanOrEqual(38)
    expect(result.endsWith('…')).toBe(true)
  })
})

it('fills the second line instead of dropping a whole sentence', () => {
  const result = cardTeaser(
    'API 密钥是应用调用 Uter 的凭据。',
    '建议为每个应用单独创建密钥，便于分别管控与吊销。'
  )
  expect(result).toContain('API 密钥是应用调用 Uter 的凭据。')
  expect(result).toContain('建议为每个应用单独创建密钥')
  expect(result.endsWith('…')).toBe(true)
})
