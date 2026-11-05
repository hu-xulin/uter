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

function Textarea({
  className,
  mono = false,
  ...props
}: React.ComponentProps<'textarea'> & {
  /**
   * 用等宽字形渲染**值**（域名清单 / 白名单 / 密钥 / 代码）。
   *
   * 与 `Input` 的 `mono` 同义：只管字形与字号档位，不管宽度或内边距。
   */
  mono?: boolean
}) {
  return (
    <textarea
      data-slot='textarea'
      data-mono={mono || undefined}
      className={cn(
        // 内边距沿用 Input 的 12×10px（px-3 py-2.5）；最小高度按规范
        // 「最小约 3 行」= 3×20 + 2×10 + 2×1 ≈ 72px（min-h-18）。
        // 此前 min-h-16（64px）在 14/20 字号下只能装 2 行多一点。
        //
        // 焦点环与 Input 同档 **1px 外扩**（规范 2.1 Textarea 写的就是 1px；
        // 2px 会让「1px 边框 + 2px 环」看起来像双线框）。错误态同步收到 1px。
        // 悬停态与 Input 同源（规范 §11.2/§11.4）：border-strong Token。
        'border-input hover:border-border-strong placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring disabled:bg-input/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 flex field-sizing-content max-h-96 min-h-18 w-full overflow-y-auto rounded-md border bg-background px-3 py-2.5 transition-colors outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-1',
        // 与 Input 一致：字号统一走 `text-long`（16px）满足 UAES P4 H5 无障碍
        // （≥16px 防 iOS 聚焦自动缩放）；mono 仅额外叠 `font-mono` 字形族，
        // 不再用 13px 的 `text-mono` 档，size 与字形拆开避免 twMerge 冲突。
        mono ? 'font-mono text-long' : 'text-long',
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
