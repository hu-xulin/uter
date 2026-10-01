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

For commercial licensing, please contact support@Uter.ai.com
*/
import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { getCurrencyLabel } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import { useBillingTime } from '../hooks/use-billing-time'
import {
  getDynamicDisplayGroupRatio,
  getDynamicPriceUnitLabelKey,
  getDynamicPricingSummary,
  isUnconfiguredTaskUsageModel,
} from '../lib/dynamic-price'
import { isTokenBasedModel } from '../lib/model-helpers'
import { taskUsageUnitLabel } from '../lib/task-price-display'
import { PriceMetricOfficial } from './price-with-official'
import type { PricingModel, PriceType, TokenUnit } from '../types'

export type ModelPriceCellOptions = {
  tokenUnit?: TokenUnit
  priceRate?: number
  usdExchangeRate?: number
  showRechargePrice?: boolean
  selectedGroup?: string
  /** Per-model official reference ratios from the selected preset. */
  officialPrices?: Record<string, Record<string, number>>
  /**
   * Official preset USD prices keyed by visual variable (`p`, `c`, `cr`, ...).
   * When provided, dynamic (expression) pricing renders the Uter/official
   * columns dimension by dimension instead of the group-ratio footnote.
   */
  officialPricesByVariable?: Record<string, number | null>
  /**
   * Comparison layout when official preset prices are available:
   * - 'stacked' (default): each dimension is a column with the official
   *   price rendered underneath the Uter price (table cells).
   * - 'rows': a Uter price row above an aligned official price row
   *   (current-billing summary).
   */
  layout?: 'stacked' | 'rows'
}

