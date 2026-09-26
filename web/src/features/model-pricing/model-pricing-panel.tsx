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

For commercial licensing, please contact support@Uter.ai.com
*/
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { DynamicPricingBreakdown } from '@/features/pricing/components/dynamic-pricing-breakdown'
import { ModelPriceCell } from '@/features/pricing/components/model-price-cell'
import { isDynamicPricingModel } from '@/features/pricing/lib/dynamic-price'
import {
  buildPreviewRows,
  createInitialLaneState,
  officialTierVariablePriceUSD,
} from '@/features/system-settings/models/model-pricing-core'
import {
  ModelPricingEditorPanel,
  type ModelPricingEditorPanelHandle,
} from '@/features/system-settings/models/model-pricing-sheet'
import { useOfficialPrices } from '@/features/system-settings/models/use-official-prices'
import { handleServerError } from '@/lib/handle-server-error'
import { usePricingPreferencesStore } from '@/stores/pricing-preferences-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import {
  useCanEditModelPricing,
  useModelPricing,
  useSaveModelPricing,
  type ModelPricingEntry,
} from './api'
import {
  getSitePricingCurrency,
  isValidPricingCurrency,
  USD_PRICING_CURRENCY,
  type PricingCurrency,
} from './currency'
import { modelPricingDisplay, pricingFromDraft, pricingRow } from './pricing'

/**
 * Detects the optimistic-concurrency conflict returned by the model pricing
 * PATCH endpoint ("model pricing changed; reload before saving: <model>").
 * The message text is server-defined and stable, so a substring match is the
 * most reliable client-side signal (no structured error code is exposed).
 */
function isModelPricingConflict(error: unknown): boolean {
  let message = ''
  if (error instanceof Error) {
    message = error.message
  } else if (typeof error === 'string') {
    message = error
  }
  return /reload before saving|model pricing changed/i.test(message)
}

export function ModelPricingPanel(props: {
  modelName: string
  onDirtyChange?: (dirty: boolean) => void
}) {
  const { t } = useTranslation()
  const currencyConfig = useSystemConfigStore((state) => state.config.currency)
  const currencyPreference = usePricingPreferencesStore(
    (state) => state.currency
  )
  const canEdit = useCanEditModelPricing()
  const query = useModelPricing([props.modelName], Boolean(props.modelName))
  const save = useSaveModelPricing()
  const [entry, setEntry] = useState<ModelPricingEntry | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const editor = useRef<ModelPricingEditorPanelHandle>(null)
  const editData = useMemo(() => {
    if (!entry) return null
    const values = { ...entry.configured }
    if (entry.effective['billing_setting.billing_mode'] === 'tiered_expr') {
      values['billing_setting.billing_mode'] = 'tiered_expr'
      values['billing_setting.billing_expr'] =
        entry.effective['billing_setting.billing_expr']
    }
    return pricingRow(entry.model_name, values)
  }, [entry])

  useEffect(() => {
    const loaded = query.data?.entries.find(
      (item) => item.model_name === props.modelName
    )
    if (loaded && (!entry || entry.model_name !== props.modelName)) {
      setEntry(loaded)
    }
  }, [query.data, entry, props.modelName])

  const persist = async (reset = false) => {
    if (!entry) return
    // Submits the current editor draft using the given expected version. The
    // draft is read live from the form, so the user's edits survive retries.
    const submit = async (version: string) => {
      const draft = reset ? null : await editor.current?.commitDraft()
      if (!reset && !draft) return
      await save.mutateAsync([
        {
          model_name: entry.model_name,
          expected_version: version,
          pricing: draft ? pricingFromDraft(draft) : {},
          reset,
        },
      ])
    }
    try {
      await submit(entry.version)
    } catch (error) {
      // The pricing changed on the server after this editor loaded (e.g. a
      // price sync ran, or another tab saved). Reload the latest version and
      // re-apply the user's draft once instead of forcing a manual reload.
      if (!isModelPricingConflict(error)) {
        handleServerError(error)
        return
      }
      try {
        const refreshed = await query.refetch()
        const loaded = refreshed.data?.entries.find(
          (item) => item.model_name === props.modelName
        )
        if (!loaded) throw error
        // Use the fresh version without replacing `entry`: replacing it would
        // reset the form and discard the discount ratio the user just typed.
        await submit(loaded.version)
      } catch (retryError) {
        handleServerError(retryError)
        return
      }
    }
    const refreshed = await query.refetch()
    setEntry(
      refreshed.data?.entries.find((item) => item.model_name === props.modelName) ??
        null
    )
    setResetOpen(false)
    save.reset()
    toast.success(t('Model pricing saved'))
  }

  if (!canEdit) {
    return (
      <div className='text-muted-foreground p-6 text-sm'>
        {t('Model pricing is managed by a super administrator.')}
      </div>
    )
  }
  if (query.isError) {
    return (
      <ErrorState
        description={query.error.message}
        onRetry={() => void query.refetch()}
      />
    )
  }
  if (!editData || !entry) return <LoadingState />
  const effectivePricing = modelPricingDisplay(entry)
  const siteCurrency = getSitePricingCurrency(currencyConfig)
  const currency =
    currencyPreference === 'site' && isValidPricingCurrency(siteCurrency)
      ? siteCurrency
      : USD_PRICING_CURRENCY
  return (
    <div className='flex min-h-0 min-w-0 flex-1 flex-col gap-3'>
      <ModelPricingEditorPanel
        embedded
        ref={editor}
        editData={editData}
        usageSchema={entry.usage_schema}
        pluginVariants={entry.plugin_variants}
        onDirtyChange={props.onDirtyChange}
        onSave={() => persist()}
        isSaving={save.isPending}
        className='rounded-none border-0'
        scrollHeader={
          <CurrentBillingSection
            entry={entry}
            effectivePricing={effectivePricing}
            currency={currency}
            onResetOpen={() => setResetOpen(true)}
            saveIsPending={save.isPending}
            saveIsError={save.isError}
            saveError={save.isError ? save.error : undefined}
            onReloadPricing={async () => {
              const refreshed = await query.refetch()
              const loaded = refreshed.data?.entries.find(
                (item) => item.model_name === props.modelName
              )
              if (loaded) {
                setEntry(loaded)
                save.reset()
              }
            }}
          />
        }
      />
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={t('Restore default pricing')}
        desc={t(
          'Remove this model’s custom pricing and use the built-in defaults. A model without a default may become unpriced.'
        )}
        confirmText={t('Restore defaults')}
        isLoading={save.isPending}
        handleConfirm={() => void persist(true)}
      />
    </div>
  )
}

