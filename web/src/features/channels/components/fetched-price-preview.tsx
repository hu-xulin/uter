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
import { useQuery } from '@tanstack/react-query'
import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

import { getChannelModelPricing } from '../api'
import { canDisplayChannelPrice } from '../lib/channel-price-display'
import {
  filterPricingRowsToSelectedModels,
  remapPricingRowsForPreview,
} from '../lib/model-mapping-validation'
import { resolveOfficialDisplayTier } from '../lib/official-price-display'
import type {
  ChannelModelPricingRecord,
  ChannelOfficialPricingTier,
  ChannelUpstreamQuoteView,
} from '../types'

type FetchedPricePreviewProps = {
  channelId: number
  modelMapping?: string
  models?: string[]
  setupState?: 'idle' | 'creating' | 'failed'
  setupError?: string | null
  fetchState?: 'idle' | 'running' | 'done' | 'failed'
  onRetrySetup?: () => void
  onRetryFetch?: () => void
}

function formatUsd(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return `$${value.toFixed(value > 0 && value < 0.01 ? 6 : 4)}`
}

function unitLabel(unit: string, t: (key: string) => string): string {
  switch (unit) {
    case 'per_call':
      return t('Per call')
    case 'per_image':
      return t('Per image')
    case 'per_second':
      return t('Per second')
    case 'per_minute':
      return t('Per minute')
    case 'per_1m_token':
    case 'per_1m_tokens':
      return t('Per 1M tokens')
    default:
      return unit
  }
}

function officialLabel(
  tier: ChannelOfficialPricingTier | undefined,
  t: (key: string) => string
): string {
  if (!tier) return t('Not available')
  if (
    tier.unit === 'per_call' ||
    tier.unit === 'per_second' ||
    tier.unit === 'per_minute' ||
    tier.unit === 'per_image'
  ) {
    return `${formatUsd(tier.per_unit_usd)} · ${unitLabel(tier.unit, t)}`
  }
  return `${formatUsd(tier.input_per_million_usd)} / ${formatUsd(tier.output_per_million_usd)}`
}

function quoteLabel(
  quote: ChannelUpstreamQuoteView | undefined,
  t: (key: string) => string
): string {
  if (!quote) return t('Not available')
  if (
    quote.unit === 'per_call' ||
    quote.unit === 'per_second' ||
    quote.unit === 'per_minute' ||
    quote.unit === 'per_image'
  ) {
    return `${formatUsd(quote.per_call_usd)} · ${unitLabel(quote.unit, t)}`
  }
  return `${formatUsd(quote.input_per_million_usd)} / ${formatUsd(quote.output_per_million_usd)}`
}

/**
 * Shared table body for both the saved-channel price preview and the
 * pre-creation catalogue preview. One formatter keeps the two views identical.
 */
export function PricePreviewTable({
  items,
}: {
  items: ChannelModelPricingRecord[]
}) {
  const { t } = useTranslation()
  return (
    <div className='max-h-80 overflow-y-auto rounded-md border text-sm'>
      {/* 表头固定在滚动容器顶部：只滚动下面的价格行，滚动时行不会从半透明
          背景下透出来，所以这里用不透明的 bg-muted。 */}
      <div className='bg-muted sticky top-0 z-10 grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b px-3 py-2 font-medium'>
        <span>{t('Model')}</span>
        <span>{t('Official price')}</span>
        <span>{t('Channel price')}</span>
      </div>
      {items.map((item) => (
        <div
          key={item.model_name}
          className='grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b px-3 py-2 last:border-b-0'
        >
          <span className='font-mono break-words'>{item.model_name}</span>
          <span className='tabular-nums'>
            {officialLabel(resolveOfficialDisplayTier(item.official), t)}
          </span>
          <span className='tabular-nums'>
            {canDisplayChannelPrice(item)
              ? quoteLabel(item.upstream_quote, t)
              : t('Not available')}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * Read-only view of the official and channel prices a catalog sync wrote for
 * this channel. Used by the creation wizard's "fetch prices" step; draft and
 * fetch progress are handled inline so the operator never triggers them.
 */
export function FetchedPricePreview(props: FetchedPricePreviewProps) {
  const { t } = useTranslation()
  const ready = props.channelId > 0
  const query = useQuery({
    queryKey: ['channel-model-pricing', props.channelId],
    queryFn: () => getChannelModelPricing(props.channelId),
    enabled: ready,
    retry: false,
    meta: { errorToast: false },
  })
  // Order matters: remap first so an unsaved redirect alias inherits its
  // upstream price, then restrict the view to the models this channel serves.
  // Without the second step a catalog sync's historical rows (batch/operator
  // rows are never deleted) show up as unavailable models in the fetch step.
  const items: ChannelModelPricingRecord[] = useMemo(() => {
    const selectedModels = props.models ?? []
    const remapped = remapPricingRowsForPreview(
      query.data?.data?.items ?? [],
      props.modelMapping ?? '',
      selectedModels
    )
    return filterPricingRowsToSelectedModels(remapped, selectedModels)
  }, [query.data?.data?.items, props.modelMapping, props.models])

  let body: ReactNode
  if (props.setupState === 'failed') {
    body = (
      <div className='space-y-2 rounded-lg border border-dashed p-4 text-sm'>
        <p className='text-destructive'>
          {props.setupError || t('Failed to prepare the draft channel')}
        </p>
        {props.onRetrySetup ? (
          <Button
            type='button'
            size='sm'
            variant='outline'
            onClick={props.onRetrySetup}
          >
            {t('Retry')}
          </Button>
        ) : null}
      </div>
    )
  } else if (!ready) {
    body = (
      <p className='text-muted-foreground text-sm'>
        {t('Preparing the draft channel...')}
      </p>
    )
  } else if (props.fetchState === 'running') {
    body = <p className='text-muted-foreground text-sm'>{t('Syncing...')}</p>
  } else if (props.fetchState === 'failed') {
    body = (
      <div className='space-y-2 rounded-lg border border-dashed p-4 text-sm'>
        <p className='text-destructive'>
          {t('Failed to fetch prices from the catalog')}
        </p>
        {props.onRetryFetch ? (
          <Button
            type='button'
            size='sm'
            variant='outline'
            onClick={props.onRetryFetch}
          >
            {t('Retry')}
          </Button>
        ) : null}
      </div>
    )
  } else if (query.isLoading) {
    body = <p className='text-muted-foreground text-sm'>{t('Loading...')}</p>
  } else if (items.length === 0) {
    body = (
      <p className='text-muted-foreground rounded-lg border border-dashed p-4 text-sm'>
        {t('No prices fetched yet. Sync the channel catalog first.')}
      </p>
    )
  } else {
    body = <PricePreviewTable items={items} />
  }

  return (
    <section className='space-y-2' aria-live='polite'>
      <div>
        <Label>{t('Fetched prices')}</Label>
        <p className='text-muted-foreground text-sm'>
          {t('Official and channel prices from the synced catalog.')}
        </p>
      </div>
      {body}
    </section>
  )
}
