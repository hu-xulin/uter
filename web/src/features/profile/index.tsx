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

import { useStatus } from '@/hooks/use-status'
import { useAuthStore } from '@/stores/auth-store'

import { LanguagePreferencesCard } from './components/language-preferences-card'
import { PersonalPageLayout } from './components/personal-page-layout'
import { ProfileSettingsCard } from './components/profile-settings-card'
import { SidebarModulesCard } from './components/sidebar-modules-card'
import { useProfile } from './hooks'
import { UserSecretDisclosureProvider } from './hooks/use-user-secret-disclosure'

export function Profile() {
  const { t } = useTranslation()
  const { profile, loading, refreshProfile } = useProfile()
  const { status } = useStatus()
  const permissions = useAuthStore((s) => s.auth.user?.permissions)

  const canConfigureSidebar = permissions?.sidebar_settings !== false
  // Older cached status payloads lack these fields; the site default is on.
  const quotaRemindEnabled = status?.quota_remind_enabled !== false
  const quotaRemindThreshold = status?.quota_remind_threshold ?? 0

  return (
    <UserSecretDisclosureProvider>
      <PersonalPageLayout
        title={t('Settings')}
        profile={profile}
        loading={loading}
      >
        <ProfileSettingsCard
          profile={profile}
          loading={loading}
          onProfileUpdate={refreshProfile}
          quotaRemindEnabled={quotaRemindEnabled}
          quotaRemindThreshold={quotaRemindThreshold}
        />
        <LanguagePreferencesCard
          profile={profile}
          onProfileUpdate={refreshProfile}
        />
        {canConfigureSidebar && <SidebarModulesCard />}
      </PersonalPageLayout>
    </UserSecretDisclosureProvider>
  )
}
