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
import { describe, expect, it } from 'vitest'

import type { ChannelProviderSettings } from '../../types'
import {
  buildChannelProviderCredentialSlotUpdates,
  channelProviderSlotAPIKeyOption,
  readChannelProviderCredentialSlots,
  type ChannelProviderCredentialSlot,
} from '../channel-provider-credential-slots'

const slot = (
  overrides: Partial<ChannelProviderCredentialSlot> = {}
): ChannelProviderCredentialSlot => ({
  slotId: 'slot-claude',
  group: 'claude-economy',
  label: 'Claude Code · 经济',
  mode: 'multi_to_single',
  strategy: 'polling',
  apiKey: '',
  ...overrides,
})

describe('channel provider credential slots', () => {
  it('reads saved metadata together with the per-slot masked keys', () => {
    const settings: ChannelProviderSettings = {
      'channel_provider.subscription.credential_slots': JSON.stringify([
        {
          id: 'slot-claude',
          group: 'claude-economy',
          label: 'Claude Code · 经济',
          mode: 'multi_to_single',
          strategy: 'polling',
        },
      ]),
      'channel_provider.subscription.slot_slot-claude_api_key':
        'key1****aaaa\nkey2****bbbb',
    }

    expect(
      readChannelProviderCredentialSlots(settings, 'subscription')
    ).toEqual([slot({ apiKey: 'key1****aaaa\nkey2****bbbb' })])
  })

  it('writes slot metadata and new plaintext keys without writing masks', () => {
    const defaults = [
      slot({ apiKey: 'key1****aaaa\nkey2****bbbb' }),
      slot({
        slotId: 'slot-codex',
        group: 'codex-standard',
        mode: 'single',
        strategy: 'random',
        apiKey: 'old****key',
      }),
    ]

    expect(
      buildChannelProviderCredentialSlotUpdates(
        'subscription',
        defaults,
        defaults
      )
    ).toEqual([])

    const values = [
      defaults[0],
      slot({
        slotId: 'slot-codex',
        group: 'codex-standard',
        label: '',
        mode: 'batch',
        strategy: 'random',
        apiKey: 'new-plaintext-key',
      }),
    ]

    expect(
      buildChannelProviderCredentialSlotUpdates(
        'subscription',
        values,
        defaults
      )
    ).toEqual([
      {
        key: 'channel_provider.subscription.credential_slots',
        value: JSON.stringify([
          {
            id: 'slot-claude',
            group: 'claude-economy',
            label: 'Claude Code · 经济',
            mode: 'multi_to_single',
            strategy: 'polling',
          },
          {
            id: 'slot-codex',
            group: 'codex-standard',
            label: '',
            mode: 'batch',
            strategy: 'random',
          },
        ]),
      },
      {
        key: channelProviderSlotAPIKeyOption('subscription', 'slot-codex'),
        value: 'new-plaintext-key',
      },
    ])
  })
})
