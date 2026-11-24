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
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
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
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'

import { invalidatePricingQueries } from '../lib/channel-actions'
import {
  getUterRouteEndpoint,
  getUterRouteUpstreamSnapshot,
  syncUterRouteUpstream,
  type UterRouteUpstreamSnapshot,
} from '../api'

type UterRouteChannelPanelProps = {
  channelId: number | null
  baseUrl: string
  onCreateDraft?: () => Promise<number | null>
  onChangeBaseUrl: (value: string) => void
}

/**
 * Uter Route upstream catalog for an advanced-custom channel.
 *
 * Uter Route publishes billing ratios, not an absolute official/discounted
 * price, so this panel never invents USD prices. It syncs the official ratios
 * into this channel's isolated pricing rows; the operator sets the internal
 * sale price in the pricing tab before the channel can bill.
 */
export function UterRouteChannelPanel(props: UterRouteChannelPanelProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [pickedDiscountGroup, setPickedDiscountGroup] = useState('')
  const endpointQuery = useQuery({
    queryKey: ['uterroute-endpoint'],
    queryFn: getUterRouteEndpoint,
    staleTime: Infinity,
    retry: false,
    meta: { errorToast: false },
  })
  const snapshotQuery = useQuery<UterRouteUpstreamSnapshot>({
    queryKey: ['uterroute-upstream-snapshot', props.channelId],
    queryFn: () => getUterRouteUpstreamSnapshot(props.channelId ?? undefined),
    retry: false,
    meta: { errorToast: false },
  })
  const prepareDraft = useMutation({
    mutationFn: async () => {
      if (!props.onCreateDraft) return null
      return props.onCreateDraft()
    },
    onError: (error) =>
      handleServerError(error, t('Failed to prepare the draft channel')),
  })
  const snapshot = snapshotQuery.data
  const summary = snapshot?.synced ? snapshot.summary : null
  const discountGroups =
    snapshot?.synced && snapshot.discount_groups?.length
      ? snapshot.discount_groups
      : ['default']
  const discountGroup =
    pickedDiscountGroup ||
    (snapshot?.synced ? snapshot.discount_group : undefined) ||
    'default'

  const sync = useMutation({
    mutationFn: (groupOverride?: string) =>
      syncUterRouteUpstream(
        props.channelId ?? 0,
        props.baseUrl,
        groupOverride ?? discountGroup
      ),
    onSuccess: (result) => {
      const written =
        typeof result === 'object' &&
        result &&
        'channel_pricing_written' in result
          ? Number(
              (result as { channel_pricing_written?: number })
                .channel_pricing_written ?? 0
            )
          : 0
      toast.success(
        t('Uter Route catalog synced: {{count}} channel prices written', {
          count: written,
        })
      )
      void queryClient.invalidateQueries({
        queryKey: ['uterroute-upstream-snapshot', props.channelId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['channel-model-pricing', props.channelId],
      })
      invalidatePricingQueries(queryClient)
    },
    onError: (error) =>
      handleServerError(error, t('Failed to sync Uter Route catalog')),
  })

  let syncStatusLabel = t('Not synced yet')
  let syncStatusVariant: 'secondary' | 'warning' | 'default' = 'warning'
  if (sync.isPending || snapshotQuery.isLoading) {
    syncStatusLabel = t('Syncing...')
    syncStatusVariant = 'secondary'
  } else if (snapshot?.synced) {
    syncStatusLabel = t('Synced')
    syncStatusVariant = 'default'
  }

  return (
    <div className='space-y-3 rounded-lg border p-3'>
      <div className='space-y-1'>
        <Label>{t('Uter Route upstream')}</Label>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Sync the official model catalog and billing ratios into this channel only. Other channels are not affected.'
          )}
        </p>
        <div className='flex flex-wrap items-center gap-1.5 pt-1'>
          <span className='text-muted-foreground text-xs'>
            {t('Synced fields')}:
          </span>
          {[
            'Model name',
            'Vendor',
            'Model ratio',
            'Completion ratio',
            'Cache ratio',
            'Group ratios',
            'Official price',
            'Channel price',
          ].map((field) => (
            <Badge key={field} variant='outline' className='font-normal'>
              {t(field)}
            </Badge>
          ))}
        </div>
      </div>

      <div className='space-y-1.5'>
        <Label htmlFor='uterroute-discount-group'>{t('Discount group')}</Label>
        <Select
          value={discountGroup}
          onValueChange={(value) => {
            if (!value) return
            setPickedDiscountGroup(value)
            // A saved channel can re-price immediately; a draft without an id
            // waits for the create flow's own sync.
            if (props.channelId != null) sync.mutate(value)
          }}
          disabled={sync.isPending || props.channelId == null}
        >
          <SelectTrigger id='uterroute-discount-group' className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {discountGroups.map((group) => (
              <SelectItem key={group} value={group}>
                {group}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className='text-muted-foreground text-sm'>
          {t(
            'The channel price is the official price multiplied by the discount of this Uter Route group. Manual prices are never overwritten.'
          )}
        </p>
      </div>

      <div className='space-y-1.5'>
        <Label htmlFor='uterroute-base-url'>{t('Base URL')}</Label>
        <Input
          id='uterroute-base-url'
          mono
          value={props.baseUrl}
          placeholder={endpointQuery.data?.base_url ?? ''}
          onChange={(event) => props.onChangeBaseUrl(event.target.value)}
        />
      </div>

      <div className='space-y-2 border-t pt-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <Button
            type='button'
            size='sm'
            variant='outline'
            onClick={() => sync.mutate(discountGroup)}
            disabled={sync.isPending || props.channelId == null}
          >
            <RefreshCw
              className={cn('size-4', sync.isPending && 'animate-spin')}
            />
            {t('Sync Uter Route catalog')}
          </Button>
          <Badge variant={syncStatusVariant}>{syncStatusLabel}</Badge>

          {snapshot?.synced && summary ? (
            <span className='text-muted-foreground text-sm'>
              {t('{{models}} models · {{groups}} groups', {
                models: summary.models,
                groups: summary.groups,
              })}
            </span>
          ) : null}
        </div>

        {snapshot?.synced && summary ? (
          <div className='text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3'>
            <span>
              {t('Version')}: {summary.pricing_version || '—'}
            </span>
            <span>
              {t('Synced at')}: {summary.fetched_at}
            </span>
            <span>
              {t('Price basis')}: {t(summary.price_basis)}
            </span>
          </div>
        ) : (
          <p className='text-muted-foreground text-sm'>
            {t('No Uter Route catalog synced yet.')}
          </p>
        )}

        {props.channelId == null ? (
          <div className='space-y-2'>
            <p className='text-muted-foreground text-sm'>
              {t('A draft channel is created automatically to fetch prices.')}
            </p>
            {props.onCreateDraft ? (
              <Button
                type='button'
                size='sm'
                variant='outline'
                onClick={() => prepareDraft.mutate()}
                disabled={prepareDraft.isPending}
              >
                {t('Prepare draft channel')}
              </Button>
            ) : null}
          </div>
        ) : null}
        <p className='text-muted-foreground text-sm'>
          {t(
            'Official prices are reconstructed from Uter Route ratios; the channel sale price remains separately editable in Pricing.'
          )}
        </p>
      </div>
    </div>
  )
}
