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

import { isMaskedSecret } from '@/lib/secret'

import type { ChannelProviderSettings } from '../../types'
import { readChannelProviderCredentialSlots } from '../channel-provider-credential-slots'
import {
  applyChannelProviderMaskView,
  buildChannelProviderUpdates,
  channelProviderOptionKey,
  type ChannelProviderFormValues,
} from '../channel-provider-settings-form'

const baseSettings: ChannelProviderSettings = {
  ChannelProviderCredentialMasks: '{}',
  'channel_provider.featured.login_url': '',
  'channel_provider.featured.username': '',
  'channel_provider.featured.password': 'abcd****wxyz',
  'channel_provider.featured.api_key': 'abcd****wxyz',
  'channel_provider.bailian.login_url': '',
  'channel_provider.bailian.username': '',
  'channel_provider.bailian.password': '',
  'channel_provider.bailian.api_key': '',
  'channel_provider.subscription.login_url': '',
  'channel_provider.subscription.username': '',
  'channel_provider.subscription.password': '',
  'channel_provider.subscription.api_key': '',
  'channel_provider.subscription.credential_slots': '[]',
}

const masked: ChannelProviderFormValues = {
  loginUrl: 'https://console.example.com',
  username: 'operator',
  password: 'abcd****wxyz',
  apiKey: 'key1\nkey2',
  apiUrl: 'https://api.example.com',
  slots: [],
}

describe('applyChannelProviderMaskView', () => {
  it('uses per-line masks for multiline secrets', () => {
    const view = JSON.stringify({
      featured: {
        password: 'pass****word',
        api_key: 'line****one\nshor*\nline****two',
      },
    })

    const result = applyChannelProviderMaskView(baseSettings, [
      { key: 'ChannelProviderCredentialMasks', value: view },
    ])

    expect(result['channel_provider.featured.api_key']).toBe(
      'line****one\nshor*\nline****two'
    )
    expect(result['channel_provider.featured.password']).toBe('pass****word')
    expect(result['channel_provider.bailian.api_key']).toBe('')
  })

  it('restores the derived Bailian AccessKey Secret mask', () => {
    const view = JSON.stringify({
      bailian: { access_key_secret: 'UTER****0001' },
    })

    const result = applyChannelProviderMaskView(baseSettings, [
      { key: 'ChannelProviderCredentialMasks', value: view },
    ])

    expect(result['channel_provider.bailian.access_key_secret']).toBe(
      'UTER****0001'
    )
    expect(result['channel_provider.bailian.access_key_id']).toBeUndefined()
  })

  it('keeps option-level masks when the derived view is invalid', () => {
    expect(
      applyChannelProviderMaskView(baseSettings, [
        { key: 'ChannelProviderCredentialMasks', value: 'not-json' },
      ])
    ).toBe(baseSettings)
  })

  // Regression: getOptionValue only keeps keys declared in defaultSettings, so
  // the dynamic credential_slots key is dropped before this resolver runs.
  // After a save refetch that made useResetForm wipe the operator's groups,
  // the slots looked "completely cleared" for every managed provider.
  it.each(['featured', 'bailian', 'subscription'] as const)(
    '%s restores saved credential slots after getOptionValue dropped them',
    (prefix) => {
      const slotId = `slot-${prefix}`
      const metadata = JSON.stringify([
        {
          id: slotId,
          group: 'claude-standard',
          label: 'Claude Standard',
          mode: 'multi_to_single',
          strategy: 'polling',
        },
      ])
      // What SettingsPage passes in: slot keys were filtered out of settings
      // by getOptionValue, but are still present in the raw option list.
      const settingsAfterFilter: ChannelProviderSettings = {
        ...baseSettings,
        [`channel_provider.${prefix}.credential_slots`]: '',
      }
      const raw = [
        { key: `channel_provider.${prefix}.credential_slots`, value: metadata },
        {
          key: 'ChannelProviderCredentialMasks',
          value: JSON.stringify({
            [prefix]: {
              password: '',
              api_key: '',
              slots: [{ id: slotId, api_key: 'key1****aaaa\nkey2****bbbb' }],
            },
          }),
        },
      ]

      const resolved = applyChannelProviderMaskView(settingsAfterFilter, raw)
      const slots = readChannelProviderCredentialSlots(resolved, prefix)

      expect(slots).toHaveLength(1)
      expect(slots[0]).toMatchObject({
        slotId,
        group: 'claude-standard',
        mode: 'multi_to_single',
        strategy: 'polling',
        apiKey: 'key1****aaaa\nkey2****bbbb',
      })
      // Plaintext from the raw slot key must never leak into form state.
      expect(JSON.stringify(slots)).not.toContain('sk-plaintext')
    }
  )

  // Regression: a save bug once overwrote all providers' credential_slots
  // with a single stale id while the real keys survived under other ids. The
  // operator saw "no API keys"; recovery must rebuild every slot from the
  // authoritative option keys instead of trusting the stale metadata.
  it('recovers saved keys when credential_slots metadata lost their ids', () => {
    const staleMetadata = JSON.stringify([
      { id: 'slot-stale', group: '', label: '', mode: 'single', strategy: 'random' },
    ])
    const savedSlots = [
      { id: 'slot-kiro', group: 'Claude-kiro' },
      { id: 'slot-max', group: 'Claude-max' },
      { id: 'slot-codex', group: 'Codex Pro' },
    ]
    const raw = [
      {
        key: 'channel_provider.subscription.credential_slots',
        value: staleMetadata,
      },
      {
        key: 'ChannelProviderCredentialMasks',
        value: JSON.stringify({ subscription: { password: '', api_key: '' } }),
      },
      ...savedSlots.map((slot) => ({
        key: `channel_provider.subscription.slot_${slot.id}_api_key`,
        value: `sk-${slot.group.replace(/\W/g, '')}****key`,
      })),
    ]

    const resolved = applyChannelProviderMaskView(baseSettings, raw)
    const slots = readChannelProviderCredentialSlots(resolved, 'subscription')

    // All recovered keys are present, and the stale metadata entry is kept
    // rather than dropped so no operator-configured slot is silently lost.
    const slotIds = slots.map((slot) => slot.slotId)
    expect(slotIds).toEqual(
      expect.arrayContaining(savedSlots.map((slot) => slot.id))
    )
    expect(slotIds).toContain('slot-stale')
    for (const slot of slots.filter((item) =>
      savedSlots.some((saved) => saved.id === item.slotId)
    )) {
      expect(isMaskedSecret(slot.apiKey)).toBe(true)
    }
  })
})

