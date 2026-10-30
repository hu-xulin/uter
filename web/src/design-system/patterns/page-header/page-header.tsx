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
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { Heading } from '../../components/typography/heading'
import { Text } from '../../components/typography/text'

export type PageHeaderProps = {
  /** 页面主标题，渲染为 `h1`（28/600/36）。 */
  title: ReactNode
  /** 页面描述，16/400/24。 */
  description?: ReactNode
  /** 右侧操作区，通常放主按钮。 */
  actions?: ReactNode
  /** 标题上方的面包屑或返回入口。 */
  breadcrumb?: ReactNode
  className?: string
}

/**
 * 页面头部模式。
 *
 * 把「标题 + 描述 + 操作」的排版收敛到一处：页面只提供内容，不再各自
 * 决定标题字号、描述颜色和间距。这是文档 5.2 节「复合组件」的落地
 * 样例 —— 页面层不允许重复定义基础排版规则。
 */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn('flex flex-col gap-1.5 sm:gap-2', className)}
      data-slot='page-header'
    >
      {breadcrumb != null && (
        <div className='mb-1 flex items-center gap-1.5'>{breadcrumb}</div>
      )}
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0 flex-1'>
          <Heading variant='page-title' truncate>
            {title}
          </Heading>
          {description != null && (
            <Text as='p' variant='body' color='secondary' className='mt-1.5'>
              {description}
            </Text>
          )}
        </div>
        {actions != null && (
          <div className='flex shrink-0 items-center gap-2'>{actions}</div>
        )}
      </div>
    </header>
  )
}
