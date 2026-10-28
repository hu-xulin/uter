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
import type { CSSProperties, ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * 视觉层级。与 HTML 语义（h1–h6）**分离**：
 *
 * - `display`       36/700/40  营销页主视觉
 * - `page-title`    30/600/36  页面标题
 * - `section-title` 24/600/32  区块标题
 * - `card-title`    18/600/28  卡片标题
 * - `dialog-title`  18/600/28  弹窗标题
 * - `group-title`   16/600/24  卡片内的分组标题（表单分组、列表分组）
 * - `mono-title`    16/600/22  用等宽字形的卡片标题（定价卡片模型名）
 *
 * `group-title` 是页面层级的第 4 层：卡片内部再分组时用（个人资料页的
 * 「通知方式」「偏好设置」、弹窗里的字段分组）。它比 `card-title` 低一档、
 * 比表单标签（label 14/500）高一档，不能反过来当卡片标题用。
 *
 * `mono-title` 与 `card-title` 是**同一语义层级的两种字形**，不是两个层级：
 * 需要等宽显示标识符的卡片标题（模型 ID）用 mono-title，其余用 card-title。
 * 16px 是「等宽字形视觉上比 Inter 同字号更宽」的补偿值，不是新开一档标题。
 */
export type HeadingVariant =
  | 'display'
  | 'page-title'
  | 'section-title'
  | 'card-title'
  | 'dialog-title'
  | 'group-title'
  | 'mono-title'

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

/** 每个视觉层级默认对应的语义标签，避免出现「h2 长得像 h1」。 */
const DEFAULT_LEVEL: Record<HeadingVariant, HeadingLevel> = {
  display: 1,
  'page-title': 1,
  'section-title': 2,
  'card-title': 3,
  'dialog-title': 3,
  'group-title': 4,
  'mono-title': 3,
}

export type HeadingProps = {
  variant?: HeadingVariant
  /**
   * 语义层级。默认跟随 `variant`；只有文档结构需要跳级时才显式传，
   * 用来修「视觉上该小、语义上该大」的情况。
   */
  level?: HeadingLevel
  color?: 'primary' | 'secondary' | 'inherit'
  truncate?: boolean
  clamp?: 1 | 2
  /**
   * 多行主标题行高（1.5 比例，随字号缩放）。只对会折成 3 行以上的
   * 营销主标题开启；单行标题保持 40px 的紧行高。
   */
  multiline?: boolean
  className?: string
  style?: CSSProperties
  id?: string
  children?: ReactNode
}

/**
 * 设计系统的标题组件。
 *
 * 输出真正的 `h1`–`h6`，而不是套着标题样式的 `div` —— 屏幕阅读器
 * 靠标签层级建立大纲。视觉样式只由 `variant` 决定。
 */
export function Heading({
  variant = 'section-title',
  level,
  color = 'primary',
  truncate = false,
  clamp,
  multiline = false,
  className,
  style,
  id,
  children,
  ...rest
}: HeadingProps & Record<string, unknown>) {
  const Tag = `h${level ?? DEFAULT_LEVEL[variant]}` as
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6'

  return (
    <Tag
      id={id}
      className={cn(
        'ds-heading',
        `ds-heading--${variant}`,
        `ds-heading--${color}`,
        truncate && 'ds-text--truncate',
        clamp != null && `ds-heading--clamp-${clamp}`,
        multiline && 'ds-heading--display-multiline',
        className
      )}
      style={style}
      {...rest}
    >
      {children}
    </Tag>
  )
}
