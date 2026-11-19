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
import { Calculator, RefreshCw, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
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
  batchChannelModelPricing,
  approveChannelPricingReviews,
  getChannelPricingHistory,
  getChannelPricingReviews,
  getChannelPricingSchedule,
  rejectChannelPricingReviews,
  rollbackChannelPricingHistory,
  setChannelPricingSchedule,
  syncDreamRouterUpstream,
  type ChannelBatchPricingResult,
  type ChannelPricingSchedule,
} from '../api'
import { ChannelModelPricingSection } from './channel-model-pricing-section'

type ChannelPricingPanelProps = {
  channelId: number | null
  baseUrl: string
  onCreateDraft?: () => Promise<number | null>
}

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

const PRICING_MODES = [
  { value: 'discount', label: 'Discount' },
  { value: 'markup', label: 'Markup' },
  { value: 'multiply', label: 'Fixed multiplier' },
  { value: 'add', label: 'Fixed amount' },
  { value: 'fixed', label: 'Fixed price' },
  { value: 'none', label: 'No change' },
] as const

export function ChannelPricingPanel(props: ChannelPricingPanelProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [basis, setBasis] = useState<'official' | 'channel'>('official')
  const [mode, setMode] = useState<string>('multiply')
  const [value, setValue] = useState('0.6')
  const [scope, setScope] = useState<'all' | 'prefix'>('all')
  const [prefixes, setPrefixes] = useState('')
  const [preview, setPreview] = useState<ChannelBatchPricingResult | null>(null)
  const [creatingDraft, setCreatingDraft] = useState(false)
  const [schedule, setSchedule] =
    useState<ChannelPricingSchedule>(defaultSchedule)

  const historyQuery = useQuery({
    queryKey: ['channel-pricing-history', props.channelId],
    queryFn: () => getChannelPricingHistory(props.channelId ?? 0),
    enabled: props.channelId != null,
    retry: false,
    meta: { errorToast: false },
  })
  const reviewsQuery = useQuery({
    queryKey: ['channel-pricing-reviews', props.channelId],
    queryFn: () => getChannelPricingReviews(props.channelId ?? 0),
    enabled: props.channelId != null,
    retry: false,
    meta: { errorToast: false },
  })
  const scheduleQuery = useQuery({
    queryKey: ['channel-pricing-schedule', props.channelId],
    queryFn: () => getChannelPricingSchedule(props.channelId ?? 0),
    enabled: props.channelId != null,
    retry: false,
    meta: { errorToast: false },
  })
  useEffect(() => {
    if (scheduleQuery.data?.schedule) {
      setSchedule({ ...defaultSchedule, ...scheduleQuery.data.schedule })
    }
  }, [scheduleQuery.data])

  const parsedValue = Number(value)
  const valueValid = Number.isFinite(parsedValue) && parsedValue >= 0

  const batch = useMutation({
    mutationFn: (dryRun: boolean) =>
      batchChannelModelPricing(props.channelId ?? 0, {
        basis,
        mode,
        value: parsedValue,
        model_prefixes:
          scope === 'prefix'
            ? prefixes
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
            : undefined,
        dry_run: dryRun,
      }),
    onSuccess: (result, dryRun) => {
      setPreview(result)
      if (!dryRun) {
        toast.success(
          t('Batch pricing applied to {{count}} models', {
            count: result.updated,
          })
        )
        void queryClient.invalidateQueries({
          queryKey: ['channel-model-pricing', props.channelId],
        })
      }
    },
    onError: (error) =>
      handleServerError(error, t('Failed to apply batch pricing')),
  })

  const saveSchedule = useMutation({
    mutationFn: () =>
      setChannelPricingSchedule(props.channelId ?? 0, {
        ...schedule,
        value: Number(schedule.value),
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

  const approveReviews = useMutation({
    mutationFn: () => approveChannelPricingReviews(props.channelId ?? 0),
    onSuccess: () => {
      toast.success(t('Pending prices approved'))
      void queryClient.invalidateQueries({
        queryKey: ['channel-pricing-reviews', props.channelId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['channel-model-pricing', props.channelId],
      })
    },
    onError: (error) =>
      handleServerError(error, t('Failed to approve pending prices')),
  })

  const rejectReviews = useMutation({
    mutationFn: () => rejectChannelPricingReviews(props.channelId ?? 0),
    onSuccess: () => {
      toast.success(t('Pending prices rejected'))
      void queryClient.invalidateQueries({
        queryKey: ['channel-pricing-reviews', props.channelId],
      })
    },
    onError: (error) =>
      handleServerError(error, t('Failed to reject pending prices')),
  })

  const rollback = useMutation({
    mutationFn: (historyId: number) =>
      rollbackChannelPricingHistory(props.channelId ?? 0, historyId),
    onSuccess: () => {
      toast.success(t('Price rolled back'))
      void queryClient.invalidateQueries({
        queryKey: ['channel-pricing-history', props.channelId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['channel-model-pricing', props.channelId],
      })
    },
    onError: (error) =>
      handleServerError(error, t('Failed to roll back price')),
  })

  const syncUpstream = useMutation({
    mutationFn: () =>
      syncDreamRouterUpstream(props.channelId ?? 0, props.baseUrl),
    onSuccess: () => {
      toast.success(t('Upstream catalog synchronized'))
      void queryClient.invalidateQueries({
        queryKey: ['channel-model-pricing', props.channelId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['dreamrouter-upstream-snapshot'],
      })
    },
    onError: (error) =>
      handleServerError(error, t('Failed to sync upstream catalog')),
  })

  const isDreamRouter = props.baseUrl.toLowerCase().includes('dreamrouter.ai')
  const disabled = props.channelId == null

  return (
    <div className='space-y-5'>
      <div>
        <p className='font-medium'>{t('Model pricing')}</p>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Sync upstream prices, set the batch rule, and keep the Uter sale price separate from the upstream quote.'
          )}
        </p>
      </div>

      {disabled ? (
        <div className='bg-muted/20 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm'>
          <span className='text-muted-foreground'>
            {t('Save the channel first to sync upstream prices and configure batch pricing.')}
          </span>
          {props.onCreateDraft ? (
            <Button
              type='button'
              size='sm'
              variant='outline'
              disabled={creatingDraft}
              onClick={async () => {
                setCreatingDraft(true)
                try {
                  const id = await props.onCreateDraft?.()
                  if (id) {
                    toast.success(t('Draft channel ID generated'))
                  }
                } catch (error) {
                  handleServerError(error, t('Failed to create draft channel'))
                } finally {
                  setCreatingDraft(false)
                }
              }}
            >
              {creatingDraft ? t('Creating...') : t('Generate draft channel ID')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {isDreamRouter && !disabled ? (
        <section className='space-y-2 rounded-lg border p-3'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              <Label>{t('Upstream catalog')}</Label>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'Official prices are reconstructed from DreamRouter ratios; channel prices stay independent.'
                )}
              </p>
            </div>
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() => syncUpstream.mutate()}
              disabled={syncUpstream.isPending}
            >
              <RefreshCw
                className={`size-4 ${syncUpstream.isPending ? 'animate-spin' : ''}`}
              />
              {t('Sync now')}
            </Button>
          </div>
        </section>
      ) : null}

      <section className='space-y-3 rounded-lg border p-3'>
        <div>
          <Label>{t('Batch pricing')}</Label>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Apply one multiplier to every selected model price. Platform prices remain independent from the upstream quote.'
            )}
          </p>
        </div>
        <div className='grid gap-3 sm:grid-cols-3'>
          <div className='space-y-1.5'>
            <Label htmlFor='batch-pricing-basis'>{t('Price basis')}</Label>
            <Select
              value={basis}
              onValueChange={(value) =>
                setBasis(value === 'channel' ? 'channel' : 'official')
              }
            >
              <SelectTrigger id='batch-pricing-basis' className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='official'>{t('Official price')}</SelectItem>
                <SelectItem value='channel'>{t('Channel price')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='batch-pricing-mode'>{t('Pricing rule')}</Label>
            <Select value={mode} onValueChange={(next) => next && setMode(next)}>
              <SelectTrigger id='batch-pricing-mode' className='w-full'>
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
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='batch-pricing-value'>{t('Value')}</Label>
            <Input
              id='batch-pricing-value'
              inputMode='decimal'
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder='0.6'
              disabled={mode === 'none'}
            />
            <p className='text-muted-foreground text-sm'>
              {t('Discount: 0.6 = 40% off; markup: 0.1 = 10%')}
            </p>
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='batch-pricing-scope'>{t('Scope')}</Label>
            <Select
              value={scope}
              onValueChange={(next) =>
                setScope(next === 'prefix' ? 'prefix' : 'all')
              }
            >
              <SelectTrigger id='batch-pricing-scope' className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>{t('All models')}</SelectItem>
                <SelectItem value='prefix'>{t('Model name prefix')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scope === 'prefix' ? (
            <div className='space-y-1.5 sm:col-span-2'>
              <Label htmlFor='batch-pricing-prefixes'>
                {t('Prefixes (comma separated)')}
              </Label>
              <Input
                id='batch-pricing-prefixes'
                value={prefixes}
                onChange={(event) => setPrefixes(event.target.value)}
                placeholder='gpt-, claude-'
              />
            </div>
          ) : null}
          <div className='flex items-end gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={disabled || !valueValid || batch.isPending}
              onClick={() => batch.mutate(true)}
            >
              <Calculator className='size-4' />
              {t('Preview')}
            </Button>
            <Button
              type='button'
              size='sm'
              disabled={disabled || !valueValid || batch.isPending}
              onClick={() => batch.mutate(false)}
            >
              {t('Apply')}
            </Button>
          </div>
        </div>
        {preview ? (
          <div className='bg-muted/20 space-y-1 rounded-md border px-3 py-2 text-sm'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge variant='secondary'>
                {t('{{count}} models', { count: preview.updated })}
              </Badge>
              {preview.skipped.length > 0 ? (
                <Badge variant='warning'>
                  {t('{{count}} skipped', { count: preview.skipped.length })}
                </Badge>
              ) : null}
              <span className='text-muted-foreground'>
                {preview.basis} · {preview.mode} {preview.value}
              </span>
            </div>
            {preview.skipped.length > 0 ? (
              <ul className='text-muted-foreground space-y-0.5'>
                {preview.skipped.slice(0, 3).map((item) => (
                  <li key={item.model_name}>
                    {item.model_name}: {item.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className='space-y-3 rounded-lg border p-3'>
        <div>
          <Label>{t('Scheduled price update')}</Label>
          <p className='text-muted-foreground text-sm'>
            {t(
              'After each upstream catalog sync, re-apply the batch rule to this channel.'
            )}
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-4'>
          <div className='flex items-center gap-2'>
            <Switch
              checked={schedule.enabled}
              onCheckedChange={(checked) =>
                setSchedule((current) => ({ ...current, enabled: checked }))
              }
            />
            <Label>{t('Enabled')}</Label>
          </div>
          <div className='w-40'>
            <Select
              value={schedule.basis}
              onValueChange={(value) =>
                setSchedule((current) => ({
                  ...current,
                  basis: value === 'channel' ? 'channel' : 'official',
                }))
              }
            >
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='official'>{t('Official price')}</SelectItem>
                <SelectItem value='channel'>{t('Channel price')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='w-44'>
            <Select
              value={schedule.mode}
              onValueChange={(next) =>
                next &&
                setSchedule((current) => ({ ...current, mode: next }))
              }
            >
              <SelectTrigger className='w-full'>
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
          </div>
          <Input
            className='w-28'
            inputMode='decimal'
            value={String(schedule.value)}
            onChange={(event) =>
              setSchedule((current) => ({
                ...current,
                value: Number(event.target.value),
              }))
            }
            placeholder='0.6'
            disabled={schedule.mode === 'none'}
          />
          <div className='w-36'>
            <Select
              value={schedule.review_mode}
              onValueChange={(next) =>
                next &&
                setSchedule((current) => ({
                  ...current,
                  review_mode: next as 'auto' | 'manual',
                }))
              }
            >
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='auto'>{t('Auto apply')}</SelectItem>
                <SelectItem value='manual'>{t('Manual review')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input
            className='w-28'
            inputMode='decimal'
            value={String(schedule.threshold_percent)}
            onChange={(event) =>
              setSchedule((current) => ({
                ...current,
                threshold_percent: Number(event.target.value),
              }))
            }
            placeholder='20'
          />
          <Input
            className='w-36'
            inputMode='numeric'
            value={String(schedule.model_sync_interval_minutes)}
            onChange={(event) =>
              setSchedule((current) => ({
                ...current,
                model_sync_interval_minutes: Number(event.target.value),
              }))
            }
            placeholder={t('Model sync minutes')}
            aria-label={t('Model sync minutes')}
          />
          <Input
            className='w-36'
            inputMode='numeric'
            value={String(schedule.official_sync_interval_minutes)}
            onChange={(event) =>
              setSchedule((current) => ({
                ...current,
                official_sync_interval_minutes: Number(event.target.value),
              }))
            }
            placeholder={t('Official sync minutes')}
            aria-label={t('Official sync minutes')}
          />
          <Input
            className='w-36'
            inputMode='numeric'
            value={String(schedule.channel_sync_interval_minutes)}
            onChange={(event) =>
              setSchedule((current) => ({
                ...current,
                channel_sync_interval_minutes: Number(event.target.value),
              }))
            }
            placeholder={t('Channel sync minutes')}
            aria-label={t('Channel sync minutes')}
          />
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={
              disabled ||
              (schedule.mode !== 'none' && schedule.value < 0) ||
              saveSchedule.isPending
            }
            onClick={() => saveSchedule.mutate()}
          >
            <Save className='size-4' />
            {t('Save schedule')}
          </Button>
        </div>
      </section>

      {!disabled && props.channelId != null ? (
        <ChannelModelPricingSection channelId={props.channelId} />
      ) : null}

      {!disabled && props.channelId != null ? (
        <section className='space-y-2 rounded-lg border p-3'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <Label>{t('Pending price reviews')}</Label>
            <span className='text-muted-foreground text-sm'>
              {reviewsQuery.data?.items?.length ?? 0}
            </span>
          </div>
          {reviewsQuery.data?.items?.length ? (
            <>
              <ul className='text-muted-foreground space-y-1 text-sm'>
                {reviewsQuery.data.items.slice(0, 5).map((entry) => (
                  <li key={`${entry.model_name}-${entry.field}-${entry.created_at}`}>
                    {entry.model_name} · {entry.field} · {entry.percent.toFixed(1)}%
                  </li>
                ))}
              </ul>
              <div className='flex gap-2'>
                <Button
                  type='button'
                  size='sm'
                  onClick={() => approveReviews.mutate()}
                  disabled={approveReviews.isPending}
                >
                  {t('Approve')}
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={() => rejectReviews.mutate()}
                  disabled={rejectReviews.isPending}
                >
                  {t('Reject')}
                </Button>
              </div>
            </>
          ) : (
            <p className='text-muted-foreground text-sm'>
              {t('No pending price reviews.')}
            </p>
          )}
        </section>
      ) : null}

      {!disabled && props.channelId != null ? (
        <section className='space-y-2 rounded-lg border p-3'>
          <Label>{t('Recent price changes')}</Label>
          {historyQuery.data?.items?.length ? (
            <ul className='text-muted-foreground space-y-1 text-sm'>
              {historyQuery.data.items.slice(0, 5).map((entry) => (
                <li
                  key={`${entry.model_name}-${entry.source}-${entry.changed_at}`}
                  className='flex flex-wrap items-center gap-2'
                >
                  <span className='min-w-0 flex-1 truncate'>
                    {entry.model_name} · {entry.source} · {entry.changed_at}
                  </span>
                  {entry.id ? (
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      disabled={rollback.isPending}
                      onClick={() => rollback.mutate(entry.id as number)}
                    >
                      {t('Rollback')}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className='text-muted-foreground text-sm'>
              {t('No price changes yet.')}
            </p>
          )}
        </section>
      ) : null}
    </div>
  )
}