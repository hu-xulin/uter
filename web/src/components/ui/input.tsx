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
import { Input as InputPrimitive } from '@base-ui/react/input'
import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({
  className,
  type,
  mono,
  ...props
}: React.ComponentProps<'input'> & {
  /**
   * 用等宽字形渲染**值**（网址 / 域名 / 密钥 / 邮箱 / ID / 代码）。
   *
   * 只管字形与字号档位，不管宽度或内边距。人读的名称（站点名、发送者姓名）
   * 不要开 —— 等宽在中文与长名称上反而更难读。
   *
   * **`type='url'` 默认开启**：链接地址一律等宽是全站规则（规范
   * `typography.md`「等宽（mono）的适用范围」），没有例外的理由。
   * 确实要关掉时显式传 `mono={false}`。
   */
  mono?: boolean
}) {
  const useMono = mono ?? type === 'url'
  return (
    <InputPrimitive
      type={type}
      data-slot='input'
      data-mono={useMono || undefined}
      className={cn(
        // 内边距按规范 2.1 Input：12×10px（px-3 py-2.5）。此前 px-2.5（10px）
        // 横向偏窄 2px；填充此前是 bg-transparent（靠父容器底色），规范要求
        // Surface/background，深色主题下透明会让输入框「陷进」卡片里。
        //
        // 焦点环 2026-10-28 定为 **1px 外扩**（此前 2px）：输入框本身已有 1px
        // 边框，再叠 2px 环时整个控件看起来像双线框。环仍然贴着边框外沿
        // （ring 无 offset），颜色仍是 `ring` 满色 —— 只把宽度收到 1px。
        // 校验失败态同理收到 1px，否则同一个输入框会出现两种粗细。
        'border-input file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring disabled:bg-input/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 h-(--ds-control-height-md) w-full min-w-0 rounded-md border bg-background px-3 py-2.5 transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-1 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-1',
        // 字号只能有一个来源。`text-mono` 是自定义 token，twMerge 不认它属于
        // 字号类，因此无法靠「后写覆盖」去掉 text-sm —— 两者会同时存在，
        // 最终生效哪一个取决于 CSS 源顺序。这里改成二选一。
        useMono ? 'font-mono text-mono' : 'text-sm',
        className
      )}
      {...props}
    />
  )
}

export { Input }
