/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

import { useQuery } from '@tanstack/react-query'

import { canManageOrganization } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { getOrganizationMembers } from './api'
import type { OrgMember, OrgRole } from './types'

export interface OrgManagerScope {
  /** 当前用户是否为组织管理者（owner / admin / department_admin）。 */
  isOrgManager: boolean
  /** 当前用户所属组织 id（非组织管理者为 0）。 */
  orgId: number
  /** 当前用户在组织内的角色。 */
  orgRole: OrgRole
  /**
   * 当前用户可见的组织成员列表（已按后端可见性收敛：
   * admin 看不到 owner、部门 admin 只看本部门），用于填充用户名 / 用户ID 下拉。
   */
  members: OrgMember[]
  isLoading: boolean
}

/**
 * 解析当前登录用户的组织管理视角。
 *
 * 与后端 `middleware.OrgAdminAuth` / `orgAuthorityOf` 的分级逐字对齐：
 * 只有组织归属 + 管理角色（owner/admin/department_admin）才视为组织管理者，
 * 普通成员（member）或平台直管账号返回 isOrgManager=false。
 */
export function useOrgManagerScope(): OrgManagerScope {
  const authUser = useAuthStore((state) => state.auth.user)
  const isOrgManager = canManageOrganization(authUser)
  const orgId = isOrgManager ? (authUser?.organization_id ?? 0) : 0
  const orgRole = (authUser?.org_role ?? '') as OrgRole

  const { data, isLoading } = useQuery({
    queryKey: ['org-member-options', orgId],
    queryFn: async () => {
      const res = await getOrganizationMembers(orgId, { page_size: 1000 })
      return (res.data?.items ?? []) as OrgMember[]
    },
    enabled: isOrgManager && orgId > 0,
  })

  return {
    isOrgManager,
    orgId,
    orgRole,
    members: data ?? [],
    isLoading,
  }
}
