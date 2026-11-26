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

// getOptionValue only keeps keys declared here. Every provider field that must
// survive a page reload has to be listed, including the independent API address.
export const defaultChannelProviderSettings: ChannelProviderSettings = {
  ChannelProviderCredentialMasks: '{}',
  'channel_provider.featured.login_url': '',
  'channel_provider.featured.username': '',
  'channel_provider.featured.password': '',
  'channel_provider.featured.api_key': '',
  'channel_provider.featured.api_url': '',
  'channel_provider.bailian.login_url': '',
  'channel_provider.bailian.username': '',
  'channel_provider.bailian.password': '',
  'channel_provider.bailian.api_key': '',
  'channel_provider.bailian.api_url': '',
  'channel_provider.bailian.access_key_id': '',
  'channel_provider.bailian.access_key_secret': '',
  'channel_provider.subscription.login_url': '',
  'channel_provider.subscription.username': '',
  'channel_provider.subscription.password': '',
  'channel_provider.subscription.api_key': '',
  'channel_provider.subscription.api_url': '',
}
