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
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useScrolled } from '@/hooks/use-scrolled'
import { cn } from '@/lib/utils'

type HeaderProps = React.HTMLAttributes<HTMLElement>

export function Header({ className, children, ...props }: HeaderProps) {
  const scrolled = useScrolled()
  return (
    <header
      className={cn(
        'sticky top-0 z-40 h-[var(--app-header-height,3rem)] w-full shrink-0 transition-[background-color,box-shadow,border-color,backdrop-filter] ds-motion-base',
        scrolled ? 'bg-background/85 backdrop-blur-xl' : 'bg-transparent',
        className
      )}
      {...props}
    >
      {/* 底线用叠加层而非 border：border 会占掉 1px 盒内高度，
          使整行控件的中心落在 31.5px，而不是 64px 顶栏的真实中心 32px。 */}
      <span
        aria-hidden='true'
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 h-px transition-colors ds-motion-base',
          scrolled ? 'bg-border/60' : 'bg-transparent'
        )}
      />
      <div className='flex h-full items-center gap-1.5 px-2 sm:gap-2 sm:px-3'>
        <SidebarTrigger variant='ghost' className='size-10' />
        {children}
      </div>
    </header>
  )
}
