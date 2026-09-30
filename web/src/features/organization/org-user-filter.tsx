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

import { useTranslation } from 'react-i18next'

import { Label } from '@/components/ui/label'
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select'
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
 * 两个下拉各自独立、均不可输入（NativeSelect），数据源为当前用户可见的组织成员
 * （后端已按角色做可见性收敛：admin 看不到 owner、部门 admin 只看本部门）。
 * 选「全部」即清空对应维度过滤。
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
  return (
    <>
      <div className='flex flex-col gap-1'>
        <Label>{t('Username')}</Label>
        <NativeSelect
          value={username ?? ''}
          disabled={disabled}
          onChange={(e) => onUsernameChange(e.target.value || undefined)}
        >
          <NativeSelectOption value=''>{t('All users')}</NativeSelectOption>
          {members.map((m) => (
            <NativeSelectOption key={m.id} value={m.username}>
              {m.username}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className='flex flex-col gap-1'>
        <Label>{t('User ID')}</Label>
        <NativeSelect
          value={userId ? String(userId) : ''}
          disabled={disabled}
          onChange={(e) =>
            onUserIdChange(e.target.value ? Number(e.target.value) : undefined)
          }
        >
          <NativeSelectOption value=''>{t('All users')}</NativeSelectOption>
          {members.map((m) => (
            <NativeSelectOption key={m.id} value={String(m.id)}>
              {formatUserId(m.id)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </>
  )
}
