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
import type { CSSProperties, ElementType, ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * 文本语义变体。取值来自 `tokens/typography.css` 的字号阶梯，
 * 不允许在调用处覆盖 font-size —— 需要新档位就先加 Token。
 *
 * - `body`       14/400/20  常规正文、表单内容、普通说明（全站基准）
 * - `body-long`  16/400/26  长文本：文章、协议、帮助中心、隐私政策
 * - `body-sm`    14/400/20  紧凑辅助正文、表格单元格
 * - `label`      14/500/20  按钮文字、表单标签、导航项
 * - `caption`    12/400/16  说明、占位符、徽标
 * - `code`       14/400/20  正文里的等宽文本（模型 ID、密钥、金额、行内代码）
 * - `code-block` 13/400/20  等宽代码展示区（首页代码卡片、代码块、编辑器视口）
 * - `code-dense` 14/400/20  `code` 的兼容别名，新代码用 `code`
 *
 * `body` 与 `body-sm` 同值（14/20），差别只在语义：前者是默认基准，
 * 后者是「明确要紧凑」的辅助正文。**正文不要用 16px** —— 需要连续阅读
 * 的长文本走 `body-long`。
 *
 * 等宽只有这两档：正文 14px（与 body-sm 同档）、代码展示区 13px（固定高度
 * 的卡片里要稳住行数）。两者混用会基线错位，所以同一容器内只用一档。
 */
export type TextVariant =
  | 'body'
  | 'body-long'
  | 'body-sm'
  | 'label'
  | 'caption'
  | 'code'
  | 'code-block'
  | 'code-dense'

export type TextColor =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'success'
  | 'inherit'

export type TextWeight = 400 | 500 | 600 | 700

const WEIGHT_CLASS: Record<TextWeight, string> = {
  400: 'font-normal',
  500: 'font-medium',
  600: 'font-semibold',
  700: 'font-bold',
}

export type TextProps = {
  /** 语义标签。默认 `span`；段落用 `p`，定义列表用 `dt` / `dd`。 */
  as?: ElementType
  variant?: TextVariant
  color?: TextColor
  /** 覆盖字重。视觉层级需要强调时使用，不要用 `font-semibold` 类硬写。 */
  weight?: TextWeight
  /** 单行截断。 */
  truncate?: boolean
  /** 多行截断行数。 */
  clamp?: 1 | 2 | 3
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

/**
 * 设计系统的基础文本组件。
 *
 * 只负责四件事：字号、字重、行高、颜色。不负责布局（用 `className`
 * 传 margin/gap），也不负责业务语义。
 */
export function Text({
  as: Component = 'span',
  variant = 'body',
  color = 'primary',
  weight,
  truncate = false,
  clamp,
  className,
  style,
  children,
  ...rest
}: TextProps & Record<string, unknown>) {
  return (
    <Component
      className={cn(
        'ds-text',
        `ds-text--${variant}`,
        `ds-text--${color}`,
        weight != null && WEIGHT_CLASS[weight],
        truncate && 'ds-text--truncate',
        clamp != null && `ds-text--clamp-${clamp}`,
        className
      )}
      style={style}
      {...rest}
    >
      {children}
    </Component>
  )
}
