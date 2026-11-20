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
import { getGroups as getUserGroups } from '@/features/users/api'
import { api, type ApiRequestConfig } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import type { PriorityMove, PriorityOrder } from './lib/channel-priority-order'
import type { InferenceStatus } from './lib/inference-status'
import type {
  AddChannelRequest,
  BatchDeleteParams,
  BatchSetTagParams,
  Channel,
  ChannelBalanceResponse,
  ChannelInternalPricingView,
  ChannelModelPricingListResponse,
  ChannelModelPricingUpdateResponse,
  ChannelOpsResponse,
  ChannelTestResponse,
  CopyChannelParams,
  CopyChannelResponse,
  FetchModelsResponse,
  GetChannelResponse,
  GetChannelsParams,
  GetChannelsResponse,
  MultiKeyManageParams,
  MultiKeyStatusResponse,
  SearchChannelsParams,
  SearchChannelsResponse,
  TagOperationParams,
} from './types'

const channelActionConfig = (
  config: ApiRequestConfig = {}
): ApiRequestConfig => ({
  ...config,
  skipBusinessError: true,
  skipErrorHandler: true,
})

export async function getChannelPriorityOrder(): Promise<PriorityOrder> {
  const response = await api.get<{ success: boolean; data: PriorityOrder }>(
    '/api/channel/priority/order',
    { disableDuplicate: true }
  )
  return requireServerSuccess(response.data).data
}

export async function reorderChannelPriority(
  move: PriorityMove
): Promise<PriorityOrder> {
  const response = await api.post<{ success: boolean; data: PriorityOrder }>(
    '/api/channel/priority/reorder',
    move
  )
  return requireServerSuccess(response.data).data
}

export async function getInferenceStatus(
  channelId: number,
  provider: 'vllm' | 'sglang',
  signal?: AbortSignal
): Promise<InferenceStatus> {
  const response = await api.get<{ success: boolean; data: InferenceStatus }>(
    `/api/channel/${channelId}/${provider}/status`,
    { signal, disableDuplicate: true }
  )
  return requireServerSuccess(response.data).data
}

export type TaskPluginOption = {
  sortPriority?: number
  website?: string
  key: string
  name: string
  description?: Record<string, string> | null
  icon?: string
  hasIcon?: boolean
  baseUrl?: string
  models: string[]
  channelTypes?: number[] | null
  upstreams?: string[] | null
  /** The schema of a request processing instance's config. */
  configSchema?: Record<string, unknown> | null
  /** The schema of the channel plugin config, as the plugin declares it. */
  channelConfig?: Record<string, unknown> | null
  /** Hint and example of the channel key field, localized. */
  keyHint?: Record<string, string> | null
}

export async function getTaskPluginOptions(): Promise<TaskPluginOption[]> {
  const response = await api.get<{
    success: boolean
    data: TaskPluginOption[]
  }>('/api/task_plugin_options')
  // Go marshals a nil slice as JSON null. Plugins that declare no models are
  // still listed (so they can be bound and configured), so normalise the field
  // once here instead of letting every consumer dereference null.
  return requireServerSuccess(response.data).data.map((plugin) => ({
    ...plugin,
    models: plugin.models ?? [],
  }))
}

export type CodexUsageResponse = {
  success: boolean
  message?: string
  upstream_status?: number
  data?: Record<string, unknown>
}

export type CodexResetCreditsResponse = CodexUsageResponse

export type CodexUsageResetResponse = CodexUsageResponse

export type CodexCredentialRefreshResponse = {
  success: boolean
  message?: string
  data?: {
    expires_at?: string
    last_refresh?: string
    account_id?: string
    email?: string
    channel_id?: number
    channel_type?: number
    channel_name?: string
  }
}

// ============================================================================
// Base Channel CRUD Operations
// ============================================================================

/**
 * Get paginated list of channels
 */
export async function getChannels(
  params: GetChannelsParams = {}
): Promise<GetChannelsResponse> {
  const res = await api.get('/api/channel', { params })
  return res.data
}

/**
 * Search channels with filters
 */