export function ModelPriceCell(props: {
  model: PricingModel
  options?: ModelPriceCellOptions
  showExpression?: boolean
}) {
  const { t, i18n } = useTranslation()
  const currency = useSystemConfigStore((state) => state.config.currency)
  const currencyLabel =
    currency.quotaDisplayType === 'TOKENS' ? 'USD' : getCurrencyLabel()
  const options = props.options ?? {}
  const tokenUnit = options.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const tokenUnitLabel = tokenUnit === 'K' ? '1K' : '1M'
  const billingTime = useBillingTime(props.model.billing_expr)
  const dynamic = useMemo(
    () =>
      getDynamicPricingSummary(props.model, {
        priceRate: options.priceRate,
        usdExchangeRate: options.usdExchangeRate,
        showRechargePrice: options.showRechargePrice,
        now: billingTime === undefined ? undefined : new Date(billingTime),
        tokenUnit,
        showCurrencySymbol: false,
        groupRatioMultiplier: getDynamicDisplayGroupRatio(
          props.model,
          options.selectedGroup
        ),
      }),
    // Currency is read indirectly by the price formatter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      props.model,
      tokenUnit,
      options.priceRate,
      options.usdExchangeRate,
      options.showRechargePrice,
      options.selectedGroup,
      billingTime,
      currency,
    ]
  )
  const officialDynamic = useMemo(
    () =>
      getDynamicPricingSummary(props.model, {
        priceRate: options.priceRate,
        usdExchangeRate: options.usdExchangeRate,
        showRechargePrice: options.showRechargePrice,
        now: billingTime === undefined ? undefined : new Date(billingTime),
        tokenUnit,
        showCurrencySymbol: false,
        groupRatioMultiplier: 1,
      }),
    // Currency is read indirectly by the price formatter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      props.model,
      tokenUnit,
      options.priceRate,
      options.usdExchangeRate,
      options.showRechargePrice,
      options.selectedGroup,
      billingTime,
      currency,
    ]
  )
  let metrics: Array<{
    label: string
    value: string
    variableKey?: string
    rawValue?: number
  }> = []
  let priceNodes: ReactNode | null = null
  const providerCaption = dynamic?.providerCount
    ? t('{{count}} providers', { count: dynamic.providerCount })
    : ''
  const unconfiguredCaption = dynamic?.hasUnconfiguredProviders
    ? t('Not configured for some providers')
    : ''
  let caption = t('{{currency}} / {{unit}} tokens', {
    currency: currencyLabel,
    unit: tokenUnitLabel,
  })

  if (dynamic) {
    if (dynamic.isSpecialExpression) {
      return (
        <span className='block max-w-full min-w-0'>
          <span className='text-muted-foreground block truncate text-sm'>
            {t('Special billing expression')}
          </span>
          {providerCaption && (
            <span className='text-muted-foreground block text-xs'>
              {[providerCaption, unconfiguredCaption]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
          {props.showExpression !== false && (
            <code className='text-muted-foreground mt-1 line-clamp-2 block text-xs break-all whitespace-normal'>
              {dynamic.rawExpression}
            </code>
          )}
        </span>
      )
    }
    const allEntries = dynamic.entries
    const hasRequestPrice = allEntries.some(
      (entry) => entry.unit === 'request' || entry.unit === 'image'
    )
    metrics = allEntries
      .map((entry) => {
        const unit = getDynamicPriceUnitLabelKey(entry)
        const unitLabel = taskUsageUnitLabel(
          entry,
          i18n.language,
          unit ? t(unit) : ''
        )
        let suffix = unitLabel ? `/${unitLabel}` : ''
        if (entry.unit === 'token') {
          suffix = `/${t('{{unit}} tokens', { unit: tokenUnitLabel })}`
        }
        return {
          label:
            entry.labelKind === 'schema'
              ? entry.shortLabel
              : t(entry.shortLabel),
          value: `${entry.formattedRange ?? entry.formatted}${suffix}`,
          variableKey: entry.variable?.key,
          rawValue: entry.value,
        }
      })
    if (metrics.length === 0) {
      return (
        <span className='text-muted-foreground text-sm'>
          {dynamic.hasUnconfiguredProviders
            ? t('Not configured')
            : t('Dynamic Pricing')}
          {providerCaption && (
            <span className='block text-xs'>
              {[providerCaption, unconfiguredCaption]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </span>
      )
    }
    if (dynamic.isTaskUsage || hasRequestPrice) caption = currencyLabel
    if (dynamic.isTimePricing) caption += ` · ${t('Current period price')}`
    if (dynamic.isMixedBilling) {
      caption += ` · ${t('Token or per-call pricing')}`
    }
    if (providerCaption) caption += ` · ${providerCaption}`
    if (unconfiguredCaption) caption += ` · ${unconfiguredCaption}`
    if (dynamic.tierCount > 1) {
      caption += ` · ${t('{{count}} tiers', { count: dynamic.tierCount })}`
    }
  } else {
    if (isUnconfiguredTaskUsageModel(props.model)) {
      return (
        <span className='text-muted-foreground text-sm'>
          {t('Not configured')}
        </span>
      )
    }
    const tokenBased = isTokenBasedModel(props.model)
    if (
      !Number.isFinite(
        tokenBased ? props.model.model_ratio : props.model.model_price
      )
    ) {
      return (
        <span className='text-muted-foreground text-sm'>
          {t('Unset price')}
        </span>
      )
    }
    const officialPreset = options.officialPrices?.[props.model.model_name]
    if (tokenBased) {
      const m = props.model
      const hasRatio = (value?: number | null) =>
        typeof value === 'number' && Number.isFinite(value)
      const tokenDims: Array<{ type: PriceType; label: string }> = [
        { type: 'input', label: t('Input') },
        { type: 'output', label: t('Output') },
      ]
      if (hasRatio(m.cache_ratio)) {
        tokenDims.push({ type: 'cache', label: t('Cache Read') })
      }
      if (hasRatio(m.create_cache_ratio)) {
        tokenDims.push({ type: 'create_cache', label: t('Cache write') })
      }
      if (hasRatio(m.image_ratio)) {
        tokenDims.push({ type: 'image', label: t('Image input') })
      }
      if (hasRatio(m.audio_ratio)) {
        tokenDims.push({ type: 'audio_input', label: t('Audio input') })
      }
      if (hasRatio(m.audio_ratio) && hasRatio(m.audio_completion_ratio)) {
        tokenDims.push({ type: 'audio_output', label: t('Audio output') })
      }
      priceNodes = (
        <>
          {tokenDims.map((dim) => (
            <PriceMetricOfficial
              key={dim.type}
              model={m}
              type={dim.type}
              label={dim.label}
              unit={tokenUnitLabel}
              tokenUnit={tokenUnit}
              showRechargePrice={options.showRechargePrice}
              priceRate={options.priceRate}
              usdExchangeRate={options.usdExchangeRate}
              selectedGroup={options.selectedGroup}
              officialPreset={officialPreset}
            />
          ))}
        </>
      )
    } else {
      priceNodes = (
        <PriceMetricOfficial
          model={props.model}
          type='request'
          label={t('Per-request')}
          unit={t('request')}
          tokenUnit={tokenUnit}
          showRechargePrice={options.showRechargePrice}
          priceRate={options.priceRate}
          usdExchangeRate={options.usdExchangeRate}
          selectedGroup={options.selectedGroup}
          officialPreset={officialPreset}
        />
      )
      caption = `${currencyLabel} / ${t('request')}`
    }
  }
  const officialByVar = options.officialPricesByVariable
  const hasPresetOfficial =
    Boolean(officialByVar) &&
    metrics.some(
      (metric) =>
        metric.variableKey != null &&
        Number.isFinite(officialByVar?.[metric.variableKey])
    )
  const uterRowLabel = i18n.language?.startsWith('zh') ? '优特' : 'Uter'

  const officialText = (official: number | null | undefined) =>
    official != null && Number.isFinite(official)
      ? String(Number(official.toFixed(6)))
      : '—'

  const renderMetricGrid = () => {
    if (hasPresetOfficial && options.layout === 'rows') {
      // Two aligned rows: Uter prices on top, official prices below.
      return (
        <span
          className='grid min-w-0 items-baseline gap-x-4 gap-y-1'
          style={{
            gridTemplateColumns: `max-content repeat(${metrics.length}, minmax(56px, 1fr))`,
          }}
        >
          <span aria-hidden />
          {metrics.map((metric) => (
            <span
              key={`h-${metric.label}`}
              className='text-muted-foreground text-xs whitespace-nowrap'
              title={metric.label}
            >
              {metric.label}
            </span>
          ))}
          <span className='text-xs font-semibold whitespace-nowrap'>
            {uterRowLabel}
          </span>
          {metrics.map((metric) => (
            <span
              key={`u-${metric.label}`}
              className='text-sm font-semibold tabular-nums whitespace-nowrap'
              title={metric.value}
            >
              {metric.value}
            </span>
          ))}
          <span className='text-muted-foreground text-xs whitespace-nowrap'>
            {t('Official')}
          </span>
          {metrics.map((metric) => {
            const official =
              metric.variableKey != null
                ? officialByVar?.[metric.variableKey]
                : null
            const isDiscount =
              official != null &&
              Number.isFinite(official) &&
              official > 0 &&
              metric.rawValue != null &&
              Number.isFinite(metric.rawValue) &&
              metric.rawValue < official - 1e-9
            const discountPercent =
              isDiscount && official && metric.rawValue != null
                ? Math.round((1 - metric.rawValue / official) * 100)
                : 0
            return (
              <span
                key={`o-${metric.label}`}
                className='text-muted-foreground text-xs tabular-nums whitespace-nowrap'
                title={officialText(official)}
              >
                <span className={cn(isDiscount && 'line-through')}>
                  {officialText(official)}
                </span>
                {isDiscount && (
                  <span className='text-emerald-600 ml-1 font-bold'>
                    -{discountPercent}%
                  </span>
                )}
              </span>
            )
          })}
        </span>
      )
    }
    if (hasPresetOfficial) {
      return (
        <span className='grid grid-cols-2 gap-x-4 gap-y-2'>
          {metrics.map((metric) => {
            const official =
              metric.variableKey != null
                ? officialByVar?.[metric.variableKey]
                : null
            const isDiscount =
              official != null &&
              Number.isFinite(official) &&
              official > 0 &&
              metric.rawValue != null &&
              Number.isFinite(metric.rawValue) &&
              metric.rawValue < official - 1e-9
            const discountPercent =
              isDiscount && official && metric.rawValue != null
                ? Math.round((1 - metric.rawValue / official) * 100)
                : 0
            return (
              <span
                key={metric.label}
                className='flex min-w-0 flex-col gap-y-0.5'
              >
                <span
                  className='text-muted-foreground min-w-0 truncate text-xs font-normal'
                  title={metric.label}
                >
                  {metric.label}
                </span>
                <span
                  className='min-w-0 text-sm break-words whitespace-normal font-semibold tabular-nums'
                  title={metric.value}
                >
                  {metric.value}
                  {isDiscount && (
                    <span className='text-emerald-600 text-xs font-bold'>
                      {' '}
                      · -{discountPercent}%
                    </span>
                  )}
                </span>
                <span className='text-muted-foreground text-xs font-normal tabular-nums'>
                  {t('Official')}: {officialText(official)}
                </span>
              </span>
            )
          })}
        </span>
      )
    }
    return (
      <span
        className={metrics.length > 1 ? 'grid grid-cols-2 gap-x-4' : 'grid'}
      >
        {metrics.map((metric) => (
          <span
            key={metric.label}
            className='flex min-w-0 flex-col items-start gap-y-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-1.5'
          >
            <span
              className='text-muted-foreground min-w-0 truncate text-xs font-normal'
              title={metric.label}
            >
              {metric.label}
            </span>
            <span
              className='min-w-0 text-sm break-words whitespace-normal tabular-nums'
              title={metric.value}
            >
              {metric.value}
            </span>
          </span>
        ))}
      </span>
    )
  }
  return (
    <span className='block w-full max-w-full min-w-0 space-y-1.5'>
      {priceNodes ?? renderMetricGrid()}
      {officialDynamic?.entries.length && !hasPresetOfficial ? (
        <span className='text-muted-foreground block text-xs font-normal tabular-nums'>
          {t('Official')}:{' '}
          {officialDynamic.entries
            .map((e) =>
              e.labelKind === 'schema'
                ? `${e.shortLabel} ${e.formattedRange ?? e.formatted}`
                : `${t(e.shortLabel)} ${e.formattedRange ?? e.formatted}`
            )
            .join(' · ')}
        </span>
      ) : null}
      <span
        className='text-muted-foreground block text-xs font-normal break-words whitespace-normal sm:truncate'
        title={caption}
      >
        {caption}
      </span>
    </span>
  )
}
