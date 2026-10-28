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
import { Filter, RotateCcw, Calendar, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DateTimePicker } from '@/components/datetime-picker'
import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TIME_GRANULARITY_OPTIONS,
  TIME_RANGE_PRESETS,
} from '@/features/dashboard/constants'
import {
  buildDefaultDashboardFilters,
  cleanFilters,
} from '@/features/dashboard/lib'
import type {
  DashboardChartPreferences,
  DashboardFilters,
} from '@/features/dashboard/types'
import { OrgUserFilter } from '@/features/organization/org-user-filter'
import { useOrgManagerScope } from '@/features/organization/use-org-manager'
import { formatUserId, parseUserId } from '@/lib/format'
import { getRollingDateRange, type TimeGranularity } from '@/lib/time'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

interface ModelsFilterProps {
  preferences: DashboardChartPreferences
  // The filters currently applied to the dashboard. The dialog edits a copy of
  // these so reopening it never discards a manually picked range.
  currentFilters: DashboardFilters
  onFilterChange: (filters: DashboardFilters) => void
  onReset: () => void
  titleKey?: string
  descriptionKey?: string
}

// Quick-range presets imply a sensible granularity (matching the app's
// range<->granularity pairing), so picking "7 Days" requests daily buckets
// instead of leaving the granularity on its previous value (e.g. hourly).
function granularityForRangeDays(days: number): TimeGranularity {
  if (days <= 1) return 'hour'
  if (days >= 29) return 'week'
  return 'day'
}

// Highlights the matching quick-range button when the applied range spans an
// exact preset; custom ranges leave every quick button unselected.
function detectQuickRangeDays(
  filters: DashboardFilters | undefined
): number | null {
  const start = filters?.start_timestamp
  const end = filters?.end_timestamp
  if (!start || !end) return null
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000)
  return TIME_RANGE_PRESETS.some((preset) => preset.days === days) ? days : null
}

/**
 * Section divider component for better visual organization
 */
const SectionDivider = ({ label }: { label: string }) => (
  <div className='relative'>
    <div className='absolute inset-0 flex items-center'>
      <span className='w-full border-t' />
    </div>
    <div className='relative flex justify-center text-xs uppercase'>
      <span className='bg-background text-muted-foreground px-2'>{label}</span>
    </div>
  </div>
)

