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
import { ChevronRight } from 'lucide-react'
import { memo, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import type { VisualPrice } from '@/features/pricing/lib/billing-expression/visual'
import {
  officialRequestPriceUSD,
  officialTierVariablePriceUSD,
} from '@/features/system-settings/models/model-pricing-core'
import { getLobeIcon, resolveModelIconKey } from '@/lib/lobe-icon'
import { resolveLocalizedText } from '@/lib/localized-text'
import { cn } from '@/lib/utils'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import { useBillingTime } from '../hooks/use-billing-time'
import { getBillingModeLabelKey } from '../lib/billing-mode'
import {
  formatDynamicUnitPrice,
  formatTaskUsageUnitPrice,
  getCardExamplePrice,
  getDynamicDisplayGroupRatio,
  getDynamicPriceUnitLabelKey,
  getDynamicPricingSummary,
  isUnconfiguredTaskUsageModel,
  type DynamicPriceEntry,
} from '../lib/dynamic-price'
import { parseTags } from '../lib/filters'
import { getDisplayGroupRatio, isTokenBasedModel } from '../lib/model-helpers'
import {
  formatOfficialPrice,
  formatOfficialRequestPrice,
  formatPrice,
  formatRequestPrice,
  formatUSDRequestPrice,
  formatUSDTokenPrice,
  getOfficialPresetRequestUSD,
  getOfficialPresetTokenUSD,
  getTokenPriceUSD,
} from '../lib/price'
import { taskPriceLabel, taskUsageUnitLabel } from '../lib/task-price-display'
import type { PricingModel, PriceType, TokenUnit } from '../types'
import { DiscountTag } from './discount-tag'
import { ModelBillingModeBadge } from './model-billing-mode-badge'
import { ModelPerfBadge, type ModelPerfBadgeData } from './model-perf-badge'

export interface ModelCardProps {
  model: PricingModel
  onClick: (modelName: string) => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  selectedGroup?: string
  perf?: ModelPerfBadgeData
  /** Selected plaza pricing source (official / models.dev / channel). */
  pricingSource?: string
  /** Per-model official reference ratios from the selected preset. */
  officialPrices?: Record<string, Record<string, number>>
  /** Whether the viewer is a super administrator (affects source label). */
  isSuperAdmin?: boolean
}

export const ModelCard = memo(function ModelCard(props: ModelCardProps) {
  const { t, i18n } = useTranslation()
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const priceRate = props.priceRate ?? 1
  const usdExchangeRate = props.usdExchangeRate ?? 1
  const showRechargePrice = props.showRechargePrice ?? false
  const isTokenBased = isTokenBasedModel(props.model)
  const tokenUnitLabel = tokenUnit === 'K' ? '1K' : '1M'
  const billingMode = getBillingModeLabelKey(props.model)
  const tokenUnitSuffix = `${tokenUnitLabel} Tokens`
  // Only token-priced modes (dynamic & token-based) append the
  // "/ 1M Tokens" unit suffix to the billing-mode badge.
  const showTokenSuffix =
    billingMode === 'Dynamic Pricing' || billingMode === 'Token-based'
  const tags = parseTags(props.model.tags)
  // 描述优先取全语种副本按当前界面语言本地解析，这样切换语言立即生效，
  // 不必为每种语言重新请求定价接口；没有副本时才用后端已解析好的单值。
  const localizedDescription = resolveLocalizedText(
    props.model.descriptions,
    i18n.language
  )
  const groups = props.model.enable_groups || []
  const endpoints = props.model.supported_endpoint_types || []
  const modelIconKey = resolveModelIconKey(
    props.model.icon,
    props.model.vendor_icon
  )
  // Model logos render in their brand colors so cards stay scannable at a
  // glance; a vendor's company logo standing in for a model stays monochrome.
  const modelIcon = modelIconKey
    ? getLobeIcon(modelIconKey, 28)
    : null
  const initial = props.model.model_name?.charAt(0).toUpperCase() || '?'
  const isUnconfiguredTaskUsage = isUnconfiguredTaskUsageModel(props.model)
  const billingTime = useBillingTime(props.model.billing_expr)
  const currency = useSystemConfigStore((state) => state.config.currency)
  const dynamicPriceOptions = useMemo(
    () => ({
      now: billingTime === undefined ? undefined : new Date(billingTime),
      tokenUnit,
      showRechargePrice,
      priceRate,
      usdExchangeRate,
      groupRatioMultiplier: getDynamicDisplayGroupRatio(
        props.model,
        props.selectedGroup
      ),
    }),
    [
      props.model,
      props.selectedGroup,
      billingTime,
      tokenUnit,
      showRechargePrice,
      priceRate,
      usdExchangeRate,
    ]
  )
  const dynamicSummary = useMemo(
    () => getDynamicPricingSummary(props.model, dynamicPriceOptions),
    // Currency is read indirectly by the price formatter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.model, dynamicPriceOptions, currency]
  )
  const officialSummary = useMemo(
    () =>
      getDynamicPricingSummary(props.model, {
        ...dynamicPriceOptions,
        groupRatioMultiplier: 1,
      }),
    // Currency is read indirectly by the price formatter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.model, dynamicPriceOptions, currency]
  )
  const cardExamplePrice = useMemo(
    () => getCardExamplePrice(props.model, dynamicPriceOptions),
    // Currency is read indirectly by the price formatter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.model, dynamicPriceOptions, currency]
  )
  // Official preset entry (官方价格) from the selected pricing preset. The
  // platform's own price data may carry an admin-applied discount baked into
  // model_ratio / billing_expr, so the "official" row must derive from the
  // preset's ratio fields — never from the platform's own prices.
  const officialRatios = props.officialPrices?.[props.model.model_name]
  const officialFormatOptions = useMemo(
    () => ({ ...dynamicPriceOptions, groupRatioMultiplier: 1 }),
    [dynamicPriceOptions]
  )
  /**
   * Official preset USD price behind a dynamic pricing entry, or null when
   * the preset has no counterpart for that dimension (the official cell then
   * renders "—" instead of the platform's own discounted price).
   */
  const presetOfficialUSDFor = (
    entry: DynamicPriceEntry
  ): { usd: number; perRequest: boolean } | null => {
    if (!officialRatios) return null
    if (entry.unit === 'request' || entry.unit === 'image') {
      if (entry.key !== 'fixed' && entry.key !== 'modelPrice') return null
      const requestUSD = officialRequestPriceUSD(officialRatios)
      return requestUSD != null ? { usd: requestUSD, perRequest: true } : null
    }
    const usd = officialTierVariablePriceUSD(
      officialRatios,
      entry.key as VisualPrice['variable']
    )
    return usd != null ? { usd, perRequest: false } : null
  }
  let priceSummary: ReactNode
  if (dynamicSummary) {
    if (dynamicSummary.isSpecialExpression) {
      priceSummary = (
        <div className='col-span-full min-w-0'>
          <span className='text-warning'>
            {t('Special billing expression')}
          </span>
          <code className='text-muted-foreground mt-1 line-clamp-2 block font-mono text-xs break-all'>
            {dynamicSummary.rawExpression}
          </code>
        </div>
      )
    } else if (dynamicSummary.entries.length > 0) {
      const dims = dynamicSummary.entries
      const groupRatio = getDisplayGroupRatio(props.model, props.selectedGroup)
      const isDiscount = groupRatio > 0 && groupRatio < 1
      const discountPercent = isDiscount
        ? Math.round((1 - groupRatio) * 100)
        : 0
      const uterLabel = i18n.language?.startsWith('zh') ? '优特' : 'Uter'
      const officialEntries = officialSummary?.entries ?? []
      const getLabel = (e: DynamicPriceEntry): ReactNode =>
        e.labelKind !== 'schema'
          ? t(e.shortLabel)
          : taskPriceLabel(e.description, e.shortLabel, i18n.language)
      const officialFor = (key: string) =>
        officialEntries.find((e) => e.key === key)
      // 每个价格维度自带计费单位（1K/1M token、request、usage 单位…），
      // 与上游 model-card 的 entry 级 unit label 保持一致：价格与单位相邻渲染。
      const unitLabelFor = (entry: DynamicPriceEntry): string => {
        const unitLabelKey = getDynamicPriceUnitLabelKey(entry)
        return taskUsageUnitLabel(
          entry,
          i18n.language,
          unitLabelKey ? t(unitLabelKey) : tokenUnitLabel
        )
      }
      priceSummary = (
        <>
          <div
            className='col-span-full grid min-w-0 items-baseline gap-x-4 gap-y-1.5'
            style={{
              gridTemplateColumns: `max-content repeat(${dims.length}, minmax(64px, 1fr))`,
            }}
          >
            <span aria-hidden />
            {dims.map((entry) => (
              <span
                key={`h-${entry.key}`}
                className='text-muted-foreground text-xs whitespace-nowrap'
              >
                {getLabel(entry)}
              </span>
            ))}
            <span className='text-xs font-semibold whitespace-nowrap'>
              {uterLabel}
            </span>
            {dims.map((entry) => (
              <span
                key={`u-${entry.key}`}
                className='text-sm font-semibold tabular-nums'
              >
                {entry.formattedRange ?? entry.formatted}
              </span>
            ))}
            <span className='text-muted-foreground text-xs whitespace-nowrap'>
              {t('Official')}
            </span>
            {dims.map((entry) => {
              const preset = presetOfficialUSDFor(entry)
              if (preset) {
                const offText = preset.perRequest
                  ? formatTaskUsageUnitPrice(preset.usd, officialFormatOptions)
                  : formatDynamicUnitPrice(preset.usd, officialFormatOptions)
                const uterUSD =
                  entry.value * (dynamicPriceOptions.groupRatioMultiplier ?? 1)
                const dimDiscount =
                  Number.isFinite(uterUSD) &&
                  uterUSD > 0 &&
                  uterUSD < preset.usd - 1e-9
                const dimPercent = dimDiscount
                  ? Math.round((1 - uterUSD / preset.usd) * 100)
                  : 0
                return (
                  <span
                    key={`o-${entry.key}`}
                    className='text-muted-foreground text-xs whitespace-nowrap tabular-nums'
                  >
                    <span className={cn(dimDiscount && 'line-through')}>
                      {offText}
                    </span>
                    <span className='font-normal'>
                      {' '}
                      / {unitLabelFor(entry)}
                    </span>
                    {dimDiscount && (
                      <span className='ml-1 font-bold text-emerald-600'>
                        -{dimPercent}%
                      </span>
                    )}
                  </span>
                )
              }
              if (officialRatios) {
                // Preset exists but has no counterpart for this dimension —
                // never fall back to the platform's own (discounted) price.
                return (
                  <span
                    key={`o-${entry.key}`}
                    className='text-muted-foreground text-xs whitespace-nowrap tabular-nums'
                  >
                    -
                  </span>
                )
              }
              const off = officialFor(entry.key)
              const offText = off ? (off.formattedRange ?? off.formatted) : '-'
              return (
                <span
                  key={`o-${entry.key}`}
                  className='text-muted-foreground text-xs whitespace-nowrap tabular-nums'
                >
                  <span className={cn(isDiscount && 'line-through')}>
                    {offText}
                  </span>
                  {off && (
                    <span className='font-normal'>
                      {' '}
                      / {unitLabelFor(entry)}
                    </span>
                  )}
                  {isDiscount && (
                    <span className='ml-1 font-bold text-emerald-600'>
                      -{discountPercent}%
                    </span>
                  )}
                </span>
              )
            })}
          </div>
          {dynamicSummary.isTimePricing && (
            <span className='text-muted-foreground col-span-full text-xs'>
              {t('Current period price')}
            </span>
          )}
          {dynamicSummary.isMixedBilling && (
            <span className='text-muted-foreground col-span-full text-xs'>
              {t('Token or per-call pricing')}
            </span>
          )}
          {cardExamplePrice && (
            <span className='text-muted-foreground col-span-full text-xs break-words'>
              {cardExamplePrice.label} ≈ {cardExamplePrice.formatted}
            </span>
          )}
          {dynamicSummary.isTaskUsage &&
            dynamicSummary.tier?.label &&
            !dynamicSummary.primaryEntries.some(
              (entry) => entry.formattedRange
            ) && (
              <span className='text-muted-foreground col-span-full text-xs break-words'>
                ({dynamicSummary.tier.label})
              </span>
            )}
        </>
      )
    } else {
      priceSummary = (
        <span className='text-muted-foreground col-span-full'>
          {dynamicSummary.hasUnconfiguredProviders
            ? t('Usage-based billing · price not configured')
            : t('Dynamic Pricing')}
        </span>
      )
    }
  } else if (isUnconfiguredTaskUsage) {
    priceSummary = (
      <span className='text-muted-foreground col-span-full'>
        {t('Usage-based billing · price not configured')}
      </span>
    )
  } else if (isTokenBased) {
    const displayRatio = getDisplayGroupRatio(props.model, props.selectedGroup)
    const dimTypes: { type: PriceType; label: string }[] = [
      { type: 'input', label: t('Input') },
      { type: 'output', label: t('Output') },
      { type: 'cache', label: t('Cache Read') },
      { type: 'create_cache', label: t('Cache Write') },
      { type: 'image', label: t('Image') },
      { type: 'audio_input', label: t('Audio Input') },
      { type: 'audio_output', label: t('Audio Output') },
    ]
    const dims = dimTypes
      .map(({ type, label }) => {
        const uterVal = getTokenPriceUSD(props.model, type, displayRatio)
        // Official list price comes from the pricing preset when available;
        // the platform's own ratios may carry the admin discount.
        const presetUSD = getOfficialPresetTokenUSD(officialRatios, type)
        const hasPresetUSD = Number.isFinite(presetUSD)
        const officialVal = hasPresetUSD
          ? presetUSD
          : getTokenPriceUSD(props.model, type, 1)
        if (!Number.isFinite(uterVal) && !Number.isFinite(officialVal)) {
          return null
        }
        const isDiscount =
          Number.isFinite(uterVal) &&
          Number.isFinite(officialVal) &&
          officialVal > 0 &&
          uterVal < officialVal - 1e-12
        const percent = isDiscount
          ? Math.round((1 - uterVal / officialVal) * 100)
          : 0
        return {
          type,
          label,
          uter: formatPrice(
            props.model,
            type,
            tokenUnit,
            showRechargePrice,
            priceRate,
            usdExchangeRate,
            props.selectedGroup
          ),
          official: hasPresetUSD
            ? formatUSDTokenPrice(
                presetUSD,
                tokenUnit,
                showRechargePrice,
                priceRate,
                usdExchangeRate
              )
            : formatOfficialPrice(
                props.model,
                type,
                tokenUnit,
                showRechargePrice,
                priceRate,
                usdExchangeRate
              ),
          isDiscount,
          percent,
        }
      })
      .filter((d) => d != null)
    priceSummary = dims.length > 0 && (
      <div
        className='grid min-w-0 items-baseline gap-x-4 gap-y-1.5'
        style={{
          gridTemplateColumns: `max-content repeat(${dims.length}, minmax(64px, 1fr))`,
        }}
      >
        <span aria-hidden />
        {dims.map((d) => (
          <span
            key={`h-${d.type}`}
            className='text-muted-foreground text-xs whitespace-nowrap'
          >
            {d.label}
          </span>
        ))}
        <span className='text-xs font-semibold whitespace-nowrap'>
          {i18n.language?.startsWith('zh') ? '优特' : 'Uter'}
        </span>
        {dims.map((d) => (
          <span
            key={`u-${d.type}`}
            className='text-sm font-semibold tabular-nums'
          >
            {d.uter}
          </span>
        ))}
        <span className='text-muted-foreground text-xs whitespace-nowrap'>
          {t('Official')}
        </span>
        {dims.map((d) => (
          <span
            key={`o-${d.type}`}
            className='text-muted-foreground text-xs whitespace-nowrap tabular-nums'
          >
            <span className={cn(d.isDiscount && 'line-through')}>
              {d.official}
            </span>
            {d.isDiscount && (
              <span className='ml-1 font-bold text-emerald-600'>
                -{d.percent}%
              </span>
            )}
          </span>
        ))}
      </div>
    )
  } else {
    // Per-request (and non-dynamic task-usage) billing: a single "Per-request"
    // dimension compared against the official list price, using the same
    // 优特/官方 grid as the token & dynamic cards.
    const displayRatio = getDisplayGroupRatio(props.model, props.selectedGroup)
    const uterVal = (props.model.model_price || 0) * displayRatio
    const presetRequestUSD = getOfficialPresetRequestUSD(officialRatios)
    const hasPresetRequest = Number.isFinite(presetRequestUSD)
    const officialVal = hasPresetRequest
      ? presetRequestUSD
      : props.model.model_price || 0
    const isDiscount =
      Number.isFinite(uterVal) &&
      Number.isFinite(officialVal) &&
      officialVal > 0 &&
      uterVal < officialVal - 1e-12
    const percent = isDiscount
      ? Math.round((1 - uterVal / officialVal) * 100)
      : 0
    const uterLabel = i18n.language?.startsWith('zh') ? '优特' : 'Uter'
    const dims = [
      {
        key: 'request',
        label: t('Per-request'),
        uter: formatRequestPrice(
          props.model,
          showRechargePrice,
          priceRate,
          usdExchangeRate,
          props.selectedGroup
        ),
        official: hasPresetRequest
          ? formatUSDRequestPrice(
              presetRequestUSD,
              showRechargePrice,
              priceRate,
              usdExchangeRate
            )
          : formatOfficialRequestPrice(
              props.model,
              showRechargePrice,
              priceRate,
              usdExchangeRate
            ),
        isDiscount,
        percent,
      },
    ]
    priceSummary = (
      <div
        className='grid min-w-0 items-baseline gap-x-4 gap-y-1.5'
        style={{
          gridTemplateColumns: `max-content repeat(${dims.length}, minmax(64px, 1fr))`,
        }}
      >
        <span aria-hidden />
        {dims.map((d) => (
          <span
            key={`h-${d.key}`}
            className='text-muted-foreground text-xs whitespace-nowrap'
          >
            {d.label}
          </span>
        ))}
        <span className='text-xs font-semibold whitespace-nowrap'>
          {uterLabel}
        </span>
        {dims.map((d) => (
          <span
            key={`u-${d.key}`}
            className='text-sm font-semibold tabular-nums'
          >
            {d.uter}
          </span>
        ))}
        <span className='text-muted-foreground text-xs whitespace-nowrap'>
          {t('Official')}
        </span>
        {dims.map((d) => (
          <span
            key={`o-${d.key}`}
            className='text-muted-foreground text-xs whitespace-nowrap tabular-nums'
          >
            <span className={cn(d.isDiscount && 'line-through')}>
              {d.official}
            </span>
            {d.isDiscount && (
              <span className='ml-1 font-bold text-emerald-600'>
                -{d.percent}%
              </span>
            )}
          </span>
        ))}
      </div>
    )
  }

  return (
    <Card className='hover:ring-foreground/20 h-full min-w-0 gap-3 transition-colors'>
      <CardHeader className='flex flex-row items-start gap-3'>
        <div
          aria-hidden
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg',
            // Colored brand logos sit on their own artwork; the muted tile is
            // only needed behind the initial-letter fallback.
            !modelIcon && 'bg-muted/50'
          )}
        >
          {modelIcon || (
            <span className='text-muted-foreground text-sm font-bold'>
              {initial}
            </span>
          )}
        </div>
        <div className='min-w-0 flex-1'>
          <h3
            className='line-clamp-2 font-mono text-[0.8125rem] leading-snug font-semibold [overflow-wrap:anywhere]'
            title={props.model.model_name}
          >
            {props.model.model_name}
            <DiscountTag
              model={props.model}
              officialPrices={props.officialPrices}
              selectedGroup={props.selectedGroup}
              className='ml-1.5 align-middle'
            />
          </h3>
          {props.model.vendor_name && (
            <p
              className='text-muted-foreground mt-1 truncate text-xs'
              title={props.model.vendor_name}
            >
              {props.model.vendor_name}
            </p>
          )}
        </div>
        <CopyButton
          value={props.model.model_name}
          tooltip={t('Copy model name')}
          className='size-7'
          iconClassName='size-3.5'
        />
      </CardHeader>
      <CardContent className='flex flex-1 flex-col gap-3'>
        <div className='flex min-w-0 flex-col gap-1.5'>
          <p className='text-muted-foreground line-clamp-2 text-sm leading-5 break-words'>
            {/* 回退链必须包含后端已解析好的单值：只有 description、尚无
                多语副本的历史模型全靠它显示，否则会误报「暂无描述」。 */}
            {localizedDescription ||
              props.model.description ||
              t('No description available.')}
          </p>
          {tags.length > 0 && (
            <div
              role='group'
              aria-label={t('Tags')}
              className='text-muted-foreground flex min-w-0 items-baseline gap-1.5 text-xs'
            >
              <span className='shrink-0'>{t('Tags')}</span>
              <span className='truncate' title={tags.join(', ')}>
                {tags.slice(0, 2).join(', ')}
              </span>
              {tags.length > 2 && (
                <span className='shrink-0' title={tags.slice(2).join(', ')}>
                  +{tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
        <div
          role='group'
          aria-label={t('Pricing')}
          className='mt-auto flex min-w-0 flex-col gap-1.5'
        >
          <div className='flex flex-wrap items-center gap-1.5'>
            <ModelBillingModeBadge model={props.model} appearance='caption' />
            {showTokenSuffix && (
              <span className='text-muted-foreground text-xs whitespace-nowrap'>
                （/ {tokenUnitSuffix}）
              </span>
            )}
          </div>
          {dynamicSummary?.providerCount && (
            <span className='text-muted-foreground text-xs break-words'>
              {t('{{count}} providers', {
                count: dynamicSummary.providerCount,
              })}
              {dynamicSummary.hasUnconfiguredProviders &&
                ` · ${t('Not configured for some providers')}`}
            </span>
          )}
          <div className='grid grid-cols-[repeat(auto-fit,minmax(88px,1fr))] gap-x-3 gap-y-2'>
            {priceSummary}
          </div>
        </div>
        {(groups.length > 0 || endpoints.length > 0) && (
          <dl
            className={cn(
              'grid min-w-0 grid-cols-2 gap-3 text-xs',
              (groups.length === 0 || endpoints.length === 0) && 'grid-cols-1'
            )}
          >
            {groups.length > 0 && (
              <div className='flex min-w-0 items-baseline gap-1.5'>
                <dt className='text-muted-foreground shrink-0'>
                  {t('Groups')}
                </dt>
                <dd className='flex min-w-0 items-baseline gap-1'>
                  <span className='truncate' title={groups.join(', ')}>
                    {groups[0]}
                  </span>
                  {groups.length > 1 && (
                    <span
                      className='text-muted-foreground shrink-0'
                      title={groups.slice(1).join(', ')}
                    >
                      +{groups.length - 1}
                    </span>
                  )}
                </dd>
              </div>
            )}
            {endpoints.length > 0 && (
              <div className='flex min-w-0 items-baseline gap-1.5'>
                <dt className='text-muted-foreground shrink-0'>
                  {t('Endpoints')}
                </dt>
                <dd className='flex min-w-0 items-baseline gap-1'>
                  <span className='truncate' title={endpoints.join(', ')}>
                    {endpoints.slice(0, 2).join(', ')}
                  </span>
                  {endpoints.length > 2 && (
                    <span
                      className='text-muted-foreground shrink-0'
                      title={endpoints.slice(2).join(', ')}
                    >
                      +{endpoints.length - 2}
                    </span>
                  )}
                </dd>
              </div>
            )}
          </dl>
        )}
      </CardContent>
      <CardFooter className='mt-auto border-0 bg-transparent pt-0'>
        <ModelPerfBadge
          perf={props.perf}
          className='border-border/60 border-t pt-2'
        >
          <Button
            variant='ghost'
            size='sm'
            onClick={() => props.onClick(props.model.model_name || '')}
          >
            {t('Details')}
            <ChevronRight aria-hidden className='size-3.5' />
          </Button>
        </ModelPerfBadge>
      </CardFooter>
    </Card>
  )
})
