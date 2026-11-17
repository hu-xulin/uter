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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { useSystemConfig } from '@/hooks/use-system-config'
import { BRAND_LOGO_BOX_CLASS, localizedBrandName } from '@/lib/brand'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t, i18n } = useTranslation()
  const { logo, loading } = useSystemConfig()
  const brandName = localizedBrandName(i18n.language)

  return (
    <div data-auth-surface='' className='relative grid h-svh max-w-none'>
      <Link
        to='/'
        className='absolute top-4 left-4 z-10 flex items-center gap-2.5 transition-opacity hover:opacity-80 sm:top-8 sm:left-8'
      >
        <div className={BRAND_LOGO_BOX_CLASS}>
          {loading ? (
            <Skeleton className='size-full rounded-lg' />
          ) : (
            <img
              src={logo}
              alt={t('Logo')}
              className='size-full rounded-lg object-contain'
            />
          )}
        </div>
        {loading ? (
          <Skeleton className='h-4 w-16' />
        ) : (
          /*
           * 这里是「logo + 站名」的品牌锁定区，属于标志而非页面标题：
           * 页面标题由登录卡自身的标题承担。用 span + 阶梯内的 20/28/600，
           * 不用 h1（h1 恒为 30/38/600，见规范 §1.3 四层标题）。
           */
          <span
            className='font-brand max-w-48 truncate text-xl font-semibold'
            title={brandName}
          >
            {brandName}
          </span>
        )}
      </Link>
      <div className='container flex items-center pt-16 sm:pt-0'>
        <div className='mx-auto flex w-full flex-col justify-center space-y-2 px-4 py-8 sm:w-[480px] sm:p-8'>
          {children}
        </div>
      </div>
    </div>
  )
}