export function ModelsFilter(props: ModelsFilterProps) {
  const { t } = useTranslation()
  // 使用已缓存的用户数据，避免重复调用 API
  const user = useAuthStore((state) => state.auth.user)
  const isAdmin = user?.role && user.role >= 10
  // 组织管理者（owner / admin / department_admin，且非平台管理员）：用「用户名 / 用户ID」
  // 双下拉替代平台管理员的纯文本输入；成员列表已由后端按角色收敛（admin 看不到 owner、
  // 部门 admin 只看本部门）。
  const {
    isOrgManager,
    members,
    isLoading: membersLoading,
  } = useOrgManagerScope()
  const showOrgUserFilter = isOrgManager && !isAdmin

  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState<DashboardFilters>(
    () =>
      props.currentFilters ?? buildDefaultDashboardFilters(props.preferences)
  )
  const [selectedRange, setSelectedRange] = useState<number | null>(() =>
    detectQuickRangeDays(props.currentFilters)
  )
  // 用户 ID 用受控字符串保存原始输入，只在 apply 时归一成数字：
  // 用户可以输入 "U100000001" 或 "1"，直接受控成数字会把前者吃掉。
  const [userIdInput, setUserIdInput] = useState<string>(() =>
    props.currentFilters?.user_id
      ? formatUserId(props.currentFilters.user_id)
      : ''
  )

  const handleOpenChange = (nextOpen: boolean) => {
    // Sync the editing state from the applied filters every time the dialog
    // opens so a previously applied manual range is preserved.
    if (nextOpen) {
      const applied =
        props.currentFilters ?? buildDefaultDashboardFilters(props.preferences)
      setFilters(applied)
      setSelectedRange(detectQuickRangeDays(applied))
      setUserIdInput(applied.user_id ? formatUserId(applied.user_id) : '')
    }
    setOpen(nextOpen)
  }

  const handleApply = () => {
    // 平台管理员用文本输入（可输入 uter… 形式），组织管理者走下拉直接写数字 user_id。
    const parsedUserId = isAdmin
      ? parseUserId(userIdInput)
      : (filters.user_id ?? 0)
    props.onFilterChange(
      cleanFilters({
        ...(filters as unknown as Record<string, unknown>),
        user_id: parsedUserId > 0 ? parsedUserId : undefined,
      }) as typeof filters
    )
    setOpen(false)
  }

  const handleReset = () => {
    const days = props.preferences.defaultTimeRangeDays
    const { start, end } = getRollingDateRange(days)
    setFilters({
      ...buildDefaultDashboardFilters(props.preferences),
      start_timestamp: start,
      end_timestamp: end,
    })
    setSelectedRange(days)
    setUserIdInput('')
    props.onReset()
    setOpen(false)
  }

  const handleChange = (
    field: keyof DashboardFilters,
    value: Date | string | undefined
  ) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
    if (field === 'start_timestamp' || field === 'end_timestamp') {
      setSelectedRange(null)
    }
  }

  const handleQuickRange = (days: number) => {
    const { start, end } = getRollingDateRange(days)

    setFilters((prev) => ({
      ...prev,
      start_timestamp: start,
      end_timestamp: end,
      time_granularity: granularityForRangeDays(days),
    }))
    setSelectedRange(days)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button variant='outline' size='sm'>
          <Filter className='mr-2 h-4.5 w-4.5' />
          {t('Filter')}
        </Button>
      }
      title={t(props.titleKey ?? 'Model Analytics Filters')}
      description={t(
        props.descriptionKey ??
          'Filter the model analytics view by time range and user.'
      )}
      contentClassName='max-sm:h-dvh max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:p-4 sm:max-w-lg'
      contentHeight='min(48vh, 460px)'
      footerClassName='grid grid-cols-2 gap-2 sm:flex'
      footer={
        <>
          <Button onClick={handleReset} variant='outline' type='button'>
            <RotateCcw className='mr-2 h-4.5 w-4.5' />
            {t('Reset')}
          </Button>
          <Button onClick={handleApply} type='submit'>
            <Search className='mr-2 h-4.5 w-4.5' />
            {t('Apply Filters')}
          </Button>
        </>
      }
    >
      <ScrollArea className='h-full pr-3 sm:pr-4'>
        <div className='grid gap-2.5 py-2 text-start'>
          {/* Quick time range selection */}
          <div className='grid gap-2'>
            <Label className='flex items-center gap-2'>
              <Calendar className='h-4 w-4' />
              {t('Quick Range')}
            </Label>
            <div className='grid grid-cols-2 gap-2 sm:flex'>
              {TIME_RANGE_PRESETS.map((range) => (
                <Button
                  key={range.days}
                  type='button'
                  size='sm'
                  variant={selectedRange === range.days ? 'default' : 'outline'}
                  onClick={() => handleQuickRange(range.days)}
                  className={cn(
                    'flex-1',
                    selectedRange === range.days &&
                      'ring-ring ring-2 ring-offset-2'
                  )}
                >
                  {t(range.label)}
                </Button>
              ))}
            </div>
          </div>

          <SectionDivider label={t('Custom Time Range')} />

          {/* Custom time range */}
          <div className='grid gap-2.5'>
            <div className='grid gap-2'>
              <Label htmlFor='start_timestamp'>{t('Start Time')}</Label>
              <DateTimePicker
                value={filters.start_timestamp}
                onChange={(date) =>
                  handleChange('start_timestamp', date || undefined)
                }
                placeholder={t('Select start time')}
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='end_timestamp'>{t('End Time')}</Label>
              <DateTimePicker
                value={filters.end_timestamp}
                onChange={(date) =>
                  handleChange('end_timestamp', date || undefined)
                }
                placeholder={t('Select end time')}
              />
            </div>
          </div>

          <SectionDivider label={t('Chart Settings')} />

          <div className='grid gap-2'>
            <Label htmlFor='time_granularity'>{t('Time Granularity')}</Label>
            <Select
              items={TIME_GRANULARITY_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.label),
              }))}
              value={filters.time_granularity}
              onValueChange={(value) =>
                handleChange('time_granularity', value as TimeGranularity)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t('Select time granularity')} />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  {TIME_GRANULARITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.label)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* 组织管理者（非平台管理员）：在「筛选时间粒度」下方提供用户名 / 用户ID 双下拉，
              数据源为后端按角色收敛后的可见成员（admin 看不到 owner、部门 admin 只看本部门），不可输入。 */}
          {showOrgUserFilter && (
            <OrgUserFilter
              members={members}
              username={filters.username}
              userId={filters.user_id}
              disabled={membersLoading}
              onUsernameChange={(value) =>
                setFilters((prev) => ({ ...prev, username: value }))
              }
              onUserIdChange={(value) => {
                setFilters((prev) => ({ ...prev, user_id: value }))
                setUserIdInput('')
              }}
            />
          )}

          {/* Admin-only fields */}
          {isAdmin && (
            <>
              <SectionDivider label={t('Admin Only')} />

              <div className='grid gap-2'>
                <Label htmlFor='username'>{t('Username')}</Label>
                <Input
                  id='username'
                  placeholder={t('Filter by username')}
                  value={filters.username}
                  onChange={(e) => handleChange('username', e.target.value)}
                />
              </div>

              <div className='grid gap-2'>
                <Label htmlFor='user_id'>{t('User ID')}</Label>
                <Input
                  mono
                  id='user_id'
                  inputMode='numeric'
                  autoComplete='off'
                  placeholder={t('Filter by user ID')}
                  value={userIdInput}
                  onChange={(e) => setUserIdInput(e.target.value)}
                />
                <p className='text-muted-foreground text-sm'>
                  {t('Accepts a raw user ID or the displayed U… number.')}
                </p>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </Dialog>
  )
}
