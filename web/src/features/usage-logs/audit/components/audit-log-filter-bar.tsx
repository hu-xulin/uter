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
import type { Table } from '@tanstack/react-table'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Combobox } from '@/components/ui/combobox'
import { OrgUserFilter } from '@/features/organization/org-user-filter'
import { useOrgManagerScope } from '@/features/organization/use-org-manager'
import { formatUserId, parseUserId } from '@/lib/format'

import { CompactDateTimeRangePicker } from '../../components/compact-date-time-range-picker'
import {
  LogsFilterField,
  LogsFilterInput,
  LogsFilterToolbar,
} from '../../components/logs-filter-toolbar'
import type { AuditFilters, AuditLog } from '../api'

function AuditFilterSelect(props: {
  label: string
  value: string
  options: { value: string; label: string; disabled?: boolean }[]
  onChange: (value: string) => void
}) {
  return (
    <LogsFilterField>
      <Combobox
        options={props.options}
        value={props.value}
        onValueChange={(value) => {
          if (value !== null) props.onChange(value)
        }}
        aria-label={props.label}
        className='w-full'
      />
    </LogsFilterField>
  )
}

export function AuditLogFilterBar(props: {
  table: Table<AuditLog>
  filters: AuditFilters
  onChange: (patch: Partial<AuditFilters>) => void
  scope: 'all' | 'self' | 'org'
  accessOnly?: boolean
  tokenScope: string
  defaultTokenScope: string
  currentTokenRef?: string
  onTokenScopeChange: (value: string) => void
  isFetching: boolean
  onSearch: () => void
  onReset: () => void
}) {
  const { t } = useTranslation()
  // 用户 ID 输入框保留原始字符串（同时接受 "1" 与展示编号 "U100000001"），
  // null 表示「跟随已应用的 filters 渲染」；父组件 Reset 时清空。
  const [userIdRaw, setUserIdRaw] = useState<string | null>(null)
  const userIdInput =
    userIdRaw ??
    (props.filters.user_id ? formatUserId(props.filters.user_id) : '')
  // 组织管理者（scope === 'org'）视角的可见成员列表，供「用户名 / 用户ID」双下拉使用。
  // 后端已按角色收敛：owner/admin 看全组织，部门 admin 仅本部门。
  const { members: orgMembers, isLoading: orgMembersLoading } =
    useOrgManagerScope()
  const dateFilter = (
    <LogsFilterField wide>
      <CompactDateTimeRangePicker
        start={
          props.filters.start_timestamp === undefined
            ? undefined
            : new Date(props.filters.start_timestamp * 1000)
        }
        end={
          props.filters.end_timestamp === undefined
            ? undefined
            : new Date(props.filters.end_timestamp * 1000)
        }
        onChange={({ start, end }) =>
          props.onChange({
            start_timestamp: start
              ? Math.floor(start.getTime() / 1000)
              : undefined,
            end_timestamp: end ? Math.floor(end.getTime() / 1000) : undefined,
          })
        }
      />
    </LogsFilterField>
  )
  const mainFilters = (
    <>
      <AuditFilterSelect
        label={t('Result')}
        value={props.filters.success ?? 'all'}
        options={[
          { value: 'all', label: t('All results') },
          { value: 'true', label: t('Success') },
          { value: 'false', label: t('Failed') },
        ]}
        onChange={(value) =>
          props.onChange({ success: value === 'all' ? undefined : value })
        }
      />
      {props.accessOnly ? (
        <AuditFilterSelect
          label={t('Token scope')}
          value={props.tokenScope}
          options={[
            { value: 'all', label: t('All tokens') },
            {
              value: 'current',
              label: t('Current token'),
              disabled: !props.currentTokenRef,
            },
            {
              value: 'historical',
              label: t('Historical tokens'),
              disabled: props.currentTokenRef === undefined,
            },
          ]}
          onChange={props.onTokenScopeChange}
        />
      ) : (
        <AuditFilterSelect
          label={t('Category')}
          value={props.filters.category ?? 'all'}
          options={[
            { value: 'all', label: t('All categories') },
            { value: 'login', label: t('Login') },
            { value: 'security', label: t('Account security') },
            { value: 'operation', label: t('Operation audit') },
            { value: 'access_token', label: t('Access Token') },
          ]}
          onChange={(value) =>
            props.onChange({ category: value === 'all' ? undefined : value })
          }
        />
      )}
      {/* 用户名 / 用户ID：与「结果」「分类」同模式，常驻主筛选区；
          仅平台管理员（all）或组织管理者（org）可见，普通用户（self）只看自己无需此筛选。
          平台管理员（all）保留文本输入（可见全部用户）；组织管理者（org）改为组织内成员双下拉，
          仅可在权限范围内下拉筛选、不可手动输入。 */}
      {(props.scope === 'all' || props.scope === 'org') && (
        <>
          {props.scope === 'all' && (
            <>
              <LogsFilterField>
                <LogsFilterInput
                  aria-label={t('Username')}
                  placeholder={t('Username')}
                  value={props.filters.username ?? ''}
                  onChange={(event) =>
                    props.onChange({
                      username: event.target.value || undefined,
                    })
                  }
                />
              </LogsFilterField>
              <LogsFilterField>
                <LogsFilterInput
                  mono
                  aria-label={t('User ID')}
                  placeholder={t('User ID')}
                  inputMode='numeric'
                  value={userIdInput}
                  onChange={(event) => {
                    const raw = event.target.value
                    setUserIdRaw(raw)
                    const parsed = parseUserId(raw)
                    props.onChange({ user_id: parsed > 0 ? parsed : undefined })
                  }}
                />
              </LogsFilterField>
            </>
          )}
          {props.scope === 'org' && (
            <OrgUserFilter
              members={orgMembers}
              username={props.filters.username}
              userId={props.filters.user_id}
              onUsernameChange={(value) => props.onChange({ username: value })}
              onUserIdChange={(value) => props.onChange({ user_id: value })}
              disabled={orgMembersLoading}
            />
          )}
        </>
      )}
    </>
  )
  const advancedFilters =
    !props.accessOnly || props.scope === 'all' || props.scope === 'org'
      ? !props.accessOnly && (
          <>
            <LogsFilterField>
              <LogsFilterInput
                aria-label={t('Token identifier')}
                placeholder={t('Token identifier')}
                value={props.filters.token_ref ?? ''}
                onChange={(event) =>
                  props.onChange({ token_ref: event.target.value || undefined })
                }
              />
            </LogsFilterField>
            <LogsFilterField>
              <LogsFilterInput
                aria-label={t('Request ID')}
                placeholder={t('Request ID')}
                value={props.filters.request_id ?? ''}
                onChange={(event) =>
                  props.onChange({
                    request_id: event.target.value || undefined,
                  })
                }
              />
            </LogsFilterField>
          </>
        )
      : undefined
  const advancedCount = [
    props.filters.token_ref,
    props.filters.request_id,
  ].filter(Boolean).length
  const filterCount =
    advancedCount +
    [
      props.filters.success,
      props.filters.category,
      props.tokenScope !== props.defaultTokenScope,
    ].filter(Boolean).length
  const hasFilters =
    filterCount > 0 ||
    props.filters.start_timestamp !== undefined ||
    props.filters.end_timestamp !== undefined
  return (
    <LogsFilterToolbar
      table={props.table}
      primaryFilters={
        <>
          {dateFilter}
          {mainFilters}
        </>
      }
      advancedFilters={advancedFilters}
      mobilePinnedFilters={dateFilter}
      mobileFilters={
        <>
          {mainFilters}
          {advancedFilters}
        </>
      }
      mobileFilterCount={filterCount}
      advancedFilterCount={advancedCount}
      hasActiveFilters={hasFilters}
      hasAdvancedActiveFilters={advancedCount > 0}
      searchLoading={props.isFetching}
      onSearch={props.onSearch}
      onReset={() => {
        setUserIdRaw(null)
        props.onReset()
      }}
    />
  )
}
