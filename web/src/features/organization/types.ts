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

// ============================================================================
// Organization (公司/组织) domain types
// ============================================================================

export type OrgRole = '' | 'owner' | 'admin' | 'department_admin' | 'member'

/**
 * 组织状态取值，与后端 model.OrgStatus* 逐字对应。
 *
 * 从 1 开始而不是 0：0 是 int 的零值，后端用它当「不修改」哨兵之外没有任何合法语义，
 * 因此前端也绝不可把 0 当成状态提交（后端会直接拒绝）。
 */
export const ORG_STATUS_ENABLED = 1
export const ORG_STATUS_DISABLED = 2

/** 共享总钱包预算（额度单位，与用户 quota 同单位） */
export interface Organization {
  id: number
  name: string
  owner_user_id: number
  quota: number
  used_quota: number
  member_limit: number
  /** 1=启用 2=停用，见 ORG_STATUS_* */
  status: number
  created_at: number
  updated_at: number
}

export interface OrgMember {
  id: number
  username: string
  display_name: string
  email?: string
  quota: number
  used_quota: number
  status: number
  organization_id: number
  department_name: string
  org_role: OrgRole
  sub_quota_limit: number
}

export interface OrgMembersResponse {
  success: boolean
  message?: string
  data?: {
    page: number
    page_size: number
    total: number
    items: OrgMember[]
  }
}

export interface MyOrgResponse {
  success: boolean
  message?: string
  data?: {
    organization: Organization | null
    role?: OrgRole
    /** 是否能查看组织总预算（owner/admin/department_admin 为 true，普通成员为 false） */
    can_view_budget?: boolean
    /** 自己被分配的额度上限（0=不限） */
    my_sub_quota_limit?: number
    /** 自己的已用额度 */
    my_used_quota?: number
  }
}

export interface OrgStats {
  organization: Organization
  used_quota: number
  remaining: number
}

export interface ApiResult {
  success: boolean
  message?: string
}
