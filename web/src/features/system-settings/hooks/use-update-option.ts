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
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import i18next from 'i18next'
import { toast } from 'sonner'

import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getStatus } from '@/lib/api'
import {
  STATUS_QUERY_KEY,
  STATUS_STORAGE_KEY,
  mapStatusDataToConfig,
} from '@/lib/status-query'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { updatePasskeyDomains, updateSystemOption } from '../api'
import type { UpdateOptionRequest, UpdatePasskeyDomainsRequest } from '../types'

// Configuration keys that require status refresh
const STATUS_RELATED_KEYS = new Set([
  'HeaderNavModules',
  'SidebarModulesAdmin',
  'Notice',
  'LogConsumeEnabled',
  'log_setting.user_export_enabled',
  'log_setting.max_range_days',
  'QuotaPerUnit',
  'USDExchangeRate',
  // 支付定价汇率：Price 是「每 1 美元额度的人民币价」(status.price)，直接驱动
  // 钱包预付面额卡片与应付金额的展示；StripeUnitPrice 同样经 /api/status 下发。
  // 两者都不在白名单时，保存后状态查询不会重拉，钱包里的「汇率/应付金额」会
  // 停留在修改前的旧值（与 USDExchangeRate 同一个实时同步问题）。
  'Price',
  'StripeUnitPrice',
  'DisplayInCurrencyEnabled',
  'DisplayTokenStatEnabled',
  'general_setting.quota_display_type',
  'general_setting.custom_currency_symbol',
  'general_setting.custom_currency_exchange_rate',
  'oidc.display_name',
  'ServerAddress',
  'passkey.enabled',
  'passkey.rp_id',
  'passkey.legacy_rp_ids',
  'passkey.origins',
  'QuotaRemindEnabled',
  'QuotaRemindThreshold',
])

/**
 * 保存支付定价相关配置后，主动拉取并落地最新 /api/status。
 *
 * 仅 `invalidate` / `refetch` 依赖 React Query 的观察者与 staleTime 语义：已挂载的钱包页
 * 在 5 分钟 staleTime 内、且 `['status']` 查询被其他 observer 标记为 fresh 时，未必会
 * 重新拉取，导致汇率/应付金额展示不同步。这里改为「直接 fetch + setQueryData」，把最新
 * 状态同时写进 React Query 缓存、zustand store 与 localStorage，钱包读取的 `status.price`
 * （即汇率）与 `currency` 立刻生效，无需刷新或重新进入页面。
 */
export async function syncStatusNow(queryClient: QueryClient) {
  try {
    const fresh = (await getStatus()) as Record<string, unknown> | null
    if (!fresh) return
    queryClient.setQueryData(STATUS_QUERY_KEY, fresh)
    useSystemConfigStore.getState().setConfig(mapStatusDataToConfig(fresh))
    try {
      window.localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(fresh))
    } catch {
      /* Storage may be disabled in private mode. */
    }
  } catch {
    // 兜底：至少让 React Query 重新拉取一次
    queryClient.invalidateQueries({ queryKey: ['status'] })
  }
}

export function useUpdateOption() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: UpdateOptionRequest) =>
      requireServerSuccess(await updateSystemOption(request)),
    onSuccess: (data, variables) => {
      if (data.success) {
        // Always refresh system-options
        queryClient.invalidateQueries({ queryKey: ['system-options'] })

        // 支付定价类配置（Price / StripeUnitPrice / USDExchangeRate 等）保存后，
        // 钱包页需要「立即」看到新汇率 / 应付金额。直接拉取最新 /api/status 并同步
        // 写入 React Query 缓存、系统配置 store 与 localStorage，彻底绕开
        // staleTime 与 refetch 的观察者语义，确保已挂载的钱包页也会即时重渲染。
        if (STATUS_RELATED_KEYS.has(variables.key)) {
          void syncStatusNow(queryClient)
        }

        toast.success(i18next.t('Setting updated successfully'))
      } else {
        handleServerError(data, i18next.t('Failed to update setting'))
      }
    },
    onError: (error: Error) => {
      handleServerError(error, i18next.t('Failed to update setting'))
    },
  })
}

export function useUpdatePasskeyDomains() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (request: UpdatePasskeyDomainsRequest) => {
      const result = await updatePasskeyDomains(request)
      if (
        result.code === 'PASSKEY_RP_ID_REMOVAL_CONFIRMATION_REQUIRED' &&
        result.data
      ) {
        return result
      }
      return requireServerSuccess(result)
    },
    onSuccess: (result, request) => {
      if (request.preview || !result.success) return
      queryClient.invalidateQueries({ queryKey: ['system-options'] })
      queryClient.invalidateQueries({ queryKey: ['status'] })
      try {
        window.localStorage.removeItem('status')
      } catch {
        /* Storage may be disabled. */
      }
      toast.success(i18next.t('Setting updated successfully'))
    },
    onError: (error: Error) =>
      handleServerError(error, i18next.t('Failed to update setting')),
  })
}
