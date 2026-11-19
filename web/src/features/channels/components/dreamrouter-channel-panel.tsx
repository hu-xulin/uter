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
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'

import {
  getDreamRouterUpstreamSnapshot,
  syncDreamRouterUpstream,
} from '../api'

type DreamRouterChannelPanelProps = {
  channelId: number | null
  baseUrl: string
  onChangeBaseUrl: (value: string) => void
}

/**
 * DreamRouter upstream catalog for an advanced-custom channel.
 *
 * DreamRouter publishes billing ratios, not an absolute official/discounted
 * price, so this panel never invents USD prices. It syncs the official ratios
 * into this channel's isolated pricing rows; the operator sets the internal
 * sale price in the pricing tab before the channel can bill.
 */
export function DreamRouterChannelPanel(props: DreamRouterChannelPanelProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const snapshotQuery = useQuery({
    queryKey: ['dreamrouter-upstream-snapshot'],
    queryFn: getDreamRouterUpstreamSnapshot,
    retry: false,
    meta: { errorToast: false },
  })
  const snapshot = snapshotQuery.data
  const summary = snapshot?.synced ? snapshot.summary : null

  const sync = useMutation({
    mutationFn: () =>
      syncDreamRouterUpstream(props.channelId ?? 0, props.baseUrl),
    onSuccess: (result) => {
      const written =
        typeof result === 'object' && result && 'channel_pricing_written' in result
          ? Number(
              (result as { channel_pricing_written?: number })
                .channel_pricing_written ?? 0
            )
          : 0
      toast.success(
        t('DreamRouter catalog synced: {{count}} channel prices written', {
          count: written,
        })
      )
      void queryClient.invalidateQueries({
        queryKey: ['dreamrouter-upstream-snapshot'],
      })
      void queryClient.invalidateQueries({
        queryKey: ['channel-model-pricing', props.channelId],
      })
    },
    onError: (error) =>
      handleServerError(error, t('Failed to sync DreamRouter catalog')),
  })

  return (
    <div className='space-y-3 rounded-lg border p-3'>
      <div className='space-y-1'>
        <Label>{t('DreamRouter upstream')}</Label>
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
        <Label htmlFor='dreamrouter-base-url'>{t('Base URL')}</Label>
        <Input
          id='dreamrouter-base-url'
          mono
          value={props.baseUrl}
          placeholder='https://dreamrouter.ai'
          onChange={(event) => props.onChangeBaseUrl(event.target.value)}
        />
      </div>

      <div className='space-y-2 border-t pt-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <Button
            type='button'
            size='sm'
            variant='outline'
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
          >
            <RefreshCw
              className={cn('size-4', sync.isPending && 'animate-spin')}
            />
            {t('Sync DreamRouter catalog')}
          </Button>
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
              {t('Price basis')}: {summary.price_basis}
            </span>
          </div>
        ) : (
          <p className='text-muted-foreground text-sm'>
            {t('No DreamRouter catalog synced yet.')}
          </p>
        )}

        <p className='text-muted-foreground text-sm'>
          {t(
            'Official prices are reconstructed from DreamRouter ratios; the channel sale price remains separately editable in Pricing.'
          )}
        </p>
      </div>
    </div>
  )
}