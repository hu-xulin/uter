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
import { QueryClient } from '@tanstack/react-query'
import { vi } from 'vitest'

import { api } from '@/lib/api'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import type { UterAPIPricingGroup } from '../../api'
import { channelSchema, type Channel } from '../../types'

export type WizardMockOverrides = {
  groups?: UterAPIPricingGroup[]
  groupsError?: boolean
  /** Return null to simulate an empty catalogue for the requested group. */
  pricePreviewItems?: (group: string) => unknown[] | null
  pricePreviewError?: boolean
  editingRow?: Channel | null
  /** Rows returned by the channel-model-pricing detail query. */
  pricingRows?: unknown[]
  /** Uter Route endpoint lookup; return null to simulate lookup failure. */
  uterRouteEndpoint?: { base_url: string; host: string } | null
  /** Uter Route upstream snapshot; defaults to unsynced. */
  uterRouteSnapshot?: unknown
  /** Bailian sync status; defaults to unsynced. */
  bailianStatus?: unknown
  /** Bailian catalogue coverage; defaults to no coverage block. */
  bailianCoverage?: unknown
  /** Channel provider credential masks returned by GET /api/option/. */
  providerCredentialMasks?: Record<
    string,
    { password?: string; api_key?: string }
  >
  /** Extra GET URLs handled by the caller, or an error to throw. */
  extraGet?: (url: string, config?: unknown) => unknown | undefined
}

export type WizardMockState = {
  client: QueryClient
  postSpy: ReturnType<typeof vi.spyOn>
  putSpy: ReturnType<typeof vi.spyOn>
  originalAuth: ReturnType<typeof useAuthStore.getState>['auth']
}

export const wizardOriginalAuth = useAuthStore.getState().auth

const DEFAULT_GROUPS: UterAPIPricingGroup[] = [
  { key: 'Claude-kiro', name: 'Claude Economy', ratio: 0.9 },
  { key: 'Claude-max', name: 'Claude Standard', ratio: 2.5 },
  { key: 'Claude-稳定', name: 'Claude Advanced', ratio: 3.5 },
]

function previewItem(modelName: string) {
  return {
    channel_id: 0,
    model_name: modelName,
    provider: 'uterapi',
    region: '',
    deployment_id: '',
    currency: 'USD',
    pricing_source: 'newapi:/api/pricing',
    pricing_status: 'official_only',
    pricing_version: '',
    price_supported: true,
    fetched_at: 1,
    updated_at: 1,
    stale: false,
    fetched_age_hours: 0,
    official: {
      currency: 'USD',
      unit: 'per_1m_token',
      tiers: [
        {
          range_name: 'base',
          unit: 'per_1m_token',
          input_per_million_usd: 10,
          output_per_million_usd: 50,
        },
      ],
      source: 'newapi:/api/pricing',
      fetched_at: 1,
    },
    upstream_quote: {
      price_basis: 'CHANNEL_DISCOUNT',
      currency: 'USD',
      unit: 'per_1m_token',
      input_per_million_usd: 25,
      output_per_million_usd: 125,
      source: 'uterroute-discount',
    },
  }
}