export async function searchChannels(
  params: SearchChannelsParams
): Promise<SearchChannelsResponse> {
  const res = await api.get('/api/channel/search', { params })
  return res.data
}

/**
 * Get single channel by ID
 */
export async function getChannel(id: number): Promise<GetChannelResponse> {
  const res = await api.get(`/api/channel/${id}`)
  return res.data
}

/**
 * Get channel operations summary for administrators
 */
export async function getChannelOps(
  autoBan?: boolean
): Promise<ChannelOpsResponse> {
  // Keep the config in a single `ApiRequestConfig`-typed binding: passing the
  // object literal straight to `api.get` lets axios infer the query-params
  // generic from `{ auto_ban }`, which then rejects the spread helper config.
  const config: ApiRequestConfig = {
    ...channelActionConfig(),
    params: autoBan === undefined ? undefined : { auto_ban: autoBan },
  }
  const res = await api.get('/api/channel/ops', config)
  return res.data
}

export async function getChannelDefaultBaseURLs(): Promise<
  Partial<Record<number, string>>
> {
  const response = await api.get<{
    success: boolean
    data: Partial<Record<number, string>>
  }>('/api/channel/default_base_urls')
  return requireServerSuccess(response.data).data
}

/**
 * Create new channel(s)
 * Supports single, batch, and multi-key modes
 */
export async function createChannel(
  data: AddChannelRequest
): Promise<{ success: boolean; message?: string }> {
  const res = await api.post('/api/channel', data, channelActionConfig())
  return res.data
}

/**
 * Update existing channel
 */
export async function updateChannel(
  id: number,
  data: Partial<Channel>
): Promise<{ success: boolean; message?: string; data?: Channel }> {
  const res = await api.put(
    '/api/channel/',
    { id, ...data },
    channelActionConfig()
  )
  return res.data
}

/**
 * Update channel enabled/disabled status.
 */
export async function updateChannelStatus(
  id: number,
  status: number
): Promise<{ success: boolean; message?: string; data?: boolean }> {
  const res = await api.post(
    `/api/channel/${id}/status`,
    { status },
    channelActionConfig()
  )
  return res.data
}

/**
 * Batch update channel enabled/disabled status.
 */
export async function batchUpdateChannelStatus(
  ids: number[],
  status: number
): Promise<{ success: boolean; message?: string; data?: number }> {
  const res = await api.post(
    '/api/channel/status/batch',
    { ids, status },
    channelActionConfig()
  )
  return res.data
}

/**
 * Delete single channel
 */
export async function deleteChannel(
  id: number
): Promise<{ success: boolean; message?: string }> {
  const res = await api.delete(`/api/channel/${id}`, channelActionConfig())
  return res.data
}

/**
 * Batch delete channels
 */
export async function batchDeleteChannels(
  data: BatchDeleteParams
): Promise<{ success: boolean; message?: string; data?: number }> {
  const res = await api.post('/api/channel/batch', data, channelActionConfig())
  return res.data
}

/**
 * Batch set tag for channels
 */
export async function batchSetChannelTag(
  data: BatchSetTagParams
): Promise<{ success: boolean; message?: string; data?: number }> {
  const res = await api.post(
    '/api/channel/batch/tag',
    data,
    channelActionConfig()
  )
  return res.data
}

// ============================================================================
// Channel Operations
// ============================================================================

/**
 * Test channel connectivity
 */
export async function testChannel(
  id: number,
  params?: { model?: string; endpoint_type?: string; stream?: boolean }
): Promise<ChannelTestResponse> {
  const res = await api.get(
    `/api/channel/test/${id}`,
    channelActionConfig({ params })
  )
  return res.data
}

/**
 * Update channel balance
 */
export async function updateChannelBalance(
  id: number
): Promise<ChannelBalanceResponse> {
  const res = await api.get(
    `/api/channel/update_balance/${id}`,
    channelActionConfig()
  )
  return res.data
}

/**
 * Fetch available models from upstream provider
 */
