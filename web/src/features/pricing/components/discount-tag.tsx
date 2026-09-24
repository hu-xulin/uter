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
along with this program; see <https://www.gnu.org/licenses/>.
*/
import { memo } from 'react'

import { cn } from '@/lib/utils'

import { getDiscountInfo } from '../lib/price'
import type { PricingModel } from '../types'

export type DiscountTagProps = {
  model: PricingModel
  officialPrices?: Record<string, Record<string, number>>
  selectedGroup?: string
  className?: string
}

/**
 * Green "xx折" badge shown after a model name when the platform price is lower
 * than the official preset price. e.g. ratio 0.9 -> "9折", 0.85 -> "8.5折".
 */
export const DiscountTag = memo(function DiscountTag(props: DiscountTagProps) {
  const info = getDiscountInfo(props.model, props.officialPrices, props.selectedGroup)
  if (!info.hasDiscount) return null

  const zhe = info.zhe
  const zheLabel =
    Math.abs(zhe - Math.round(zhe)) < 1e-6
      ? String(Math.round(zhe))
      : zhe.toFixed(1)
  const label = `${zheLabel}折`

  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-[5px] text-[11px] font-semibold leading-none text-white bg-emerald-600',
        props.className
      )}
      title={`-${Math.round(info.percent)}%`}
    >
      {label}
    </span>
  )
})
