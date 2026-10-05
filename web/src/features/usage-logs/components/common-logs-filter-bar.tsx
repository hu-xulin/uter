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
import { useQueryClient, useIsFetching, useQuery } from '@tanstack/react-query'
import { useNavigate, getRouteApi } from '@tanstack/react-router'
import type { Table } from '@tanstack/react-table'
import { Eye, EyeOff } from 'lucide-react'
import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useOrgManagerScope } from '@/features/organization/use-org-manager'
import { OrgUserFilter } from '@/features/organization/org-user-filter'
import { getGroups } from '@/features/users/api'
import { getUserGroups } from '@/lib/api'
import { formatUserId, parseUserId } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'

import { LOG_TYPE_ALL_VALUE, LOG_TYPE_FILTERS } from '../constants'
import { buildSearchParams } from '../lib/filter'
import { getDefaultTimeRange } from '../lib/utils'
import type { CommonLogFilters } from '../types'
import { CommonLogsStats } from './common-logs-stats'
import { CompactDateTimeRangePicker } from './compact-date-time-range-picker'
import {
  LogsFilterField,
  LogsFilterInput,
  LogsFilterToolbar,
} from './logs-filter-toolbar'
import { useLogsViewScope, useUsageLogsContext } from './usage-logs-provider'

const route = getRouteApi('/_authenticated/usage-logs/$section')

type LogTypeValue = (typeof LOG_TYPE_FILTERS)[number]['value']
const logTypeValueSet = new Set<string>(
  LOG_TYPE_FILTERS.map((type) => type.value)
)

type CommonLogDraft = {
  sourceKey: string
  filters: CommonLogFilters
  logType: LogTypeValue
}

function isLogTypeValue(value: string): value is LogTypeValue {
  return logTypeValueSet.has(value)
}

function getLogTypeValue(value: unknown): LogTypeValue {
  return Array.isArray(value) &&
    value.length === 1 &&
    typeof value[0] === 'string' &&
    isLogTypeValue(value[0])
    ? value[0]
    : LOG_TYPE_ALL_VALUE
}

function buildSearchSourceKey(values: {
  startTime?: unknown
  endTime?: unknown
  channel?: unknown
  model?: unknown
  token?: unknown
  group?: unknown
  username?: unknown
  userId?: unknown
  requestId?: unknown
  upstreamRequestId?: unknown
  type?: unknown
}) {
  return [
    values.startTime,
    values.endTime,
    values.channel,
    values.model,
    values.token,
    values.group,
    values.username,
    values.userId,
    values.requestId,
    values.upstreamRequestId,
    Array.isArray(values.type) ? values.type.join(',') : values.type,
  ]
    .map((value) => String(value ?? ''))
    .join('\u001f')
}

interface CommonLogsFilterBarProps<TData> {
  table: Table<TData>
}

