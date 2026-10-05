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

import { extractAllTags, filterByTag, parseTags } from '../lib/filters'
import type { PricingModel } from '../types'

// Context-window size labels describe an input limit, not a capability, so the
// pricing tag filter must not offer them or count them.
describe('context size tags', () => {
  test('parseTags drops bare number + K/M labels', () => {
    expect(parseTags('1M')).toEqual([])
    expect(parseTags('推理,多模态,1M,200K')).toEqual(['推理', '多模态'])
    expect(parseTags('1.1M,204.8K,8.2K,PDF')).toEqual(['PDF'])
    expect(parseTags('32K')).toEqual([])
  })

  test('parseTags keeps real capability labels', () => {
    expect(parseTags('推理,多模态,文件,工具,音频,PDF,文本,结构化输出')).toEqual(
      ['推理', '多模态', '文件', '工具', '音频', 'PDF', '文本', '结构化输出']
    )
  })

  // The pattern is anchored, so a capability label that merely contains a
  // digit or a K/M must survive.
  test('parseTags does not over-match labels that are not plain sizes', () => {
    expect(parseTags('GPT-4,Claude-3,4K-grade,Mock')).toEqual([
      'GPT-4',
      'Claude-3',
      '4K-grade',
      'Mock',
    ])
    expect(parseTags('MCP,MoE,agent-mode')).toEqual([
      'MCP',
      'MoE',
      'agent-mode',
    ])
  })

  test('extractAllTags never lists a size label, and ignores it in counts', () => {
    const models = [
      { tags: '推理,多模态,1M,200K' },
      { tags: '1M,1.1M,204.8K,PDF' },
      { tags: '音频,8.2K,工具调用' },
      // A model tagged only with a size must still count toward "All Tags".
      { tags: '1M' },
    ] as PricingModel[]

    const tags = extractAllTags(models)
    expect(tags).toEqual(['pdf', '多模态', '工具调用', '推理', '音频'])
    expect(tags).not.toContain('1m')
    expect(tags).not.toContain('200k')
  })

  test('a model tagged only with a size is still reachable and counts as data', () => {
    const models = [{ tags: '1M' }, { tags: '推理' }] as PricingModel[]
    expect(filterByTag(models, 'all')).toHaveLength(2)
    expect(filterByTag(models, '推理')).toHaveLength(1)
  })
})
