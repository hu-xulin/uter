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
import { api } from '@/lib/api'

import type {
  ConfirmPaymentComplianceResponse,
  FetchUpstreamRatiosRequest,
  LogCleanupTask,
  SystemOptionsResponse,
  SystemTaskListResponse,
  SystemTaskFilters,
  SystemTaskResponse,
  UpdateOptionRequest,
  UpdateOptionResponse,
  UpdatePasskeyDomainsRequest,
  UpdatePasskeyDomainsResponse,
  UpstreamChannelsResponse,
  UpstreamRatiosResponse,
} from './types'

export async function getSystemOptions() {
  const res = await api.get<SystemOptionsResponse>('/api/option/')
  return res.data
}

export async function updateSystemOption(request: UpdateOptionRequest) {
  const res = await api.put<UpdateOptionResponse>('/api/option/', request)
  return res.data
}

export type RevealChannelProviderCredentialResponse = {
  success: boolean
  message: string
  data?: { key: string; value: string }
}

/**
 * Fetch one saved upstream credential after the caller has obtained a proof
 * bound to this exact option key. The browser never receives these values from
 * GET /api/option/, which always returns masked values for secret keys.
 */
export async function revealChannelProviderCredential(
  optionKey: string,
  proofToken: string,
  signal?: AbortSignal
) {
  const res = await api.post<RevealChannelProviderCredentialResponse>(
    `/api/option/channel-provider/${encodeURIComponent(optionKey)}/reveal`,
    undefined,
    {
      headers: { 'X-Security-Proof': proofToken },
      signal,
    }
  )
  return res.data
}

export type RevealSystemSecretResponse = {
  success: boolean
  message: string
  data?: { key: string; value: string }
}

/**
 * 取回单个已保存的系统设置密钥明文。调用方必须先完成绑定到同一 option key
 * 的二次验证；GET /api/option/ 永远只返回掩码串。
 */
export async function revealSystemSecret(
  optionKey: string,
  proofToken: string,
  signal?: AbortSignal
) {
  const res = await api.post<RevealSystemSecretResponse>(
    `/api/option/${encodeURIComponent(optionKey)}/secret/reveal`,
    undefined,
    {
      headers: { 'X-Security-Proof': proofToken },
      signal,
    }
  )
  return res.data
}

export type SyncExchangeRateResponse = {
  success: boolean
  message: string
  data?: {
    usd_exchange_rate: number
    price: number
    price_adjustment_rate: number
    exchange_rate_updated_at: number
  }
}

/**
 * 立即拉取一次外部行情，刷新 A（USDExchangeRate）与 B（Price = A + 0.2）。
 * 定时任务每 10 分钟自动跑一次，这个接口只是让管理员不必等下一个周期。
 */
export async function syncExchangeRate() {
  const res = await api.post<SyncExchangeRateResponse>(
    '/api/option/exchange_rate/sync'
  )
  return res.data
}

export async function updatePasskeyDomains(
  request: UpdatePasskeyDomainsRequest
) {
  const res = await api.put<UpdatePasskeyDomainsResponse>(
    '/api/option/passkey/domains',
    request,
    {
      validateStatus: (status) =>
        (status >= 200 && status < 300) || status === 409,
    }
  )
  return res.data
}

export async function confirmPaymentCompliance() {
  const res = await api.post<ConfirmPaymentComplianceResponse>(
    '/api/option/payment_compliance',
    { confirmed: true }
  )
  return res.data
}

export async function startLogCleanupTask(targetTimestamp: number) {
  const res = await api.post<SystemTaskResponse<LogCleanupTask>>(
    '/api/system-task/log-cleanup',
    null,
    {
      params: { target_timestamp: targetTimestamp },
    }
  )
  return res.data
}

export async function getCurrentLogCleanupTask() {
  const res = await api.get<SystemTaskResponse<LogCleanupTask | null>>(
    '/api/system-task/current',
    {
      params: { type: 'log_cleanup' },
    }
  )
  return res.data
}

export async function getSystemTask(taskId: string) {
  const res = await api.get<SystemTaskResponse<LogCleanupTask>>(
    `/api/system-task/${taskId}`
  )
  return res.data
}

export async function listSystemTasks(
  limit = 20,
  filters: SystemTaskFilters = {}
) {
  const res = await api.get<SystemTaskListResponse>('/api/system-task/list', {
    params: { limit, ...filters },
  })
  return res.data
}

export async function getUpstreamChannels() {
  const res = await api.get<UpstreamChannelsResponse>(
    '/api/ratio_sync/channels'
  )
  return res.data
}

export async function fetchUpstreamRatios(request: FetchUpstreamRatiosRequest) {
  const res = await api.post<UpstreamRatiosResponse>(
    '/api/ratio_sync/fetch',
    request
  )
  return res.data
}

export type AlipayCallbackEvent = {
  time: number
  provider: string
  trade_no?: string
  result: string
  reason?: string
  remote_ip?: string
}

export type AlipayCallbackDiagnostics = {
  server_address: string
  payment_site_address: string
  custom_callback_address: string
  notify_url: string
  current_return_url: string
  gateway: string
  tcp_reachable: boolean
  http_status: number
  content_type: string
  http_server: string
  reaches_uter: boolean
  reach_error: string
  events: AlipayCallbackEvent[]
}

export async function getAlipayCallbackDiagnostics() {
  const res = await api.get<{ data: AlipayCallbackDiagnostics }>(
    '/api/option/alipay_callback_diagnostics'
  )
  return res.data
}
