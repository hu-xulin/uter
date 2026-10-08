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
import { CheckSquare, RefreshCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import {
  buildPricingChanges,
  getModelPricing,
  saveModelPricing,
  invalidateModelPricing,
  type ModelPricingConfig,
} from '@/features/model-pricing/api'
import { applyPriceSyncSelections } from '@/features/model-pricing/pricing'
import { handleServerError } from '@/lib/handle-server-error'
import {
  requireServerSuccess,
  createServerError,
} from '@/lib/server-error-message'

import {
  fetchUpstreamRatios,
  getSystemOptions,
  getUpstreamChannels,
} from '../api'
import type {
  DifferencesMap,
  PricingSyncModels,
  PricingSyncValues,
  UpstreamChannel,
  UpstreamConfig,
} from '../types'
import { ChannelSelectorDialog } from './channel-selector-dialog'
import {
  ConflictConfirmDialog,
  type ConflictItem,
} from './conflict-confirm-dialog'
import {
  DEFAULT_ENDPOINT,
  MODELS_DEV_PRESET_ENDPOINT,
  MODELS_DEV_PRESET_ID,
  OFFICIAL_CHANNEL_ENDPOINT,
  OFFICIAL_CHANNEL_ID,
  OPENROUTER_CHANNEL_TYPE,
  OPENROUTER_ENDPOINT,
} from './constants'
import {
  describeSyncPrice,
  getUpstreamDisplayName,
  type PricingSourceSelection,
  type PricingSourceSelections,
} from './upstream-ratio-sync-helpers'
import { UpstreamRatioSyncTable } from './upstream-ratio-sync-table'

function getDefaultEndpointForChannel(channel: UpstreamChannel): string {
  if (channel.id === MODELS_DEV_PRESET_ID) return MODELS_DEV_PRESET_ENDPOINT
  if (channel.id === OFFICIAL_CHANNEL_ID) return OFFICIAL_CHANNEL_ENDPOINT
  if (channel.type === OPENROUTER_CHANNEL_TYPE) return OPENROUTER_ENDPOINT
  return DEFAULT_ENDPOINT
}

// ----------------------------------------------------------------------------
// Channel price source
//
// The operator can also price models through the "Channel Pricing" billing
// setting (a multiplier or an absolute price per channel+model). When syncing
// model prices we surface those configured prices as additional, selectable
// sources named "Channel price · #{id}". They are derived from the current
// model price (fetched upstream) so the operator can pick Official price OR
// their own channel price per model and apply it.
// ----------------------------------------------------------------------------

const CHANNEL_PRICE_NUMERIC_FIELDS = [
  'model_ratio',
  'completion_ratio',
  'cache_ratio',
  'create_cache_ratio',
  'image_ratio',
  'audio_ratio',
  'audio_completion_ratio',
  'model_price',
] as const

type ChannelPriceRule = { mode: string; value: number }

/**
 * Apply a single channel-price rule to the current model pricing and return the
 * resulting pricing values, or null when it can't be derived (e.g. the current
 * model uses an expression, or the rule is malformed).
 *
 * - ratio mode multiplies every numeric price field (mirrors what billing does
 *   at request time).
 * - price mode sets an absolute price: for token models the input price is
 *   `value` USD / 1M tokens, which maps to model_ratio = value / 2 (new-api's
 *   $2-per-1M baseline), and the other ratios are scaled by the same factor to
 *   preserve their relationship; for request models model_price is set.
 */
function applyChannelRuleToCurrent(
  current: PricingSyncValues,
  rule: ChannelPriceRule
): PricingSyncValues | null {
  if (typeof current.billing_expr === 'string' && current.billing_expr.trim()) {
    // Expression-mode prices can't be derived by scaling ratios.
    return null
  }
  const value = Number(rule.value)
  if (!Number.isFinite(value) || value < 0) return null
  const next: PricingSyncValues = { ...current }
  if (rule.mode === 'ratio') {
    for (const field of CHANNEL_PRICE_NUMERIC_FIELDS) {
      const existing = current[field]
      if (typeof existing === 'number') next[field] = existing * value
    }
    return next
  }
  if (rule.mode === 'price') {
    if (typeof current.model_ratio === 'number') {
      const factor = value / 2 / current.model_ratio
      for (const field of CHANNEL_PRICE_NUMERIC_FIELDS) {
        const existing = current[field]
        if (typeof existing === 'number') next[field] = existing * factor
      }
      return next
    }
    if (typeof current.model_price === 'number') {
      next.model_price = value
      for (const field of CHANNEL_PRICE_NUMERIC_FIELDS) {
        if (field !== 'model_price') delete next[field]
      }
      return next
    }
    return null
  }
  return null
}

/**
 * Fold every configured "Channel price" source into the fetched price table so
 * each appears as an additional selectable column beside the official / preset
 * sources. Models without a matching channel rule are left untouched.
 */
function mergeChannelPrices(
  prices: PricingSyncModels,
  sources: { sourceName: string; byModel: Record<string, ChannelPriceRule> }[]
): PricingSyncModels {
  if (!sources.length) return prices
  const next: PricingSyncModels = {}
  for (const [model, row] of Object.entries(prices)) {
    const upstreams: Record<string, PricingSyncValues> = { ...row.upstreams }
    let changed = false
    for (const src of sources) {
      const rule = src.byModel[model]
      if (!rule) continue
      const derived = applyChannelRuleToCurrent(row.current, rule)
      if (!derived) continue
      upstreams[src.sourceName] = derived
      changed = true
    }
    next[model] = changed ? { current: row.current, upstreams } : row
  }
  return next
}

export function UpstreamRatioSync() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [pricingBaseline, setPricingBaseline] =
    useState<ModelPricingConfig | null>(null)
  const [channelDialogOpen, setChannelDialogOpen] = useState(false)
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [selectedChannelIds, setSelectedChannelIds] = useState<number[]>([])
  const [channelEndpoints, setChannelEndpoints] = useState<
    Record<number, string>
  >({})
  const [differences, setDifferences] = useState<DifferencesMap>({})
  const [prices, setPrices] = useState<PricingSyncModels>({})
  const [selectedSources, setSelectedSources] =
    useState<PricingSourceSelections>({})
  const [conflictItems, setConflictItems] = useState<ConflictItem[]>([])
  const [loadingBaseline, setLoadingBaseline] = useState(false)
  const { data: channelsData } = useQuery({
    queryKey: ['upstream-channels'],
    queryFn: async () => requireServerSuccess(await getUpstreamChannels()),
    enabled: true,
  })
  const channels = useMemo(() => channelsData?.data ?? [], [channelsData?.data])
  const { data: optionsRes } = useQuery({
    queryKey: ['system-options-channel-price'],
    queryFn: () => getSystemOptions(),
    staleTime: 60_000,
  })
  const channelPriceSetting = useMemo(() => {
    const arr = optionsRes?.data
    if (!Array.isArray(arr)) return undefined
    return arr.find((option) => option.key === 'ChannelPriceSetting')?.value
  }, [optionsRes])
  // Channels that have a configured Channel Pricing override become selectable
  // "Channel price" sources in the table.
  const channelPriceSources = useMemo(() => {
    if (!channelPriceSetting) return []
    let parsed: {
      enabled?: boolean
      channels?: Record<
        string,
        { enabled?: boolean; models?: Record<string, ChannelPriceRule> }
      >
    }
    try {
      parsed = JSON.parse(channelPriceSetting)
    } catch {
      return []
    }
    if (parsed.enabled !== true) return []
    const nameById = new Map(
      channels.map((channel) => [String(channel.id), channel.name])
    )
    const out: {
      sourceName: string
      byModel: Record<string, ChannelPriceRule>
    }[] = []
    for (const [channelId, config] of Object.entries(parsed.channels ?? {})) {
      if (!config || config.enabled === false) continue
      const byModel: Record<string, ChannelPriceRule> = {}
      for (const [model, rule] of Object.entries(config.models ?? {})) {
        if (!model || !rule) continue
        byModel[model] = rule
      }
      if (Object.keys(byModel).length) {
        out.push({
          sourceName:
            `${t('Channel price source')} · #${channelId} ${nameById.get(channelId) ?? ''}`.trim(),
          byModel,
        })
      }
    }
    return out
  }, [channelPriceSetting, channels, t])

  // Keep the latest channel price sources available inside the fetch mutation
  // callback without re-creating the mutation whenever they change.
  const channelPriceSourcesRef = useRef(channelPriceSources)
  channelPriceSourcesRef.current = channelPriceSources
  useEffect(() => {
    if (!channels.length) return
    setChannelEndpoints((previous) => {
      const next = { ...previous }
      for (const channel of channels) {
        next[channel.id] ??= getDefaultEndpointForChannel(channel)
      }
      return next
    })
  }, [channels])
  const resolutions = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(selectedSources).flatMap(([name, source]) => {
          const values = prices[name]?.upstreams[source]
          return values ? [[name, { ...values }]] : []
        })
      ) as Record<string, Record<string, number | string>>,
    [selectedSources, prices]
  )
  const fetchMutation = useMutation({
    mutationFn: async (request: Parameters<typeof fetchUpstreamRatios>[0]) => {
      const response = await fetchUpstreamRatios(request)
      if (!response.success || !response.data?.prices) {
        throw createServerError(response, t('Failed to fetch upstream prices'))
      }
      const results = response.data.test_results
      if (
        results.length &&
        results.every((result) => result.status === 'error')
      ) {
        throw new Error(
          results
            .map(
              (result) =>
                `${getUpstreamDisplayName(result.name, t)}: ${result.error}`
            )
            .join(', ')
        )
      }
      return response
    },
    onMutate: () => {
      setPrices({})
      setDifferences({})
      setSelectedSources({})
    },
    onSuccess: (response) => {
      const errors = response.data.test_results.filter(
        (result) => result.status === 'error'
      )
      if (errors.length) {
        toast.warning(
          t('Some channels failed: {{errorMsg}}', {
            errorMsg: errors
              .map(
                (result) =>
                  `${getUpstreamDisplayName(result.name, t)}: ${result.error}`
              )
              .join(', '),
          })
        )
      }
      setDifferences(response.data.differences)
      setPrices(
        mergeChannelPrices(response.data.prices, channelPriceSourcesRef.current)
      )
      if (!Object.keys(response.data.prices).length) {
        toast.success(t('No price differences found'))
      }
    },
    onError: (error: Error) =>
      handleServerError(error, t('Failed to fetch upstream prices')),
  })
  const syncMutation = useMutation({
    mutationFn: async (
      override?: Record<string, Record<string, number | string>>
    ) => {
      if (!pricingBaseline) throw new Error(t('Reload pricing'))
      const resolved = override ?? resolutions
      if (!Object.keys(resolved).length) {
        throw new Error(t('No price sources selected'))
      }
      const after = applyPriceSyncSelections(pricingBaseline.options, resolved)
      await saveModelPricing(
        buildPricingChanges(pricingBaseline, pricingBaseline.options, after)
      )
      return resolved
    },
    onSuccess: async (saved) => {
      setPrices((previous) =>
        Object.fromEntries(
          Object.entries(previous).map(([name, row]) => [
            name,
            { ...row, current: saved[name] ?? row.current },
          ])
        )
      )
      setSelectedSources({})
      setConflictDialogOpen(false)
      setPricingBaseline(null)
      toast.success(t('Prices synced successfully'))
      await invalidateModelPricing(queryClient)
      try {
        setPricingBaseline(await getModelPricing())
      } catch (error) {
        handleServerError(error, t('Reload pricing'))
      }
    },
    onError: (error: Error) =>
      handleServerError(error, t('Failed to sync prices')),
  })
  const handleConfirmChannelSelection = async (selectedIds: number[]) => {
    const selected = channels.filter((channel) =>
      selectedIds.includes(channel.id)
    )
    if (!selected.length) {
      toast.warning(t('Please select at least one channel'))
      return
    }
    const upstreams: UpstreamConfig[] = selected.map((channel) => ({
      id: channel.id,
      name: channel.name,
      base_url: channel.base_url,
      endpoint:
        channelEndpoints[channel.id] || getDefaultEndpointForChannel(channel),
    }))
    setLoadingBaseline(true)
    setPrices({})
    setDifferences({})
    fetchMutation.reset()
    setPricingBaseline(null)
    setSelectedSources({})
    syncMutation.reset()
    try {
      setPricingBaseline(await getModelPricing())
      fetchMutation.mutate({ upstreams, timeout: 10 })
    } catch (error) {
      handleServerError(error, t('Failed to load model pricing'))
    } finally {
      setLoadingBaseline(false)
    }
  }
  const handleSelectPrices = useCallback(
    (selections: PricingSourceSelection[]) => {
      setSelectedSources((previous) =>
        Object.fromEntries([
          ...Object.entries(previous),
          ...selections
            .filter(
              (selection) =>
                prices[selection.model]?.upstreams[selection.source]
            )
            .map((selection) => [selection.model, selection.source]),
        ])
      )
    },
    [prices]
  )
  const handleUnselectPrices = useCallback((models: string[]) => {
    setSelectedSources((previous) => {
      const next = { ...previous }
      for (const name of models) delete next[name]
      return next
    })
  }, [])
  const handleApplySync = () => {
    const previews: ConflictItem[] = Object.entries(selectedSources).flatMap(
      ([model, source]) => {
        const row = prices[model]
        const selected: PricingSyncValues | undefined = row?.upstreams[source]
        if (!row || !selected) return []
        return [
          {
            model,
            channel: getUpstreamDisplayName(source, t),
            current: describeSyncPrice(row.current, t),
            newVal: describeSyncPrice(selected, t),
          },
        ]
      }
    )
    setConflictItems(previews)
    setConflictDialogOpen(true)
  }

  // One-click sync: resolve every model that has an upstream price to that
  // upstream value (overwriting local), then apply in a single transaction.
  // The "Channel price" derived sources are local overrides, not upstream
  // prices, so they are skipped; among the real upstream channels we prefer
  // the one the operator selected, falling back to the first available.
  const handleOneClickSync = useCallback(() => {
    if (!pricingBaseline) {
      toast.warning(t('Reload pricing'))
      return
    }
    if (!Object.keys(prices).length) {
      toast.warning(
        t('Please select price sources and fetch upstream prices first')
      )
      return
    }
    const channelPricePrefix = t('Channel price source')
    const selectedChannelNames = new Set(
      channels
        .filter((channel) => selectedChannelIds.includes(channel.id))
        .map((channel) => channel.name)
    )
    const newSelectedSources: Record<string, string> = {}
    const override: Record<string, Record<string, number | string>> = {}
    for (const [model, row] of Object.entries(prices)) {
      const realUpstreams = Object.keys(row.upstreams).filter(
        (source) => !source.startsWith(channelPricePrefix)
      )
      if (!realUpstreams.length) continue
      const chosen =
        realUpstreams.find((source) => selectedChannelNames.has(source)) ??
        realUpstreams[0]
      newSelectedSources[model] = chosen
      const values = row.upstreams[chosen]
      if (values) override[model] = { ...values }
    }
    if (!Object.keys(override).length) {
      toast.warning(t('No upstream prices available to sync'))
      return
    }
    setSelectedSources(newSelectedSources)
    syncMutation.mutate(override)
  }, [pricingBaseline, prices, channels, selectedChannelIds, t, syncMutation])
  const isLoading =
    loadingBaseline || fetchMutation.isPending || syncMutation.isPending
  return (
    <div className='flex h-full min-h-0 flex-col gap-3'>
      <div className='min-h-0 flex-1'>
        {fetchMutation.isError ? (
          <ErrorState
            description={fetchMutation.error.message}
            action={
              <Button
                variant='outline'
                onClick={() =>
                  void handleConfirmChannelSelection(selectedChannelIds)
                }
              >
                {t('Retry')}
              </Button>
            }
          />
        ) : (
          <UpstreamRatioSyncTable
            toolbar={
              <Button
                variant='outline'
                onClick={() => setChannelDialogOpen(true)}
                disabled={isLoading}
              >
                <RefreshCcw className='size-4' aria-hidden />
                {t('Select price sources')}
              </Button>
            }
            prices={prices}
            differences={differences}
            selectedSources={selectedSources}
            isDisabled={isLoading}
            isSyncing={fetchMutation.isPending || loadingBaseline}
            onSelectPrices={handleSelectPrices}
            onUnselectPrices={handleUnselectPrices}
          />
        )}
      </div>
      <div className='flex shrink-0 flex-wrap items-center justify-between gap-2 border-t pt-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-muted-foreground text-sm' role='status'>
            {t('{{count}} selected models', {
              count: Object.keys(selectedSources).length,
            })}
          </span>
          {Object.keys(selectedSources).length > 0 && (
            <Button
              variant='ghost'
              size='sm'
              disabled={isLoading}
              onClick={() => setSelectedSources({})}
            >
              {t('Clear selection')}
            </Button>
          )}
        </div>
        <Button
          variant='secondary'
          onClick={handleOneClickSync}
          disabled={
            !pricingBaseline || !Object.keys(prices).length || isLoading
          }
        >
          {t('One-click sync upstream prices')}
        </Button>
        <Button
          onClick={handleApplySync}
          disabled={
            !pricingBaseline ||
            !Object.keys(selectedSources).length ||
            isLoading
          }
        >
          <CheckSquare className='size-4' aria-hidden />
          {t('Apply Sync')}
        </Button>
      </div>
      <ChannelSelectorDialog
        open={channelDialogOpen}
        onOpenChange={setChannelDialogOpen}
        channels={channels}
        selectedChannelIds={selectedChannelIds}
        onSelectedChannelIdsChange={setSelectedChannelIds}
        channelEndpoints={channelEndpoints}
        onChannelEndpointsChange={setChannelEndpoints}
        onConfirm={handleConfirmChannelSelection}
      />
      <ConflictConfirmDialog
        open={conflictDialogOpen}
        onOpenChange={(open) => {
          if (!syncMutation.isPending) setConflictDialogOpen(open)
        }}
        conflicts={conflictItems}
        onConfirm={() => syncMutation.mutate(undefined)}
        isLoading={syncMutation.isPending}
        error={syncMutation.error?.message}
        onReload={() => {
          setConflictDialogOpen(false)
          setSelectedSources({})
          setPrices({})
          setDifferences({})
          setPricingBaseline(null)
          syncMutation.reset()
          setChannelDialogOpen(true)
        }}
      />
    </div>
  )
}