export async function fetchUpstreamModels(
  id: number
): Promise<FetchModelsResponse> {
  const res = await api.get(
    `/api/channel/fetch_models/${id}`,
    channelActionConfig()
  )
  return res.data
}

export async function getChannelModelPricing(
  id: number
): Promise<ChannelModelPricingListResponse> {
  const res = await api.get<ChannelModelPricingListResponse>(
    `/api/channel/${id}/model_pricing`
  )
  return res.data
}

export async function seedChannelModelPricing(
  id: number,
  overwrite = false
): Promise<{
  success: boolean
  message?: string
  data?: { channel_id: number; seeded: number; skipped: number }
}> {
  const res = await api.post(
    `/api/channel/${id}/model_pricing/seed`,
    { overwrite },
    channelActionConfig()
  )
  return res.data
}

export async function setChannelModelPricing(
  id: number,
  modelName: string,
  pricing: ChannelInternalPricingView,
  identity?: { provider?: string; region?: string; deploymentId?: string }
): Promise<ChannelModelPricingUpdateResponse> {
  const res = await api.put<ChannelModelPricingUpdateResponse>(
    `/api/channel/${id}/model_pricing`,
    {
      model_name: modelName,
      provider: identity?.provider ?? '',
      region: identity?.region ?? '',
      deployment_id: identity?.deploymentId ?? '',
      pricing,
    },
    channelActionConfig()
  )
  return res.data
}

/**
 * Copy/clone a channel
 */
export async function copyChannel(
  id: number,
  params: CopyChannelParams = {}
): Promise<CopyChannelResponse> {
  const res = await api.post(
    `/api/channel/copy/${id}`,
    null,
    channelActionConfig({ params })
  )
  return res.data
}

/**
 * Fix channel abilities
 */
export async function fixChannelAbilities(): Promise<{
  success: boolean
  message?: string
  data?: { success: number; fails: number }
}> {
  const res = await api.post(
    '/api/channel/fix',
    undefined,
    channelActionConfig()
  )
  return res.data
}

/**
 * Delete all disabled channels
 */
export async function deleteDisabledChannels(): Promise<{
  success: boolean
  message?: string
  data?: number
}> {
  const res = await api.delete('/api/channel/disabled', channelActionConfig())
  return res.data
}

/**
 * Get channel key (requires 2FA verification)
 */
export async function getChannelKey(
  id: number,
  proofToken: string,
  signal?: AbortSignal
): Promise<{ success: boolean; message?: string; data?: { key: string } }> {
  const res = await api.post(
    `/api/channel/${id}/key`,
    undefined,
    channelActionConfig({
      headers: { 'X-Security-Proof': proofToken },
      signal,
    })
  )
  return res.data
}

// ============================================================================
// Codex Channel Operations
// ============================================================================

export async function refreshCodexCredential(
  channelId: number
): Promise<CodexCredentialRefreshResponse> {
  const res = await api.post(
    `/api/channel/${channelId}/codex/refresh`,
    {},
    channelActionConfig()
  )
  return res.data
}

export async function getCodexUsage(
  channelId: number
): Promise<CodexUsageResponse> {
  const res = await api.get(
    `/api/channel/${channelId}/codex/usage`,
    channelActionConfig({ disableDuplicate: true })
  )
  return res.data
}

export async function getCodexResetCredits(
  channelId: number
): Promise<CodexResetCreditsResponse> {
  const res = await api.get(
    `/api/channel/${channelId}/codex/usage/reset-credits`,
    channelActionConfig({ disableDuplicate: true })
  )
  return res.data
}

export async function resetCodexUsage(
  channelId: number
): Promise<CodexUsageResetResponse> {
  const res = await api.post(
    `/api/channel/${channelId}/codex/usage/reset`,
    {},
    channelActionConfig({ disableDuplicate: true })
  )
  return res.data
}

// ============================================================================
// Multi-Key Management
// ============================================================================

/**
 * Manage multi-key channel operations
 */
export async function manageMultiKeys(
  params: MultiKeyManageParams
): Promise<MultiKeyStatusResponse | { success: boolean; message?: string }> {
  const res = await api.post(
    '/api/channel/multi_key/manage',
    params,
    channelActionConfig()
  )
  return res.data
}

