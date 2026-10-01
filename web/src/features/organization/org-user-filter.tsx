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
*/

import { useTranslation } from 'react-i18next'

import { Combobox } from '@/components/ui/combobox'
import { formatUserId } from '@/lib/format'

import type { OrgMember } from './types'

interface OrgUserFilterProps {
  members: OrgMember[]
  /** 当前选中的用户名（受控）。 */
  username?: string
  /** 当前选中的用户 ID（受控）。 */
  userId?: number
  onUsernameChange: (value: string | undefined) => void
  onUserIdChange: (value: number | undefined) => void
  /** 是否禁用（如下拉数据尚未加载）。 */
  disabled?: boolean
}

/**
 * 组织管理者视角的「用户名 / 用户ID」双下拉筛选。
 *
 * 样式与站内「分组」筛选一致（Combobox：选中值显示于框、点击展开、选中项带对号），
 * 两个下拉各自独立、均不可输入（未启用 allowCustomValue），数据源为当前用户可见的
 * 组织成员（后端已按角色做可见性收敛：admin 看不到 owner、部门 admin 仅本部门）。
 * 选默认项（「Username」/「User ID」）即清空对应维度过滤。
 */
export function OrgUserFilter({
  members,
  username,
  userId,
  onUsernameChange,
  onUserIdChange,
  disabled,
}: OrgUserFilterProps) {
  const { t } = useTranslation()
  const usernameOptions = [
    { value: '', label: t('Username') },
    ...members.map((m) => ({ value: m.username, label: m.username })),
  ]
  const userIdOptions = [
    { value: '', label: t('User ID') },
    ...members.map((m) => ({
      value: String(m.id),
      label: formatUserId(m.id),
    })),
  ]
  return (
    <>
      <Combobox
        options={usernameOptions}
        aria-label={t('Username')}
        placeholder={t('Username')}
        emptyText={t('No user found.')}
        className='h-8 min-w-0 text-sm leading-5'
        disabled={disabled}
        value={username ?? ''}
        onValueChange={(value) => onUsernameChange(value || undefined)}
      />
      <Combobox
        options={userIdOptions}
        aria-label={t('User ID')}
        placeholder={t('User ID')}
        emptyText={t('No user found.')}
        className='h-8 min-w-0 text-sm leading-5'
        disabled={disabled}
        value={userId ? String(userId) : ''}
        onValueChange={(value) =>
          onUserIdChange(value ? Number(value) : undefined)
        }
      />
    </>
  )
}
