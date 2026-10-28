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
import { Check, Moon, Sun } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/context/theme-provider'
import { useThemeColor } from '@/lib/theme-color'
import { cn } from '@/lib/utils'

export function ThemeSwitch() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()

  /* 浏览器 UI（iOS Safari / Android Chrome 地址栏）跟随主题背景色。
   * 色值从 `--background` Token 解析，浅色/深色与主题预设都会同步，
   * 不在组件里写死十六进制（旧实现是两个写死的浅/深底色，与 Token 脱钩）。 */
  const backgroundColor = useThemeColor('--background')
  useEffect(() => {
    if (!backgroundColor) return
    const metaThemeColor = document.querySelector("meta[name='theme-color']")
    if (metaThemeColor) metaThemeColor.setAttribute('content', backgroundColor)
  }, [backgroundColor])

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger render={<Button variant='ghost' size='icon' />}>
        <Sun className='size-4.5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90' />
        <Moon className='absolute size-4.5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0' />
        <span className='sr-only'>{t('Toggle theme')}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuItem onClick={() => setTheme('light')}>
          {t('Light')}{' '}
          <Check
            className={cn('size-4 ms-auto', theme !== 'light' && 'hidden')}
          />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          {t('Dark')}
          <Check
            className={cn('size-4 ms-auto', theme !== 'dark' && 'hidden')}
          />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          {t('System')}
          <Check
            className={cn('size-4 ms-auto', theme !== 'system' && 'hidden')}
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
