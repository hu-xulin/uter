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
import { Shield, User, Users } from 'lucide-react'

import type { User as UserType } from './types'

// ============================================================================
// User Utilities
// ============================================================================

export const isUserDeleted = (user: UserType): boolean => {
  return user.DeletedAt != null
}

// ============================================================================
// User Status Configuration
// ============================================================================

export const USER_STATUS = {
  ENABLED: 1,
  DISABLED: 2,
  DELETED: -1,
} as const

export const USER_STATUSES = {
  [USER_STATUS.ENABLED]: {
    labelKey: 'Enabled',
    variant: 'success' as const,
    value: USER_STATUS.ENABLED,
  },
  [USER_STATUS.DISABLED]: {
    labelKey: 'Disabled',
    variant: 'neutral' as const,
    value: USER_STATUS.DISABLED,
  },
  [USER_STATUS.DELETED]: {
    labelKey: 'Deleted',
    variant: 'danger' as const,
    value: USER_STATUS.DELETED,
  },
} as const

export const getUserStatusOptions = (t: (key: string) => string) => [
  { label: t('Enabled'), value: String(USER_STATUS.ENABLED) },
  { label: t('Disabled'), value: String(USER_STATUS.DISABLED) },
  { label: t('Deleted'), value: String(USER_STATUS.DELETED) },
]

// ============================================================================
// User Role Configuration
// ============================================================================

export const USER_ROLE = {
  USER: 1,
  ADMIN: 10,
  ROOT: 100,
} as const

/** 组织内角色 → 角色栏展示键（组织成员系统角色恒为普通用户，组织权威与系统角色正交）。 */
export const ORG_ROLE_LABEL_KEYS: Record<string, string> = {
  owner: 'Organization Owner',
  admin: 'Organization Admin',
  department_admin: 'Department Admin',
  member: 'Organization User',
}

/**
 * 角色栏展示键：
 * - 系统特权角色（Root / Admin）始终以平台身份展示（Uter Root / Uter Admin），
 *   组织归属不覆盖系统身份——组织权威与系统角色正交。
 * - 普通用户（role=USER）若属于组织（organization_id>0）则按组织内角色显示
 *   （组织所有者 / 组织管理员 / 部门管理员 / 组织用户）。
 * - 其余普通用户 → User。
 */
export function getUserRoleDisplayKey(
  role: number,
  orgId?: number,
  orgRole?: string
): string {
  // 系统特权角色优先：Root/Admin 不被组织成员身份覆盖。
  if (role === USER_ROLE.ROOT) return 'Uter Root'
  if (role === USER_ROLE.ADMIN) return 'Uter Admin'
  if ((orgId ?? 0) > 0) {
    return ORG_ROLE_LABEL_KEYS[orgRole ?? 'member'] ?? 'Organization User'
  }
  return 'User'
}

export const USER_ROLES = {
  [USER_ROLE.USER]: {
    labelKey: 'User',
    value: USER_ROLE.USER,
    icon: User,
  },
  [USER_ROLE.ADMIN]: {
    labelKey: 'Uter Admin',
    value: USER_ROLE.ADMIN,
    icon: Users,
  },
  [USER_ROLE.ROOT]: {
    labelKey: 'Uter Root',
    value: USER_ROLE.ROOT,
    icon: Shield,
  },
} as const

export const getUserRoleOptions = (t: (key: string) => string) => [
  { label: t('User'), value: String(USER_ROLE.USER), icon: User },
  { label: t('Uter Admin'), value: String(USER_ROLE.ADMIN), icon: Users },
  { label: t('Uter Root'), value: String(USER_ROLE.ROOT), icon: Shield },
]

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_GROUP = 'default' as const

// ============================================================================
// Third-party Binding Fields
// ============================================================================

export const BINDING_FIELDS = [
  { key: 'github_id', label: 'GitHub ID' },
  { key: 'discord_id', label: 'Discord ID' },
  { key: 'oidc_id', label: 'OIDC ID' },
  { key: 'wechat_id', label: 'WeChat ID' },
  { key: 'email', label: 'Email' },
  { key: 'telegram_id', label: 'Telegram ID' },
] as const

// ============================================================================
// Error Messages (i18n keys: use t(ERROR_MESSAGES.xxx) when displaying)
// ============================================================================

export const ERROR_MESSAGES = {
  UNEXPECTED: 'An unexpected error occurred',
  NO_USER: 'No user selected',
  LOAD_FAILED: 'Failed to load users',
  SEARCH_FAILED: 'Failed to search users',
  CREATE_FAILED: 'Failed to create user',
  UPDATE_FAILED: 'Failed to update user',
  DELETE_FAILED: 'Failed to delete user',
} as const

// ============================================================================
// Success Messages (i18n keys: use t(SUCCESS_MESSAGES.xxx) when displaying)
// ============================================================================

export const SUCCESS_MESSAGES = {
  USER_CREATED: 'User created successfully',
  USER_UPDATED: 'User updated successfully',
} as const
