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
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import type {
  ApiResponse,
  UpstreamModelDiscovery,
  UpstreamModelsRequest,
  UpstreamMonitorChannelOption,
  UpstreamMonitorReport,
  UpstreamMonitorRunSummary,
  UpstreamMonitorTask,
  UpstreamMonitorTaskPayload,
} from './types'

export async function listUpstreamMonitorTasks(): Promise<
  UpstreamMonitorTask[]
> {
  const res = await api.get<ApiResponse<UpstreamMonitorTask[]>>(
    '/api/upstream-monitor'
  )
  return requireServerSuccess(res.data).data
}

export async function getUpstreamMonitorTask(
  id: number
): Promise<UpstreamMonitorTask> {
  const res = await api.get<ApiResponse<UpstreamMonitorTask>>(
    `/api/upstream-monitor/${id}`
  )
  return requireServerSuccess(res.data).data
}

export async function fetchUpstreamMonitorChannels(): Promise<
  UpstreamMonitorChannelOption[]
> {
  const res = await api.get<ApiResponse<UpstreamMonitorChannelOption[]>>(
    '/api/upstream-monitor/channels'
  )
  return requireServerSuccess(res.data).data
}

export async function fetchUpstreamMonitorModels(
  payload: UpstreamModelsRequest
): Promise<string[]> {
  const res = await api.post<ApiResponse<UpstreamModelDiscovery>>(
    '/api/upstream-monitor/models',
    payload
  )
  return requireServerSuccess(res.data).data.models
}

export async function createUpstreamMonitorTask(
  payload: UpstreamMonitorTaskPayload
): Promise<UpstreamMonitorTask> {
  const res = await api.post<ApiResponse<UpstreamMonitorTask>>(
    '/api/upstream-monitor',
    payload
  )
  return requireServerSuccess(res.data).data
}

export async function updateUpstreamMonitorTask(
  id: number,
  payload: UpstreamMonitorTaskPayload
): Promise<UpstreamMonitorTask> {
  const res = await api.put<ApiResponse<UpstreamMonitorTask>>(
    `/api/upstream-monitor/${id}`,
    payload
  )
  return requireServerSuccess(res.data).data
}

export async function deleteUpstreamMonitorTask(id: number): Promise<void> {
  const res = await api.delete<ApiResponse<null>>(`/api/upstream-monitor/${id}`)
  requireServerSuccess(res.data)
}

export async function runUpstreamMonitorNow(
  id: number
): Promise<UpstreamMonitorRunSummary> {
  const res = await api.post<ApiResponse<UpstreamMonitorRunSummary>>(
    `/api/upstream-monitor/${id}/run`
  )
  return requireServerSuccess(res.data).data
}

export async function listUpstreamMonitorReports(
  id: number,
  offset = 0,
  pageSize = 20,
  model?: string
): Promise<{ items: UpstreamMonitorReport[]; total: number }> {
  const res = await api.get<
    ApiResponse<UpstreamMonitorReport[]> & { total: number }
  >(`/api/upstream-monitor/${id}/reports`, {
    params: { offset, page_size: pageSize, model },
  })
  const body = requireServerSuccess(res.data)
  return { items: body.data, total: body.total ?? 0 }
}

export async function getUpstreamMonitorReport(
  id: number
): Promise<UpstreamMonitorReport> {
  const res = await api.get<ApiResponse<UpstreamMonitorReport>>(
    `/api/upstream-monitor/reports/${id}`
  )
  return requireServerSuccess(res.data).data
}
