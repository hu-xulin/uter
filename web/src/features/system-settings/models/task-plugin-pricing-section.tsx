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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  getModelPricing,
  saveModelPricing,
  type ModelPricingEntry,
} from '@/features/model-pricing/api'
import { pricingFromDraft } from '@/features/model-pricing/pricing'
import type { ModelRatioData } from './model-pricing-core'
import { handleServerError } from '@/lib/handle-server-error'

import { SettingsSection } from '../components/settings-section'
import {
  ModelPricingSheet,
  type ModelPricingEditorPanelHandle,
} from './model-pricing-sheet'

function isConfigured(entry: ModelPricingEntry): boolean {
  if (entry.plugin_variants?.some((variant) => variant.configured)) return true
  const effective = entry.effective
  return (
    effective.ModelPrice != null ||
    effective.ModelRatio != null ||
    effective['billing_setting.billing_expr'] != null
  )
}


function resolveBillingMode(
  effective: Record<string, unknown>
): ModelRatioData['billingMode'] {
  if (effective['billing_setting.billing_mode'] === 'tiered_expr') {
    return 'tiered_expr'
  }
  if (effective.ModelPrice != null) return 'per-request'
  return 'per-token'
}

function toEditData(entry: ModelPricingEntry): ModelRatioData {
  const effective = entry.effective
  const effectiveValues = effective as Record<string, unknown>
  const value = (key: string) =>
    effectiveValues[key] == null
      ? undefined
      : String(effectiveValues[key])
  return {
    name: entry.model_name,
    price: value('ModelPrice'),
    ratio: value('ModelRatio'),
    completionRatio: value('CompletionRatio'),
    cacheRatio: value('CacheRatio'),
    createCacheRatio: value('CreateCacheRatio'),
    imageRatio: value('ImageRatio'),
    audioRatio: value('AudioRatio'),
    audioCompletionRatio: value('AudioCompletionRatio'),
    billingMode: resolveBillingMode(effective),
    billingExpr:
      typeof effective['billing_setting.billing_expr'] === 'string'
        ? effective['billing_setting.billing_expr']
        : undefined,
    pluginBillingExpr: Object.fromEntries(
      (entry.plugin_variants ?? [])
        .map((variant) => [
          variant.plugin_key,
          variant.configured || variant.effective,
        ])
        .filter(([, expression]) => Boolean(expression))
    ),
  }
}

export function TaskPluginPricingSection() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const sheetRef = useRef<ModelPricingEditorPanelHandle>(null)
  const [selected, setSelected] = useState<ModelPricingEntry | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const pricing = useQuery({
    queryKey: ['task-plugin-pricing-entries'],
    queryFn: () => getModelPricing(),
  })

  const entries = useMemo(
    () =>
      (pricing.data?.entries ?? []).filter(
        (entry) => entry.plugin_variants?.length || entry.usage_schema
      ),
    [pricing.data]
  )

  const openEditor = (entry: ModelPricingEntry) => {
    setSelected(entry)
    setSheetOpen(true)
  }

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const draft = await sheetRef.current?.commitDraft()
      if (!draft) return
      await saveModelPricing([
        {
          model_name: selected.model_name,
          expected_version: selected.version,
          pricing: pricingFromDraft(draft),
        },
      ])
      toast.success(t('Pricing saved'))
      setSheetOpen(false)
      await queryClient.invalidateQueries({
        queryKey: ['task-plugin-pricing-entries'],
      })
    } catch (error) {
      handleServerError(error, t('Failed to save pricing'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsSection title={t('Task plugin pricing')}>
      <p className='text-muted-foreground text-sm'>
        {t(
          'Plugins declare usage dimensions, not currency prices. Set the per-model price here; models without a usable price remain in Pricing Issues.'
        )}
      </p>
      {pricing.isLoading && (
        <p className='text-muted-foreground text-sm'>{t('Loading...')}</p>
      )}
      {pricing.isError && (
        <p className='text-destructive text-sm'>
          {pricing.error instanceof Error
            ? pricing.error.message
            : t('Failed to load model pricing')}
        </p>
      )}
      <div className='space-y-2'>
        {entries.map((entry) => {
          const configured = isConfigured(entry)
          const plugins = (entry.plugin_variants ?? [])
            .map((variant) => variant.plugin_name)
            .join(', ')
          return (
            <div
              key={entry.model_name}
              className='flex flex-wrap items-center gap-2 rounded-md border p-3'
            >
              <code className='min-w-0 flex-1 truncate font-mono text-sm'>
                {entry.model_name}
              </code>
              {plugins && (
                <span className='text-muted-foreground text-sm'>{plugins}</span>
              )}
              <Badge variant={configured ? 'secondary' : 'warning'}>
                {configured ? t('Configured') : t('Unconfigured')}
              </Badge>
              <Button
                size='sm'
                variant='outline'
                onClick={() => openEditor(entry)}
              >
                {t('Configure')}
              </Button>
            </div>
          )
        })}
      </div>

      <ModelPricingSheet
        ref={sheetRef}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editData={selected ? toEditData(selected) : null}
        pluginVariants={selected?.plugin_variants}
        usageSchema={selected?.usage_schema}
        onSave={handleSave}
        isSaving={saving}
      />
    </SettingsSection>
  )
}