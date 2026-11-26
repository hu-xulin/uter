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
import type { ChannelProviderSettings } from '../types'
import { createSectionRegistry } from '../utils/section-registry'
import { ChannelProviderSettingsSection } from './channel-provider-settings-section'
import type { ChannelCredentialDisclosure } from './use-channel-credential-disclosure'

function readValues(
  settings: ChannelProviderSettings,
  prefix: 'featured' | 'bailian' | 'subscription'
) {
  return {
    loginUrl: settings[`channel_provider.${prefix}.login_url`] ?? '',
    username: settings[`channel_provider.${prefix}.username`] ?? '',
    password: settings[`channel_provider.${prefix}.password`] ?? '',
    apiKey: settings[`channel_provider.${prefix}.api_key`] ?? '',
  }
}

const CHANNEL_SECTIONS = [
  {
    id: 'featured',
    titleKey: 'Uter Select',
    build: (
      settings: ChannelProviderSettings,
      disclosure: ChannelCredentialDisclosure
    ) => (
      <ChannelProviderSettingsSection
        title='Uter Select'
        description='Used when creating Uter Route channels; saved values fill empty connection fields on the server.'
        prefix='featured'
        values={readValues(settings, 'featured')}
        disclosure={disclosure}
      />
    ),
  },
  {
    id: 'bailian',
    titleKey: 'Uter Bailian',
    build: (
      settings: ChannelProviderSettings,
      disclosure: ChannelCredentialDisclosure
    ) => (
      <ChannelProviderSettingsSection
        title='Uter Bailian'
        description='Used when creating Alibaba Bailian channels; saved values fill empty connection fields on the server.'
        prefix='bailian'
        values={readValues(settings, 'bailian')}
        disclosure={disclosure}
      />
    ),
  },
  {
    id: 'subscription',
    titleKey: 'Uter Subscription',
    build: (
      settings: ChannelProviderSettings,
      disclosure: ChannelCredentialDisclosure
    ) => (
      <ChannelProviderSettingsSection
        title='Uter Subscription'
        description='Used when creating Uter.api channels; saved values fill empty connection fields on the server.'
        prefix='subscription'
        values={readValues(settings, 'subscription')}
        disclosure={disclosure}
      />
    ),
  },
] as const

export type ChannelSectionId = (typeof CHANNEL_SECTIONS)[number]['id']

const channelRegistry = createSectionRegistry<
  ChannelSectionId,
  ChannelProviderSettings,
  [ChannelCredentialDisclosure]
>({
  sections: CHANNEL_SECTIONS,
  defaultSection: 'featured',
  basePath: '/system-settings/channels',
  urlStyle: 'path',
})

export const CHANNEL_SECTION_IDS = channelRegistry.sectionIds
export const CHANNEL_DEFAULT_SECTION = channelRegistry.defaultSection
export const getChannelSectionNavItems = channelRegistry.getSectionNavItems
export const getChannelSectionContent = channelRegistry.getSectionContent
export const getChannelSectionMeta = channelRegistry.getSectionMeta
