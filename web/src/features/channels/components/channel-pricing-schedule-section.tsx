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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { handleServerError } from '@/lib/handle-server-error'

import {
  getChannelPricingSchedule,
  setChannelPricingSchedule,
  type ChannelPricingSchedule,
} from '../api'
import { PRICING_MODES } from '../lib/pricing-schedule'

const defaultSchedule: ChannelPricingSchedule = {
  enabled: false,
  basis: 'official',
  mode: 'multiply',
  value: 0.6,
  apply_on_sync: true,
  interval_minutes: 5,
  review_mode: 'auto',
  threshold_percent: 20,
  model_sync_interval_minutes: 360,
  official_sync_interval_minutes: 1440,
  channel_sync_interval_minutes: 60,
}

function scheduleNumberValid(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed === '') return false
  const value = Number(trimmed)
  return Number.isFinite(value) && value >= 0
}

type ChannelPricingScheduleSectionProps = {
  channelId: number | null
  baseUrl: string
  /** False renders nothing (create wizard keeps it in the Automatic updates step). */
  show?: boolean
}

export function ChannelPricingScheduleSection(
  props: ChannelPricingScheduleSectionProps
) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [schedule, setSchedule] =
    useState<ChannelPricingSchedule>(defaultSchedule)
  // Numeric fields keep the typed text so a decimal point survives the
  // keystroke that has no digits after it yet ("0." must not collapse to "0").
  const [scheduleValueText, setScheduleValueText] = useState('0.6')
  const [thresholdText, setThresholdText] = useState('20')

  const normalizedBaseUrl = props.baseUrl.toLowerCase()
  const isBailian =
    normalizedBaseUrl.includes('.maas.aliyuncs.com') ||
    normalizedBaseUrl.includes('dashscope')

  const scheduleQuery = useQuery({
    queryKey: ['channel-pricing-schedule', props.channelId],
    queryFn: () => getChannelPricingSchedule(props.channelId ?? 0),
    enabled: props.channelId != null,
    retry: false,
    meta: { errorToast: false },
  })

  useEffect(() => {
    const saved = scheduleQuery.data?.schedule
    if (!saved) return
    setSchedule({ ...defaultSchedule, ...saved })
    setScheduleValueText(String(saved.value ?? defaultSchedule.value))
    setThresholdText(String(saved.threshold_percent ?? 20))
  }, [scheduleQuery.data])

  useEffect(() => {
    if (isBailian) {
      setSchedule((current) => ({ ...current, basis: 'channel' }))
    }
  }, [isBailian])

  const saveSchedule = useMutation({
    mutationFn: () =>
      setChannelPricingSchedule(props.channelId ?? 0, {
        ...schedule,
        basis: isBailian ? 'channel' : schedule.basis,
        value: Number(scheduleValueText),
        threshold_percent: Number(thresholdText),
        interval_minutes: 5,
      }),
    onSuccess: () => {
      toast.success(t('Pricing schedule saved'))
      void queryClient.invalidateQueries({
        queryKey: ['channel-pricing-schedule', props.channelId],
      })
    },
    onError: (error) =>
      handleServerError(error, t('Failed to save pricing schedule')),
  })

  if (props.show === false) {
    return null
  }

  const disabled = props.channelId == null

  return (
    <section className='space-y-3 rounded-lg border p-3'>
      <div>
        <Label>{t('Scheduled price update')}</Label>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Fetches the upstream catalog and prices on the cadence below, then re-applies the batch rule. No manual sync is required.'
          )}
        </p>
      </div>
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <div className='flex items-start gap-3 sm:col-span-2 xl:col-span-4'>
          <Switch
            checked={schedule.enabled}
            onCheckedChange={(checked) =>
              setSchedule((current) => ({ ...current, enabled: checked }))
            }
          />
          <div className='space-y-0.5'>
            <Label>{t('Enabled')}</Label>
            <p className='text-muted-foreground text-sm'>
              {t('Save a pricing rule for this channel.')}
            </p>
          </div>
        </div>
        <div className='flex items-start gap-3 sm:col-span-2 xl:col-span-4'>
          <Switch
            checked={schedule.apply_on_sync}
            onCheckedChange={(checked) =>
              setSchedule((current) => ({
                ...current,
                apply_on_sync: checked,
              }))
            }
          />
          <div className='space-y-0.5'>
            <Label>{t('Apply after each upstream sync')}</Label>
            <p className='text-muted-foreground text-sm'>
              {t(
                'When off, the rule is saved but only a manual Apply changes prices. Upstream model additions and removals are handled by the Automatic updates step, not by this schedule.'
              )}
            </p>
          </div>
        </div>

        <div className='space-y-1.5'>
          <Label htmlFor='schedule-basis'>{t('Price basis')}</Label>
          <Select
            items={[
              { value: 'official', label: t('Official price') },
              { value: 'channel', label: t('Channel price') },
            ]}
            value={isBailian ? 'channel' : schedule.basis}
            disabled={isBailian}
            onValueChange={(value) =>
              setSchedule((current) => ({
                ...current,
                basis:
                  value === 'official' && !isBailian ? 'official' : 'channel',
              }))
            }
          >
            <SelectTrigger id='schedule-basis' className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='official' disabled={isBailian}>
                {t('Official price')}
              </SelectItem>
              <SelectItem value='channel'>{t('Channel price')}</SelectItem>
            </SelectContent>
          </Select>
          <p className='text-muted-foreground text-sm'>
            {isBailian
              ? t('Bailian schedules always use channel catalog prices.')
              : t('Price basis hint')}
          </p>
        </div>

        <div className='space-y-1.5'>
          <Label htmlFor='schedule-mode'>{t('Pricing rule')}</Label>
          <Select
            items={PRICING_MODES.map((item) => ({
              value: item.value,
              label: t(item.label),
            }))}
            value={schedule.mode}
            onValueChange={(next) =>
              next && setSchedule((current) => ({ ...current, mode: next }))
            }
          >
            <SelectTrigger id='schedule-mode' className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRICING_MODES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {t(item.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className='text-muted-foreground text-sm'>
            {t('Pricing rule hint')}
          </p>
        </div>

        <div className='space-y-1.5'>
          <Label htmlFor='schedule-value'>{t('Rule value')}</Label>
          <Input
            id='schedule-value'
            inputMode='decimal'
            value={scheduleValueText}
            onChange={(event) => setScheduleValueText(event.target.value)}
            placeholder='0.6'
            disabled={schedule.mode === 'none'}
          />
          <p className='text-muted-foreground text-sm'>
            {t('Rule value hint')}
          </p>
        </div>

        <div className='space-y-1.5'>
          <Label htmlFor='schedule-review-mode'>{t('Review mode')}</Label>
          <Select
            items={[
              { value: 'auto', label: t('Auto apply') },
              { value: 'manual', label: t('Manual review') },
            ]}
            value={schedule.review_mode}
            onValueChange={(next) =>
              next &&
              setSchedule((current) => ({
                ...current,
                review_mode: next as 'auto' | 'manual',
              }))
            }
          >
            <SelectTrigger id='schedule-review-mode' className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='auto'>{t('Auto apply')}</SelectItem>
              <SelectItem value='manual'>{t('Manual review')}</SelectItem>
            </SelectContent>
          </Select>
          <p className='text-muted-foreground text-sm'>
            {t('Review mode hint')}
          </p>
        </div>

        <div className='space-y-1.5'>
          <Label htmlFor='schedule-threshold'>
            {t('Review threshold (%)')}
          </Label>
          <Input
            id='schedule-threshold'
            inputMode='decimal'
            value={thresholdText}
            onChange={(event) => setThresholdText(event.target.value)}
            placeholder='20'
          />
          <p className='text-muted-foreground text-sm'>
            {t('Review threshold hint')}
          </p>
        </div>

        <div className='space-y-1.5'>
          <Label htmlFor='schedule-official-interval'>
            {t('Official price interval (minutes)')}
          </Label>
          <Input
            id='schedule-official-interval'
            inputMode='numeric'
            value={String(schedule.official_sync_interval_minutes)}
            onChange={(event) =>
              setSchedule((current) => ({
                ...current,
                official_sync_interval_minutes: Number(event.target.value),
              }))
            }
            placeholder='1440'
          />
          <p className='text-muted-foreground text-sm'>
            {t('Official price interval hint')}
          </p>
        </div>

        <div className='space-y-1.5'>
          <Label htmlFor='schedule-channel-interval'>
            {t('Channel price interval (minutes)')}
          </Label>
          <Input
            id='schedule-channel-interval'
            inputMode='numeric'
            value={String(schedule.channel_sync_interval_minutes)}
            onChange={(event) =>
              setSchedule((current) => ({
                ...current,
                channel_sync_interval_minutes: Number(event.target.value),
              }))
            }
            placeholder='60'
          />
          <p className='text-muted-foreground text-sm'>
            {t('Channel price interval hint')}
          </p>
        </div>

        <div className='flex items-end'>
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={
              disabled ||
              !scheduleNumberValid(scheduleValueText) ||
              !scheduleNumberValid(thresholdText) ||
              saveSchedule.isPending
            }
            onClick={() => saveSchedule.mutate()}
          >
            <Save className='size-4' />
            {t('Save schedule')}
          </Button>
        </div>
      </div>
    </section>
  )
}
