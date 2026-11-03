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
import { cva, type VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

const iconBadgeVariants = cva(
  'flex shrink-0 items-center justify-center [&>svg]:shrink-0',
  {
    variants: {
      tone: {
        neutral: 'bg-muted text-muted-foreground',
        primary: 'bg-primary-subtle text-primary-subtle-foreground',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        info: 'bg-info-soft text-info',
        destructive: 'bg-destructive-subtle text-destructive',
        'chart-1': 'bg-chart-1/10 text-chart-1',
        'chart-2': 'bg-chart-2/10 text-chart-2',
        'chart-3': 'bg-chart-3/10 text-chart-3',
        'chart-4': 'bg-chart-4/10 text-chart-4',
        'chart-5': 'bg-chart-5/10 text-chart-5',
        'chart-6': 'bg-chart-6/10 text-chart-6',
      },
      size: {
        // 图标字形落在规范 §2.2 的合法档位上：16 / 24（2026-10-28 10:58 版
        // 取消了 20px）。只有 20px 的 `xs` / `stat` 小屏档放不下 16px
        // （上下各只剩 2px），才降到 12px —— 登记在 exceptions E23。
        xs: 'size-5 rounded-md [&>svg]:size-3',
        sm: 'size-7 rounded-md [&>svg]:size-4',
        md: 'size-8 rounded-lg [&>svg]:size-4',
        title: 'size-8 rounded-lg sm:size-9 [&>svg]:size-4',
        // 40px 方框放 16px 会空掉一圈，升到「强调型入口」的 24px 档。
        lg: 'size-10 rounded-xl [&>svg]:size-6',
        stat: 'size-5 rounded-md sm:size-7 [&>svg]:size-3 sm:[&>svg]:size-4',
      },
    },
    defaultVariants: {
      tone: 'neutral',
      size: 'md',
    },
  }
)

export type IconBadgeTone = NonNullable<
  VariantProps<typeof iconBadgeVariants>['tone']
>

export type IconBadgeSize = NonNullable<
  VariantProps<typeof iconBadgeVariants>['size']
>

interface IconBadgeProps {
  children?: ReactNode
  tone?: IconBadgeTone
  size?: IconBadgeSize
  className?: string
  decorative?: boolean
}

export function IconBadge(props: IconBadgeProps) {
  return (
    <span
      className={cn(
        iconBadgeVariants({ tone: props.tone, size: props.size }),
        props.className
      )}
      aria-hidden={props.decorative ?? true}
    >
      {props.children}
    </span>
  )
}
