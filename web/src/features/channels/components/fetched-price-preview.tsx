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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Label } from '@/components/ui/label'

import { getChannelModelPricing } from '../api'
import type {
  ChannelModelPricingRecord,
  ChannelOfficialPricingTier,
  ChannelUpstreamQuoteView,
} from '../types'

type FetchedPricePreviewProps = {
  channelId: number
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
 * Read-only view of the official and channel prices a catalog sync wrote for
 * this channel. Used by the creation wizard's "fetch prices" step so the
 * operator sees the real values before configuring sale prices.
 */
export function FetchedPricePreview(props: FetchedPricePreviewProps) {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['channel-model-pricing', props.channelId],
    queryFn: () => getChannelModelPricing(props.channelId),
    enabled: props.channelId > 0,
    retry: false,
    meta: { errorToast: false },
  })
  const items: ChannelModelPricingRecord[] = query.data?.data?.items ?? []

  let body: ReactNode
  if (query.isLoading) {
    body = <p className='text-muted-foreground text-sm'>{t('Loading...')}</p>
  } else if (items.length === 0) {
    body = (
      <p className='text-muted-foreground rounded-lg border border-dashed p-4 text-sm'>
        {t('No prices fetched yet. Sync the channel catalog first.')}
      </p>
    )
  } else {
    body = (
      <div className='max-h-80 overflow-y-auto rounded-md border text-sm'>
        <div className='bg-muted/40 grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b px-3 py-2 font-medium'>
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
              {officialLabel(item.official?.tiers?.[0], t)}
            </span>
            <span className='tabular-nums'>
              {quoteLabel(item.upstream_quote, t)}
            </span>
          </div>
        ))}
      </div>
    )
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
