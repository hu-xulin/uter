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

import type { UpstreamMonitorTask } from '../../types'
import {
  formatMonitorScore,
  orderMonitorTasksByChannel,
} from '../upstream-monitor-actions'

function makeTask(
  name: string,
  channelName: string,
  models: string[] = []
): UpstreamMonitorTask {
  return {
    id: 0,
    name,
    channel_name: channelName,
    models,
  } as UpstreamMonitorTask
}

describe('formatMonitorScore', () => {
  it('shows a real 0 score for a completed run instead of hiding it', () => {
    expect(formatMonitorScore(0, 1795736430)).toBe('0/100')
  })

  it('shows a dash only when the task has never run', () => {
    expect(formatMonitorScore(0, 0)).toBe('—')
    expect(formatMonitorScore(92, 0)).toBe('—')
  })

  it('shows the score for a normal completed run', () => {
    expect(formatMonitorScore(92, 1795736430)).toBe('92/100')
  })
})

describe('orderMonitorTasksByChannel', () => {
  it('渠道任务按定价页固定渠道顺序排列，手动任务排在最后', () => {
    const tasks = [
      makeTask('gpt-max', 'GPT-Max'),
      makeTask('manual', ''),
      makeTask('claude-basic', 'Claude-Basic'),
      makeTask('ute-select', '优特-精选'),
      makeTask('other', '其他渠道'),
    ]
    expect(orderMonitorTasksByChannel(tasks).map((task) => task.name)).toEqual([
      'ute-select',
      'claude-basic',
      'gpt-max',
      'other',
      'manual',
    ])
  })

  it('不修改传入的任务数组', () => {
    const tasks = [makeTask('b', 'GPT-Pro'), makeTask('a', 'Claude-Basic')]
    const original = [...tasks]
    orderMonitorTasksByChannel(tasks)
    expect(tasks).toEqual(original)
  })
})
