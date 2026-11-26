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
export const upstreamMonitorQueryKeys = {
  all: ['upstream-monitor'] as const,
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
