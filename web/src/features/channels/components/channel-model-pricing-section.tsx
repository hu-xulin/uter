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
import { Pencil } from 'lucide-react'
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
import { handleServerError } from '@/lib/handle-server-error'

import { getChannelModelPricing, setChannelModelPricing } from '../api'
import type {
  ChannelInternalPricingView,
  ChannelModelPricingRecord,
} from '../types'

type EditDraft = {
  mode: 'per_1m_token' | 'per_call' | 'per_second'
  input: string
  output: string
  cache: string
  cacheWrite: string
  perCall: string
  perSecond: string
  note: string
}

function formatUsd(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return `$${value.toFixed(value > 0 && value < 0.01 ? 6 : 4)}`
}

function modeFromInternal(mode: string | undefined): EditDraft['mode'] {
  if (mode === 'per_call') return 'per_call'
  if (mode === 'per_second') return 'per_second'
  return 'per_1m_token'
}

function draftFrom(record: ChannelModelPricingRecord): EditDraft {
  const internal = record.internal
  return {
    mode: modeFromInternal(internal?.mode),
    input: internal?.input_per_million_usd?.toString() ?? '',
    output: internal?.output_per_million_usd?.toString() ?? '',
    cache: internal?.cache_per_million_usd?.toString() ?? '',
    cacheWrite: internal?.create_cache_per_million_usd?.toString() ?? '',
    perCall: internal?.per_call_usd?.toString() ?? '',
    perSecond: internal?.per_second_usd?.toString() ?? '',
    note: internal?.note ?? '',
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
}

function pricingRuleLabel(
  internal: NonNullable<ChannelModelPricingRecord['internal']>,
  t: (key: string, options?: Record<string, unknown>) => string
) {
  if (internal.source === 'dreamrouter-discount') {
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
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<ChannelModelPricingRecord | null>(null)
  const [draft, setDraft] = useState<EditDraft | null>(null)

  const listQuery = useQuery({
    queryKey: ['channel-model-pricing', props.channelId],
    queryFn: () => getChannelModelPricing(props.channelId),
    enabled: props.channelId > 0,
    retry: false,
    meta: { errorToast: false },
  })

  const items = useMemo(
    () => listQuery.data?.data?.items ?? [],
    [listQuery.data]
  )
  const summary = useMemo(() => {
    let configured = 0
    let review = 0
    for (const item of items) {
      if (item.pricing_status === 'configured') configured++
      if (item.pricing_status === 'needs_review') review++
    }
    return {
      configured,
      review,
      officialOnly: items.length - configured - review,
    }
  }, [items])

  const save = useMutation({
    mutationFn: async () => {
      if (!editing || !draft) throw new Error('No pricing record selected')
      const pricing: ChannelInternalPricingView = {
        mode: draft.mode,
        note: draft.note.trim() || undefined,
        updated_at: Math.floor(Date.now() / 1000),
      }
      if (draft.mode === 'per_call') {
        pricing.per_call_usd = parsePrice(draft.perCall)
      } else if (draft.mode === 'per_second') {
        pricing.per_second_usd = parsePrice(draft.perSecond)
      } else {
        pricing.input_per_million_usd = parsePrice(draft.input)
        pricing.output_per_million_usd = parsePrice(draft.output)
        pricing.cache_per_million_usd = parsePrice(draft.cache)
        pricing.create_cache_per_million_usd = parsePrice(draft.cacheWrite)
      }
      return setChannelModelPricing(
        props.channelId,
        editing.model_name,
        pricing
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
    if (item.internal.mode === 'per_second') {
      return t('{{price}} / second', {
        price: formatUsd(item.internal.per_second_usd),
      })
    }
    if (item.internal.mode === 'per_call') {
      return formatUsd(item.internal.per_call_usd)
    }
    return `${formatUsd(item.internal.input_per_million_usd)} / ${formatUsd(item.internal.output_per_million_usd)}`
  }

  const upstreamQuoteLabel = (item: ChannelModelPricingRecord) => {
    const quote = item.upstream_quote
    if (!quote) return t('Not available')
    if (
      quote.unit === 'per_call' ||
      quote.unit === 'per_second' ||
      quote.unit === 'per_image' ||
      quote.unit === 'per_minute'
    ) {
      return formatUsd(quote.per_call_usd)
    }
    return `${formatUsd(quote.input_per_million_usd)} / ${formatUsd(quote.output_per_million_usd)}`
  }

  const officialPriceLabel = (item: ChannelModelPricingRecord) => {
    const tier = item.official?.tiers?.[0]
    if (!tier) return t('Not available')
    if (tier.unit === 'per_call') {
      return `${formatUsd(tier.per_unit_usd)} · ${t('Per call')}`
    }
    if (tier.unit === 'per_second') {
      return `${formatUsd(tier.per_unit_usd)} · ${t('Per second')}`
    }
    return `${formatUsd(tier.input_per_million_usd)} / ${formatUsd(tier.output_per_million_usd)}`
  }

  const renderPricingList = () => {
    if (listQuery.isLoading) {
      return <p className='text-muted-foreground text-sm'>{t('Loading...')}</p>
    }
    if (items.length === 0) {
      return (
        <p className='text-muted-foreground text-sm'>
          {t(
            'No channel pricing records yet. Sync the official catalog first.'
          )}
        </p>
      )
    }
    return (
      <div className='max-h-80 overflow-y-auto rounded-md border'>
        {items.map((item) => {
          return (
            <div
              key={item.model_name}
              className='space-y-1.5 border-b px-3 py-2.5 text-sm last:border-b-0'
            >
              <div className='flex flex-wrap items-center gap-2'>
                <span className='font-mono font-medium break-words'>
                  {item.model_name}
                </span>
                <Badge variant={statusVariant(item.pricing_status)}>
                  {t(item.pricing_status)}
                </Badge>
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
                <span>
                  {t('Upstream channel price')}: {upstreamQuoteLabel(item)}
                  {item.upstream_quote ? (
                    <Badge variant='outline' className='ml-1 font-normal'>
                      {t(item.upstream_quote.price_basis)}
                    </Badge>
                  ) : null}
                  {item.upstream_quote?.discount_ratio ? (
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
              </div>

              <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
                <span>
                  {t('Uter sale price')}: {internalPriceLabel(item)}
                </span>
                <span className='text-muted-foreground'>
                  {t('Pricing rule')}:{' '}
                  {item.internal
                    ? pricingRuleLabel(item.internal, t)
                    : t('No rule')}
                </span>
                {item.internal?.mode === 'per_second' ? null : (
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
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

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
        <span className='text-muted-foreground text-sm'>
          {t(
            '{{total}} models · {{configured}} configured · {{review}} review',
            {
              total: items.length,
              configured: summary.configured,
              review: summary.review,
            }
          )}
        </span>
      </div>

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
                            value === 'per_call' || value === 'per_second'
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
                </SelectContent>
              </Select>
            </div>
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
            {draft.mode !== 'per_call' && draft.mode !== 'per_second' && (
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
