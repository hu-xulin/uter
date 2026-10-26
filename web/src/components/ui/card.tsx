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
import * as React from 'react'

import { cn } from '@/lib/utils'

function Card({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<'div'> & { size?: 'default' | 'sm' }) {
  return (
    <div
      data-slot='card'
      data-size={size}
      className={cn(
        // 规范 2.1 Card：头部/内容区内边距 24px（sp-6）。之前硬编码
        // py-4/px-4(16px)，比规范小 8px。改引 `--ds-card-padding`
        // （comfortable=24px / compact=16px / xl=28px）——这个 Token 在
        // spacing.css 里声明了三档却从未被引用，等于密度切换对卡片无效，
        // 本次一并接上。sm 尺寸档按 0.75 比例跟随，不另设死值。
        'group/card bg-card text-card-foreground ring-foreground/10 flex flex-col gap-4 overflow-hidden rounded-lg py-(--ds-card-padding) text-base ring-1 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-[calc(var(--ds-card-padding)*0.75)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-lg *:[img:last-child]:rounded-b-lg',
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='card-header'
      className={cn(
        // 规范 2.1 Card 头部：四周 24px、标题与描述间距 6px（sp-1）。
        // 原 gap-1(4px) 偏紧，且 px-4(16px) 未达规范值。
        'group/card-header @container/card-header grid auto-rows-min items-start gap-1.5 rounded-t-lg px-(--ds-card-padding) group-data-[size=sm]/card:px-[calc(var(--ds-card-padding)*0.75)] has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3',
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='card-title'
      className={cn(
        /* 卡片标题 18px / 600 / 26px */
        'text-lg font-semibold group-data-[size=sm]/card:text-base',
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='card-description'
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='card-action'
      className={cn(
        'col-start-2 row-span-2 row-start-1 self-start justify-self-end',
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='card-content'
      className={cn(
        'px-(--ds-card-padding) group-data-[size=sm]/card:px-[calc(var(--ds-card-padding)*0.75)]',
        className
      )}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='card-footer'
      className={cn(
        // 规范 2.1 Card 底部操作区：内边距 24px。
        'bg-muted/50 flex items-center rounded-b-lg border-t p-(--ds-card-padding) group-data-[size=sm]/card:p-[calc(var(--ds-card-padding)*0.75)]',
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
