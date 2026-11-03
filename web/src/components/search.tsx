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
      size='sm'
      variant='outline'
      className={cn(
        'bg-muted/25 group text-muted-foreground hover:bg-accent relative w-full flex-1 justify-start gap-2 rounded-md text-sm font-normal shadow-none sm:w-40 sm:pe-12 md:flex-none lg:w-52 xl:w-64',
        className
      )}
      onClick={() => setOpen(true)}
      aria-label={resolvedPlaceholder}
    >
      {/* 图标走 flex 排布，不再用 `absolute start-1.5` + 文字 `ms-4` 目测错位：
          图标与占位符靠 `gap-2` 排开，尺寸换成 18px（规范 §2.2 工具栏档）
          也不需要重算文字缩进。 */}
      <SearchIcon aria-hidden='true' className='size-4.5 shrink-0' />
      <span className='truncate'>{resolvedPlaceholder}</span>
      {/* 3.0 §7 审计整改：快捷键徽标偏移网格化，0.3rem(4.8px) → 4px（sp-1） */}
      <kbd className='bg-background text-muted-foreground text-mono pointer-events-none absolute end-1 top-1 hidden h-5 items-center gap-1 rounded border px-1.5 font-mono font-medium opacity-100 select-none sm:flex'>
        <span className='text-xs'>⌘</span>
        {t('K')}
      </kbd>
    </Button>
  )
}
