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
import { Link, useLocation } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import { getTopNavActive } from '../lib/url-utils'
import type { TopNavLink } from '../types'

type TopNavProps = React.HTMLAttributes<HTMLElement> & {
  links: TopNavLink[]
}

/**
 * 顶部导航栏组件
 * 在大屏幕显示水平导航，在小屏幕显示下拉菜单
 */
export function TopNav({ className, links, ...props }: TopNavProps) {
  const { t } = useTranslation()
  // 规范化链接，确保所有可选属性都有默认值
  const normalizedLinks = useMemo(
    () =>
      links.map((link) => ({
        disabled: false,
        external: false,
        ...link,
      })),
    [links]
  )
  // 选中态由当前路径决定；外链（如外部知识库文档）不参与匹配
  const pathname = useLocation({ select: (location) => location.pathname })

  return (
    <>
      {/* 移动端下拉菜单 */}
      <div className='lg:hidden'>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger
            render={
              <Button
                size='icon-sm'
                variant='outline'
                aria-label={t('Toggle navigation menu')}
              />
            }
          >
            <Menu />
          </DropdownMenuTrigger>
          <DropdownMenuContent side='bottom' align='start'>
            {normalizedLinks.map((link) => {
              const { title, href, disabled, external } = link
              const isActive = getTopNavActive(pathname, link, normalizedLinks)
              return (
                <DropdownMenuItem
                  key={`${title}-${href}`}
                  render={
                    external ? (
                      <a
                        href={href}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-muted-foreground font-medium'
                      >
                        {title}
                      </a>
                    ) : (
                      <Link
                        to={href}
                        className={cn(
                          isActive
                            ? 'text-foreground font-semibold'
                            : 'text-muted-foreground font-medium'
                        )}
                        disabled={disabled}
                      >
                        {title}
                      </Link>
                    )
                  }
                />
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 桌面端水平导航 */}
      <nav
        className={cn(
          'hidden items-center space-x-4 lg:flex lg:space-x-4 xl:space-x-6',
          className
        )}
        {...props}
      >
        {normalizedLinks.map((link) => {
          const { title, href, disabled, external } = link
          const isActive = getTopNavActive(pathname, link, normalizedLinks)
          if (external) {
            return (
              <a
                key={`${title}-${href}`}
                href={href}
                target='_blank'
                rel='noopener noreferrer'
                className='hover:text-fg-link text-muted-foreground text-sm font-medium transition-colors'
              >
                {title}
              </a>
            )
          }
          return (
            <Link
              key={`${title}-${href}`}
              to={href}
              disabled={disabled}
              className={cn(
                'hover:text-fg-link text-sm transition-colors',
                isActive
                  ? 'text-foreground font-semibold'
                  : 'text-muted-foreground font-medium'
              )}
            >
              {title}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
