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

import { Button } from '@/components/ui/button'
import { Heading } from '@/design-system'

export function MaintenanceError() {
  const { t } = useTranslation()
  return (
    <div className='h-svh'>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        {/* 3.0 §3 审计整改：页面标题走 Heading page-title（600 字重） */}
        <Heading variant='page-title'>503</Heading>
        <span className='font-medium'>
          {t('Website is under maintenance!')}
        </span>
        <p className='text-muted-foreground text-center'>
          {t('The site is not available at the moment.')} <br />
          {t("We'll be back online shortly.")}
        </p>
        <div className='mt-6 flex gap-4'>
          <Button variant='outline'>{t('Learn more')}</Button>
        </div>
      </div>
    </div>
  )
}
