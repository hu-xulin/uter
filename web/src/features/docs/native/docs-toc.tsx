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
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { useActiveHeading } from './use-active-heading'

/** One entry of the in-page table of contents. */
export type TocItem = { depth: 2 | 3; text: string; id: string }

/**
 * 右侧目录（Clerk 式）。
 *
 * 结构是一条**贯穿到底的细竖线**，当前小节用一段品牌色粗线盖在上面 ——
 * 不是「给每一项加左边框」，那样相邻项的边框会连成一排虚线，反而看不出
 * 哪一段是当前。做法是：`ul` 画 1px 轨道，`a` 用 `-ml-px` 叠 2px 边框，
 * 未激活时边框透明，激活时换成 `border-primary`。
 *
 * 选中态的颜色走 `text-sidebar-active-foreground`（规范 §2.3 的导航选中
 * 前景色），不用 `text-primary` —— 后者在浅色主题下只有 4.44:1，不达 AA。
 */
export function DocsToc({
  items,
  showHeading = true,
  className,
}: {
  items: TocItem[]
  /** 收在 `<details>` 里时标题由 summary 承担，这里关掉避免重复。 */
  showHeading?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const active = useActiveHeading(items.map((item) => item.id))

  if (items.length === 0) return null

  return (
    <nav
      aria-label={t('docs.toc.heading')}
      className={cn('text-sm', className)}
    >
      {showHeading ? (
        <p className='text-fg-secondary mb-2 px-3 font-medium'>
          {t('docs.toc.heading')}
        </p>
      ) : null}
      <ul className='border-border flex flex-col border-l'>
        {items.map((item) => {
          const isActive = item.id === active
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={isActive ? 'location' : undefined}
                className={cn(
                  '-ml-px block border-l-2 py-1 pr-2 no-underline transition-colors',
                  item.depth === 3 ? 'pl-6' : 'pl-3',
                  isActive
                    ? 'border-primary text-sidebar-active-foreground font-medium'
                    : 'text-fg-secondary hover:text-fg-primary border-transparent'
                )}
              >
                {item.text}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/**
 * 窄屏（`xl` 以下）的目录：默认收起，展开后与右侧目录同一套选中态。
 *
 * 三栏在 1280px 以下会把正文压到读不下去的宽度，所以右栏先收起；但目录
 * 本身是长文档的必要导航，不能直接删掉，折进一个 `<details>` 里。
 */
export function DocsTocInline({ items }: { items: TocItem[] }) {
  const { t } = useTranslation()
  if (items.length === 0) return null
  return (
    <details className='border-border bg-card mb-6 rounded-lg border px-3 py-2 xl:hidden'>
      <summary className='text-fg-secondary cursor-pointer text-sm font-medium select-none'>
        {t('docs.toc.heading')}
      </summary>
      <DocsToc items={items} showHeading={false} className='mt-2' />
    </details>
  )
}
