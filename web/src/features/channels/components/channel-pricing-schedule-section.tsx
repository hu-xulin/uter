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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { handleServerError } from '@/lib/handle-server-error'

import {
  getChannelPricingSchedule,
  setChannelPricingSchedule,
  type ChannelPricingSchedule,
} from '../api'

const defaultSchedule: ChannelPricingSchedule = {
  enabled: false,
  basis: 'official',
  mode: 'multiply',
  value: 0.6,
  apply_on_sync: false,
  interval_minutes: 5,
  review_mode: 'auto',
  threshold_percent: 20,
  model_sync_interval_minutes: 360,
  official_sync_interval_minutes: 1440,
  channel_sync_interval_minutes: 60,
}

// A channel that never saved a cadence is read back as a zero-value struct
// (basis/mode "", value 0). Treat the whole object as unset so those fields
// cannot overwrite the valid defaults and break server-side validation.
// Partially filled legacy data keeps explicit values and drops empty ones.
function resolveSchedule(saved: ChannelPricingSchedule | undefined) {
  const loaded = { ...defaultSchedule }
  if (saved) {
    const unset =
      !String(saved.basis ?? '').trim() && !String(saved.mode ?? '').trim()
    if (!unset) {
      for (const [key, value] of Object.entries(saved)) {
        if (value === '' || value === null || value === undefined) continue
        Object.assign(loaded, { [key]: value })
      }
    }
  }
  return {
    schedule: loaded,
    officialInterval: String(loaded.official_sync_interval_minutes),
    channelInterval: String(loaded.channel_sync_interval_minutes),
  }
}

function intervalValid(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed === '') return false
  const value = Number(trimmed)
  return Number.isInteger(value) && value >= 0
}

type ChannelPricingScheduleSectionProps = {
  channelId: number | null
  /** Kept for callers that share the pricing step; sync cadence has no host dependency. */
  baseUrl?: string
  /** False renders nothing (create wizard renders it in the Automatic updates step). */
  show?: boolean
}

// The schedule only refreshes upstream catalog and official/channel price
// data. Sale prices are owned by the pricing step and are never re-derived
// or overwritten here.
export function ChannelPricingScheduleSection(
  props: ChannelPricingScheduleSectionProps
) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const scheduleQuery = useQuery({
    queryKey: ['channel-pricing-schedule', props.channelId],
    queryFn: () => getChannelPricingSchedule(props.channelId ?? 0),
    enabled: props.channelId != null,
    retry: false,
    meta: { errorToast: false },
  })

  const initial = resolveSchedule(scheduleQuery.data?.schedule)
  const [schedule, setSchedule] = useState<ChannelPricingSchedule>(
    initial.schedule
  )
  const [officialInterval, setOfficialInterval] = useState(
    initial.officialInterval
  )
  const [channelInterval, setChannelInterval] = useState(
    initial.channelInterval
  )
  const [prevScheduleData, setPrevScheduleData] = useState(scheduleQuery.data)

  // Adopt freshly loaded server values without resetting local edits on every
  // re-render.
  if (prevScheduleData !== scheduleQuery.data) {
    setPrevScheduleData(scheduleQuery.data)
    const next = resolveSchedule(scheduleQuery.data?.schedule)
    setSchedule(next.schedule)
    setOfficialInterval(next.officialInterval)
    setChannelInterval(next.channelInterval)
  }

  const saveSchedule = useMutation({
    mutationFn: () =>
      setChannelPricingSchedule(props.channelId ?? 0, {
        ...schedule,
        official_sync_interval_minutes: Number(officialInterval),
        channel_sync_interval_minutes: Number(channelInterval),
        interval_minutes: 5,
      }),
    onSuccess: () => {
      toast.success(t('Automatic update cadence saved'))
      void queryClient.invalidateQueries({
        queryKey: ['channel-pricing-schedule', props.channelId],
      })
    },
    onError: (error) =>
      handleServerError(
        error,
        t('Failed to save the automatic update cadence')
      ),
  })

  if (props.show === false) {
    return null
  }

  const disabled = props.channelId == null
  const valid =
    intervalValid(officialInterval) && intervalValid(channelInterval)

  return (
    <section className='space-y-3 rounded-lg border p-3'>
      <div>
        <Label>{t('Automatic updates')}</Label>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Refreshes the upstream catalog and official/channel prices on this cadence. Sale prices configured in Configure prices are never changed.'
          )}
        </p>
      </div>
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <div className='flex items-start gap-3 sm:col-span-2 xl:col-span-4'>
          <Switch
            checked={schedule.enabled}
            disabled={disabled}
            onCheckedChange={(checked) =>
              setSchedule((current) => ({ ...current, enabled: checked }))
            }
          />
          <div className='space-y-0.5'>
            <Label>{t('Enabled')}</Label>
            <p className='text-muted-foreground text-sm'>
              {t('Refresh upstream data automatically.')}
            </p>
          </div>
        </div>

        <div className='space-y-1.5'>
          <Label htmlFor='schedule-official-interval'>
            {t('Official price interval (minutes)')}
          </Label>
          <Input
            id='schedule-official-interval'
            inputMode='numeric'
            value={officialInterval}
            onChange={(event) => setOfficialInterval(event.target.value)}
            placeholder='1440'
            disabled={disabled}
          />
        </div>

        <div className='space-y-1.5'>
          <Label htmlFor='schedule-channel-interval'>
            {t('Channel price interval (minutes)')}
          </Label>
          <Input
            id='schedule-channel-interval'
            inputMode='numeric'
            value={channelInterval}
            onChange={(event) => setChannelInterval(event.target.value)}
            placeholder='60'
            disabled={disabled}
          />
        </div>

        <div className='flex items-end sm:col-span-2'>
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={disabled || !valid || saveSchedule.isPending}
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