describe('buildChannelProviderUpdates', () => {
  it('does not write backend masks back to secret options', () => {
    expect(buildChannelProviderUpdates('featured', masked, masked)).toEqual([])
  })

  it('maps every changed field to its full option key and keeps multiline keys', () => {
    const values: ChannelProviderFormValues = {
      loginUrl: 'https://new.example.com',
      username: 'new-operator',
      password: 'new-password',
      apiKey: 'line-one\nline-two',
      apiUrl: 'https://new-api.example.com',
      slots: [],
    }

    expect(buildChannelProviderUpdates('featured', values, masked)).toEqual([
      {
        key: 'channel_provider.featured.login_url',
        value: 'https://new.example.com',
      },
      { key: 'channel_provider.featured.username', value: 'new-operator' },
      { key: 'channel_provider.featured.password', value: 'new-password' },
      { key: 'channel_provider.featured.api_key', value: 'line-one\nline-two' },
      {
        key: 'channel_provider.featured.api_url',
        value: 'https://new-api.example.com',
      },
    ])
  })

  it('skips blank secrets but still saves non-secret changes', () => {
    const values: ChannelProviderFormValues = {
      ...masked,
      username: 'renamed',
      password: '',
      apiKey: '',
    }

    expect(buildChannelProviderUpdates('bailian', values, masked)).toEqual([
      { key: 'channel_provider.bailian.username', value: 'renamed' },
    ])
  })

  it('writes the Bailian AccessKey pair and never writes back masks', () => {
    const defaults: ChannelProviderFormValues = {
      ...masked,
      accessKeyId: 'UTER****0001',
      accessKeySecret: 'UTER****0001',
    }
    expect(buildChannelProviderUpdates('bailian', defaults, defaults)).toEqual(
      []
    )

    const values: ChannelProviderFormValues = {
      ...defaults,
      accessKeyId: 'UTERFAKEID0000002',
      accessKeySecret: 'UTERFAKESECRET0002',
    }
    expect(buildChannelProviderUpdates('bailian', values, defaults)).toEqual([
      {
        key: 'channel_provider.bailian.access_key_id',
        value: 'UTERFAKEID0000002',
      },
      {
        key: 'channel_provider.bailian.access_key_secret',
        value: 'UTERFAKESECRET0002',
      },
    ])
  })

  it('uses the provider prefix for subscription credentials', () => {
    expect(channelProviderOptionKey('subscription', 'apiKey')).toBe(
      'channel_provider.subscription.api_key'
    )
  })
})
