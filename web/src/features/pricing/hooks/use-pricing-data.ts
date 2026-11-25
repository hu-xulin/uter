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
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { useStatus } from '@/hooks/use-status'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getPricing } from '../api'
import { excludeRedirectedUpstreams } from '../lib/model-helpers'
import {
  canonicalVendorIcon,
  canonicalVendorName,
} from '../lib/vendor-normalize'

export function usePricingData(enabled = true) {
  const { status } = useStatus()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pricing'],
    queryFn: async () => requireServerSuccess(await getPricing()),
    staleTime: 5 * 60 * 1000,
    enabled,
  })

  // Ensure rates never reach zero to prevent division errors
  const priceRate = useMemo(
    () => Math.max((status?.price as number) ?? 1, 0.001),
    [status?.price]
  )
  const usdExchangeRate = useMemo(
    () => Math.max((status?.usd_exchange_rate as number) ?? priceRate, 0.001),
    [status?.usd_exchange_rate, priceRate]
  )

  const vendors = useMemo(() => {
    if (!data?.vendors) return []
    const canonical = new Map<string, (typeof data.vendors)[number]>()
    for (const vendor of data.vendors) {
      const name = canonicalVendorName(vendor.name)
      if (!name) continue
      const icon = canonicalVendorIcon(name, vendor.icon)
      const existing = canonical.get(name)
      if (existing) {
        existing.model_count =
          (existing.model_count ?? 0) + (vendor.model_count ?? 0)
        if (!existing.icon) existing.icon = icon
        continue
      }
      canonical.set(name, { ...vendor, name, icon })
    }
    return [...canonical.values()]
  }, [data])

  const models = useMemo(() => {
    if (!data?.data || !data?.vendors) return []

    const vendorMap = new Map(data.vendors.map((v) => [v.id, v]))

    return excludeRedirectedUpstreams(data.data).map((model) => {
      const vendor = model.vendor_id
        ? vendorMap.get(model.vendor_id)
        : undefined
      const vendorName = canonicalVendorName(vendor?.name)
      return {
        ...model,
        key: model.model_name,
        vendor_name: vendorName,
        vendor_icon: canonicalVendorIcon(vendorName, vendor?.icon),
        vendor_description: vendor?.description,
        group_ratio: data.group_ratio,
      }
    })
  }, [data])

  const officialPrices = useMemo(() => {
    const raw = data?.official_prices
    if (!raw || typeof raw !== 'object') {
      return {} as Record<string, Record<string, number>>
    }
    return raw as Record<string, Record<string, number>>
  }, [data])

  return {
    models,
    vendors,
    channels: data?.channels ?? [],
    groupRatio: data?.group_ratio ?? {},
    usableGroup: data?.usable_group ?? {},
    endpointMap: data?.supported_endpoint ?? {},
    autoGroups: data?.auto_groups ?? [],
    pricingSource: (data?.pricing_source as string) ?? 'models.dev',
    officialPrices,
    isLoading,
    error,
    refetch,
    priceRate,
    usdExchangeRate,
  }
}
