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
import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { getChannels } from '@/features/channels/api'
import type { Channel } from '@/features/channels/types'
import { cn } from '@/lib/utils'

import {
  SettingsControlChildren,
  SettingsFormGrid,
  SettingsFormGridItem,
  SettingsSwitchField,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

export const CHANNEL_PRICE_OPTION_KEY = 'ChannelPriceSetting'

type RuleMode = 'ratio' | 'price'

type ModelRuleDraft = {
  id: string
  model: string
  mode: RuleMode
  value: string
}

type ChannelDraft = {
  id: string
  channelId: string
  enabled: boolean
  ratio: string
  models: ModelRuleDraft[]
}

type Draft = {
  enabled: boolean
  channels: ChannelDraft[]
}

const EMPTY_DRAFT: Draft = { enabled: false, channels: [] }

let rowSeq = 0
const nextId = () => `row-${Date.now()}-${rowSeq++}`

function newChannelRow(channelId = ''): ChannelDraft {
  return { id: nextId(), channelId, enabled: true, ratio: '', models: [] }
}

function newModelRow(): ModelRuleDraft {
  return { id: nextId(), model: '', mode: 'ratio', value: '' }
}

// ----------------------------------------------------------------------------
// Serialization
// ----------------------------------------------------------------------------

type SerializedRule = { mode: string; value: number }
type SerializedChannel = {
  enabled: boolean
  ratio?: number
  models: Record<string, SerializedRule>
}
type SerializedSetting = {
  enabled: boolean
  channels: Record<string, SerializedChannel>
}

function serialize(draft: Draft): string {
  const channels: Record<string, SerializedChannel> = {}
  for (const row of draft.channels) {
    if (!row.channelId) continue
    const models: Record<string, SerializedRule> = {}
    for (const rule of row.models) {
      const model = rule.model.trim()
      if (!model) continue
      const value = Number(rule.value)
      if (!Number.isFinite(value) || value < 0) continue
      models[model] = { mode: rule.mode, value }
    }
    const entry: SerializedChannel = { enabled: row.enabled, models }
    const ratio = Number(row.ratio)
    if (row.ratio.trim() !== '' && Number.isFinite(ratio) && ratio >= 0) {
      entry.ratio = ratio
    }
    channels[row.channelId] = entry
  }
  return JSON.stringify({ enabled: draft.enabled, channels })
}

function deserialize(raw: string): Draft {
  if (!raw || !raw.trim()) return structuredClone(EMPTY_DRAFT)
  let parsed: SerializedSetting
  try {
    parsed = JSON.parse(raw) as SerializedSetting
  } catch {
    return structuredClone(EMPTY_DRAFT)
  }
  const channels: ChannelDraft[] = []
  for (const [channelId, config] of Object.entries(parsed.channels ?? {})) {
    const models: ModelRuleDraft[] = []
    for (const [model, rule] of Object.entries(config.models ?? {})) {
      models.push({
        id: nextId(),
        model,
        mode: rule.mode === 'price' ? 'price' : 'ratio',
        value: String(rule.value ?? ''),
      })
    }
    channels.push({
      id: nextId(),
      channelId,
      enabled: config.enabled !== false,
      ratio: config.ratio === undefined ? '' : String(config.ratio),
      models,
    })
  }
  return { enabled: parsed.enabled === true, channels }
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

/**
 * Keyword-searchable multi-select for a channel's configured models. Lets an
 * operator tick several models at once instead of typing each name by hand.
 */
function ChannelModelPicker({
  models,
  existing,
  onApply,
  onClose,
}: {
  models: string[]
  existing: Set<string>
  onApply: (models: string[]) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const filtered = useMemo(
    () =>
      models.filter((m) =>
        m.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [models, query]
  )
  const toggle = (model: string) =>
    setSelected((prev) =>
      prev.includes(model)
        ? prev.filter((x) => x !== model)
        : [...prev, model]
    )
  const apply = () => {
    onApply(selected)
    setSelected([])
    setQuery('')
    onClose()
  }
  return (
    <div className='bg-popover space-y-2 rounded-lg border p-3 shadow-md'>
      <div className='flex items-center gap-2'>
        <Input
          className='flex-1'
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('Search models')}
          aria-label={t('Search models')}
        />
        <Button type='button' variant='ghost' size='sm' onClick={onClose}>
          {t('Cancel')}
        </Button>
      </div>
      <div className='bg-muted/20 max-h-56 space-y-1 overflow-y-auto rounded-md p-1'>
        {filtered.length === 0 ? (
          <p className='text-muted-foreground px-2 py-3 text-xs'>
            {t('No models configured for channel')}
          </p>
        ) : (
          filtered.map((model) => {
            const checked = selected.includes(model)
            const disabled = existing.has(model)
            return (
              <label
                key={model}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1 text-sm',
                  disabled
                    ? 'opacity-50'
                    : 'hover:bg-muted/60 cursor-pointer'
                )}
              >
                <input
                  type='checkbox'
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(model)}
                />
                <span className='font-mono break-all'>{model}</span>
                {disabled && (
                  <span className='text-muted-foreground ml-auto text-xs'>
                    {t('Already added')}
                  </span>
                )}
              </label>
            )
          })
        )}
      </div>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-muted-foreground text-xs'>
          {t('{{count}} selected models', { count: selected.length })}
        </span>
        <div className='flex gap-2'>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => setSelected([])}
          >
            {t('Clear')}
          </Button>
          <Button
            type='button'
            size='sm'
            disabled={selected.length === 0}
            onClick={apply}
          >
            {t('Apply selected')}
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Per-channel model pricing (需求2).
 *
 * Lets an operator override either a multiplier ("ratio", e.g. 0.8 bills the
 * model at 80% of the configured platform price) or an absolute price
 * ("price") for individual models coming from a given channel. Overrides are
 * folded into the group ratio on the relay billing path, so they change what
 * the user is actually charged — not just what the UI shows.
 */
export function ChannelPricingSection({
  defaultSetting,
}: {
  defaultSetting: string
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const [saved] = useState(() => serialize(deserialize(defaultSetting)))
  const [draft, setDraft] = useState<Draft>(() => deserialize(defaultSetting))
  const [pickerRowId, setPickerRowId] = useState<string | null>(null)

  const channelsQuery = useQuery({
    queryKey: ['channels', 'channel-pricing-picker'],
    queryFn: () => getChannels({ p: 0, page_size: 500, id_sort: true }),
    staleTime: 60_000,
  })

  const channelOptions = useMemo(() => {
    const items = channelsQuery.data?.data?.items ?? []
    return items.map((channel: Channel) => ({
      value: String(channel.id),
      label: `#${channel.id} · ${channel.name}`,
    }))
  }, [channelsQuery.data])

  // Models configured on each channel (comma-separated `models` field), used to
  // power the keyword-searchable model picker so operators don't have to memorise
  // model names.
  const channelModelsMap = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const channel of channelsQuery.data?.data?.items ?? []) {
      const list = (channel.models ?? '')
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean)
      if (list.length) map[String(channel.id)] = Array.from(new Set(list))
    }
    return map
  }, [channelsQuery.data])

  function patchRow(id: string, patch: Partial<ChannelDraft>) {
    setDraft((prev) => ({
      ...prev,
      channels: prev.channels.map((row) =>
        row.id === id ? { ...row, ...patch } : row
      ),
    }))
  }

  function patchRule(
    channelRowId: string,
    ruleId: string,
    patch: Partial<ModelRuleDraft>
  ) {
    setDraft((prev) => ({
      ...prev,
      channels: prev.channels.map((row) =>
        row.id === channelRowId
          ? {
              ...row,
              models: row.models.map((rule) =>
                rule.id === ruleId ? { ...rule, ...patch } : rule
              ),
            }
          : row
      ),
    }))
  }

  function validate(): boolean {
    const seen = new Set<string>()
    for (const row of draft.channels) {
      if (!row.channelId) {
        toast.error(t('Select a channel for every rule'))
        return false
      }
      if (seen.has(row.channelId)) {
        toast.error(t('The same channel cannot be added twice'))
        return false
      }
      seen.add(row.channelId)
      if (row.ratio.trim() !== '') {
        const ratio = Number(row.ratio)
        if (!Number.isFinite(ratio) || ratio < 0) {
          toast.error(t('Multiplier must be a non-negative number'))
          return false
        }
      }
      const names = new Set<string>()
      for (const rule of row.models) {
        const model = rule.model.trim()
        if (!model) {
          toast.error(t('Model name is required'))
          return false
        }
        if (names.has(model)) {
          toast.error(t('The same model cannot be added twice'))
          return false
        }
        names.add(model)
        const value = Number(rule.value)
        if (!Number.isFinite(value) || value < 0) {
          toast.error(t('Value must be a non-negative number'))
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
      key: CHANNEL_PRICE_OPTION_KEY,
      value: serialized,
    })
  }

  function onReset() {
    setDraft(deserialize(defaultSetting))
  }

  return (
    <SettingsSection title={t('Channel Pricing')}>
      <SettingsPageFormActions
        onSave={onSave}
        onReset={onReset}
        isSaving={updateOption.isPending}
        isSaveDisabled={!isDirty}
        isResetDisabled={!isDirty}
        saveLabel='Save channel pricing'
      />
      <SettingsFormGrid>
        <SettingsFormGridItem span='full'>
          <SettingsSwitchField
            controlId='channel-pricing-enabled'
            checked={draft.enabled}
            onCheckedChange={(checked) =>
              setDraft((prev) => ({ ...prev, enabled: checked }))
            }
            label={t('Enabled')}
            description={t(
              'Charge requests differently depending on which upstream channel served them.'
            )}
          />
        </SettingsFormGridItem>

        {draft.channels.length === 0 ? (
          <SettingsFormGridItem span='full'>
            <p className='text-muted-foreground text-sm'>
              {t('No channel rule yet')}
            </p>
          </SettingsFormGridItem>
        ) : null}

        {draft.channels.map((row) => (
          <SettingsFormGridItem key={row.id} span='full'>
            <div className='bg-muted/20 space-y-3 rounded-xl border p-3'>
              <div className='flex flex-wrap items-end justify-between gap-3'>
                <div className='flex min-w-0 flex-wrap items-end gap-3'>
                  <div className='space-y-1'>
                    <Label className='text-muted-foreground text-xs'>
                      {t('Channel')}
                    </Label>
                    <Combobox
                      options={channelOptions}
                      value={row.channelId}
                      onValueChange={(value) =>
                        patchRow(row.id, { channelId: value ?? '' })
                      }
                      disabled={channelsQuery.isLoading}
                      placeholder={t('Select a channel')}
                      className='w-64'
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label className='text-muted-foreground text-xs'>
                      {t('Channel-wide multiplier')}
                    </Label>
                    <Input
                      className='w-32'
                      inputMode='decimal'
                      placeholder='1'
                      value={row.ratio}
                      onChange={(event) =>
                        patchRow(row.id, { ratio: event.target.value })
                      }
                    />
                  </div>
                  <div className='flex items-center gap-2 pb-1'>
                    <Switch
                      checked={row.enabled}
                      onCheckedChange={(checked) =>
                        patchRow(row.id, { enabled: checked })
                      }
                    />
                    <Label className='text-xs'>{t('Enabled')}</Label>
                  </div>
                </div>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      channels: prev.channels.filter((item) => item.id !== row.id),
                    }))
                  }
                >
                  <Trash2 data-icon='inline-start' />
                  <span>{t('Remove')}</span>
                </Button>
              </div>
              <p className='text-muted-foreground text-xs'>
                {t('Channel-wide multiplier hint')}
              </p>

              <SettingsControlChildren className='space-y-2'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <Label className='text-muted-foreground text-xs'>
                    {t('Per-model overrides')}
                  </Label>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    disabled={!row.channelId}
                    onClick={() =>
                      setPickerRowId((prev) =>
                        prev === row.id ? null : row.id
                      )
                    }
                  >
                    <Plus data-icon='inline-start' />
                    <span>{t('Batch add models')}</span>
                  </Button>
                </div>
                {pickerRowId === row.id && (
                  <ChannelModelPicker
                    models={channelModelsMap[row.channelId] ?? []}
                    existing={new Set(row.models.map((m) => m.model))}
                    onApply={(models) => {
                      const current = new Set(row.models.map((m) => m.model))
                      const additions = models
                        .filter((m) => !current.has(m))
                        .map((m) => ({ ...newModelRow(), model: m }))
                      if (additions.length) {
                        patchRow(row.id, {
                          models: [...row.models, ...additions],
                        })
                      }
                    }}
                    onClose={() => setPickerRowId(null)}
                  />
                )}
                {row.models.length === 0 ? (
                  <p className='text-muted-foreground text-xs'>
                    {t('No models configured for channel')}
                  </p>
                ) : (
                  row.models.map((rule) => {
                    const modelOptions = (
                      channelModelsMap[row.channelId] ?? []
                    ).map((m) => ({ value: m, label: m }))
                    return (
                      <div
                        key={rule.id}
                        className='flex flex-wrap items-center gap-2'
                      >
                        <Combobox
                          options={modelOptions}
                          value={rule.model || null}
                          onValueChange={(value) =>
                            patchRule(row.id, rule.id, { model: value ?? '' })
                          }
                          allowCustomValue
                          searchPlaceholder={t('Search models')}
                          placeholder='gpt-4o'
                          className='w-56'
                        />
                        <Combobox
                          options={[
                            { value: 'ratio', label: t('Multiplier') },
                            { value: 'price', label: t('Absolute price') },
                          ]}
                          value={rule.mode}
                          onValueChange={(value) =>
                            patchRule(row.id, rule.id, {
                              mode: value === 'price' ? 'price' : 'ratio',
                            })
                          }
                          className='w-40'
                        />
                        <Input
                          className='w-32'
                          inputMode='decimal'
                          placeholder={rule.mode === 'price' ? '2.5' : '0.8'}
                          value={rule.value}
                          onChange={(event) =>
                            patchRule(row.id, rule.id, {
                              value: event.target.value,
                            })
                          }
                        />
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          aria-label={t('Remove')}
                          onClick={() =>
                            patchRow(row.id, {
                              models: row.models.filter(
                                (item) => item.id !== rule.id
                              ),
                            })
                          }
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    )
                  })
                )}
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() =>
                    patchRow(row.id, {
                      models: [...row.models, newModelRow()],
                    })
                  }
                >
                  <Plus data-icon='inline-start' />
                  <span>{t('Add model rule')}</span>
                </Button>
                <p className='text-muted-foreground text-xs'>
                  {t('Absolute price hint')}
                </p>
              </SettingsControlChildren>
            </div>
          </SettingsFormGridItem>
        ))}

        <SettingsFormGridItem span='full'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={!draft.enabled}
            onClick={() =>
              setDraft((prev) => ({
                ...prev,
                channels: [...prev.channels, newChannelRow()],
              }))
            }
          >
            <Plus data-icon='inline-start' />
            <span>{t('Add channel rule')}</span>
          </Button>
        </SettingsFormGridItem>
      </SettingsFormGrid>
    </SettingsSection>
  )
}
