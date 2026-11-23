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

import { Alert, AlertDescription } from '@/components/ui/alert'
import { useStatus } from '@/hooks/use-status'

import { CheckinCalendarCard } from './components/checkin-calendar-card'
import { PersonalPageLayout } from './components/personal-page-layout'
import { useProfile } from './hooks'

export function Checkin() {
  const { t } = useTranslation()
  const { profile, loading, refreshProfile } = useProfile()
  const { status } = useStatus()

  const checkinEnabled = status?.checkin_enabled === true
  const turnstileEnabled = !!(
    status?.turnstile_check && status?.turnstile_site_key
  )

  return (
    <PersonalPageLayout
      title={t('Daily Check-in')}
      profile={profile}
      loading={loading}
    >
      {checkinEnabled ? (
        <CheckinCalendarCard
          checkinEnabled={checkinEnabled}
          turnstileEnabled={turnstileEnabled}
          turnstileSiteKey={status?.turnstile_site_key || ''}
          onCheckinSuccess={() => void refreshProfile()}
        />
      ) : (
        <Alert>
          <AlertDescription>
            {t('Check-in feature is not enabled')}
          </AlertDescription>
        </Alert>
      )}
    </PersonalPageLayout>
  )
}
