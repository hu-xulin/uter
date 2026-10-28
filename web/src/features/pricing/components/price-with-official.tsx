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
along with this program. If not see <https://www.gnu.org/licenses/>.
*/
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import { getDisplayGroupRatio } from '../lib/model-helpers'
import {
  formatOfficialPrice,
  formatOfficialRequestPrice,
  formatPrice,
  formatRequestPrice,
  formatUSDRequestPrice,
  formatUSDTokenPrice,
  getMarkupMultiplier,
  getOfficialPresetRequestUSD,
  getOfficialPresetTokenUSD,
  getTokenPriceUSD,
} from '../lib/price'
import type { PricingModel, PriceType, TokenUnit } from '../types'

export type PriceMetricOfficialProps = {
  model: PricingModel
  type: PriceType | 'request'
  label: string
  unit: string
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  priceRate?: number
  usdExchangeRate?: number
  selectedGroup?: string
  /**
   * Official preset ratio entry (官方价格) for this model from the selected
   * pricing preset. The platform's own price data may carry an admin-applied
   * discount, so the official reference must derive from the preset's ratio
   * fields — never from the platform's own prices.
   */
  officialPreset?: Record<string, number>
  className?: string
}

/**
 * Renders a single price metric with both the viewer's actual (discounted)
 * price and the official list price as a reference line.
 *
 * When `officialPreset` is provided (preset official price), the discount is
 * computed against that preset price; otherwise it falls back to the standard
 * list price (group_ratio = 1). When the viewer's effective price is lower
 * than the official price, the official price is struck through and a
 * "Save X%" badge is shown.
 */
export const PriceMetricOfficial = memo(function PriceMetricOfficial(
  props: PriceMetricOfficialProps
) {
  const { t } = useTranslation()
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT

  const current =
    props.type === 'request'
      ? formatRequestPrice(
          props.model,
          props.showRechargePrice,
          props.priceRate,
          props.usdExchangeRate,
          props.selectedGroup
        )
      : formatPrice(
          props.model,
          props.type,
          tokenUnit,
          props.showRechargePrice,
          props.priceRate,
          props.usdExchangeRate,
          props.selectedGroup
        )

  const displayRatio = getDisplayGroupRatio(props.model, props.selectedGroup)
  const presetUSD =
    props.type === 'request'
      ? getOfficialPresetRequestUSD(props.officialPreset)
      : getOfficialPresetTokenUSD(props.officialPreset, props.type)
  const hasPresetUSD = Number.isFinite(presetUSD)

  const uterVal =
    props.type === 'request'
      ? (props.model.model_price || 0) * displayRatio
      : getTokenPriceUSD(props.model, props.type, displayRatio)
  const fallbackOfficialVal =
    props.type === 'request'
      ? props.model.model_price || 0
      : getTokenPriceUSD(props.model, props.type, 1)
  const officialVal = hasPresetUSD ? presetUSD : fallbackOfficialVal
  const isDiscount =
    Number.isFinite(uterVal) &&
    Number.isFinite(officialVal) &&
    officialVal > 0 &&
    uterVal < officialVal - 1e-12
  const discountPercent = isDiscount
    ? Math.round((1 - uterVal / officialVal) * 100)
    : 0
  // 溢价：Uter 价高于官方价时给 `x1.05`，与模型名后的角标同口径。
  const markup = getMarkupMultiplier(uterVal, officialVal)

  const presetOfficialText =
    props.type === 'request'
      ? formatUSDRequestPrice(
          presetUSD,
          props.showRechargePrice,
          props.priceRate,
          props.usdExchangeRate
        )
      : formatUSDTokenPrice(
          presetUSD,
          tokenUnit,
          props.showRechargePrice,
          props.priceRate,
          props.usdExchangeRate
        )
  const fallbackOfficialText =
    props.type === 'request'
      ? formatOfficialRequestPrice(
          props.model,
          props.showRechargePrice,
          props.priceRate,
          props.usdExchangeRate
        )
      : formatOfficialPrice(
          props.model,
          props.type,
          tokenUnit,
          props.showRechargePrice,
          props.priceRate,
          props.usdExchangeRate
        )
  const official = hasPresetUSD ? presetOfficialText : fallbackOfficialText

  return (
    <div className={cn('flex min-w-0 flex-col gap-1', props.className)}>
      <span className='text-muted-foreground text-xs'>{props.label}</span>
      <span className='flex flex-wrap items-baseline gap-x-1 text-sm font-semibold tabular-nums'>
        <span>{current}</span>
        <span className='text-muted-foreground text-xs font-normal whitespace-nowrap'>
          {' '}
          {props.unit}
        </span>
        {isDiscount && (
          <span className='text-success-soft-foreground text-xs font-bold'>
            · -{discountPercent}%
          </span>
        )}
        {markup != null && (
          <span
            className='text-warning-soft-foreground text-xs font-bold'
            title={`+${Math.round((markup - 1) * 100)}%`}
          >
            · x{markup}
          </span>
        )}
      </span>
      <span className='text-muted-foreground text-xs tabular-nums'>
        {t('Official')}:{' '}
        <span className={cn(isDiscount && 'line-through')}>{official}</span>{' '}
        {props.unit}
      </span>
    </div>
  )
})