/**
 * The "Current Billing" summary above the editor. Renders the effective
 * pricing card with a Uter/official two-column layout for expression-priced
 * models; official reference prices come from the selected official preset so
 * they stay stable when the Uter prices are recalculated.
 */
function CurrentBillingSection(props: {
  entry: ModelPricingEntry
  effectivePricing: ReturnType<typeof modelPricingDisplay>
  currency: PricingCurrency
  onResetOpen: () => void
  saveIsPending: boolean
  saveIsError: boolean
  saveError?: Error | null
  onReloadPricing: () => Promise<void>
}) {
  const { t } = useTranslation()
  const { entry, effectivePricing, currency } = props
  const { prices: presetPrices } = useOfficialPrices({
    enabled: isDynamicPricingModel(effectivePricing),
  })
  const officialPricesByVariable = useMemo(() => {
    const ratios = presetPrices?.[entry.model_name]
    if (!ratios) return undefined
    const map: Record<string, number | null> = {}
    for (const key of [
      'p',
      'c',
      'cr',
      'cc',
      'cc1h',
      'img',
      'img_cr',
      'img_o',
      'ai',
      'ao',
    ]) {
      map[key] = officialTierVariablePriceUSD(
        ratios,
        key as Parameters<typeof officialTierVariablePriceUSD>[1]
      )
    }
    return map
  }, [presetPrices, entry.model_name])
  const current = pricingRow(entry.model_name, entry.effective)
  const currentLanes = createInitialLaneState(current)
  const details = buildPreviewRows(
    current,
    current.billingMode ?? 'per-token',
    '',
    '',
    currentLanes.promptPrice,
    currentLanes.prices,
    currentLanes.enabled,
    t,
    currency,
    entry.cache_write_mode,
    entry.billing_details
  ).filter(
    (row) =>
      row.key !== 'inputPrice' &&
      row.key !== 'completion' &&
      row.key !== 'price' &&
      row.value !== t('Empty')
  )

  return (
    <>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='min-w-0 flex-1 break-words'>
          <p className='text-muted-foreground text-xs'>
            {Object.keys(entry.configured).length
              ? t('Stored configuration with effective defaults')
              : t('Using built-in or default pricing')}
          </p>
        </div>
        <Button
          variant='outline'
          size='sm'
          onClick={props.onResetOpen}
          disabled={props.saveIsPending}
        >
          {t('Restore default pricing')}
        </Button>
      </div>
      <section aria-label={t('Current Billing')} className='space-y-3 border-b pb-3'>
        <h3 className='text-muted-foreground text-xs'>{t('Current Billing')}</h3>
        <div className='max-w-2xl'>
          <ModelPriceCell
            model={effectivePricing}
            options={{
              tokenUnit: 'M',
              officialPricesByVariable,
              // Two aligned rows: Uter prices on top, official prices below.
              layout: 'rows',
            }}
            showExpression={false}
          />
        </div>
        {isDynamicPricingModel(effectivePricing) ? (
          <DynamicPricingBreakdown
            compact
            billingExpr={effectivePricing.billing_expr}
            usageSchema={entry.usage_schema}
          />
        ) : (
          effectivePricing.quota_type === 0 &&
          Number.isFinite(effectivePricing.model_ratio) && (
            <dl className='grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3'>
              {details.map((row) => (
                <div key={row.key}>
                  <dt className='text-muted-foreground'>{row.label}</dt>
                  <dd className='mt-1 font-mono tabular-nums'>
                    {row.value}
                    {row.unit !== 'none' && ' / 1M'}
                  </dd>
                </div>
              ))}
            </dl>
          )
        )}
      </section>
      {props.saveIsError && (
        <div>
          <p role='alert' className='text-destructive mb-2 text-sm'>
            {props.saveError?.message}
          </p>
          <Button
            variant='outline'
            size='sm'
            onClick={() => void props.onReloadPricing()}
          >
            {t('Reload pricing')}
          </Button>
        </div>
      )}
    </>
  )
}
