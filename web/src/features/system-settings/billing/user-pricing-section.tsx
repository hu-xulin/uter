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
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getCurrencyDisplay } from '@/lib/currency'

import {
  SettingsFormGrid,
  SettingsFormGridItem,
  SettingsSwitchField,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

export const USER_PRICE_OPTION_KEY = 'UserPriceSetting'

type TierDraft = {
  id: string
  min: string
  max: string
  ratio: string
  label: string
}

type Draft = {
  enabled: boolean
  tiers: TierDraft[]
}

let rowSeq = 0
const nextId = () => `tier-${Date.now()}-${rowSeq++}`

function newTier(min = ''): TierDraft {
  return { id: nextId(), min, max: '', ratio: '1', label: '' }
}

type SerializedTier = {
  min_amount: number
  max_amount: number | null
  ratio: number
  label?: string
}

type SerializedSetting = {
  enabled: boolean
  tiers: SerializedTier[]
}

function serialize(draft: Draft): string {
  const tiers: SerializedTier[] = []
  for (const tier of draft.tiers) {
    const min = Number(tier.min)
    if (!Number.isFinite(min) || min < 0) continue
    const ratio = Number(tier.ratio)
    if (!Number.isFinite(ratio) || ratio < 0) continue
    const max = tier.max.trim() === '' ? null : Number(tier.max)
    if (max !== null && (!Number.isFinite(max) || max < 0)) continue
    const entry: SerializedTier = {
      min_amount: min,
      max_amount: max,
      ratio,
    }
    const label = tier.label.trim()
    if (label) entry.label = label
    tiers.push(entry)
  }
  return JSON.stringify({ enabled: draft.enabled, tiers })
}

function deserialize(raw: string): Draft {
  if (!raw || !raw.trim()) return { enabled: false, tiers: [] }
  let parsed: SerializedSetting
  try {
    parsed = JSON.parse(raw) as SerializedSetting
  } catch {
    return { enabled: false, tiers: [] }
  }
  const tiers = (parsed.tiers ?? []).map((tier) => ({
    id: nextId(),
    min: String(tier.min_amount ?? 0),
    max:
      tier.max_amount === null || tier.max_amount === undefined
        ? ''
        : String(tier.max_amount),
    ratio: String(tier.ratio ?? 1),
    label: tier.label ?? '',
  }))
  return { enabled: parsed.enabled === true, tiers }
}

/**
 * Per-user monthly-tier pricing (需求3).
 *
 * Each tier maps a monthly consumption range to a multiplier that is folded
 * into the group ratio when billing, so heavy users can be charged a lower
 * (or higher) effective rate. Ranges are half-open: min <= spend < max, and an
 * empty upper bound means "no upper limit".
 */
export function UserPricingSection({
  defaultSetting,
}: {
  defaultSetting: string
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const { meta } = getCurrencyDisplay()
  // Billing thresholds are always stored/compared in USD; when the display
  // currency is TOKENS we still label the field in USD so the operator knows
  // what the number means.
  let currencyUnit: string
  if (meta.kind === 'tokens') {
    currencyUnit = 'USD'
  } else if (meta.kind === 'currency') {
    currencyUnit = meta.currencyCode
  } else {
    currencyUnit = meta.symbol
  }

  const [saved] = useState(() => serialize(deserialize(defaultSetting)))
  const [draft, setDraft] = useState<Draft>(() => deserialize(defaultSetting))

  function patchTier(id: string, patch: Partial<TierDraft>) {
    setDraft((prev) => ({
      ...prev,
      tiers: prev.tiers.map((tier) =>
        tier.id === id ? { ...tier, ...patch } : tier
      ),
    }))
  }

  function validate(): boolean {
    for (const tier of draft.tiers) {
      const min = Number(tier.min)
      if (!Number.isFinite(min) || min < 0) {
        toast.error(t('Monthly spend must be a non-negative number'))
        return false
      }
      const ratio = Number(tier.ratio)
      if (!Number.isFinite(ratio) || ratio < 0) {
        toast.error(t('Multiplier must be a non-negative number'))
        return false
      }
      if (tier.max.trim() !== '') {
        const max = Number(tier.max)
        if (!Number.isFinite(max) || max < 0) {
          toast.error(t('Monthly spend must be a non-negative number'))
          return false
        }
        if (max <= min) {
          toast.error(t('The upper bound must be greater than the lower bound'))
          return false
        }
      }
    }
    return true
  }

  const serialized = serialize(draft)
  const isDirty = serialized !== saved

  async function onSave() {
    if (!validate()) return
    await updateOption.mutateAsync({
      key: USER_PRICE_OPTION_KEY,
      value: serialized,
    })
  }

  function onReset() {
    setDraft(deserialize(defaultSetting))
  }

  return (
    <SettingsSection title={t('User Pricing')}>
      <SettingsPageFormActions
        onSave={onSave}
        onReset={onReset}
        isSaving={updateOption.isPending}
        isSaveDisabled={!isDirty}
        isResetDisabled={!isDirty}
        saveLabel='Save user pricing'
      />
      <SettingsFormGrid>
        <SettingsFormGridItem span='full'>
          <SettingsSwitchField
            controlId='user-pricing-enabled'
            checked={draft.enabled}
            onCheckedChange={(checked) =>
              setDraft((prev) => ({ ...prev, enabled: checked }))
            }
            label={t('Enabled')}
            // 整段功能的总开关也是一条配置项标题：与全站设置页统一 16/600，
            // 不再单独放大到 18px。
            description={t(
              'Give users a different rate depending on how much they spent this month.'
            )}
          />
        </SettingsFormGridItem>

        <SettingsFormGridItem span='full'>
          <div className='bg-muted/20 space-y-3 rounded-xl border p-3'>
            <div className='text-muted-foreground grid grid-cols-[1fr_1fr_1fr_1.2fr_auto] items-center gap-2 text-sm'>
              <span>
                {t('Monthly spend from')} ({currencyUnit})
              </span>
              <span>
                {t('Monthly spend to')} ({currencyUnit})
              </span>
              <span>{t('Multiplier')}</span>
              <span>{t('Description')}</span>
              <span />
            </div>
            {draft.tiers.map((tier) => (
              <div
                key={tier.id}
                className='grid grid-cols-[1fr_1fr_1fr_1.2fr_auto] items-center gap-2'
              >
                <Input
                  autoComplete='off'
                  inputMode='decimal'
                  placeholder='0'
                  value={tier.min}
                  onChange={(event) =>
                    patchTier(tier.id, { min: event.target.value })
                  }
                />
                <Input
                  autoComplete='off'
                  inputMode='decimal'
                  placeholder={t('No upper limit')}
                  value={tier.max}
                  onChange={(event) =>
                    patchTier(tier.id, { max: event.target.value })
                  }
                />
                <Input
                  autoComplete='off'
                  inputMode='decimal'
                  placeholder='1'
                  value={tier.ratio}
                  onChange={(event) =>
                    patchTier(tier.id, { ratio: event.target.value })
                  }
                />
                <Input
                  autoComplete='off'
                  placeholder={t('Description')}
                  value={tier.label}
                  onChange={(event) =>
                    patchTier(tier.id, { label: event.target.value })
                  }
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  aria-label={t('Remove')}
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      tiers: prev.tiers.filter((item) => item.id !== tier.id),
                    }))
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={!draft.enabled}
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  tiers: [...prev.tiers, newTier()],
                }))
              }
            >
              <Plus data-icon='inline-start' />
              <span>{t('Add tier')}</span>
            </Button>
            <p className='text-muted-foreground text-sm'>
              {t('Monthly spend hint')}
            </p>
            <p className='text-muted-foreground text-sm'>
              {t('Monthly spend unit hint', { unit: currencyUnit })}
            </p>
          </div>
        </SettingsFormGridItem>
      </SettingsFormGrid>
    </SettingsSection>
  )
}
