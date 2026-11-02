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
import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  // 规范 2.1 Badge：高度 24px、内边距 12×4px、胶囊态 r-full（非胶囊 r-md）。
  // 内边距取 §1.3 间距表的 `sp-2-5`(12px) × `sp-0-5`(4px)，而不是此前 §2.1
  // 写的 10×2px —— 两者矛盾，已按「标题句与表冲突以表为准」统一为 12×4：
  // caption 行高 16 + 上下各 4 = 24，正好等于规范高度，表里的数值才自洽。
  // 之前是 h-5(20px)/px-2(8px)/rounded-4xl(24px)——后两者在 20px 高度下
  // 视觉上恰好也是胶囊，所以一直没被发现；高度比规范小 4px。
  // rounded-full 而非 rounded-4xl：高度变化时胶囊形态不能依赖「半径≈高度」的巧合。
  'group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-3 py-1 text-xs font-normal whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground [a]:hover:bg-primary-hover',
        secondary:
          'bg-secondary text-secondary-foreground [a]:hover:bg-secondary-hover',
        destructive:
          'bg-destructive-subtle text-destructive focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive-subtle-hover',
        // 警告色文字用 soft-foreground 档：`#D97706` 落在 `warning/10` 上只有
        // 2.7:1，12px 徽标文字达不到 AA 4.5:1（规范 §1.1.2 状态文字要求）。
        warning:
          'border-warning/40 bg-warning-soft text-warning-soft-foreground focus-visible:ring-warning/20',
        outline:
          'border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground',
        ghost:
          'hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50',
        link: 'text-fg-link',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Badge({
  className,
  variant = 'default',
  render,
  ...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: 'badge',
      variant,
    },
  })
}

export { Badge, badgeVariants }