export function CommonLogsFilterBar<TData>(
  props: CommonLogsFilterBarProps<TData>
) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const searchParams = route.useSearch()
  const { isAdminView: isAdmin } = useLogsViewScope()
  const { sensitiveVisible, setSensitiveVisible } = useUsageLogsContext()
  const { isOrgManager, members: orgMembers, isLoading: orgMembersLoading } =
    useOrgManagerScope()
  // 平台管理员：内联「用户名 / 用户ID」文本输入（可见全部用户，下拉不可行）。
  // 组织管理者（非平台管理员）：改为组织内成员双下拉（OrgUserFilter），仅可在
  // 自己权限范围内（owner/admin 看全组织，部门 admin 仅本部门）下拉筛选，不可手动输入。
  const showOrgUserFilter = isOrgManager && !isAdmin
  const fetchingLogs = useIsFetching({ queryKey: ['logs'] })
  const { data: adminGroups } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => requireServerSuccess(await getGroups()),
    enabled: isAdmin,
  })
  const { data: userGroups } = useQuery({
    queryKey: ['user-groups'],
    queryFn: async () => requireServerSuccess(await getUserGroups()),
    enabled: !isAdmin,
  })
  const groupOptions = useMemo(() => {
    const groups = isAdmin
      ? (adminGroups?.data ?? [])
      : Object.keys(userGroups?.data ?? {})
    return groups
      .filter((group) => group !== 'auto')
      .map((group) => ({ label: group, value: group }))
  }, [isAdmin, adminGroups, userGroups])

  const searchState = useMemo<CommonLogDraft>(() => {
    const { start, end } = getDefaultTimeRange()
    const sourceValues = {
      startTime: searchParams.startTime,
      endTime: searchParams.endTime,
      channel: searchParams.channel,
      model: searchParams.model,
      token: searchParams.token,
      group: searchParams.group,
      username: searchParams.username,
      userId: searchParams.userId,
      requestId: searchParams.requestId,
      upstreamRequestId: searchParams.upstreamRequestId,
      type: searchParams.type,
    }
    const filters: CommonLogFilters = {
      startTime: searchParams.startTime
        ? new Date(searchParams.startTime)
        : start,
      endTime: searchParams.endTime ? new Date(searchParams.endTime) : end,
      channel: searchParams.channel || undefined,
      model: searchParams.model || undefined,
      token: searchParams.token || undefined,
      group: searchParams.group || undefined,
      username: searchParams.username || undefined,
      userId: searchParams.userId || undefined,
      requestId: searchParams.requestId || undefined,
      upstreamRequestId: searchParams.upstreamRequestId || undefined,
    }
    return {
      sourceKey: buildSearchSourceKey(sourceValues),
      filters,
      logType: getLogTypeValue(searchParams.type),
    }
  }, [
    searchParams.startTime,
    searchParams.endTime,
    searchParams.channel,
    searchParams.model,
    searchParams.token,
    searchParams.group,
    searchParams.username,
    searchParams.userId,
    searchParams.requestId,
    searchParams.upstreamRequestId,
    searchParams.type,
  ])
  const [draft, setDraft] = useState<CommonLogDraft>(() => searchState)
  const activeDraft =
    draft.sourceKey === searchState.sourceKey ? draft : searchState
  const filters = activeDraft.filters
  const logType = activeDraft.logType

  // 用户 ID 允许两种写法（原始 id 或对外展示的 uter…），因此保留一份**原始字符串**，
  // null 表示「跟随当前 filters 渲染」。与 activeDraft 同构：URL 变化后丢弃本地草稿。
  const [userIdRaw, setUserIdRaw] = useState<string | null>(null)
  const rawIsCurrent = draft.sourceKey === searchState.sourceKey
  const userIdInput = (rawIsCurrent ? userIdRaw : null) ??
    (filters.userId ? formatUserId(filters.userId) : '')

  const handleChange = useCallback(
    (field: keyof CommonLogFilters, value: Date | string | number | undefined) => {
      setDraft((current) => {
        const base =
          current.sourceKey === searchState.sourceKey ? current : searchState
        return {
          sourceKey: searchState.sourceKey,
          filters: { ...base.filters, [field]: value },
          logType: base.logType,
        }
      })
    },
    [searchState]
  )

  const handleApply = useCallback(
    (nextFilters: CommonLogFilters = filters) => {
      const parsedUserId = parseUserId(userIdInput)
      const merged: CommonLogFilters = {
        ...nextFilters,
        userId: parsedUserId > 0 ? parsedUserId : undefined,
      }
      const filterParams = buildSearchParams(merged, 'common')
      navigate({
        to: '/usage-logs/$section',
        params: { section: 'common' },
        search: {
          ...filterParams,
          type: [logType],
          page: 1,
        },
      })
      queryClient.invalidateQueries({ queryKey: ['logs'] })
      queryClient.invalidateQueries({ queryKey: ['usage-logs-stats'] })
    },
    [filters, logType, navigate, queryClient, userIdInput]
  )

  const handleReset = useCallback(() => {
    const { start, end } = getDefaultTimeRange()
    const resetFilters: CommonLogFilters = { startTime: start, endTime: end }
    const resetSearch = {
      type: [LOG_TYPE_ALL_VALUE],
      startTime: start.getTime(),
      endTime: end.getTime(),
    }
    setDraft({
      sourceKey: buildSearchSourceKey(resetSearch),
      filters: resetFilters,
      logType: LOG_TYPE_ALL_VALUE,
    })
    setUserIdRaw(null)

    navigate({
      to: '/usage-logs/$section',
      params: { section: 'common' },
      search: {
        page: 1,
        ...resetSearch,
      },
    })
    queryClient.invalidateQueries({ queryKey: ['logs'] })
    queryClient.invalidateQueries({ queryKey: ['usage-logs-stats'] })
  }, [navigate, queryClient])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleApply()
    },
    [handleApply]
  )

  const hasExpandedFilters =
    !!filters.token ||
    !!filters.channel ||
    !!filters.requestId ||
    !!filters.upstreamRequestId

  const hasTypeFilter = logType !== LOG_TYPE_ALL_VALUE
  const hasUserDimension = !!filters.username || !!filters.userId
  const hasAdditionalFilters =
    !!filters.model ||
    !!filters.group ||
    hasTypeFilter ||
    hasExpandedFilters ||
    hasUserDimension

  const expandedFilterCount = [
    filters.token,
    isAdmin ? filters.channel : undefined,
    filters.requestId,
    filters.upstreamRequestId,
  ].filter(Boolean).length
  const sensitiveInputClass = sensitiveVisible
    ? undefined
    : '[-webkit-text-security:disc]'
  const logTypeItems = useMemo(
    () =>
      LOG_TYPE_FILTERS.map((type) => ({
        value: type.value,
        label: t(type.label),
        deprecated: type.deprecated,
      })),
    [t]
  )
  const selectedLogType = logTypeItems.find((type) => type.value === logType)
  const deprecatedTypeDescription = t(
    'Only used to find historical logs. New records are available in Audit Logs.'
  )

  const statsBar = <CommonLogsStats />
  const sensitiveToggle = (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant='ghost'
            size='icon'
            onClick={() => setSensitiveVisible(!sensitiveVisible)}
            aria-label={sensitiveVisible ? t('Hide') : t('Show')}
            className='text-muted-foreground hover:text-foreground size-7 max-sm:size-11'
          />
        }
      >
        {sensitiveVisible ? <Eye /> : <EyeOff />}
      </TooltipTrigger>
      <TooltipContent>
        {sensitiveVisible ? t('Hide') : t('Show')}
      </TooltipContent>
    </Tooltip>
  )

  const dateRangeFilter = (
    <LogsFilterField wide>
      <CompactDateTimeRangePicker
        start={filters.startTime}
        end={filters.endTime}
        onChange={({ start, end }) => {
          handleChange('startTime', start)
          handleChange('endTime', end)
          // 选日期范围（预设或手动确认）后无论何种视口都立即应用：
          // 否则桌面端只更新本地草稿、不触发查询，表格仍按默认「今天」
          // 区间请求，表现为「选了最近7天仍只显示当天的数据」。
          handleApply({ ...filters, startTime: start, endTime: end })
        }}
      />
    </LogsFilterField>
  )
  const modelFilter = (
    <LogsFilterField>
      <LogsFilterInput
        placeholder={t('Model Name')}
        value={filters.model || ''}
        onChange={(e) => handleChange('model', e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </LogsFilterField>
  )
  const groupFilter = (
    <LogsFilterField className={sensitiveInputClass}>
      <Combobox
        options={groupOptions}
        allowCustomValue
        aria-label={t('Group')}
        emptyText={t('No group found.')}
        placeholder={t('Group')}
        className='h-8 min-w-0 text-sm leading-5'
        value={filters.group || ''}
        onValueChange={(value) => handleChange('group', value ?? '')}
        onKeyDown={handleKeyDown}
      />
    </LogsFilterField>
  )
  const typeFilter = (
    <LogsFilterField>
      <Select
        items={logTypeItems}
        value={logType}
        onValueChange={(value) => {
          const nextLogType =
            value !== null && isLogTypeValue(value) ? value : LOG_TYPE_ALL_VALUE
          setDraft((current) => {
            const base =
              current.sourceKey === searchState.sourceKey
                ? current
                : searchState
            return {
              sourceKey: searchState.sourceKey,
              filters: base.filters,
              logType: nextLogType,
            }
          })
        }}
      >
        <SelectTrigger
          aria-label={t('Type')}
          aria-description={
            selectedLogType?.deprecated ? deprecatedTypeDescription : undefined
          }
        >
          <SelectValue className='min-w-0'>
            <span className='truncate'>
              {selectedLogType?.label ?? t('All Types')}
            </span>
            {selectedLogType?.deprecated && (
              <Badge
                variant='secondary'
                className='h-4 px-1.5 text-[10px] font-normal'
                title={deprecatedTypeDescription}
              >
                {t('Deprecated')}
              </Badge>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          className='max-w-[calc(100vw-2rem)] min-w-52'
        >
          <SelectGroup>
            {LOG_TYPE_FILTERS.map((type) => (
              <SelectItem
                key={type.value}
                value={type.value}
                className='[&_[data-slot=select-item-text]]:items-center'
                aria-description={
                  type.deprecated ? deprecatedTypeDescription : undefined
                }
              >
                {t(type.label)}
                {type.deprecated && (
                  <Badge
                    variant='secondary'
                    className='h-4 px-1.5 text-[10px] font-normal'
                    title={deprecatedTypeDescription}
                  >
                    {t('Deprecated')}
                  </Badge>
                )}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </LogsFilterField>
  )
  const advancedFilters = (
    <>
      <LogsFilterField>
        <LogsFilterInput
          placeholder={t('Token Name')}
          className={sensitiveInputClass}
          value={filters.token || ''}
          onChange={(e) => handleChange('token', e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </LogsFilterField>
      {isAdmin && (
        <LogsFilterField>
          <LogsFilterInput
            placeholder={t('Channel ID')}
            value={filters.channel || ''}
            onChange={(e) => handleChange('channel', e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </LogsFilterField>
      )}
      <LogsFilterField>
        <LogsFilterInput
          placeholder={t('Request ID')}
          value={filters.requestId || ''}
          onChange={(e) => handleChange('requestId', e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </LogsFilterField>
      <LogsFilterField>
        <LogsFilterInput
          placeholder={t('Upstream Request ID')}
          value={filters.upstreamRequestId || ''}
          onChange={(e) => handleChange('upstreamRequestId', e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </LogsFilterField>
    </>
  )
  // 用户名 / 用户ID：与「分组」「所有类型」同模式，常驻主筛选区（仅管理员 / 组织管理者可见）。
  // 平台管理员保留文本输入；组织管理者改为组织内成员双下拉，仅可在权限范围内下拉筛选、不可手动输入。
  const userDimensionPrimaryFilters = (isAdmin || showOrgUserFilter) && (
    <>
      {isAdmin && (
        <>
          <LogsFilterField>
            <LogsFilterInput
              placeholder={t('Username')}
              className={sensitiveInputClass}
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
  )

  return (
    <LogsFilterToolbar
      table={props.table}
      compactMobile
      stats={statsBar}
      actionStart={sensitiveToggle}
      primaryFilters={
        <>
          {dateRangeFilter}
          {modelFilter}
          {groupFilter}
          {typeFilter}
          {userDimensionPrimaryFilters}
        </>
      }
      advancedFilters={advancedFilters}
      mobilePinnedFilters={dateRangeFilter}
      mobileFilters={
        <>
          {modelFilter}
          {groupFilter}
          {typeFilter}
          {userDimensionPrimaryFilters}
          {advancedFilters}
        </>
      }
      mobileFilterCount={
        [filters.model, filters.group, hasTypeFilter].filter(Boolean).length +
        expandedFilterCount +
        (hasUserDimension ? 1 : 0)
      }
      hasAdvancedActiveFilters={hasExpandedFilters}
      advancedFilterCount={expandedFilterCount}
      hasActiveFilters={hasAdditionalFilters}
      onSearch={() => handleApply()}
      searchLoading={fetchingLogs > 0}
      onReset={handleReset}
    />
  )
}
