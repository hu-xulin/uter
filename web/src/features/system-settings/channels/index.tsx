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
import { SecureVerificationDialog } from '@/features/auth/secure-verification'

import { SettingsPage } from '../components/settings-page'
import { defaultChannelProviderSettings } from './channel-provider-settings-defaults'
import { applyChannelProviderMaskView } from './channel-provider-settings-form'
import {
  CHANNEL_DEFAULT_SECTION,
  getChannelSectionContent,
  getChannelSectionMeta,
} from './section-registry.tsx'
import { useChannelCredentialDisclosure } from './use-channel-credential-disclosure'

export function ChannelSettings() {
  const disclosure = useChannelCredentialDisclosure()

  return (
    <>
      <SettingsPage
        routePath='/_authenticated/system-settings/channels/$section'
        defaultSettings={defaultChannelProviderSettings}
        defaultSection={CHANNEL_DEFAULT_SECTION}
        getSectionContent={getChannelSectionContent}
        getSectionMeta={getChannelSectionMeta}
        resolveSettings={applyChannelProviderMaskView}
        extraArgs={[disclosure]}
      />
      <SecureVerificationDialog {...disclosure.verification.dialogProps} />
    </>
  )
}
