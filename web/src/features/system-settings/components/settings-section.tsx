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
import { cn } from '@/lib/utils'

import { useSuppressSettingsSectionHeader } from './settings-page-context'

type SettingsSectionProps = {
  title: string
  titleProps?: React.HTMLAttributes<HTMLHeadingElement>
  children: React.ReactNode
  className?: string
}

export function SettingsSection({
  title,
  titleProps,
  children,
  className,
}: SettingsSectionProps) {
  const suppressHeader = useSuppressSettingsSectionHeader()

  return (
    <section className={cn('flex flex-col gap-4', className)}>
      {!suppressHeader && (
        <div className='flex flex-col gap-1'>
          {/* 区块标题走规范 h3 档（18/600/28）。此前是 16/600 —— 16px 在阶梯里
              只有 body（400 字重）一档，用它做标题会与正文同号、只靠字重区分，
              页面在 30px 页标题之下就断了层级。 */}
          <h3
            {...titleProps}
            className={cn('text-lg font-semibold', titleProps?.className)}
          >
            {title}
          </h3>
        </div>
      )}
      {children}
    </section>
  )
}
