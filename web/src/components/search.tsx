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
import { SearchIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useSearch } from '@/context/search-provider'
import { cn } from '@/lib/utils'

import { Button } from './ui/button'

type SearchProps = {
  className?: string
  type?: React.HTMLInputTypeAttribute
  placeholder?: string
}

export function Search({ className = '', placeholder }: SearchProps) {
  const { t } = useTranslation()
  const { setOpen } = useSearch()
  const resolvedPlaceholder = placeholder ?? t('Search')
  return (
    <Button
      variant='outline'
      className={cn(
        'bg-muted/25 group text-muted-foreground hover:bg-accent relative h-10 w-full flex-1 justify-start gap-2 rounded-md text-sm font-normal shadow-none sm:w-40 sm:pe-12 md:flex-none lg:w-52 xl:w-64',
        className
      )}
      onClick={() => setOpen(true)}
      // 可访问名称必须包含可见文本 tokens（axe label-content-name-mismatch）：
      // 快捷键徽标「⌘K」是可见文本，aria-hidden 无法把它从 axe 的
      // visible-text 计算里剔除（aria-hidden 只影响语义树，不影响视觉可见性），
      // 所以 aria-label 必须把「⌘K」一并纳入，name 与可见文本 tokens 才一致。
      aria-label={`${resolvedPlaceholder} ⌘${t('K')}`}
    >
      {/* 图标走 flex 排布，不再用 `absolute start-1.5` + 文字 `ms-4` 目测错位：
          图标与占位符靠 `gap-2` 排开，尺寸换成 18px（规范 §2.2 工具栏档）
          也不需要重算文字缩进。 */}
      <SearchIcon aria-hidden='true' className='size-4.5 shrink-0' />
      <span className='truncate'>{resolvedPlaceholder}</span>
      {/* The badge is 20px tall inside a 40px button, so vertical centering
          leaves 9px inside the padding box. `end-[9px]` mirrors that gap on
          the right; the old 4px inset made the shortcut visibly hug the edge. */}
      <kbd
        aria-hidden='true'
        className='bg-background text-muted-foreground text-mono pointer-events-none absolute end-[9px] top-1/2 hidden h-5 -translate-y-1/2 items-center gap-1 rounded border px-1 font-mono text-xs font-medium opacity-100 select-none sm:flex'
      >
        <span>⌘</span>
        {t('K')}
      </kbd>
    </Button>
  )
}