/**
 * Get key status for multi-key channel
 */
export async function getMultiKeyStatus(
  channelId: number,
  page = 1,
  pageSize = 50,
  status?: number
): Promise<MultiKeyStatusResponse> {
  return manageMultiKeys({
    channel_id: channelId,
    action: 'get_key_status',
    page,
    page_size: pageSize,
    status,
  }) as Promise<MultiKeyStatusResponse>
}

/**
 * Enable a specific key in multi-key channel
 */
export async function enableMultiKey(
  channelId: number,
  keyIndex: number
): Promise<{ success: boolean; message?: string }> {
  return manageMultiKeys({
    channel_id: channelId,
    action: 'enable_key',
    key_index: keyIndex,
  }) as Promise<{ success: boolean; message?: string }>
}

/**
 * Disable a specific key in multi-key channel
 */
export async function disableMultiKey(
  channelId: number,
  keyIndex: number
): Promise<{ success: boolean; message?: string }> {
  return manageMultiKeys({
    channel_id: channelId,
    action: 'disable_key',
    key_index: keyIndex,
  }) as Promise<{ success: boolean; message?: string }>
}

/**
 * Delete a specific key in multi-key channel
 */
export async function deleteMultiKey(
  channelId: number,
  keyIndex: number
): Promise<{ success: boolean; message?: string }> {
  return manageMultiKeys({
    channel_id: channelId,
    action: 'delete_key',
    key_index: keyIndex,
  }) as Promise<{ success: boolean; message?: string }>
}

/**
 * Enable all keys in multi-key channel
 */
export async function enableAllMultiKeys(
  channelId: number
): Promise<{ success: boolean; message?: string }> {
  return manageMultiKeys({
    channel_id: channelId,
    action: 'enable_all_keys',
  }) as Promise<{ success: boolean; message?: string }>
}

/**
 * Disable all keys in multi-key channel
 */
export async function disableAllMultiKeys(
  channelId: number
): Promise<{ success: boolean; message?: string }> {
  return manageMultiKeys({
    channel_id: channelId,
    action: 'disable_all_keys',
  }) as Promise<{ success: boolean; message?: string }>
}

/**
 * Delete all disabled keys in multi-key channel
 */
export async function deleteDisabledMultiKeys(
  channelId: number
): Promise<{ success: boolean; message?: string; data?: number }> {
  return manageMultiKeys({
    channel_id: channelId,
    action: 'delete_disabled_keys',
  }) as Promise<{ success: boolean; message?: string; data?: number }>
}

// ============================================================================
// Tag Operations
// ============================================================================

/**
 * Enable all channels with a specific tag
 */
export async function enableTagChannels(
  tag: string
): Promise<{ success: boolean; message?: string }> {
  const res = await api.post(
    '/api/channel/tag/enabled',
    { tag },
    channelActionConfig()
  )
  return res.data
}

/**
 * Disable all channels with a specific tag
 */
export async function disableTagChannels(
  tag: string
): Promise<{ success: boolean; message?: string }> {
  const res = await api.post(
    '/api/channel/tag/disabled',
    { tag },
    channelActionConfig()
  )
  return res.data
}

/**
 * Edit all channels with a specific tag
 */
export async function editTagChannels(
  params: TagOperationParams
): Promise<{ success: boolean; message?: string }> {
  const res = await api.put('/api/channel/tag', params, channelActionConfig())
  return res.data
}

/**
 * Get models for a specific tag
 */
