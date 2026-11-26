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
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { SettingsSection } from '@/features/system-settings/components/settings-section'
import { RequestPluginManager } from '@/features/task-plugins/components/request-plugin-manager'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/request-processing/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()
    if (auth.user?.role !== ROLE.SUPER_ADMIN) throw redirect({ to: '/403' })
  },
  component: RequestProcessingPage,
})

function RequestProcessingPage() {
  const { t } = useTranslation()
  return (
    <div className='mx-auto w-full max-w-7xl p-4'>
      <SettingsSection title={t('Request processing')}>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Configure the request plugin instances that run on relay requests. Instances run in the order shown.'
          )}
        </p>
        <RequestPluginManager />
      </SettingsSection>
    </div>
  )
}
