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
import { CalendarDays } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { getCalendarLocale } from '@/lib/calendar-locale'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'

interface CompactDateTimeRangePickerProps {
  start?: Date
  end?: Date
  onChange: (range: { start?: Date; end?: Date }) => void
  className?: string
}

const DEFAULT_START_TIME = '00:00:00'
const DEFAULT_END_TIME = '23:59:59'

/** 把「日期」与「时间」拼回一个时间点；日期为空时返回 undefined。 */
function mergeDateTime(date?: Date, time?: string): Date | undefined {
  if (!date) return undefined
  const [hours, minutes, seconds = 0] = (time || DEFAULT_START_TIME)
    .split(':')
    .map(Number)
  const merged = new Date(date)
  merged.setHours(hours, minutes, seconds, 0)
  return merged
}

export function CompactDateTimeRangePicker({
  start,
  end,
  onChange,
  className,
}: CompactDateTimeRangePickerProps) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange>({ from: start, to: end })
  const [startTime, setStartTime] = useState(DEFAULT_START_TIME)
  const [endTime, setEndTime] = useState(DEFAULT_END_TIME)

  const calendarLocale = getCalendarLocale(i18n.language)

  const label = useMemo(() => {
    if (!start && !end) return t('Date Range')
    const startText = start ? dayjs(start).format('YYYY-MM-DD HH:mm:ss') : '-'
    const endText = end ? dayjs(end).format('YYYY-MM-DD HH:mm:ss') : '-'
    return `${startText} ~ ${endText}`
  }, [end, start, t])

  const mobileLabel = useMemo(() => {
    if (!start || !end) return label
    if (dayjs(start).isSame(end, 'day')) {
      return `${dayjs(start).format('MM/DD HH:mm:ss')}–${dayjs(end).format('HH:mm:ss')}`
    }
    return label
  }, [start, end, label])

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      // 每次打开都从「已应用的区间」重新起草，未确认的改动不残留。
      setDraft({ from: start, to: end })
      setStartTime(start ? dayjs(start).format('HH:mm:ss') : DEFAULT_START_TIME)
      setEndTime(end ? dayjs(end).format('HH:mm:ss') : DEFAULT_END_TIME)
    }
    setOpen(nextOpen)
  }

  const applyDraft = () => {
    onChange({
      start: mergeDateTime(draft.from, startTime),
      end: mergeDateTime(draft.to, endTime),
    })
    setOpen(false)
  }

  const applyPreset = (kind: 'today' | '7d' | 'week' | '30d' | 'month') => {
    const now = dayjs()
    const presets = {
      today: {
        start: now.startOf('day').toDate(),
        end: now.endOf('day').toDate(),
      },
      '7d': {
        start: now.subtract(6, 'day').startOf('day').toDate(),
        end: now.endOf('day').toDate(),
      },
      week: {
        start: now.startOf('week').toDate(),
        end: now.endOf('week').toDate(),
      },
      '30d': {
        start: now.subtract(29, 'day').startOf('day').toDate(),
        end: now.endOf('day').toDate(),
      },
      month: {
        start: now.startOf('month').toDate(),
        end: now.endOf('month').toDate(),
      },
    }
    const range = presets[kind]
    setStartTime(dayjs(range.start).format('HH:mm:ss'))
    setEndTime(dayjs(range.end).format('HH:mm:ss'))
    onChange(range)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='outline'
            aria-label={label}
            className={cn(
              // 触发器与同一行里的 Input 同高（`--ds-control-height-md`，40px）。
              // 此前吃 Button 的默认档（36px），一行里输入框比日期框高 4px，
              // 筛选行看起来是锯齿的。Button 的高度在 size 变体里，与这里的
              // 同名工具类同组，twMerge 会让后写的这一个生效。
              'h-(--ds-control-height-md) w-full justify-start gap-2 px-2.5 text-sm font-normal tabular-nums',
              !start && !end && 'text-muted-foreground',
              className
            )}
          />
        }
      >
        <CalendarDays className='text-muted-foreground size-4.5 shrink-0' />
        <span className='hidden truncate sm:block'>{label}</span>
        <span className='min-w-0 [overflow-wrap:anywhere] whitespace-normal sm:hidden'>
          {mobileLabel}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        className='w-[min(20rem,calc(100vw-2rem))] p-3'
      >
        <div className='space-y-3'>
          {/* 日历走设计系统（`ui/calendar.tsx`），不再用原生 `datetime-local`：
              浏览器自带的日历弹层是操作系统风格（系统蓝选中块、清除/今天按钮、
              自带字号），与后台的圆角、主色、字号阶梯完全对不上，也不跟主题走。 */}
          <Calendar
            mode='range'
            selected={draft}
            // 区间可以被清空（面板里有「清除」），因此这里是可空的 range 模式：
            // `onSelect` 会给出 `DateRange | undefined`，而 state 恒为 `DateRange`。
            // 直接把 `setDraft` 传进去会被 react-day-picker 的 `required` 分支
            // 判成类型不符 —— 包一层把 undefined 归一成空区间。
            onSelect={(range) => setDraft(range ?? { from: undefined })}
            locale={calendarLocale}
            aria-label={t('Date Range')}
            // 撑满弹层宽度：日历默认 `w-fit`（7 × 28px ≈ 212px），而弹层内宽
            // 296px，右侧会空出 84px —— 看起来像日历没画完。
            fullWidth
          />

          <div className='grid grid-cols-2 gap-2'>
            <div className='space-y-1.5'>
              <div className='text-muted-foreground text-sm'>
                {t('Start Time')}
              </div>
              <Input
                type='time'
                step={1}
                value={startTime}
                aria-label={t('Start Time')}
                onChange={(e) =>
                  setStartTime(e.target.value || DEFAULT_START_TIME)
                }
                className='appearance-none text-sm tabular-nums [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none'
              />
            </div>
            <div className='space-y-1.5'>
              <div className='text-muted-foreground text-sm'>
                {t('End Time')}
              </div>
              <Input
                type='time'
                step={1}
                value={endTime}
                aria-label={t('End Time')}
                onChange={(e) => setEndTime(e.target.value || DEFAULT_END_TIME)}
                className='appearance-none text-sm tabular-nums [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none'
              />
            </div>
          </div>

          <div className='flex flex-wrap gap-1.5'>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              className='flex-1 px-2 text-sm'
              onClick={() => applyPreset('today')}
            >
              {t('Today')}
            </Button>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              className='flex-1 px-2 text-sm'
              onClick={() => applyPreset('7d')}
            >
              {t('7 Days')}
            </Button>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              className='flex-1 px-2 text-sm'
              onClick={() => applyPreset('week')}
            >
              {t('This week')}
            </Button>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              className='flex-1 px-2 text-sm'
              onClick={() => applyPreset('30d')}
            >
              {t('30 Days')}
            </Button>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              className='flex-1 px-2 text-sm'
              onClick={() => applyPreset('month')}
            >
              {t('Current month')}
            </Button>
          </div>

          <div className='flex items-center justify-between gap-2'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='text-sm'
              onClick={() => {
                setDraft({ from: undefined, to: undefined })
                setStartTime(DEFAULT_START_TIME)
                setEndTime(DEFAULT_END_TIME)
              }}
            >
              {t('Clear')}
            </Button>
            <Button size='sm' onClick={applyDraft}>
              {t('Confirm')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
