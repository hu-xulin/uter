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
import { Pencil, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
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
import { Textarea } from '@/components/ui/textarea'
import { toIntlLocale } from '@/i18n/languages'
import { handleServerError } from '@/lib/handle-server-error'

import {
  getChannelBillingSnapshots,
  getChannelModelPricing,
  seedChannelModelPricing,
  setChannelModelPricing,
} from '../api'
import { canDisplayChannelPrice } from '../lib/channel-price-display'
import { filterPricingRowsToPublishedAliases } from '../lib/model-mapping-validation'
import { resolveOfficialDisplayTier } from '../lib/official-price-display'
import type {
  ChannelInternalPricingView,
  ChannelModelPricingRecord,
  ChannelOfficialPricingTier,
} from '../types'

type EditDraft = {
  mode:
    | 'per_1m_token'
    | 'per_call'
    | 'per_second'
    | 'per_minute'
    | 'tiered_table'
    | 'tiered_expr'
  expression: string
  input: string
  output: string
  cache: string
  cacheWrite: string
  audioInput: string
  audioOutput: string
  perCall: string
  perSecond: string
  perMinute: string
  tiersText: string
  note: string
  purchaseInput: string
  purchaseOutput: string
  purchasePerCall: string
  purchasePerSecond: string
  purchasePerMinute: string
  purchaseVerified: boolean
  purchaseNote: string
}

function formatUsd(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return `$${value.toFixed(value > 0 && value < 0.01 ? 6 : 4)}`
}

function modeFromInternal(mode: string | undefined): EditDraft['mode'] {
  if (mode === 'per_call') return 'per_call'
  if (mode === 'per_second') return 'per_second'
  if (mode === 'per_minute') return 'per_minute'
  if (mode === 'tiered_table') return 'tiered_table'
  if (mode === 'tiered_expr') return 'tiered_expr'
  return 'per_1m_token'
}

function draftFrom(record: ChannelModelPricingRecord): EditDraft {
  const internal = record.internal
  return {
    mode: modeFromInternal(internal?.mode),
    expression: internal?.billing_expr ?? '',
    input: internal?.input_per_million_usd?.toString() ?? '',
    output: internal?.output_per_million_usd?.toString() ?? '',
    cache: internal?.cache_per_million_usd?.toString() ?? '',
    cacheWrite: internal?.create_cache_per_million_usd?.toString() ?? '',
    audioInput: internal?.audio_input_per_million_usd?.toString() ?? '',
    audioOutput: internal?.audio_output_per_million_usd?.toString() ?? '',
    perCall: internal?.per_call_usd?.toString() ?? '',
    perSecond: internal?.per_second_usd?.toString() ?? '',
    perMinute: internal?.per_minute_usd?.toString() ?? '',
    tiersText:
      internal?.tiers && internal.tiers.length > 0
        ? JSON.stringify(internal.tiers, null, 2)
        : '',
    note: internal?.note ?? '',
    purchaseInput:
      record.purchase?.pricing.input_per_million_usd?.toString() ?? '',
    purchaseOutput:
      record.purchase?.pricing.output_per_million_usd?.toString() ?? '',
    purchasePerCall: record.purchase?.pricing.per_call_usd?.toString() ?? '',
    purchasePerSecond:
      record.purchase?.pricing.per_second_usd?.toString() ?? '',
    purchasePerMinute:
      record.purchase?.pricing.per_minute_usd?.toString() ?? '',
    purchaseVerified: record.purchase?.verified ?? false,
    purchaseNote: record.purchase?.note ?? '',
  }
}

function parsePrice(value: string): number | undefined {
  if (value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

function statusVariant(
  status: ChannelModelPricingRecord['pricing_status']
): 'default' | 'secondary' | 'warning' {
  if (status === 'configured') return 'default'
  if (status === 'needs_review') return 'warning'
  return 'secondary'
}

type ChannelModelPricingSectionProps = {
  channelId: number
  modelMapping?: string
  publishedModels?: string[]
}

function pricingRuleLabel(
  internal: NonNullable<ChannelModelPricingRecord['internal']>,
  t: (key: string, options?: Record<string, unknown>) => string
) {
  if (
    internal.source === 'bailian-official' ||
    internal.source === 'bailian-channel'
  ) {
    return t('Channel catalog default')
  }
  if (internal.source?.includes('expression')) {
    return t('Upstream expression')
  }
  if (internal.source === 'batch') {
    return internal.note || t('Batch rule')
  }
  if (internal.source === 'schedule') {
    return internal.note || t('Scheduled rule')
  }
  if (internal.source === 'uterroute-discount') {
    return t('Upstream discount {{group}} ×{{ratio}}', {
      group:
        internal.discount_model_group || internal.discount_group || 'default',
      ratio: internal.discount_ratio ?? 1,
    })
  }
  return internal.note || t('Manual')
}

export function ChannelModelPricingSection(
  props: ChannelModelPricingSectionProps
) {
  const { t, i18n } = useTranslation()
  const intlLocale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<ChannelModelPricingRecord | null>(null)
  const [draft, setDraft] = useState<EditDraft | null>(null)
  const [reviewOnly, setReviewOnly] = useState(false)

  const listQuery = useQuery({
    queryKey: ['channel-model-pricing', props.channelId],
    queryFn: () => getChannelModelPricing(props.channelId),
    enabled: props.channelId > 0,
    retry: false,
    meta: { errorToast: false },
  })

  const snapshotQuery = useQuery({
    queryKey: ['channel-billing-snapshots', props.channelId],
    queryFn: () => getChannelBillingSnapshots(props.channelId, 20),
    enabled: props.channelId > 0,
    retry: false,
    meta: { errorToast: false },
  })

  const savedItems = useMemo(
    () => listQuery.data?.data?.items ?? [],
    [listQuery.data]
  )
  const items = useMemo(
    () =>
      filterPricingRowsToPublishedAliases(
        savedItems,
        props.modelMapping,
        props.publishedModels ?? []
      ),
    [savedItems, props.modelMapping, props.publishedModels]
  )
  const summary = useMemo(() => {
    // Count models, not rows: a mis-synced channel can hold several provider
    // rows per model, and the header must still read "83 models".
    // needs_review outranks configured so a duplicate configured row can
    // never hide a model that still awaits manual confirmation.
    const rank = (status: string) => {
      if (status === 'needs_review') return 2
      if (status === 'configured') return 1
      return 0
    }
    const byModel = new Map<string, string>()
    for (const item of items) {
      const previous = byModel.get(item.model_name)
      if (
        previous === undefined ||
        rank(item.pricing_status) > rank(previous)
      ) {
        byModel.set(item.model_name, item.pricing_status)
      }
    }
    let configured = 0
    let review = 0
    for (const status of byModel.values()) {
      if (status === 'configured') configured++
      else if (status === 'needs_review') review++
    }
    return {
      total: byModel.size,
      configured,
      review,
      officialOnly: byModel.size - configured - review,
    }
  }, [items])

  const visibleItems = useMemo(
    () =>
      reviewOnly
        ? items.filter((item) => item.pricing_status === 'needs_review')
        : items,
    [items, reviewOnly]
  )

  const save = useMutation({
    mutationFn: async () => {
      if (!editing || !draft) throw new Error('No pricing record selected')
      const pricing: ChannelInternalPricingView = {
        mode: draft.mode,
        note: draft.note.trim() || undefined,
        updated_at: Math.floor(Date.now() / 1000),
      }
      if (draft.mode === 'tiered_expr') {
        const expression = draft.expression.trim()
        if (!expression) {
          throw new Error(t('Billing expression is required.'))
        }
        pricing.mode = 'tiered_expr'
        pricing.billing_expr = expression
        return setChannelModelPricing(
          props.channelId,
          editing.model_name,
          pricing,
          {
            provider: editing.provider,
            region: editing.region,
            deploymentId: editing.deployment_id,
          }
        )
      }
      if (draft.mode === 'tiered_table') {
        let tiers: unknown
        try {
          tiers = JSON.parse(draft.tiersText)
        } catch {
          throw new Error(t('Tiers must be valid JSON.'))
        }
        if (!Array.isArray(tiers) || tiers.length === 0) {
          throw new Error(t('Add at least one price tier.'))
        }
        pricing.mode = 'tiered_table'
        pricing.tiers = tiers as NonNullable<
          ChannelInternalPricingView['tiers']
        >
        return setChannelModelPricing(
          props.channelId,
          editing.model_name,
          pricing,
          {
            provider: editing.provider,
            region: editing.region,
            deploymentId: editing.deployment_id,
          }
        )
      }
      if (draft.mode === 'per_call') {
        pricing.per_call_usd = parsePrice(draft.perCall)
      } else if (draft.mode === 'per_second') {
        pricing.per_second_usd = parsePrice(draft.perSecond)
      } else if (draft.mode === 'per_minute') {
        pricing.per_minute_usd = parsePrice(draft.perMinute)
      } else {
        pricing.input_per_million_usd = parsePrice(draft.input)
        pricing.output_per_million_usd = parsePrice(draft.output)
        pricing.cache_per_million_usd = parsePrice(draft.cache)
        pricing.create_cache_per_million_usd = parsePrice(draft.cacheWrite)
        pricing.audio_input_per_million_usd = parsePrice(draft.audioInput)
        pricing.audio_output_per_million_usd = parsePrice(draft.audioOutput)
      }
      const purchasePricing: ChannelInternalPricingView = {
        mode: draft.mode,
        updated_at: Math.floor(Date.now() / 1000),
      }
      if (draft.mode === 'per_call') {
        purchasePricing.per_call_usd = parsePrice(draft.purchasePerCall)
      } else if (draft.mode === 'per_second') {
        purchasePricing.per_second_usd = parsePrice(draft.purchasePerSecond)
      } else if (draft.mode === 'per_minute') {
        purchasePricing.per_minute_usd = parsePrice(draft.purchasePerMinute)
      } else {
        purchasePricing.input_per_million_usd = parsePrice(draft.purchaseInput)
        purchasePricing.output_per_million_usd = parsePrice(
          draft.purchaseOutput
        )
      }
      const hasPurchase =
        purchasePricing.input_per_million_usd != null ||
        purchasePricing.output_per_million_usd != null ||
        purchasePricing.per_call_usd != null ||
        purchasePricing.per_second_usd != null ||
        purchasePricing.per_minute_usd != null
      return setChannelModelPricing(
        props.channelId,
        editing.model_name,
        pricing,
        {
          provider: editing.provider,
          region: editing.region,
          deploymentId: editing.deployment_id,
        },
        hasPurchase
          ? {
              pricing: purchasePricing,
              verified: draft.purchaseVerified,
              note: draft.purchaseNote.trim() || undefined,
            }
          : undefined,
        !hasPurchase && Boolean(editing.purchase)
      )
    },
    onSuccess: (response) => {
      if (!response.success) {
        toast.error(response.message || t('Failed to save channel price'))
        return
      }
      toast.success(t('Channel price saved'))
      setEditing(null)
      setDraft(null)
      void queryClient.invalidateQueries({
        queryKey: ['channel-model-pricing', props.channelId],
      })
    },
    onError: (error) =>
      handleServerError(error, t('Failed to save channel price')),
  })

  const internalPriceLabel = (item: ChannelModelPricingRecord) => {
    if (!item.internal) return t('Not configured')
    if (item.internal.mode === 'tiered_expr' || item.internal.billing_expr) {
      return t('Expression')
    }
    if (item.internal.mode === 'per_second') {
      return t('{{price}} / second', {
        price: formatUsd(item.internal.per_second_usd),
      })
    }
    if (item.internal.mode === 'per_call') {
      return formatUsd(item.internal.per_call_usd)
    }
    if (item.internal.mode === 'tiered_table' || item.internal.tiers?.length) {
      return t('{{count}} tiers', { count: item.internal.tiers?.length ?? 0 })
    }
    return `${formatUsd(item.internal.input_per_million_usd)} / ${formatUsd(item.internal.output_per_million_usd)}`
  }

  const upstreamQuoteLabel = (item: ChannelModelPricingRecord) => {
    const quote = item.upstream_quote
    if (!quote || !canDisplayChannelPrice(item)) return t('Not available')
    if (
      quote.unit === 'per_call' ||
      quote.unit === 'per_second' ||
      quote.unit === 'per_image' ||
      quote.unit === 'per_minute'
    ) {
      return formatUsd(quote.per_unit_usd ?? quote.per_call_usd)
    }
    return `${formatUsd(quote.input_per_million_usd)} / ${formatUsd(quote.output_per_million_usd)}`
  }

  const unitLabel = (unit: string) => {
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

  const formatTierPrice = (tier: ChannelOfficialPricingTier) => {
    if (
      tier.unit === 'per_call' ||
      tier.unit === 'per_image' ||
      tier.unit === 'per_second' ||
      tier.unit === 'per_minute'
    ) {
      return `${formatUsd(tier.per_unit_usd)} · ${unitLabel(tier.unit)}`
    }
    const parts = [
      `${t('Input')} ${formatUsd(tier.input_per_million_usd)}`,
      `${t('Output')} ${formatUsd(tier.output_per_million_usd)}`,
    ]
    if (tier.cache_per_million_usd != null) {
      parts.push(`${t('Cache read')} ${formatUsd(tier.cache_per_million_usd)}`)
    }
    if (tier.create_cache_per_million_usd != null) {
      parts.push(
        `${t('Cache write')} ${formatUsd(tier.create_cache_per_million_usd)}`
      )
    }
    if (tier.image_input_per_million_usd != null) {
      parts.push(
        `${t('Image input')} ${formatUsd(tier.image_input_per_million_usd)}`
      )
    }
    if (tier.thinking_input_per_million_usd != null) {
      parts.push(
        `${t('Thinking input')} ${formatUsd(tier.thinking_input_per_million_usd)}`
      )
    }
    if (tier.thinking_output_per_million_usd != null) {
      parts.push(
        `${t('Thinking output')} ${formatUsd(tier.thinking_output_per_million_usd)}`
      )
    }
    if (tier.thinking_cache_per_million_usd != null) {
      parts.push(
        `${t('Thinking cache read')} ${formatUsd(tier.thinking_cache_per_million_usd)}`
      )
    }
    if (tier.thinking_create_cache_per_million_usd != null) {
      parts.push(
        `${t('Thinking cache write')} ${formatUsd(tier.thinking_create_cache_per_million_usd)}`
      )
    }
    if (tier.thinking_image_input_per_million_usd != null) {
      parts.push(
        `${t('Thinking image input')} ${formatUsd(tier.thinking_image_input_per_million_usd)}`
      )
    }
    if (tier.multi_input_output_per_million_usd != null) {
      parts.push(
        `${t('Multimodal input/output')} ${formatUsd(tier.multi_input_output_per_million_usd)}`
      )
    }
    if (tier.thinking_multi_input_output_per_million_usd != null) {
      parts.push(
        `${t('Thinking multimodal input/output')} ${formatUsd(tier.thinking_multi_input_output_per_million_usd)}`
      )
    }
    if (tier.audio_input_per_million_usd != null) {
      parts.push(
        `${t('Audio input')} ${formatUsd(tier.audio_input_per_million_usd)}`
      )
    }
    if (tier.audio_output_per_million_usd != null) {
      parts.push(
        `${t('Audio output')} ${formatUsd(tier.audio_output_per_million_usd)}`
      )
    }
    if (tier.audio_input_per_million_usd != null) {
      parts.push(
        `${t('Audio input')} ${formatUsd(tier.audio_input_per_million_usd)}`
      )
    }
    if (tier.audio_output_per_million_usd != null) {
      parts.push(
        `${t('Audio output')} ${formatUsd(tier.audio_output_per_million_usd)}`
      )
    }
    return parts.join(' · ')
  }

  const rawPriceComponent = (item: ChannelModelPricingRecord) => {
    const tier =
      item.official?.tiers?.[0] ?? item.official?.channel_price_tiers?.[0]
    return tier?.raw_components?.[0]
  }

  const officialPriceLabel = (item: ChannelModelPricingRecord) => {
    const tier = resolveOfficialDisplayTier(item.official)
    if (!tier) return t('Not available')
    return formatTierPrice(tier)
  }

  const renderPricingList = () => {
    if (listQuery.isLoading) {
      return <p className='text-muted-foreground text-sm'>{t('Loading...')}</p>
    }
    if (items.length === 0) {
      return (
        <p className='text-muted-foreground text-sm'>
          {t('No channel pricing records yet. Sync the channel catalog first.')}
        </p>
      )
    }
    if (visibleItems.length === 0) {
      return (
        <p className='text-muted-foreground text-sm'>
          {t('No models available')}
        </p>
      )
    }
    return (
      <div className='max-h-80 overflow-y-auto rounded-md border'>
        {visibleItems.map((item) => {
          const raw = rawPriceComponent(item)
          return (
            <div
              key={`${item.model_name}|${item.provider}|${item.region}|${item.deployment_id}`}
              className='space-y-1.5 border-b px-3 py-2.5 text-sm last:border-b-0'
            >
              <div className='flex flex-wrap items-center gap-2'>
                <span className='font-mono font-medium break-words'>
                  {item.model_name}
                </span>
                <Badge variant={statusVariant(item.pricing_status)}>
                  {t(item.pricing_status)}
                </Badge>
                {item.model_provider &&
                item.model_provider !== item.provider ? (
                  <Badge variant='outline'>{item.model_provider}</Badge>
                ) : null}
                {item.stale ? (
                  <Badge
                    variant='warning'
                    title={t('Last fetched {{hours}} hours ago', {
                      hours: item.fetched_age_hours,
                    })}
                  >
                    {t('Stale price')}
                  </Badge>
                ) : null}
                {item.price_shape && !item.price_supported ? (
                  <Badge variant='warning'>
                    {t('Unsupported price shape')}: {item.price_shape}
                  </Badge>
                ) : null}
              </div>

              <div className='text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1'>
                <span>
                  {t('Upstream official price')}: {officialPriceLabel(item)}
                </span>
                {raw ? (
                  <span className='inline-flex flex-wrap items-center gap-1'>
                    <Badge variant='outline' className='font-normal'>
                      {raw.raw_currency} {raw.raw_amount} {raw.raw_unit}
                    </Badge>
                    {raw.currency_inferred ? (
                      <Badge variant='warning'>{t('Inferred currency')}</Badge>
                    ) : null}
                    {raw.fx_rate ? (
                      <Badge
                        variant='outline'
                        title={raw.fx_source}
                        className='font-normal'
                      >
                        {t('FX')} {raw.fx_rate}
                      </Badge>
                    ) : null}
                  </span>
                ) : null}
                {item.official?.review_reasons?.length ? (
                  <span className='text-destructive w-full text-sm'>
                    {t('Review reasons')}:{' '}
                    {item.official.review_reasons.join(' · ')}
                  </span>
                ) : null}
                {item.official?.tiers?.length ? (
                  <details className='w-full'>
                    <summary className='text-muted-foreground cursor-pointer text-sm'>
                      {t('All price tiers ({{count}})', {
                        count: item.official.tiers.length,
                      })}
                    </summary>
                    <ul className='mt-1 space-y-0.5'>
                      {item.official.tiers.map((tier) => (
                        <li
                          key={`${tier.range_name}|${tier.time_band ?? ''}|${tier.unit}|${tier.min_input_tokens ?? 0}-${tier.max_input_tokens ?? 0}|${tier.input_per_million_usd ?? ''}-${tier.output_per_million_usd ?? ''}-${tier.per_unit_usd ?? ''}`}
                          className='text-muted-foreground font-mono text-sm'
                        >
                          {tier.range_name || t('Default')}
                          {tier.time_band ? ` · ${tier.time_band}` : ''} ·{' '}
                          {formatTierPrice(tier)}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                {item.official?.channel_price_tiers?.length ? (
                  <details className='w-full'>
                    <summary className='text-muted-foreground cursor-pointer text-sm'>
                      {t('Upstream channel price tiers ({{count}})', {
                        count: item.official.channel_price_tiers.length,
                      })}
                    </summary>
                    <ul className='mt-1 space-y-0.5'>
                      {item.official.channel_price_tiers.map((tier) => (
                        <li
                          key={`channel|${tier.range_name}|${tier.time_band ?? ''}|${tier.unit}|${tier.min_input_tokens ?? 0}-${tier.max_input_tokens ?? 0}|${tier.input_per_million_usd ?? ''}-${tier.output_per_million_usd ?? ''}-${tier.per_unit_usd ?? ''}`}
                          className='text-muted-foreground font-mono text-sm'
                        >
                          {tier.range_name || t('Default')}
                          {tier.time_band ? ` · ${tier.time_band}` : ''} ·{' '}
                          {formatTierPrice(tier)}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                {item.official?.component_prices?.length ? (
                  <span>
                    {t('Additional service price')}:{' '}
                    {item.official.component_prices
                      .map(
                        (component) =>
                          `${component.name || component.type || '—'} ${formatUsd(component.usd)} · ${unitLabel(component.unit)}`
                      )
                      .join(' | ')}
                  </span>
                ) : null}
                <span>
                  {t('Upstream channel price')}: {upstreamQuoteLabel(item)}
                  {canDisplayChannelPrice(item) && item.upstream_quote ? (
                    <Badge variant='outline' className='ml-1 font-normal'>
                      {t(item.upstream_quote.price_basis)}
                    </Badge>
                  ) : null}
                  {canDisplayChannelPrice(item) &&
                  item.upstream_quote?.discount_ratio ? (
                    <Badge
                      variant='secondary'
                      className='ml-1 font-normal'
                      aria-label={t('Discount group')}
                    >
                      {item.upstream_quote.discount_group}: ×
                      {item.upstream_quote.discount_ratio}
                    </Badge>
                  ) : null}
                </span>
                {canDisplayChannelPrice(item) &&
                (item.upstream_quote?.tiers?.length ?? 0) > 1 ? (
                  <details className='w-full'>
                    <summary className='text-muted-foreground cursor-pointer text-sm'>
                      {t('Upstream channel price tiers ({{count}})', {
                        count: item.upstream_quote?.tiers?.length ?? 0,
                      })}
                    </summary>
                    <ul className='mt-1 space-y-0.5'>
                      {item.upstream_quote?.tiers?.map((tier) => (
                        <li
                          key={`quote|${tier.range_name}|${tier.time_band ?? ''}|${tier.unit}|${tier.min_input_tokens ?? 0}-${tier.max_input_tokens ?? 0}`}
                          className='text-muted-foreground font-mono text-sm'
                        >
                          {tier.range_name || t('Default')}
                          {tier.time_band ? ` · ${tier.time_band}` : ''} ·{' '}
                          {formatTierPrice(tier)}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>

              <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
                <span>
                  {t('Uter sale price')}: {internalPriceLabel(item)}
                  {item.internal?.audio_input_per_million_usd != null ? (
                    <span className='text-muted-foreground block text-sm'>
                      {t('Audio input')}:{' '}
                      {formatUsd(item.internal.audio_input_per_million_usd)}
                      {item.internal.audio_output_per_million_usd != null
                        ? ` · ${t('Audio output')}: ${formatUsd(item.internal.audio_output_per_million_usd)}`
                        : ''}
                    </span>
                  ) : null}
                </span>
                <span className='text-muted-foreground'>
                  {t('Contract cost')}:{' '}
                  {item.purchase
                    ? `${formatUsd(
                        item.purchase.pricing.input_per_million_usd ??
                          item.purchase.pricing.per_call_usd ??
                          item.purchase.pricing.per_second_usd ??
                          item.purchase.pricing.per_minute_usd
                      )} ${item.purchase.verified ? t('Verified') : t('Not verified')}`
                    : t('Not configured')}
                </span>
                <span className='text-muted-foreground'>
                  {t('Pricing rule')}:{' '}
                  {item.internal
                    ? pricingRuleLabel(item.internal, t)
                    : t('No rule')}
                </span>
                {item.internal?.tiers?.length ? (
                  <details>
                    <summary className='text-muted-foreground cursor-pointer text-sm'>
                      {t('Sale tiers ({{count}})', {
                        count: item.internal.tiers.length,
                      })}
                    </summary>
                    <ul className='mt-1 space-y-0.5'>
                      {item.internal.tiers.map((tier) => (
                        <li
                          key={`sale|${tier.range_name}|${tier.time_band ?? ''}|${tier.unit}|${tier.min_input_tokens ?? 0}-${tier.max_input_tokens ?? 0}`}
                          className='text-muted-foreground font-mono text-sm'
                        >
                          {tier.range_name || t('Default')}
                          {tier.time_band ? ` · ${tier.time_band}` : ''} ·{' '}
                          {formatTierPrice({
                            range_name: tier.range_name,
                            time_band: tier.time_band,
                            min_input_tokens: tier.min_input_tokens,
                            max_input_tokens: tier.max_input_tokens,
                            input_per_million_usd: tier.input_per_million_usd,
                            output_per_million_usd: tier.output_per_million_usd,
                            cache_per_million_usd: tier.cache_per_million_usd,
                            create_cache_per_million_usd:
                              tier.create_cache_per_million_usd,
                            per_unit_usd: tier.per_unit_usd,
                            unit: tier.unit,
                          })}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                <span className='text-muted-foreground'>
                  {t('Provider')}: {item.provider || '—'}
                </span>
                <span className='text-muted-foreground'>
                  {t('Region')}: {item.region || '—'}
                </span>
                {item.deployment_id ? (
                  <span className='text-muted-foreground'>
                    {t('Deployment')}: {item.deployment_id}
                  </span>
                ) : null}
                <span className='text-muted-foreground'>
                  {t('Updated')}:{' '}
                  {item.updated_at
                    ? new Date(item.updated_at * 1000).toLocaleString(
                        intlLocale
                      )
                    : '—'}
                </span>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  className='ml-auto'
                  onClick={() => {
                    setEditing(item)
                    setDraft(draftFrom(item))
                  }}
                >
                  <Pencil className='size-4' aria-hidden='true' />
                  {t('Edit')}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const seed = useMutation({
    mutationFn: () => seedChannelModelPricing(props.channelId),
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        toast.error(response.message || t('Failed to seed official prices'))
        return
      }
      toast.success(
        t('Seeded {{count}} official price(s)', {
          count: response.data.seeded,
        })
      )
      void queryClient.invalidateQueries({
        queryKey: ['channel-model-pricing', props.channelId],
      })
    },
    onError: (error) =>
      handleServerError(error, t('Failed to seed official prices')),
  })

  if (props.channelId <= 0) return null

  return (
    <div className='space-y-2 border-t pt-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div>
          <Label>{t('Channel model pricing')}</Label>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Upstream official price, upstream channel price, and Uter sale price are shown separately for every model.'
            )}
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-muted-foreground text-sm'>
            {t(
              '{{total}} models · {{configured}} configured · {{review}} review',
              {
                total: summary.total,
                configured: summary.configured,
                review: summary.review,
              }
            )}
            {' · '}
            {t('Channel #{{id}}', { id: props.channelId })}
          </span>
          {summary.review > 0 && (
            <Button
              type='button'
              size='sm'
              variant={reviewOnly ? 'secondary' : 'outline'}
              aria-pressed={reviewOnly}
              title={t(
                'Click to show only the models that await manual confirmation'
              )}
              onClick={() => setReviewOnly((value) => !value)}
            >
              {t('Needs review')} · {summary.review}
            </Button>
          )}
          {summary.officialOnly > 0 && (
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={seed.isPending}
              onClick={() => seed.mutate()}
            >
              <Sparkles className='size-4' aria-hidden='true' />
              {t('Use official prices')}
            </Button>
          )}
        </div>
      </div>

      {(snapshotQuery.data?.length ?? 0) > 0 ? (
        <details className='rounded-md border px-3 py-2'>
          <summary className='cursor-pointer text-sm'>
            {t('Recent billing snapshots ({{count}})', {
              count: snapshotQuery.data?.length ?? 0,
            })}
          </summary>
          <ul className='mt-2 space-y-1'>
            {snapshotQuery.data?.map((snapshot) => (
              <li
                key={snapshot.id}
                className='text-muted-foreground font-mono text-xs'
              >
                {snapshot.request_id || snapshot.task_id} ·{' '}
                {snapshot.model_name} · {snapshot.billing_mode || '—'} ·{' '}
                {snapshot.pricing_version?.slice(0, 12) || '—'}
                {snapshot.purchase_version
                  ? ` · ${t('cost')} ${snapshot.purchase_version.slice(0, 12)}`
                  : ''}
                {snapshot.provider
                  ? ` · ${[snapshot.provider, snapshot.region, snapshot.deployment_id].filter(Boolean).join('/')}`
                  : ''}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {renderPricingList()}

      <Dialog
        open={Boolean(editing && draft)}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null)
            setDraft(null)
          }
        }}
        title={t('Set internal channel price')}
        description={editing?.model_name}
        contentClassName='sm:max-w-lg'
        footer={
          <>
            <Button
              type='button'
              variant='outline'
              onClick={() => {
                setEditing(null)
                setDraft(null)
              }}
            >
              {t('Cancel')}
            </Button>
            <Button
              type='button'
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              {t('Save')}
            </Button>
          </>
        }
      >
        {draft && (
          <div className='space-y-3'>
            <div className='space-y-1.5'>
              <Label>{t('Billing mode')}</Label>
              <Select
                value={draft.mode}
                onValueChange={(value) =>
                  setDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          mode:
                            value === 'per_call' ||
                            value === 'per_second' ||
                            value === 'per_minute' ||
                            value === 'tiered_table' ||
                            value === 'tiered_expr'
                              ? value
                              : 'per_1m_token',
                        }
                      : prev
                  )
                }
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='per_1m_token'>
                    {t('Per 1M tokens')}
                  </SelectItem>
                  <SelectItem value='per_call'>{t('Per call')}</SelectItem>
                  <SelectItem value='per_second'>{t('Per second')}</SelectItem>
                  <SelectItem value='per_minute'>{t('Per minute')}</SelectItem>
                  <SelectItem value='tiered_table'>
                    {t('Tiered token prices')}
                  </SelectItem>
                  <SelectItem value='tiered_expr'>
                    {t('Billing expression')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {draft.mode === 'per_1m_token' && (
              <div className='grid gap-3 sm:grid-cols-2'>
                <div className='space-y-1.5'>
                  <Label>{t('Audio input price (USD per 1M tokens)')}</Label>
                  <Input
                    inputMode='decimal'
                    value={draft.audioInput}
                    onChange={(event) =>
                      setDraft((prev) =>
                        prev
                          ? { ...prev, audioInput: event.target.value }
                          : prev
                      )
                    }
                  />
                </div>
                <div className='space-y-1.5'>
                  <Label>{t('Audio output price (USD per 1M tokens)')}</Label>
                  <Input
                    inputMode='decimal'
                    value={draft.audioOutput}
                    onChange={(event) =>
                      setDraft((prev) =>
                        prev
                          ? { ...prev, audioOutput: event.target.value }
                          : prev
                      )
                    }
                  />
                </div>
              </div>
            )}
            {draft.mode === 'tiered_expr' && (
              <div className='space-y-1.5'>
                <Label>{t('Billing expression')}</Label>
                <Textarea
                  rows={6}
                  className='font-mono'
                  value={draft.expression}
                  onChange={(event) =>
                    setDraft((prev) =>
                      prev ? { ...prev, expression: event.target.value } : prev
                    )
                  }
                  placeholder='len <= 131072 ? tier("short", p * 1 + c * 2) : tier("long", p * 2 + c * 4)'
                />
                <p className='text-muted-foreground text-sm'>
                  {t(
                    'Expression rule is validated by Uter billing engine before saving.'
                  )}
                </p>
              </div>
            )}
            {draft.mode === 'tiered_table' && (
              <div className='space-y-1.5'>
                <Label>{t('Price tiers (JSON)')}</Label>
                <Textarea
                  rows={10}
                  className='font-mono'
                  value={draft.tiersText}
                  onChange={(event) =>
                    setDraft((prev) =>
                      prev ? { ...prev, tiersText: event.target.value } : prev
                    )
                  }
                  placeholder={`[
  {
    "range_name": "0-32k",
    "max_input_tokens": 32768,
    "input_per_million_usd": 1.2,
    "output_per_million_usd": 4.8,
    "unit": "per_1m_token"
  }
]`}
                />
                <p className='text-muted-foreground text-sm'>
                  {t(
                    'One band per context range. Time bands must match or stay empty.'
                  )}
                </p>
              </div>
            )}
            {draft.mode === 'per_call' && (
              <div className='space-y-1.5'>
                <Label>{t('Price per call (USD)')}</Label>
                <Input
                  inputMode='decimal'
                  value={draft.perCall}
                  onChange={(event) =>
                    setDraft((prev) =>
                      prev ? { ...prev, perCall: event.target.value } : prev
                    )
                  }
                />
              </div>
            )}
            {draft.mode === 'per_second' && (
              <div className='space-y-1.5'>
                <Label>{t('Price per second (USD)')}</Label>
                <Input
                  inputMode='decimal'
                  value={draft.perSecond}
                  onChange={(event) =>
                    setDraft((prev) =>
                      prev ? { ...prev, perSecond: event.target.value } : prev
                    )
                  }
                />
              </div>
            )}
            {draft.mode === 'per_minute' && (
              <div className='space-y-1.5'>
                <Label>{t('Price per minute (USD)')}</Label>
                <Input
                  inputMode='decimal'
                  value={draft.perMinute}
                  onChange={(event) =>
                    setDraft((prev) =>
                      prev ? { ...prev, perMinute: event.target.value } : prev
                    )
                  }
                />
              </div>
            )}
            {draft.mode !== 'per_call' &&
              draft.mode !== 'per_second' &&
              draft.mode !== 'per_minute' && (
                <div className='grid gap-3 sm:grid-cols-2'>
                  <div className='space-y-1.5'>
                    <Label>{t('Input / 1M (USD)')}</Label>
                    <Input
                      inputMode='decimal'
                      value={draft.input}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev ? { ...prev, input: event.target.value } : prev
                        )
                      }
                    />
                  </div>
                  <div className='space-y-1.5'>
                    <Label>{t('Output / 1M (USD)')}</Label>
                    <Input
                      inputMode='decimal'
                      value={draft.output}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev ? { ...prev, output: event.target.value } : prev
                        )
                      }
                    />
                  </div>
                  <div className='space-y-1.5'>
                    <Label>{t('Cache / 1M (USD)')}</Label>
                    <Input
                      inputMode='decimal'
                      value={draft.cache}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev ? { ...prev, cache: event.target.value } : prev
                        )
                      }
                    />
                  </div>
                  <div className='space-y-1.5'>
                    <Label>{t('Cache write / 1M (USD)')}</Label>
                    <Input
                      inputMode='decimal'
                      value={draft.cacheWrite}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev
                            ? { ...prev, cacheWrite: event.target.value }
                            : prev
                        )
                      }
                    />
                  </div>
                </div>
              )}
            {draft.mode !== 'tiered_expr' && draft.mode !== 'tiered_table' && (
              <div className='space-y-3 rounded-md border p-3'>
                <div>
                  <Label>{t('Contract purchase cost')}</Label>
                  <p className='text-muted-foreground text-sm'>
                    {t(
                      'Your actual contracted cost, kept separate from the upstream public quote. Leave empty when no contract cost is known.'
                    )}
                  </p>
                </div>
                {draft.mode === 'per_call' && (
                  <div className='space-y-1.5'>
                    <Label>{t('Purchase per call (USD)')}</Label>
                    <Input
                      inputMode='decimal'
                      value={draft.purchasePerCall}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev
                            ? { ...prev, purchasePerCall: event.target.value }
                            : prev
                        )
                      }
                    />
                  </div>
                )}
                {draft.mode === 'per_second' && (
                  <div className='space-y-1.5'>
                    <Label>{t('Purchase per second (USD)')}</Label>
                    <Input
                      inputMode='decimal'
                      value={draft.purchasePerSecond}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev
                            ? { ...prev, purchasePerSecond: event.target.value }
                            : prev
                        )
                      }
                    />
                  </div>
                )}
                {draft.mode === 'per_minute' && (
                  <div className='space-y-1.5'>
                    <Label>{t('Purchase per minute (USD)')}</Label>
                    <Input
                      inputMode='decimal'
                      value={draft.purchasePerMinute}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev
                            ? { ...prev, purchasePerMinute: event.target.value }
                            : prev
                        )
                      }
                    />
                  </div>
                )}
                {draft.mode === 'per_1m_token' && (
                  <div className='grid gap-3 sm:grid-cols-2'>
                    <div className='space-y-1.5'>
                      <Label>{t('Purchase input / 1M (USD)')}</Label>
                      <Input
                        inputMode='decimal'
                        value={draft.purchaseInput}
                        onChange={(event) =>
                          setDraft((prev) =>
                            prev
                              ? { ...prev, purchaseInput: event.target.value }
                              : prev
                          )
                        }
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label>{t('Purchase output / 1M (USD)')}</Label>
                      <Input
                        inputMode='decimal'
                        value={draft.purchaseOutput}
                        onChange={(event) =>
                          setDraft((prev) =>
                            prev
                              ? { ...prev, purchaseOutput: event.target.value }
                              : prev
                          )
                        }
                      />
                    </div>
                  </div>
                )}
                <div className='flex items-center justify-between gap-3'>
                  <div>
                    <Label>{t('Cost verified')}</Label>
                    <p className='text-muted-foreground text-sm'>
                      {t(
                        'Enable only after the contract or supplier bill confirms this cost.'
                      )}
                    </p>
                  </div>
                  <Switch
                    checked={draft.purchaseVerified}
                    onCheckedChange={(checked) =>
                      setDraft((prev) =>
                        prev ? { ...prev, purchaseVerified: checked } : prev
                      )
                    }
                  />
                </div>
              </div>
            )}
            <div className='space-y-1.5'>
              <Label>{t('Note')}</Label>
              <Input
                aria-label={t('Note')}
                value={draft.note}
                onChange={(event) =>
                  setDraft((prev) =>
                    prev ? { ...prev, note: event.target.value } : prev
                  )
                }
              />
            </div>
            {editing?.official?.needs_review && (
              <p className='text-warning text-sm'>
                {t(
                  'This official record has multiple ranges or unsupported units. It is preserved for reference and never flattened automatically.'
                )}
              </p>
            )}
          </div>
        )}
      </Dialog>
    </div>
  )
}
