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
 * 回归：表格首列中文必须按「词语」而非「单字」提供换行断点。
 * 隐私政策术语表的「个人信息」曾被拆成「个人信」+「息」，根因是
 * `overflow-wrap: anywhere` 允许在任意汉字间断行。分词断点让浏览器
 * 只在词边界换行，配合 `word-break: keep-all` 禁止词内断行。
 */
describe('segmentCjkWords', () => {
  it('把「个人信息」分成「个人」「信息」两个词', () => {
    expect(segmentCjkWords('个人信息')).toEqual(['个人', '信息'])
  })

  it('把「敏感个人信息」分成「敏感」「个人」「信息」', () => {
    expect(segmentCjkWords('敏感个人信息')).toEqual(['敏感', '个人', '信息'])
  })

  it('按用户逐条裁决锁定法务术语的构词边界', () => {
    // 用户校对决定（2026-11-26）：换行断点必须符合中文构词，不接受
    // Intl.Segmenter 原生逐词结果。以下边界为用户明确指定，精确锁定。
    expect(segmentCjkWords('受托处理者')).toEqual(['受托', '处理者'])
    expect(segmentCjkWords('个人信息处理者')).toEqual(['个人信息', '处理者'])
    expect(segmentCjkWords('上游模型提供商')).toEqual(['上游模型', '提供商'])
  })

  it('按用户 18:52 裁决锁定新增术语的构词边界', () => {
    expect(segmentCjkWords('营销信息推送')).toEqual(['营销信息推送'])
    expect(segmentCjkWords('（非必需）')).toEqual(['（非必需）'])
    expect(segmentCjkWords('营销信息推送（非必需）')).toEqual([
      '营销信息推送',
      '（非必需）',
    ])
    expect(segmentCjkWords('日志与元数据')).toEqual(['日志与', '元数据'])
    expect(segmentCjkWords('平台 / 本平台')).toEqual(['平台 / ', '本平台'])
  })

  it('中文标点不得单独成词，问号必须跟随前文', () => {
    expect(segmentCjkWords('余额快用完会突然停服吗？')).toEqual([
      '余额快',
      '用完会',
      '突然停服吗？',
    ])
    for (const text of [
      '怎么核对账目？',
      '大额充值有额外保障吗？',
      '分批到账会降低折扣吗？',
    ]) {
      const parts = segmentCjkWords(text)
      expect(parts.at(-1), text).not.toMatch(/^[？！。，、；：]+$/)
    }
  })

  it('违约程度列的四字术语保持单行原子词', () => {
    for (const term of [
      '违约程度',
      '一般违约',
      '较重违约',
      '严重违约',
      '涉嫌违法',
    ]) {
      expect(segmentCjkWords(term), term).toEqual([term])
    }
  })

  it('「自动化决策」按构词为「自动化」「决策」而非「自动」「化」', () => {
    expect(segmentCjkWords('自动化决策')).toEqual(['自动化', '决策'])
  })

  it('拼接结果恒等于原文（无字符丢失或重复）', () => {
    for (const value of [
      '个人信息',
      '个人信息处理者',
      '受托处理者',
      '去标识化',
      '上游模型提供商',
      'API Key 用量',
      'gpt-4o-mini',
      '',
    ]) {
      expect(segmentCjkWords(value).join('')).toBe(value)
    }
  })

  it('空字符串返回空数组', () => {
    expect(segmentCjkWords('')).toEqual([])
  })
})
