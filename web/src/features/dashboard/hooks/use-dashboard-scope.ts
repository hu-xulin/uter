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
along with this program. If not received, see <https://www.gnu.org/licenses/>.
*/
import { ROLE, canManageOrganization } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

export interface DashboardScope {
  /** 平台管理员（role >= ADMIN）。 */
  isAdmin: boolean
  /** 组织管理者（owner / admin / department_admin），与平台管理员正交。 */
  isOrgManager: boolean
  /**
   * 组织管理者视角下的组织 id；非组织管理者或本身是平台管理员时为 0。
   * 数据查询应据此把请求路由到组织接口，而非平台 /self 接口。
   */
  orgId: number
}

/**
 * 解析当前用户在数据看板中的有效视角，与 usage-logs 的 `useLogsViewScope`
 * 逐字对齐：仅当「组织管理者 且 非平台管理员」时才启用组织视角
 * （组织管理者约定是普通用户，平台管理员即便属于某组织也走全局接口）。
 */
export function useDashboardScope(): DashboardScope {
  const user = useAuthStore((state) => state.auth.user)
  const isAdmin = Boolean(user?.role && user.role >= ROLE.ADMIN)
  const isOrgManager = canManageOrganization(user)
  const orgId = isOrgManager && !isAdmin ? (user?.organization_id ?? 0) : 0
  return { isAdmin, isOrgManager, orgId }
}
