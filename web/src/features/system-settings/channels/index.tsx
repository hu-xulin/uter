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
import type { ChannelProviderSettings } from '../types'
import {
  CHANNEL_DEFAULT_SECTION,
  getChannelSectionContent,
  getChannelSectionMeta,
} from './section-registry.tsx'
import { applyChannelProviderMaskView } from './channel-provider-settings-form'
import { useChannelCredentialDisclosure } from './use-channel-credential-disclosure'

const defaultChannelProviderSettings: ChannelProviderSettings = {
  ChannelProviderCredentialMasks: '{}',
  'channel_provider.featured.login_url': '',
  'channel_provider.featured.username': '',
  'channel_provider.featured.password': '',
  'channel_provider.featured.api_key': '',
  'channel_provider.bailian.login_url': '',
  'channel_provider.bailian.username': '',
  'channel_provider.bailian.password': '',
  'channel_provider.bailian.api_key': '',
  'channel_provider.subscription.login_url': '',
  'channel_provider.subscription.username': '',
  'channel_provider.subscription.password': '',
  'channel_provider.subscription.api_key': '',
}

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
