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

import {
  getDreamRouterUpstreamSnapshot,
  syncDreamRouterUpstream,
  type DreamRouterUpstreamSnapshot,
} from '../api'

type DreamRouterChannelPanelProps = {
  channelId: number | null
  baseUrl: string
  onCreateDraft?: () => Promise<number | null>
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
  const [creatingDraft, setCreatingDraft] = useState(false)
  const [pickedDiscountGroup, setPickedDiscountGroup] = useState('')
  const snapshotQuery = useQuery<DreamRouterUpstreamSnapshot>({
    queryKey: ['dreamrouter-upstream-snapshot', props.channelId],
    queryFn: () => getDreamRouterUpstreamSnapshot(props.channelId ?? undefined),
    retry: false,
    meta: { errorToast: false },
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
    mutationFn: () =>
      syncDreamRouterUpstream(
        props.channelId ?? 0,
        props.baseUrl,
        discountGroup
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
        t('DreamRouter catalog synced: {{count}} channel prices written', {
          count: written,
        })
      )
      void queryClient.invalidateQueries({
        queryKey: ['dreamrouter-upstream-snapshot', props.channelId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['channel-model-pricing', props.channelId],
      })
    },
    onError: (error) =>
      handleServerError(error, t('Failed to sync DreamRouter catalog')),
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
        <Label htmlFor='dreamrouter-discount-group'>
          {t('Discount group')}
        </Label>
        <Select
          value={discountGroup}
          onValueChange={(value) => {
            if (value) setPickedDiscountGroup(value)
          }}
          disabled={sync.isPending || props.channelId == null}
        >
          <SelectTrigger id='dreamrouter-discount-group' className='w-full'>
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
            'The channel price is the official price multiplied by the discount of this DreamRouter group. Manual prices are never overwritten.'
          )}
        </p>
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
            disabled={sync.isPending || props.channelId == null}
          >
            <RefreshCw
              className={cn('size-4', sync.isPending && 'animate-spin')}
            />
            {t('Sync DreamRouter catalog')}
          </Button>
          <Badge variant={syncStatusVariant}>{syncStatusLabel}</Badge>
          {props.channelId == null && props.onCreateDraft ? (
            <Button
              type='button'
              size='sm'
              variant='outline'
              disabled={creatingDraft}
              onClick={async () => {
                setCreatingDraft(true)
                try {
                  await props.onCreateDraft?.()
                } catch (error) {
                  handleServerError(error, t('Failed to create draft channel'))
                } finally {
                  setCreatingDraft(false)
                }
              }}
            >
              {creatingDraft
                ? t('Creating...')
                : t('Generate draft channel ID')}
            </Button>
          ) : null}
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
            {t('No DreamRouter catalog synced yet.')}
          </p>
        )}

        {props.channelId == null ? (
          <p className='text-muted-foreground text-sm'>
            {t(
              'Generate a draft channel ID before syncing so prices are written into this channel.'
            )}
          </p>
        ) : null}
        <p className='text-muted-foreground text-sm'>
          {t(
            'Official prices are reconstructed from DreamRouter ratios; the channel sale price remains separately editable in Pricing.'
          )}
        </p>
      </div>
    </div>
  )
}
