/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without any warranty of MERCHANTABILITY or
FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License
for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@Uter.ai.com
*/

import { api } from '@/lib/api'

import type {
  ApiResult,
  MyOrgResponse,
  OrgMember,
  OrgMembersResponse,
  OrgRole,
  OrgStats,
  Organization,
} from './types'

// ============================================================================
// Organization Management APIs
// ============================================================================

export async function getMyOrganization(): Promise<MyOrgResponse> {
  const res = await api.get('/api/organization/self')
  return res.data
}

/**
 * 创建组织。
 *
 * 仅超管可用：组织是受控租户（预算 0 = 不限量），自助创建等于开放免费通道。
 * 后端路由为 `POST /api/organizations`（RootAuth），与只读的 `/api/organization/*` 区分。
 * 组织列表复用 `@/features/users/api#listOrganizations`，不在此重复定义。
 */
export async function createOrganization(payload: {
  name: string
  quota: number
  member_limit?: number
}): Promise<MyOrgResponse> {
  const res = await api.post('/api/organizations', payload)
  return res.data
}

export async function getOrganization(id: number): Promise<{
  success: boolean
  data?: Organization
}> {
  const res = await api.get(`/api/organization/${id}`)
  return res.data
}

export async function getOrganizationStats(id: number): Promise<{
  success: boolean
  data?: OrgStats
}> {
  const res = await api.get(`/api/organization/${id}/stats`)
  return res.data
}

export async function getOrganizationMembers(
  id: number,
  params: { p?: number; page_size?: number; department?: string; keyword?: string } = {}
): Promise<OrgMembersResponse> {
  const res = await api.get(`/api/organization/${id}/members`, { params })
  return res.data
}

export async function addOrganizationMembers(
  id: number,
  payload: { user_ids: number[]; department_name?: string; sub_quota_limit?: number }
): Promise<ApiResult> {
  const res = await api.post(`/api/organization/${id}/members`, payload)
  return res.data
}

export async function updateOrganizationMember(
  id: number,
  uid: number,
  payload: { sub_quota_limit?: number; department_name?: string; org_role?: OrgRole }
): Promise<ApiResult> {
  const res = await api.put(`/api/organization/${id}/members/${uid}`, payload)
  return res.data
}

export async function removeOrganizationMember(
  id: number,
  uid: number
): Promise<ApiResult> {
  const res = await api.delete(`/api/organization/${id}/members/${uid}`)
  return res.data
}

export async function updateOrganization(
  id: number,
  payload: { name?: string; quota?: number; member_limit?: number; status?: number }
): Promise<ApiResult> {
  const res = await api.put(`/api/organization/${id}`, payload)
  return res.data
}

export const ORG_ROLES: OrgRole[] = [
  'owner',
  'admin',
  'department_admin',
  'member',
]

export type { OrgMember }
