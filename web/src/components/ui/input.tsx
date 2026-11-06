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
        // （ring 无 offset，规范 §1.7 明确禁止留缝），颜色仍是 `ring` 满色
        // —— 只把宽度收到 1px。校验失败态同理收到 1px，否则同一个输入框
        // 会出现两种粗细。悬停态（规范 §11.2）：边框加深一档走 border-strong
        // Token，不用透明度凑；aria-invalid / focus-visible 的变体序在 hover
        // 之后，仍会覆盖这里的边框色。
        // 焦点态**不**改边框色（不设 focus-visible:border-ring）：边框保持
        // 中性的 border-input，1px 满色焦点环贴着边框外沿，二者颜色不同即可
        // 清楚区分。若边框也跟着变成 ring 色，会和同色同位的焦点环融成一条
        // 更粗的线，焦点环反而「消失」（PR #31 focus-ring 修复）。
        'border-input hover:border-border-strong file:text-foreground placeholder:text-muted-foreground focus-visible:ring-ring disabled:bg-input/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 h-(--ds-control-height-md) w-full min-w-0 rounded-md border bg-background px-3 py-2.5 transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-1 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-1',
        // 字号统一走 `text-long`（16px）：满足 UAES P4 的 H5 无障碍要求
        // （输入框字号 ≥16px 可阻止 iOS 在聚焦时自动缩放）。mono 只额外叠加
        // `font-mono` 字形族，不再使用 13px 的 `text-mono` 档 —— size 与字形
        // 拆成两件事，twMerge 不会再出现「两个字号类并存、源顺序定生死」。
        useMono ? 'font-mono text-long' : 'text-long',
        className
      )}
      {...props}
    />
  )
}

export { Input }
