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

import * as React from 'react'

import { cn } from '@/lib/utils'

function Table({
  className,
  withContainer = true,
  ...props
}: React.ComponentProps<'table'> & { withContainer?: boolean }) {
  /**
   * 这里**不要**再给 `:is(th,td) *` 加 `font-family: inherit`。
   *
   * 曾经有一条 `[&_:is(th,td)_*]:[font-family:inherit]`，本意是让单元格里的
   * 按钮/输入框回到表格字体，实际把单元格内所有后代的 `font-mono` 一起按死
   * —— API Key、模型 ID、工具标识这些「机器可读的值」全都渲染成了 Inter。
   * 表单控件回到正文字体已由 preflight 的 `button, input, … { font-family:
   * inherit }` 覆盖，不需要再写一条通配后代规则。
   */
  const table = (
    <table
      data-slot='table'
      className={cn(
        // 表格走「密集数据档」（规范 v1.2）：单元格 13/400/20（text-dense）、
        // 表头 12/500/18（text-xs + font-medium）。普通说明文字不要跟着降，
        // 14px 仍是正文档。⚠️ `text-dense` 是自定义 token，twMerge 不认它
        // 属于字号组 —— 不要与 `text-sm` 同时写在同一个类串里。
        'w-full caption-bottom text-dense tabular-nums [font-family:var(--font-body)] [&_td]:text-dense [&_th]:text-xs [&_th]:font-medium [&_:is(th,td)_*]:[font-size:inherit] [&_:is(th,td)_*]:[font-weight:inherit]',
        '[&_[data-table-text=secondary]]:text-xs [&_[data-table-text=secondary]]:font-normal',
        className
      )}
      {...props}
    />
  )

  if (!withContainer) return table

  return (
    <div
      data-slot='table-container'
      className='relative w-full overflow-x-auto overflow-y-hidden'
    >
      {table}
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot='table-header'
      className={cn('[&_tr]:border-b', className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot='table-body'
      className={cn('[&>tr]:h-12 [&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot='table-footer'
      className={cn(
        'bg-muted/50 border-t font-medium [&>tr]:last:border-b-0',
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot='table-row'
      className={cn(
        'group data-[state=selected]:bg-muted border-b transition-colors hover:[background-color:color-mix(in_oklch,var(--muted)_50%,var(--background))] has-aria-expanded:[background-color:color-mix(in_oklch,var(--muted)_50%,var(--background))]',
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot='table-head'
      className={cn(
        'text-foreground h-10 px-3 py-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot='table-cell'
      className={cn(
        'px-3 py-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot='table-caption'
      className={cn('text-muted-foreground mt-4 text-xs', className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
