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
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  getPresetPrices,
  type PresetPriceSource,
} from '@/features/model-pricing/api'

type PresetPrices = Record<string, Record<string, number>>

/** Module-level cache so every pricing rule card shares one request per source. */
const presetPricesCache = new Map<PresetPriceSource, PresetPrices>()

/**
 * Loads the official reference prices for a pricing preset. The data is
 * shared across all consumers through a module-level cache; `sync` forces a
 * backend refresh for the selected source.
 */
export function useOfficialPrices(props: { enabled: boolean }) {
  const { t } = useTranslation()
  const [source, setSource] = useState<PresetPriceSource>('official')
  const [prices, setPrices] = useState<PresetPrices | undefined>(() =>
    presetPricesCache.get('official')
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!props.enabled) return
    if (presetPricesCache.has(source)) {
      setPrices(presetPricesCache.get(source))
      setError(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void getPresetPrices(source)
      .then((data) => {
        presetPricesCache.set(source, data)
        if (!cancelled) {
          setPrices(data)
          setError(false)
        }
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [props.enabled, source])

  const sync = useCallback(async (): Promise<PresetPrices | undefined> => {
    setLoading(true)
    try {
      const data = await getPresetPrices(source, true)
      presetPricesCache.set(source, data)
      setPrices(data)
      setError(false)
      toast.success(t('Official prices synced.'))
      return data
    } catch {
      setError(true)
      toast.error(t('Failed to sync prices'))
      return undefined
    } finally {
      setLoading(false)
    }
  }, [source, t])

  return { source, setSource, prices, loading, error, sync }
}
