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
import { sortByPinnedChannelOrder } from '@/lib/channel-order'

import type { UpstreamMonitorTask } from '../types'

export const upstreamMonitorQueryKeys = {
  all: ['upstream-monitor'] as const,
  channels: () => [...upstreamMonitorQueryKeys.all, 'channels'] as const,
  tasks: () => [...upstreamMonitorQueryKeys.all, 'tasks'] as const,
  task: (id: number) => [...upstreamMonitorQueryKeys.all, 'task', id] as const,
  reports: (taskId: number, model?: string) =>
    [
      ...upstreamMonitorQueryKeys.all,
      'reports',
      taskId,
      model ?? 'all',
    ] as const,
  report: (id: number) =>
    [...upstreamMonitorQueryKeys.all, 'report', id] as const,
}

/**
 * Format a monitor task's score for the task table.
 *
 * A score of 0 is a legitimate result: a run completed and every probed model
 * scored zero. Only a task that has never run (last_run_at === 0) has no score
 * to display. Using `score > 0` here used to hide real 0-score runs as "—",
 * which made a failed run look like it had never been executed.
 */
export function formatMonitorScore(
  lastScore: number,
  lastRunAt: number
): string {
  return lastRunAt > 0 ? `${lastScore}/100` : '—'
}

/**
 * 监测任务列表排序：渠道任务按定价页左侧的固定渠道顺序排列（同一真源），
 * 手动任务（无关联渠道）排在最后。返回新数组，不修改入参。
 */
export function orderMonitorTasksByChannel(
  tasks: readonly UpstreamMonitorTask[]
): UpstreamMonitorTask[] {
  const channelTasks = sortByPinnedChannelOrder(
    tasks.filter((task) => task.channel_name),
    (task) => task.channel_name,
    (task) => task.models?.length ?? 0
  )
  return [...channelTasks, ...tasks.filter((task) => !task.channel_name)]
}
