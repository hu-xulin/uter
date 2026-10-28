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
import { Search, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onClear: () => void
  placeholder?: string
  className?: string
}

export function SearchBar(props: SearchBarProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className={cn('relative', props.className)}>
      <Search className='text-tertiary-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2' />
      {/* 用统一 Input 而不是原生 <input>：高度、描边、焦点环、
          内边距全部来自控件 Token（B-08）。这里只补图标留白。 */}
      <Input
        ref={inputRef}
        type='text'
        placeholder={props.placeholder || t('Search models...')}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className='pr-16 pl-10'
        aria-label={t('Search models')}
      />
      <div className='absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-1'>
        {props.value ? (
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={props.onClear}
            className='text-tertiary-foreground hover:text-foreground'
            aria-label={t('Clear search')}
          >
            <X className='size-4.5' />
          </Button>
        ) : (
          <kbd className='bg-muted text-muted-foreground text-mono pointer-events-none hidden rounded border px-1.5 py-0.5 font-mono sm:inline-block'>
            ⌘K
          </kbd>
        )}
      </div>
    </div>
  )
}
