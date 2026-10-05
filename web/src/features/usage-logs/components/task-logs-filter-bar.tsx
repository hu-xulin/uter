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
import { useQueryClient, useIsFetching } from '@tanstack/react-query'
import { useNavigate, getRouteApi } from '@tanstack/react-router'
import type { Table } from '@tanstack/react-table'
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { formatUserId, parseUserId } from '@/lib/format'

import { buildSearchParams } from '../lib/filter'
import { getDefaultTimeRange } from '../lib/utils'
import type { DrawingLogFilters, LogCategory, TaskLogFilters } from '../types'
import { CompactDateTimeRangePicker } from './compact-date-time-range-picker'
import { useOrgManagerScope } from '@/features/organization/use-org-manager'
import { OrgUserFilter } from '@/features/organization/org-user-filter'
import {
  LogsFilterField,
  LogsFilterInput,
  LogsFilterToolbar,
} from './logs-filter-toolbar'
import { useLogsViewScope } from './usage-logs-provider'

const route = getRouteApi('/_authenticated/usage-logs/$section')

type TaskLikeLogCategory = Extract<LogCategory, 'drawing' | 'task'>
type TaskLogsFilters = DrawingLogFilters | TaskLogFilters

interface TaskLogsFilterBarProps<TData> {
  table: Table<TData>
  logCategory: TaskLikeLogCategory
}

function getFilterValue(
  filters: TaskLogsFilters,
  logCategory: TaskLikeLogCategory
): string {
  if (logCategory === 'drawing') {
    return (filters as DrawingLogFilters).mjId || ''
  }
  return (filters as TaskLogFilters).taskId || ''
}

function setFilterValue(
  filters: TaskLogsFilters,
  logCategory: TaskLikeLogCategory,
  value: string
): TaskLogsFilters {
  if (logCategory === 'drawing') {
    return { ...filters, mjId: value }
  }
  return { ...filters, taskId: value }
}

