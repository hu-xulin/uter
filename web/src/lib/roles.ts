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

For commercial licensing, please contact support@Uter.ai.com
*/
import { t } from 'i18next'

export const ROLE = {
  GUEST: 0, // 后续如果需要用到这个角色那就再加，同语先留一下
  USER: 1,
  ADMIN: 10,
  SUPER_ADMIN: 100,
} as const

export type RoleValue = (typeof ROLE)[keyof typeof ROLE]

const DEFAULT_ROLE = ROLE.GUEST

const ROLE_LABEL_KEYS: Record<RoleValue, string> = {
  [ROLE.SUPER_ADMIN]: 'Uter Root',
  [ROLE.ADMIN]: 'Uter Admin',
  [ROLE.USER]: 'User',
  [ROLE.GUEST]: 'Guest',
}

export function getRoleLabelKey(role?: number): string {
  return ROLE_LABEL_KEYS[role as RoleValue] ?? ROLE_LABEL_KEYS[DEFAULT_ROLE]
}

export function getRoleLabel(role?: number): string {
  return t(getRoleLabelKey(role))
}

/**
 * 组织内拥有后台管理权限的角色。
 *
 * 必须与后端 `middleware.OrgAdminAuth` 的放行清单逐字一致：
 * 后端仅放行 owner / admin / department_admin，普通成员一律 403。
 * 前端（侧边栏可见性、路由守卫）统一以此为准，避免出现
 * “菜单看得见但接口全部 403” 的不一致状态。
 */
export const ORG_MANAGE_ROLES = [
  'owner',
  'admin',
  'department_admin',
] as const

const ORG_MANAGE_ROLE_SET: ReadonlySet<string> = new Set(ORG_MANAGE_ROLES)

/**
 * 判断当前用户是否拥有组织管理权限。
 *
 * - 超管：与后端一致，可管理（查看）所有组织，不受组织归属限制。
 * - 其他账号：必须属于某个组织，且组织内角色在 ORG_MANAGE_ROLES 中。
 *   组织成员（member）不属于管理角色，看不到组织模块——这与后端
 *   OrgAdminAuth 对 member 返回 403 的行为一致。
 * - 组织归属可能被半写入（只写了 organization_id 或 org_role 其中之一），
 *   任一列成立即视为组织成员；但半写入时若拿不到具体角色，按最小权限
 *   原则视为普通成员处理。
 */
export function canManageOrganization(
  user?: {
    role?: number
    organization_id?: number
    org_role?: string
  } | null
): boolean {
  if (!user) return false

  if ((user.role ?? 0) >= ROLE.SUPER_ADMIN) return true

  const hasOrgMembership = (user.organization_id ?? 0) > 0 || !!user.org_role
  if (!hasOrgMembership) return false

  return ORG_MANAGE_ROLE_SET.has(user.org_role ?? '')
}
