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

import type {
  FlowQuotaDataItem,
  QuotaDataItem,
  UptimeGroupResult,
} from './types'

// ============================================================================
// Dashboard APIs
// ============================================================================

// ----------------------------------------------------------------------------
// Quota & Usage Data
// ----------------------------------------------------------------------------

// Get user quota data within a time range
// Admin users get all users' data by default.
export async function getUserQuotaDates(
  params: {
    start_timestamp: number
    end_timestamp: number
    default_time?: string
    username?: string
  },
  isAdmin = false
) {
  const endpoint = isAdmin ? '/api/data' : '/api/data/self'
  const res = await api.get<{ success: boolean; data: QuotaDataItem[] }>(
    endpoint,
    { params }
  )
  return res.data
}

// ----------------------------------------------------------------------------
// System Monitoring
// ----------------------------------------------------------------------------

export async function getUserQuotaDataByUsers(params: {
  start_timestamp: number
  end_timestamp: number
}) {
  const res = await api.get<{ success: boolean; data: QuotaDataItem[] }>(
    '/api/data/users',
    { params }
  )
  return res.data
}

export async function getFlowQuotaDates(
  params: {
    start_timestamp: number
    end_timestamp: number
    default_time?: string
    username?: string
  },
  isAdmin = false
) {
  const endpoint = isAdmin ? '/api/data/flow' : '/api/data/flow/self'
  const res = await api.get<{
    success: boolean
    data?: FlowQuotaDataItem[]
    message?: string
  }>(endpoint, { params })
  return res.data
}

// Get uptime monitoring status for all services
export async function getUptimeStatus() {
  const res = await api.get<{ success: boolean; data: UptimeGroupResult[] }>(
    '/api/uptime/status'
  )
  return res.data
}

// ============================================================================
// Organization-scoped Dashboard APIs (组织管理者视角)
// ============================================================================

// 组织管理者查看本组织成员按时间聚合的额度消耗；范围由后端按角色收敛
// （admin 看不到 owner、部门 admin 只看本部门）。
export async function getOrgQuotaDates(
  orgId: number,
  params: {
    start_timestamp: number
    end_timestamp: number
    default_time?: string
    username?: string
    user_id?: number
  }
) {
  const res = await api.get<{ success: boolean; data: QuotaDataItem[] }>(
    `/api/organization/${orgId}/quota-dates`,
    { params }
  )
  return res.data
}

// 组织管理者查看本组织成员流量（按模型/日期）汇总。
export async function getOrgFlowQuotaDates(
  orgId: number,
  params: {
    start_timestamp: number
    end_timestamp: number
    default_time?: string
    username?: string
    user_id?: number
  }
) {
  const res = await api.get<{
    success: boolean
    data?: FlowQuotaDataItem[]
    message?: string
  }>(`/api/organization/${orgId}/flow`, { params })
  return res.data
}

// 组织管理者查看本组织成员按用户聚合的额度消耗（用户分析分区）。
export async function getOrgQuotaDatesByUsers(
  orgId: number,
  params: {
    start_timestamp: number
    end_timestamp: number
    user_id?: number
  }
) {
  const res = await api.get<{ success: boolean; data: QuotaDataItem[] }>(
    `/api/organization/${orgId}/quota-dates/users`,
    { params }
  )
  return res.data
}
