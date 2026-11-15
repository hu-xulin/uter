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
'use client'

import { motion } from 'motion/react'
import { type CSSProperties, type ElementType, memo, useMemo } from 'react'

import { cn } from '@/lib/utils'

export type TextShimmerProps = {
  children: string
  as?: ElementType
  className?: string
  duration?: number
  spread?: number
}

const MotionP = motion.p

const ShimmerComponent = ({
  children,
  className,
  duration = 2,
  spread = 2,
}: TextShimmerProps) => {
  const dynamicSpread = useMemo(
    () => (children?.length ?? 0) * spread,
    [children, spread]
  )

  return (
    <MotionP
      animate={{ backgroundPosition: '0% center' }}
      className={cn('relative inline-block ds-text-shimmer', className)}
      initial={{ backgroundPosition: '100% center' }}
      style={
        {
          /* UDS 6.0：渐变定义已收敛到 foundations/typography.css 的受控出口
           * ds-text-shimmer，业务组件不再手写 bg-clip-text / linear-gradient。 */
          '--ds6-shimmer-spread': `${dynamicSpread}px`,
        } as CSSProperties
      }
      transition={{
        repeat: Number.POSITIVE_INFINITY,
        duration,
        ease: 'linear',
      }}
    >
      {children}
    </MotionP>
  )
}

export const Shimmer = memo(ShimmerComponent)