/** Install all API mocks the channel wizard touches. Call in beforeEach. */
export function setupWizardApiMocks(
  overrides: WizardMockOverrides = {}
): WizardMockState {
  const groups = overrides.groups ?? DEFAULT_GROUPS
  const editingRow =
    overrides.editingRow === undefined
      ? undefined
      : (overrides.editingRow ?? undefined)
  const currentRow =
    editingRow ??
    channelSchema.parse({
      id: 42,
      name: 'Existing channel',
      type: 1,
      key: '',
      status: 1,
      created_time: 1,
      test_time: 0,
      response_time: 0,
      balance_updated_time: 0,
      models: 'custom-model',
      group: 'default',
      base_url: 'https://saved.example',
    })

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  useAuthStore.setState({
    auth: {
      ...wizardOriginalAuth,
      user: { id: 1, username: 'root', role: ROLE.SUPER_ADMIN },
    },
  })

  vi.spyOn(api, 'get').mockImplementation(async (url, config) => {
    const extra = overrides.extraGet?.(url, config)
    if (extra !== undefined) return { data: { success: true, data: extra } }

    if (url === '/api/option/') {
      return {
        data: {
          success: true,
          data: [
            {
              key: 'ChannelProviderCredentialMasks',
              value: JSON.stringify(
                overrides.providerCredentialMasks ?? {
                  featured: { api_key: 'route-key****one\nroute-key****two' },
                  bailian: { api_key: 'bailian-key****one' },
                  subscription: { api_key: 'sub-key****one' },
                }
              ),
            },
          ],
        },
      }
    }
    if (url === '/api/upstream/uterroute/endpoint') {
      const endpoint = overrides.uterRouteEndpoint
      if (endpoint === null) throw new Error('endpoint unavailable')
      return {
        data: {
          success: true,
          data: endpoint ?? {
            base_url: 'https://route.example.com',
            host: 'route.example.com',
          },
        },
      }
    }
    if (url === '/api/upstream/uterroute/snapshot') {
      return {
        data: {
          success: true,
          data: overrides.uterRouteSnapshot ?? { synced: false },
        },
      }
    }
    if (url === '/api/ratio_sync/bailian/status') {
      return {
        data: {
          success: true,
          data: overrides.bailianStatus ?? { synced: false },
        },
      }
    }
    if (
      typeof url === 'string' &&
      /^\/api\/channel\/\d+\/bailian\/coverage$/.test(url)
    ) {
      return {
        data: {
          success: true,
          data: overrides.bailianCoverage ?? { models: [], unmatched: 0 },
        },
      }
    }
    if (url === '/api/channel/uterapi/groups') {
      if (overrides.groupsError) throw new Error('groups unavailable')
      return { data: { success: true, data: { groups } } }
    }
    if (url === '/api/channel/uterapi/price-preview') {
      if (overrides.pricePreviewError) throw new Error('preview unavailable')
      const group =
        (config?.params as { group?: string } | undefined)?.group ?? ''
      const items = overrides.pricePreviewItems
        ? overrides.pricePreviewItems(group)
        : [previewItem('claude-preview')]
      return {
        data: {
          success: true,
          data: {
            group,
            group_name: groups.find((g) => g.key === group)?.name || group,
            ratio: groups.find((g) => g.key === group)?.ratio ?? 1,
            currency: 'USD',
            fetched_at: 1,
            authenticated: true,
            items: items ?? [],
          },
        },
      }
    }
    if (url === '/api/channel/42') {
      return { data: { success: true, data: currentRow } }
    }
    if (url === '/api/channel/fetch_models/42') {
      return { data: { success: true, data: ['upstream-model'] } }
    }
    if (
      typeof url === 'string' &&
      /^\/api\/channel\/\d+\/model_pricing$/.test(url)
    ) {
      return {
        data: {
          success: true,
          data: {
            channel_id: 42,
            items: overrides.pricingRows ?? [],
          },
        },
      }
    }
    if (url === '/api/task_plugin_options') {
      return { data: { success: true, data: [] } }
    }
    if (url === '/api/channel/models') {
      return { data: { success: true, data: [{ id: 'custom-model' }] } }
    }
    if (url === '/api/channel/default_base_urls') {
      return { data: { success: true, data: {} } }
    }
    if (url === '/api/group/') {
      return { data: { success: true, data: ['default', 'premium'] } }
    }
    if (url === '/api/prefill_group') {
      return { data: { success: true, data: [] } }
    }
    if (
      typeof url === 'string' &&
      url.startsWith('/api/channel/') &&
      /^\/api\/channel\/\d+$/.test(url)
    ) {
      return { data: { success: true, data: currentRow } }
    }
    throw new Error(`Unexpected GET ${url}`)
  })

  const postSpy = vi
    .spyOn(api, 'post')
    .mockResolvedValue({ data: { success: true, data: { created: 1 } } })
  const putSpy = vi
    .spyOn(api, 'put')
    .mockResolvedValue({ data: { success: true } })

  return { client, postSpy, putSpy, originalAuth: wizardOriginalAuth }
}

export function makeEditingChannel(overrides: Partial<Channel> = {}): Channel {
  return channelSchema.parse({
    id: 42,
    name: 'Existing channel',
    type: 1,
    key: '',
    status: 1,
    created_time: 1,
    test_time: 0,
    response_time: 0,
    balance_updated_time: 0,
    models: 'custom-model',
    group: 'default',
    base_url: 'https://saved.example',
    ...overrides,
  })
}
