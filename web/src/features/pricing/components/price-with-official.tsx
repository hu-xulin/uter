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
  formatOfficialPriceAtRatio,
  formatOfficialRequestPrice,
  formatPrice,
  formatRequestPrice,
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
   * Optional official reference ratio (model_ratio) from the selected pricing
   * preset. When provided, the discount compares the platform price (model
   * ratio adjusted by the viewer's group ratio) against this official ratio.
   */
  officialRatio?: number
  className?: string
}

/**
 * Renders a single price metric with both the viewer's actual (discounted)
 * price and the official list price as a reference line.
 *
 * When `officialRatio` is provided (preset official price), the discount is
 * computed against that preset ratio; otherwise it falls back to the standard
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
  const hasPresetOfficial =
    props.type !== 'request' &&
    typeof props.officialRatio === 'number' &&
    Number.isFinite(props.officialRatio) &&
    props.officialRatio > 0

  const official =
    props.type !== 'request' && hasPresetOfficial && props.officialRatio != null
      ? formatOfficialPriceAtRatio(
          props.model,
          props.type,
          props.officialRatio,
          tokenUnit,
          props.showRechargePrice,
          props.priceRate,
          props.usdExchangeRate
        )
      : props.type === 'request'
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

  let isDiscount = false
  let discountPercent = 0
  if (hasPresetOfficial && props.officialRatio != null) {
    const effectivePlatform = props.model.model_ratio * displayRatio
    if (effectivePlatform < props.officialRatio - 1e-9) {
      isDiscount = true
      discountPercent = Math.round((1 - effectivePlatform / props.officialRatio) * 100)
    }
  } else {
    isDiscount = displayRatio > 0 && displayRatio < 1
    discountPercent = isDiscount ? Math.round((1 - displayRatio) * 100) : 0
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-1', props.className)}>
      <span className='text-muted-foreground text-xs'>{props.label}</span>
      <span className='flex flex-wrap items-baseline gap-x-1 font-mono text-sm font-semibold tabular-nums'>
        <span>{current}</span>
        <span className='text-muted-foreground text-xs font-normal whitespace-nowrap'>
          {' '}
          {props.unit}
        </span>
        {isDiscount && (
          <span className='text-emerald-600 text-xs font-bold'>
            · -{discountPercent}%
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