export async function getTagModels(
  tag: string
): Promise<{ success: boolean; message?: string; data?: string }> {
  const res = await api.get('/api/channel/tag/models', { params: { tag } })
  return res.data
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Fetch models from the current unsaved channel form configuration.
 */
export async function fetchModels(data: {
  base_url: string
  type: number
  key?: string
  channel_id?: number
  advanced_custom?: string
  header_override?: string
  proxy?: string
}): Promise<FetchModelsResponse> {
  const res = await api.post(
    '/api/channel/fetch_models',
    data,
    channelActionConfig()
  )
  return res.data
}

/**
 * Delete an Ollama model from a channel
 */
export async function deleteOllamaModel(params: {
  channel_id: number
  model_name: string
}): Promise<{ success: boolean; message?: string }> {
  const res = await api.delete(
    '/api/channel/ollama/delete',
    channelActionConfig({ data: params })
  )
  return res.data
}

/**
 * Test all enabled channels
 */
export async function testAllChannels(): Promise<{
  success: boolean
  message?: string
}> {
  const res = await api.get('/api/channel/test', channelActionConfig())
  return res.data
}

/**
 * Update balance for all enabled channels
 */
export async function updateAllChannelsBalance(): Promise<{
  success: boolean
  message?: string
}> {
  const res = await api.get(
    '/api/channel/update_balance',
    channelActionConfig()
  )
  return res.data
}

/**
 * Get all available models
 */
export async function getAllModels(): Promise<{
  success: boolean
  message?: string
  data?: Array<{ id: string; [key: string]: unknown }>
}> {
  const res = await api.get('/api/channel/models')
  return res.data
}

/**
 * Get all enabled models
 */
export async function getEnabledModels(): Promise<{
  success: boolean
  message?: string
  data?: string[]
}> {
  const res = await api.get('/api/channel/models_enabled')
  return res.data
}

// ============================================================================
// Ollama Utilities
// ============================================================================

// ============================================================================
// Group Management
// ============================================================================

/**
 * Get all available groups (re-exported from users API for convenience)
 */
export const getGroups = getUserGroups

// ============================================================================
// Prefill Groups (Model Groups)
// ============================================================================

/**
 * Get prefill groups for quick model selection
 */
export async function getPrefillGroups(
  type: 'model' | 'group' = 'model'
): Promise<{
  success: boolean
  message?: string
  data?: Array<{ id: number; name: string; items: string | string[] }>
}> {
  const res = await api.get('/api/prefill_group', { params: { type } })
  return res.data
}

// ============================================================================
// Task Plugin Channel Credentials
// ============================================================================

export type PluginCredentialView = {
  index: number
  label: string
  account_id: string
  expires_at: number
  needs_login: boolean
}

export type PluginLoginField = {
  name: string
  label: Record<string, string>
  type: string
  required: boolean
  placeholder?: Record<string, string>
  description?: Record<string, string>
}

export type PluginLoginStep = {
  type: string
  url?: string
  hint?: Record<string, string>
  user_code?: string
  verification_uri?: string
  verification_uri_complete?: string
  interval?: number
  expires_at?: number
  fields?: PluginLoginField[]
  credential?: PluginCredentialView
}

export type PluginLoginResponse = {
  success: boolean
  message?: string
  data?: {
    flow?: string
    step?: PluginLoginStep
    channel_id?: number
  }
}

export async function getPluginCredentials(
  channelId: number
): Promise<PluginCredentialView[]> {
  const res = await api.get<{
    success: boolean
    data: { items: PluginCredentialView[] }
  }>(`/api/channel/${channelId}/plugin_credentials`, channelActionConfig())
  return requireServerSuccess(res.data).data.items
}

export async function startPluginLogin(
  channelId: number,
  body: { key_index?: number; add?: boolean }
): Promise<PluginLoginResponse> {
  const res = await api.post<PluginLoginResponse>(
    `/api/channel/${channelId}/plugin_login`,
    body,
    channelActionConfig()
  )
  return requireServerSuccess(res.data)
}

export async function continuePluginLogin(
  channelId: number,
  body: {
    flow: string
    input: {
      callback_url?: string
      fields?: Record<string, string>
      poll?: boolean
    }
  }
): Promise<PluginLoginResponse> {
  const res = await api.post<PluginLoginResponse>(
    `/api/channel/${channelId}/plugin_login/continue`,
    body,
    channelActionConfig()
  )
  return requireServerSuccess(res.data)
}

export type BailianSyncStatus = {
  channel_id: number
  started_at?: string
  finished_at?: string
  actual_models?: number
  catalog_models?: number
  matched_models?: number
  reference_prices?: number
  pricing_records?: number
  metadata_created?: number
  metadata_updated?: number
  unmatched_models?: string[]
  steps?: Record<string, { status: string; message?: string }>
}

export type BailianScheduledStatus = {
  started_at?: string
  finished_at?: string
  success: boolean
  models: number
  channels: number
  written: number
  scheduled: number
  reviews: number
  due_channels: number
  changes: number
  errors?: string[]
}

export type BailianSyncStatusResponse = {
  synced?: boolean
  post_create?: BailianSyncStatus
  scheduled?: BailianScheduledStatus
  channel_id?: number
}

export async function getBailianSyncStatus(): Promise<BailianSyncStatusResponse> {
  const res = await api.get('/api/ratio_sync/bailian/status')
  return res.data?.data ?? { synced: false }
}

export async function refreshBailianCatalog(channelId: number) {
  const res = await api.post('/api/ratio_sync/bailian/catalog/refresh', {
    channel_id: channelId,
  })
  return res.data
}

export async function applyBailianCatalog(channelId: number) {
  const res = await api.post('/api/ratio_sync/bailian/catalog/apply', {
    channel_id: channelId,
  })
  return res.data?.data
}

export type ApikoModelSyncResult = {
  channel_id: number
  fetched: number
  total: number
  added: number
  models: string[]
}

/**
 * Adds every model in Apiko's public control-plane catalogue to the channel.
 * Existing manual entries are preserved.
 */
export async function syncApikoChannelModels(
  channelId: number
): Promise<ApikoModelSyncResult> {
  const res = await api.post<{ data: ApikoModelSyncResult }>(
    `/api/channel/${channelId}/apiko/models/sync`,
    {},
    channelActionConfig()
  )
  return res.data.data
}

export type DreamRouterUpstreamSummary = {
  provider_id: string
  fetched_at: string
  pricing_version?: string
  source_endpoint: string
  price_basis: string
  models: number
  groups: number
  group_overrides: number
  auto_groups: number
  official_prices: string
  discounted_prices: string
  channel_id?: number
  channel_pricing_written?: number
  changes?: number
}

export type DreamRouterUpstreamSnapshot =
  | { synced: false }
  | {
      synced: true
      summary: DreamRouterUpstreamSummary
      models: Array<Record<string, unknown>>
      discount_group?: string
      discount_groups?: string[]
    }

export type DreamRouterSyncResult = DreamRouterUpstreamSummary & {
  discount_group?: string
  discount_groups?: string[]
}

export async function getDreamRouterUpstreamSnapshot(
  channelId?: number
): Promise<DreamRouterUpstreamSnapshot> {
  const res = await api.get('/api/upstream/dreamrouter/snapshot', {
    params: channelId ? { channel_id: channelId } : undefined,
  })
  return res.data?.data ?? { synced: false }
}

export async function syncDreamRouterUpstream(
  channelId: number,
  baseUrl?: string,
  discountGroup?: string
): Promise<DreamRouterSyncResult> {
  const res = await api.post<{
    success: boolean
    data: DreamRouterSyncResult
  }>('/api/upstream/dreamrouter/sync', {
    channel_id: channelId,
    base_url: baseUrl,
    discount_group: discountGroup,
  })
  return requireServerSuccess(res.data).data
}

export type ChannelBatchPricingItem = {
  model_name: string
  provider?: string
  region?: string
  deployment_id?: string
  mode: 'per_1m_token' | 'per_call' | 'per_second' | 'per_minute' | string
  input_per_million_usd?: number
  output_per_million_usd?: number
  cache_per_million_usd?: number
  create_cache_per_million_usd?: number
  per_call_usd?: number
  per_second_usd?: number
  per_minute_usd?: number
  version?: string
  purchase_usd?: number
  previous_usd?: number
  change_percent?: number
  margin_usd?: number
  margin_rate?: number
  dimension_margins?: {
    dimension: string
    purchase_usd?: number
    sale_usd?: number
    margin_usd?: number
    margin_rate?: number
    issue?: string
  }[]
  margin_verified?: boolean
  protection_state?: string
}

export type ChannelBatchPricingResult = {
  basis: 'official' | 'channel' | 'current'
  mode: string
  value: number
  dry_run: boolean
  updated: number
  items: ChannelBatchPricingItem[]
  skipped: Array<{ model_name: string; reason: string }>
  conflicts?: string[]
  dimensions?: string[]
  blocked?: number
  protection?: string
}

export async function batchChannelModelPricing(
  channelId: number,
  body: {
    models?: string[]
    model_prefixes?: string[]
    model_categories?: string[]
    basis: 'official' | 'channel' | 'current'
    mode: string
    value: number
    dry_run: boolean
    overwrite_manual?: boolean
    versions?: Record<string, string>
    dimensions?: string[]
    min_margin_rate?: number
    protection_mode?: 'strict' | 'partial' | 'approval'
    approval_note?: string
  }
): Promise<ChannelBatchPricingResult> {
  const res = await api.post(
    `/api/channel/${channelId}/model_pricing/batch`,
    body
  )
  return requireServerSuccess(res.data).data as ChannelBatchPricingResult
}

export type ChannelPricingSchedule = {
  enabled: boolean
  basis: 'official' | 'channel'
  mode: string
  value: number
  apply_on_sync: boolean
  interval_minutes: number
  review_mode: 'auto' | 'manual'
  threshold_percent: number
  model_sync_interval_minutes: number
  official_sync_interval_minutes: number
  channel_sync_interval_minutes: number
}

export async function getChannelPricingSchedule(channelId: number): Promise<{
  channel_id: number
  enabled: boolean
  schedule: ChannelPricingSchedule
}> {
  const res = await api.get(`/api/channel/${channelId}/model_pricing/schedule`)
  return requireServerSuccess(res.data).data
}

export async function setChannelPricingSchedule(
  channelId: number,
  schedule: ChannelPricingSchedule
) {
  const res = await api.put(
    `/api/channel/${channelId}/model_pricing/schedule`,
    schedule
  )
  return requireServerSuccess(res.data).data
}

export async function createChannelDraft(payload: {
  name?: string
  type: number
  base_url?: string
  key?: string
  models?: string
  group?: string
}): Promise<{ success: boolean; message?: string; data?: { id: number } }> {
  const res = await api.post(
    '/api/channel/draft',
    payload,
    channelActionConfig()
  )
  return res.data
}

export async function publishChannelDraft(
  channelId: number
): Promise<{ success: boolean; message?: string; data?: { id: number } }> {
  const res = await api.post(
    `/api/channel/draft/${channelId}/publish`,
    {},
    channelActionConfig()
  )
  return res.data
}

export type ChannelPricingHistoryEntry = {
  id?: number
  channel_id: number
  model_name: string
  source: string
  old_pricing?: {
    mode: string
    input_per_million_usd?: number
    output_per_million_usd?: number
    per_call_usd?: number
  }
  new_pricing?: {
    mode: string
    input_per_million_usd?: number
    output_per_million_usd?: number
    per_call_usd?: number
  }
  changed_at: string
}

export async function getChannelPricingHistory(
  channelId: number
): Promise<{ channel_id: number; items: ChannelPricingHistoryEntry[] }> {
  const res = await api.get(`/api/channel/${channelId}/model_pricing/history`)
  return requireServerSuccess(res.data).data
}

export type ChannelPricingReview = {
  channel_id: number
  model_name: string
  field: string
  old: number
  new: number
  percent: number
  created_at: string
}

export async function getChannelPricingReviews(
  channelId: number
): Promise<{ channel_id: number; items: ChannelPricingReview[] }> {
  const res = await api.get(`/api/channel/${channelId}/model_pricing/reviews`)
  return requireServerSuccess(res.data).data
}

export async function approveChannelPricingReviews(channelId: number) {
  const res = await api.post(
    `/api/channel/${channelId}/model_pricing/reviews/approve`,
    {},
    channelActionConfig()
  )
  return requireServerSuccess(res.data).data
}

export async function rejectChannelPricingReviews(channelId: number) {
  const res = await api.post(
    `/api/channel/${channelId}/model_pricing/reviews/reject`,
    {},
    channelActionConfig()
  )
  return requireServerSuccess(res.data).data
}

export async function rollbackChannelPricingHistory(
  channelId: number,
  historyId: number
) {
  const res = await api.post(
    `/api/channel/${channelId}/model_pricing/history/${historyId}/rollback`,
    {},
    channelActionConfig()
  )
  return requireServerSuccess(res.data).data
}

export type ChannelPricingAuditModel = {
  model_name: string
  legacy_status?: string
  channel_status?: string
  billing_source: string
  billable: boolean
  conflict: boolean
}

export type ChannelPricingAuditConflict = {
  model_name: string
  legacy_status: string
  channel_status: string
  billing_source: string
  reason: string
}

export type ChannelPricingAudit = {
  channel_id: number
  channel_name: string
  authority: string
  models: ChannelPricingAuditModel[]
  conflicts: ChannelPricingAuditConflict[]
  warnings?: string[]
}

export async function getChannelPricingAudit(
  channelId: number
): Promise<ChannelPricingAudit> {
  const res = await api.get(`/api/channel/${channelId}/pricing_audit`)
  return requireServerSuccess(res.data).data as ChannelPricingAudit
}

export type UpstreamCapabilityStatus =
  | 'SUPPORTED'
  | 'PARTIAL'
  | 'UNSUPPORTED'
  | 'MANUAL_ONLY'
  | 'NEEDS_CONFIGURATION'

export type UpstreamProviderCapability = {
  status: UpstreamCapabilityStatus
  detail?: string
}

export type UpstreamProviderCapabilities = {
  model_discovery: UpstreamProviderCapability
  model_metadata: UpstreamProviderCapability
  official_pricing: UpstreamProviderCapability
  channel_pricing: UpstreamProviderCapability
  discount_information: UpstreamProviderCapability
  region_pricing: UpstreamProviderCapability
  tiered_pricing: UpstreamProviderCapability
  media_pricing: UpstreamProviderCapability
  scheduled_sync: UpstreamProviderCapability
  token_pricing: UpstreamProviderCapability
  image_pricing: UpstreamProviderCapability
  video_pricing: UpstreamProviderCapability
  audio_pricing: UpstreamProviderCapability
  per_call_pricing: UpstreamProviderCapability
  per_second_pricing: UpstreamProviderCapability
  per_minute_pricing: UpstreamProviderCapability
  deployment_pricing: UpstreamProviderCapability
}

export type ChannelSyncCapabilities = {
  channel_id: number
  base_url: string
  provider: {
    id: string
    name: string
    auth_type: string
    capabilities: UpstreamProviderCapabilities
    source_documentation?: string
    sync_frequency?: string
    last_verified_at?: number
  }
}

export async function getChannelSyncCapabilities(
  channelId: number
): Promise<ChannelSyncCapabilities> {
  const res = await api.get(`/api/channel/${channelId}/sync_capabilities`)
  return requireServerSuccess(res.data).data as ChannelSyncCapabilities
}

export type ChannelSyncDiagnosticCheck = {
  status: string
  code?: string
  source?: string
  count: number
  message?: string
  error?: string
  fetched_at?: number
  duration_ms?: number
  details?: Record<string, unknown>
}

export type ChannelSyncDiagnostics = {
  channel_id: number
  channel_name: string
  checked_at: number
  models: ChannelSyncDiagnosticCheck
  official_pricing: ChannelSyncDiagnosticCheck
  channel_pricing: ChannelSyncDiagnosticCheck
  warnings?: string[]
  warning_codes?: string[]
}

export async function runChannelSyncDiagnostics(
  channelId: number
): Promise<ChannelSyncDiagnostics> {
  const res = await api.post(
    `/api/channel/${channelId}/sync_diagnostics`,
    {},
    channelActionConfig()
  )
  return requireServerSuccess(res.data).data as ChannelSyncDiagnostics
}
