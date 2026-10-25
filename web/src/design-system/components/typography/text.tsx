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
 * 文本语义变体。取值来自 `tokens/typography.css` 的九档字号阶梯，
 * 不允许在调用处覆盖 font-size —— 需要新档位就先加 Token。
 *
 * - `body`       16/400/24  正文段落、卡片正文
 * - `body-sm`    14/400/20  次要正文、表格单元格
 * - `label`      14/500/20  按钮文字、表单标签、导航项
 * - `caption`    12/400/16  说明、占位符、徽标
 * - `code`       16/400/24  代码块、独立展示的密钥
 * - `code-dense` 14/400/22  表格/日志里的密钥与模型 ID（例外 E2/E3）
 */
export type TextVariant =
  | 'body'
  | 'body-sm'
  | 'label'
  | 'caption'
  | 'code'
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
  /** 覆盖字重。视觉层级需要强调时使用，不要用 `font-bold` 类硬写。 */
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