export function TaskLogsFilterBar<TData>(props: TaskLogsFilterBarProps<TData>) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const searchParams = route.useSearch()
  const { isAdminView: isAdmin } = useLogsViewScope()
  // 平台管理员：内联「用户名 / 用户ID」文本输入（可见全部用户）。
  // 组织管理者（非平台管理员）：改为组织内成员双下拉，仅可在权限范围内下拉筛选、不可手动输入。
  const { isOrgManager, members: orgMembers, isLoading: orgMembersLoading } =
    useOrgManagerScope()
  const showOrgUserFilter = isOrgManager && !isAdmin
  const fetchingLogs = useIsFetching({ queryKey: ['logs'] })

  const [filters, setFilters] = useState<TaskLogsFilters>(() => {
    const { start, end } = getDefaultTimeRange()
    return { startTime: start, endTime: end }
  })
  // 用户 ID 输入框保留原始字符串（允许 "uter…" 写法），null 表示跟随 URL 渲染。
  const [userIdRaw, setUserIdRaw] = useState<string | null>(null)

  useEffect(() => {
    const { start, end } = getDefaultTimeRange()
    const baseFilters = {
      startTime: searchParams.startTime
        ? new Date(searchParams.startTime)
        : start,
      endTime: searchParams.endTime ? new Date(searchParams.endTime) : end,
      ...(searchParams.channel
        ? { channel: String(searchParams.channel) }
        : {}),
      ...(searchParams.userId ? { userId: Number(searchParams.userId) } : {}),
    }
    const next: TaskLogsFilters =
      props.logCategory === 'drawing'
        ? {
            ...baseFilters,
            ...(searchParams.username
              ? { username: String(searchParams.username) }
              : {}),
            ...(searchParams.filter ? { mjId: searchParams.filter } : {}),
          }
        : {
            ...baseFilters,
            ...(searchParams.username
              ? { username: String(searchParams.username) }
              : {}),
            ...(searchParams.filter ? { taskId: searchParams.filter } : {}),
          }

    setFilters(next)
    setUserIdRaw(null)
  }, [
    props.logCategory,
    searchParams.startTime,
    searchParams.endTime,
    searchParams.channel,
    searchParams.filter,
    searchParams.userId,
    searchParams.username,
  ])

  const userIdInput =
    userIdRaw ?? (filters.userId ? formatUserId(filters.userId) : '')

  const handleChange = useCallback(
    (
      field: keyof TaskLogsFilters,
      value: Date | string | number | undefined
    ) => {
      setFilters((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  const handleApply = useCallback(
    (nextFilters: TaskLogsFilters = filters) => {
      // 平台管理员与组织管理者都走内联文本输入：直接解析 userIdInput（支持 uter… 形式）。
      const parsedUserId = parseUserId(userIdInput)
      const merged: TaskLogsFilters = {
        ...nextFilters,
        userId: parsedUserId > 0 ? parsedUserId : undefined,
      }
      const filterParams = buildSearchParams(merged, props.logCategory)
      navigate({
        to: '/usage-logs/$section',
        params: { section: props.logCategory },
        search: {
          ...filterParams,
          page: 1,
        },
      })
      queryClient.invalidateQueries({ queryKey: ['logs'] })
    },
    [filters, navigate, props.logCategory, queryClient, userIdInput]
  )

  const handleReset = useCallback(() => {
    const { start, end } = getDefaultTimeRange()
    const resetFilters: TaskLogsFilters = { startTime: start, endTime: end }
    setFilters(resetFilters)
    setUserIdRaw(null)

    navigate({
      to: '/usage-logs/$section',
      params: { section: props.logCategory },
      search: {
        page: 1,
        startTime: start.getTime(),
        endTime: end.getTime(),
      },
    })
    queryClient.invalidateQueries({ queryKey: ['logs'] })
  }, [navigate, props.logCategory, queryClient])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleApply()
    },
    [handleApply]
  )

  const handleFilterChange = useCallback(
    (value: string) => {
      setFilters((prev) => setFilterValue(prev, props.logCategory, value))
    },
    [props.logCategory]
  )

  const filterValue = getFilterValue(filters, props.logCategory)
  const placeholder =
    props.logCategory === 'drawing'
      ? t('Filter by MjProxy task ID')
      : t('Filter by task ID')
  const hasAdditionalFilters =
    !!filterValue || !!filters.channel || !!filters.userId || !!filters.username
  const dateRangeFilter = (
    <LogsFilterField wide>
      <CompactDateTimeRangePicker
        start={filters.startTime}
        end={filters.endTime}
        onChange={({ start, end }) => {
          handleChange('startTime', start)
          handleChange('endTime', end)
          // 选日期范围（预设或手动确认）后立即应用，否则表格仍按默认
          // 「今天」区间请求，表现为「选了最近7天仍只显示当天的数据」。
          handleApply({ ...filters, startTime: start, endTime: end })
        }}
      />
    </LogsFilterField>
  )
  const taskIdFilter = (
    <LogsFilterField>
      <LogsFilterInput
        aria-label={t('Task ID')}
        placeholder={placeholder}
        value={filterValue}
        onChange={(e) => handleFilterChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </LogsFilterField>
  )
  const channelFilter = isAdmin ? (
    <LogsFilterField>
      <LogsFilterInput
        placeholder={t('Channel ID')}
        value={filters.channel || ''}
        onChange={(e) => handleChange('channel', e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </LogsFilterField>
  ) : null
  // 平台管理员：内联「用户名 / 用户ID」文本输入；组织管理者：组织内成员双下拉，
  // 仅可在权限范围内下拉筛选、不可手动输入（与分组、所有类型同一模式）。
  const userDimensionFilter = isAdmin || showOrgUserFilter ? (
    <>
      {isAdmin && (
        <>
          <LogsFilterField>
            <LogsFilterInput
              aria-label={t('Username')}
              placeholder={t('Username')}
              value={filters.username || ''}
              onChange={(e) => handleChange('username', e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </LogsFilterField>
          <LogsFilterField>
            <LogsFilterInput
              aria-label={t('User ID')}
              placeholder={t('User ID')}
              inputMode='numeric'
              value={userIdInput}
              onChange={(e) => setUserIdRaw(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </LogsFilterField>
        </>
      )}
      {showOrgUserFilter && (
        <OrgUserFilter
          members={orgMembers}
          username={filters.username}
          userId={filters.userId}
          onUsernameChange={(value) => handleChange('username', value)}
          onUserIdChange={(value) => handleChange('userId', value)}
          disabled={orgMembersLoading}
        />
      )}
    </>
  ) : null

  return (
    <LogsFilterToolbar
      table={props.table}
      primaryFilters={
        <>
          {dateRangeFilter}
          {taskIdFilter}
          {userDimensionFilter}
          {channelFilter}
        </>
      }
      mobilePinnedFilters={dateRangeFilter}
      mobileFilters={
        <>
          {taskIdFilter}
          {userDimensionFilter}
          {channelFilter}
        </>
      }
      mobileFilterCount={
        [filterValue, filters.userId, filters.username, filters.channel].filter(
          Boolean
        ).length
      }
      hasActiveFilters={hasAdditionalFilters}
      onSearch={handleApply}
      searchLoading={fetchingLogs > 0}
      onReset={handleReset}
    />
  )
}
