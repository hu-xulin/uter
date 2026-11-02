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
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

function Tabs({
  className,
  orientation = 'horizontal',
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot='tabs'
      data-orientation={orientation}
      className={cn(
        'group/tabs flex gap-2 data-horizontal:flex-col',
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  // 规范 2.1 Tabs：容器高约 40px、内边距 4px（sp-1）。原 h-8(32px)/
  // p-[3px] 比规范小 8px / 1px，且容器偏矮会让激活块的视觉重量不足。
  // 容器底色规范要求 Surface/secondary，default 变体原先被改成
  // bg-background（提交 875581015 的「白底药丸外框」），与规范不符，
  // 本次一并改回 secondary——激活触发器才是 background，未激活与容器同色。
  //
  // 垂直居中靠 `items-stretch` + 触发器 `h-full`，不再用 `items-center`：
  // 容器是固定 40px 的盒子，`items-center` 会把触发器当成 29px 的内容盒居中，
  // 一旦触发器用 `h-[calc(100%-1px)]` 这种百分比高度，grid/flex 轨道会按
  // 「内容高度」参与求解，实测得到上间距 5.5px、下间距 1.5px —— 也就是
  // 「按钮上下不居中」。改为拉伸轨道、触发器吃满轨道高度，上下间距恒等于
  // 容器的 p-1（4px），激活块与容器同心。
  'group/tabs-list inline-flex w-fit items-stretch justify-center rounded-lg p-1 text-muted-foreground group-data-horizontal/tabs:h-10 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none',
  {
    variants: {
      variant: {
        default: 'border border-input bg-secondary',
        line: 'gap-1 bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function TabsList({
  className,
  variant = 'default',
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot='tabs-list'
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot='tabs-trigger'
      className={cn(
        // 规范 2.1 Tabs 触发器：内边距 12×6px。原 px-1.5(6px)/py-0.5(2px)
        // 偏窄，激活块在 40px 容器里显得局促。
        //
        // 高度用 `h-full min-h-0` 而不是 `h-[calc(100%-1px)]`：后者在 grid
        // 轨道里会把触发器压成「内容高度 + 1px 误差」，激活块相对容器偏下
        // 1.5px（上 5.5 / 下 1.5），肉眼就是「按钮没对齐」。拉伸轨道后由
        // 父级 items-stretch 决定高度，上下内边距恒定对称。
        // 相邻触发器之间不需要靠 -1px 叠边框：每个触发器的边框都是
        // transparent，激活态靠背景色而非边框表达。
        "text-muted-foreground hover:text-foreground focus-visible:border-ring focus-visible:ring-ring focus-visible:outline-ring dark:text-muted-foreground dark:hover:text-foreground relative inline-flex h-full min-h-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start focus-visible:ring-2 focus-visible:outline-2 disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 aria-disabled:pointer-events-none aria-disabled:opacity-50 group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4.5",
        'group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent',
        'data-active:bg-primary data-active:text-primary-foreground group-data-[variant=default]/tabs-list:data-active:hover:text-primary-foreground dark:data-active:bg-primary dark:data-active:text-primary-foreground dark:group-data-[variant=default]/tabs-list:data-active:hover:text-primary-foreground',
        'group-data-[variant=line]/tabs-list:data-active:text-fg-link group-data-[variant=line]/tabs-list:data-active:hover:text-fg-link dark:group-data-[variant=line]/tabs-list:data-active:text-fg-link dark:group-data-[variant=line]/tabs-list:data-active:hover:text-fg-link',
        'after:bg-foreground after:absolute after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100',
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot='tabs-content'
      className={cn('flex-1 text-sm outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
