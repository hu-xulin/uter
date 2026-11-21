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
import { useMutation } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import {
  syncApikoChannelModels,
  syncApikoChannelPricing,
  type ApikoModelSyncResult,
  type ApikoPriceSyncResult,
} from '../api'

type ApikoChannelPanelProps = {
  channelId: number | null
  onCreateDraft?: () => Promise<number | null>
  onModelsSynced: (models: string[]) => void
}

/**
 * Apiko model discovery. The relay host only serves OpenAI/Anthropic
 * compatible paths, so the public control-plane catalogue is the authoritative
 * model list; syncing appends missing IDs without dropping manual entries.
 */
export function ApikoChannelPanel(props: ApikoChannelPanelProps) {
  const { t } = useTranslation()
  const [result, setResult] = useState<ApikoModelSyncResult | null>(null)
  const [priceResult, setPriceResult] = useState<ApikoPriceSyncResult | null>(
    null
  )
  const mutation = useMutation({
    mutationFn: async () => {
      let channelId = props.channelId
      if (!channelId) {
        channelId = (await props.onCreateDraft?.()) ?? null
      }
      if (!channelId) {
        throw new Error(t('Save the channel before syncing models.'))
      }
      return syncApikoChannelModels(channelId)
    },
    onSuccess: (data) => {
      setResult(data)
      props.onModelsSynced(data.models)
      toast.success(
        t('Added {{count}} models from the Apiko catalogue', {
          count: data.added,
        })
      )
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to sync Apiko models')
      )
    },
  })

  const priceMutation = useMutation({
    mutationFn: async () => {
      let channelId = props.channelId
      if (!channelId) {
        channelId = (await props.onCreateDraft?.()) ?? null
      }
      if (!channelId) {
        throw new Error(t('Save the channel before syncing prices.'))
      }
      return syncApikoChannelPricing(channelId)
    },
    onSuccess: (data) => {
      setPriceResult(data)
      toast.success(
        t(
          'Synced {{recorded}} prices, {{seeded}} auto-priced; {{skipped}} need manual pricing',
          {
            recorded: data.recorded,
            seeded: data.seeded,
            skipped: data.skipped.length,
          }
        )
      )
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to sync Apiko prices')
      )
    },
  })

  return (
    <div className='border-border/60 bg-muted/10 space-y-3 rounded-lg border p-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='space-y-1'>
          <p className='font-medium'>{t('Apiko catalogue sync')}</p>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Sync the full model list published by the Apiko control plane. Existing entries are kept.'
            )}
          </p>
        </div>
        <Button
          type='button'
          size='sm'
          variant='outline'
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          <RefreshCw
            className={cn('size-4', mutation.isPending && 'animate-spin')}
            aria-hidden='true'
          />
          {t('Sync Apiko models')}
        </Button>
        <Button
          type='button'
          size='sm'
          variant='outline'
          onClick={() => priceMutation.mutate()}
          disabled={priceMutation.isPending}
        >
          <RefreshCw
            className={cn('size-4', priceMutation.isPending && 'animate-spin')}
            aria-hidden='true'
          />
          {t('Sync Apiko prices')}
        </Button>
      </div>
      {result ? (
        <p className='text-muted-foreground text-sm' role='status'>
          {t('{{total}} models after sync; {{added}} added', {
            total: result.total,
            added: result.added,
          })}
        </p>
      ) : null}
      {priceResult ? (
        <p className='text-muted-foreground text-sm' role='status'>
          {t(
            'Synced {{recorded}} prices, {{seeded}} auto-priced; {{skipped}} need manual pricing',
            {
              recorded: priceResult.recorded,
              seeded: priceResult.seeded,
              skipped: priceResult.skipped.length,
            }
          )}
        </p>
      ) : null}
    </div>
  )
}
