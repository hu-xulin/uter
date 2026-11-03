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
import * as React from 'react'

import {
  formLabelTierClassName,
  useFormLabelTier,
  type FormLabelTier,
} from '@/components/ui/form-label-tier'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-lg border p-4 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-3 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4.5",
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        destructive:
          'bg-card text-destructive *:data-[slot=alert-description]:text-destructive *:[svg]:text-current',
        // 语义状态三变体（对齐 Toast 四态命名）：底色用 *-soft（双主题
        // 各自给出），文字用 *-soft-foreground（软底上的 AA 对比度，
        // 与 Badge 的 warning-soft-foreground 同一决策）。
        success:
          'bg-success-soft text-success-soft-foreground *:data-[slot=alert-description]:text-success-soft-foreground *:[svg]:text-current',
        warning:
          'bg-warning-soft text-warning-soft-foreground *:data-[slot=alert-description]:text-warning-soft-foreground *:[svg]:text-current',
        info: 'bg-info-soft text-info-soft-foreground *:data-[slot=alert-description]:text-info-soft-foreground *:[svg]:text-current',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot='alert'
      role='alert'
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({
  className,
  tier,
  ...props
}: React.ComponentProps<'div'> & {
  /**
   * 标题档位。提示块里的标题与同页的字段标签同属「名称」层，因此默认
   * 跟随外层 `FormLabelTierProvider`：在设置页里自动是 16/600，与旁边
   * 「Client Secret」这类标签同档；在普通页面仍是原来的 14/500 加粗。
   */
  tier?: FormLabelTier
}) {
  const activeTier = useFormLabelTier(tier)
  return (
    <div
      data-slot='alert-title'
      data-tier={activeTier}
      className={cn(
        '[&_a]:hover:text-foreground font-medium group-has-[>svg]/alert:col-start-2',
        // 档位类拼在 font-medium 之后，由 twMerge 覆盖字重。
        formLabelTierClassName(activeTier),
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='alert-description'
      className={cn(
        'text-muted-foreground [&_a]:hover:text-foreground text-sm text-balance md:text-pretty [&_p:not(:last-child)]:mb-4',
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='alert-action'
      className={cn('absolute top-2 right-2', className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
