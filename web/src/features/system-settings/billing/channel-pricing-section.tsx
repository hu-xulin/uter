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
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { getChannels, syncChannelPricing } from '@/features/channels/api'
import type {
  Channel,
  ChannelPricingQuote,
} from '@/features/channels/types'
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

type RuleMode = 'multiplier' | 'price' | 'fixed_base' | 'target_final_discount'

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
  quotes: Record<string, ChannelPricingQuote>
  models: ModelRuleDraft[]
}

type NewQuoteDraft = {
  rowId: string
  model: string
  official: string
  channel: string
  unit: 'per_1m_token' | 'per_call'
}

type Draft = {
  enabled: boolean
  channels: ChannelDraft[]
}

const EMPTY_DRAFT: Draft = { enabled: false, channels: [] }

let rowSeq = 0
const nextId = () => `row-${Date.now()}-${rowSeq++}`

function newChannelRow(channelId = ''): ChannelDraft {
  return {
    id: nextId(),
    channelId,
    enabled: true,
    ratio: '',
    quotes: {},
    models: [],
  }
}

function newModelRow(): ModelRuleDraft {
  return { id: nextId(), model: '', mode: 'multiplier', value: '' }
}

// ----------------------------------------------------------------------------
// Serialization
// ----------------------------------------------------------------------------

type SerializedRule = { mode: string; value: number }
type SerializedChannel = {
  enabled: boolean
  ratio?: number
  quotes?: Record<string, ChannelPricingQuote>
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
    if (Object.keys(row.quotes).length > 0) {
      entry.quotes = row.quotes
    }
    channels[row.channelId] = entry
  }
  return JSON.stringify({ enabled: draft.enabled, channels })
}

function parseAmount(value: string): number | undefined {
  if (value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}


function rulePlaceholder(mode: RuleMode): string {
  switch (mode) {
    case 'price':
      return '2.5'
    case 'fixed_base':
      return '4'
    case 'target_final_discount':
      return '0.7'
    default:
      return '0.8'
  }
}

function normalizeRuleMode(mode: string | undefined): RuleMode {
  switch (mode) {
    case 'price':
    case 'fixed_final':
      return 'price'
    case 'fixed_base':
      return 'fixed_base'
    case 'target_final_discount':
      return 'target_final_discount'
    default:
      return 'multiplier'
  }
}

function normalizeQuotes(
  quotes: Record<string, ChannelPricingQuote> | undefined
): Record<string, ChannelPricingQuote> {
  const normalized: Record<string, ChannelPricingQuote> = {}
  if (!quotes) return normalized
  for (const [model, quote] of Object.entries(quotes)) {
    if (!model.trim() || !quote) continue
    const entry: ChannelPricingQuote = {}
    for (const field of [
      'official_price',
      'channel_price',
      'discount',
      'completion_ratio',
      'cache_ratio',
      'create_cache_ratio',
    ] as const) {
      const value = quote[field]
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        entry[field] = value
      }
    }
    if (quote.unit) entry.unit = quote.unit
    if (quote.billing_mode) entry.billing_mode = quote.billing_mode
    if (quote.billing_expr) entry.billing_expr = quote.billing_expr
    if (quote.status) entry.status = quote.status
    if (quote.raw) entry.raw = quote.raw
    if (quote.source) entry.source = quote.source
    if (typeof quote.updated_at === 'number') entry.updated_at = quote.updated_at
    normalized[model] = entry
  }
  return normalized
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
        mode: normalizeRuleMode(rule.mode),
        value: String(rule.value ?? ''),
      })
    }
    channels.push({
      id: nextId(),
      channelId,
      enabled: config.enabled !== false,
      ratio: config.ratio === undefined ? '' : String(config.ratio),
      quotes: normalizeQuotes(config.quotes),
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
      prev.includes(model) ? prev.filter((x) => x !== model) : [...prev, model]
    )
  const apply = () => {
    onApply(selected)
    setSelected([])
    setQuery('')
    onClose()
  }
  return (
    <div className='bg-popover space-y-2 rounded-lg border p-3'>
      <div className='flex items-center gap-2'>
        <Input
          autoComplete='off'
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
          <p className='text-muted-foreground px-2 py-3 text-sm'>
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
                  disabled ? 'opacity-50' : 'hover:bg-muted/60 cursor-pointer'
                )}
              >
                <input
                  type='checkbox'
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(model)}
                />
                <span className='text-mono font-mono break-all'>{model}</span>
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
        <span className='text-muted-foreground text-sm'>
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
  const queryClient = useQueryClient()

  const [saved, setSaved] = useState(() =>
    serialize(deserialize(defaultSetting))
  )
  const [draft, setDraft] = useState<Draft>(() => deserialize(defaultSetting))
  const [pickerRowId, setPickerRowId] = useState<string | null>(null)
  const [syncingRowId, setSyncingRowId] = useState<string | null>(null)
  const [newQuote, setNewQuote] = useState<NewQuoteDraft | null>(null)

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
      if (list.length) map[String(channel.id)] = [...new Set(list)]
    }
    return map
  }, [channelsQuery.data])

  // A channel's pickable models are its configured model list plus everything
  // the upstream price sheet returned.
  function modelsForRow(row: ChannelDraft): string[] {
    const configured = channelModelsMap[row.channelId] ?? []
    return [...new Set([...configured, ...Object.keys(row.quotes)])]
  }

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

  function patchQuote(
    rowId: string,
    model: string,
    patch: Partial<ChannelPricingQuote>
  ) {
    setDraft((prev) => ({
      ...prev,
      channels: prev.channels.map((row) =>
        row.id === rowId
          ? {
              ...row,
              quotes: {
                ...row.quotes,
                [model]: { ...row.quotes[model], ...patch },
              },
            }
          : row
      ),
    }))
  }

  function removeQuote(rowId: string, model: string) {
    setDraft((prev) => ({
      ...prev,
      channels: prev.channels.map((row) => {
        if (row.id !== rowId) return row
        const quotes = { ...row.quotes }
        delete quotes[model]
        return { ...row, quotes }
      }),
    }))
  }

  function addQuote() {
    if (!newQuote) return
    const model = newQuote.model.trim()
    if (!model) {
      toast.error(t('Model name is required'))
      return
    }
    const row = draft.channels.find((item) => item.id === newQuote.rowId)
    if (!row) return
    if (row.quotes[model]) {
      toast.error(t('This model already has a quote'))
      return
    }
    const official = parseAmount(newQuote.official)
    const channelPrice = parseAmount(newQuote.channel)
    if (official === undefined && channelPrice === undefined) {
      toast.error(t('Enter at least one price'))
      return
    }
    patchQuote(row.id, model, {
      official_price: official,
      channel_price: channelPrice,
      unit: newQuote.unit,
      source: 'manual',
      updated_at: Math.floor(Date.now() / 1000),
    })
    setNewQuote(null)
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

  async function onSync(row: ChannelDraft) {
    const channelId = Number(row.channelId)
    if (!channelId) return
    setSyncingRowId(row.id)
    try {
      const response = await syncChannelPricing(channelId)
      const data = response.data
      if (!response.success || !data) {
        toast.error(response.message || t('Failed to sync channel prices'))
        return
      }
      const nextDraft: Draft = {
        ...draft,
        channels: draft.channels.map((item) =>
          item.id === row.id
            ? { ...item, enabled: true, quotes: normalizeQuotes(data.quotes) }
            : item
        ),
      }
      setDraft(nextDraft)
      // The sync already persisted the quote sheet; mirror the exact local
      // shape so only genuinely unsaved edits keep the form dirty.
      setSaved(serialize(nextDraft))
      queryClient.invalidateQueries({ queryKey: ['system-options'] })
      toast.success(
        t('Imported {{count}} model prices', { count: data.imported })
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to sync channel prices')
      )
    } finally {
      setSyncingRowId(null)
    }
  }

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
            // 整段功能的总开关也是一条配置项标题：与全站设置页统一 16/600，
            // 不再单独放大到 18px。
            description={t(
              'Charge requests differently depending on which upstream channel served them.'
            )}
          />
        </SettingsFormGridItem>

        {!draft.enabled &&
        draft.channels.some((row) => Object.keys(row.quotes).length > 0) ? (
          <SettingsFormGridItem span='full'>
            <p className='text-warning text-sm'>
              {t(
                'Quotes are saved but channel pricing is disabled. Enable it above to apply them to billing.'
              )}
            </p>
          </SettingsFormGridItem>
        ) : null}

        {draft.channels.length === 0 ? (
          <SettingsFormGridItem span='full'>
            <p className='text-muted-foreground text-sm'>
              {t('No channel rule yet')}
            </p>
          </SettingsFormGridItem>
        ) : null}

        {draft.channels.map((row) => (
          <SettingsFormGridItem key={row.id} span='full'>
            <div className='bg-muted/20 space-y-3 rounded-lg border p-3'>
              <div className='flex flex-wrap items-end justify-between gap-3'>
                <div className='flex min-w-0 flex-wrap items-end gap-3'>
                  {/* 用 `flex flex-col gap-1` 而不是 `space-y-1`：Base UI 的
                      Combobox 会在末尾渲染一个 `position: fixed` 的隐藏
                      input，Tailwind v4 的 `space-y-*` 是
                      `> :not(:last-child) { margin-bottom }`，这个隐藏节点
                      把下拉框挤成「非最后一个子元素」，于是多出一份 4px 下
                      边距 —— 三个控件在 `items-end` 里就差了 4px。
                      flex 的 `gap` 不作用于脱离文档流的子元素，正好没有这个问题。 */}
                  <div className='flex flex-col gap-1'>
                    <Label tier='field' className='text-muted-foreground'>
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
                      // 与同一行的倍率输入框、启用开关同高
                      // （--ds-control-height-md）：InputGroup 会按内容撑出
                      // 2px，这里显式钉住高度。
                      className='h-(--ds-control-height-md) w-64'
                    />
                  </div>
                  <div className='flex flex-col gap-1'>
                    <Label tier='field' className='text-muted-foreground'>
                      {t('Channel-wide multiplier')}
                    </Label>
                    <Input
                      autoComplete='off'
                      className='h-(--ds-control-height-md) w-32'
                      inputMode='decimal'
                      placeholder='1'
                      value={row.ratio}
                      onChange={(event) =>
                        patchRow(row.id, { ratio: event.target.value })
                      }
                    />
                  </div>
                  {/* 开关组按控件高度居中，不再靠 pb-1 目测微调。 */}
                  <div className='flex h-(--ds-control-height-md) items-center gap-2'>
                    <Switch
                      checked={row.enabled}
                      onCheckedChange={(checked) =>
                        patchRow(row.id, { enabled: checked })
                      }
                    />
                    <Label tier='default'>{t('Enabled')}</Label>
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    disabled={
                      !row.channelId || isDirty || syncingRowId === row.id
                    }
                    onClick={() => void onSync(row)}
                  >
                    <RefreshCw
                      data-icon='inline-start'
                      className={cn(
                        syncingRowId === row.id && 'animate-spin'
                      )}
                    />
                    <span>{t('Sync upstream prices')}</span>
                  </Button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        channels: prev.channels.filter(
                          (item) => item.id !== row.id
                        ),
                      }))
                    }
                  >
                    <Trash2 data-icon='inline-start' />
                    <span>{t('Remove')}</span>
                  </Button>
                </div>
              </div>
              <p className='text-muted-foreground text-sm'>
                {t('Channel-wide multiplier hint')}
              </p>
              <p className='text-muted-foreground text-sm'>
                {isDirty
                  ? t('Save changes before syncing upstream prices')
                  : t('Pricing sync hint')}
              </p>

              {Object.keys(row.quotes).length > 0 && (
                <div className='space-y-2'>
                  <div className='flex items-center justify-between gap-2'>
                    <Label tier='default' className='text-muted-foreground'>
                      {t('Synced channel quotes')}
                    </Label>
                    <span className='text-muted-foreground text-xs'>
                      {t('{{count}} models', {
                        count: Object.keys(row.quotes).length,
                      })}
                    </span>
                  </div>
                  <div className='bg-background max-h-72 overflow-y-auto rounded-md border'>
                    {Object.entries(row.quotes).map(([model, quote]) => (
                      <div
                        key={model}
                        className='flex flex-wrap items-center gap-2 border-b px-3 py-2 last:border-b-0'
                      >
                        <span className='text-mono min-w-0 flex-1 font-mono text-sm break-all'>
                          {model}
                        </span>
                        {quote.status === 'needs_review' && (
                          <Badge variant='warning'>{t('Needs review')}</Badge>
                        )}
                        <label className='flex items-center gap-1 text-sm'>
                          <span className='text-muted-foreground'>
                            {t('Official')}
                          </span>
                          <Input
                            aria-label={t('Official price')}
                            className='w-24'
                            inputMode='decimal'
                            min={0}
                            step='0.0001'
                            type='number'
                            value={quote.official_price ?? ''}
                            onChange={(event) =>
                              patchQuote(row.id, model, {
                                official_price: parseAmount(event.target.value),
                              })
                            }
                          />
                        </label>
                        <label className='flex items-center gap-1 text-sm'>
                          <span className='text-muted-foreground'>
                            {t('Channel')}
                          </span>
                          <Input
                            aria-label={t('Channel price')}
                            className='w-24'
                            inputMode='decimal'
                            min={0}
                            step='0.0001'
                            type='number'
                            value={quote.channel_price ?? ''}
                            onChange={(event) =>
                              patchQuote(row.id, model, {
                                channel_price: parseAmount(event.target.value),
                                status: 'ok',
                                billing_mode: undefined,
                                billing_expr: undefined,
                              })
                            }
                          />
                        </label>
                        <Combobox
                          options={[
                            {
                              value: 'per_1m_token',
                              label: t('per 1M tokens'),
                            },
                            { value: 'per_call', label: t('per request') },
                          ]}
                          value={quote.unit ?? 'per_1m_token'}
                          onValueChange={(value) =>
                            patchQuote(row.id, model, {
                              unit: value === 'per_call' ? 'per_call' : 'per_1m_token',
                            })
                          }
                          className='w-40'
                        />
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          aria-label={t('Remove quote')}
                          onClick={() => removeQuote(row.id, model)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                  </div>
                  {newQuote?.rowId === row.id ? (
                    <div className='flex flex-wrap items-center gap-2'>
                      <Combobox
                        options={modelsForRow(row).map((model) => ({
                          value: model,
                          label: model,
                        }))}
                        value={newQuote.model || null}
                        onValueChange={(value) =>
                          setNewQuote((prev) =>
                            prev ? { ...prev, model: value ?? '' } : prev
                          )
                        }
                        allowCustomValue
                        searchPlaceholder={t('Search models')}
                        placeholder='gpt-4o'
                        className='w-56'
                      />
                      <Input
                        aria-label={t('Official price')}
                        className='w-24'
                        inputMode='decimal'
                        min={0}
                        step='0.0001'
                        type='number'
                        placeholder={t('Official price')}
                        value={newQuote.official}
                        onChange={(event) =>
                          setNewQuote((prev) =>
                            prev
                              ? { ...prev, official: event.target.value }
                              : prev
                          )
                        }
                      />
                      <Input
                        aria-label={t('Channel price')}
                        className='w-24'
                        inputMode='decimal'
                        min={0}
                        step='0.0001'
                        type='number'
                        placeholder={t('Channel price')}
                        value={newQuote.channel}
                        onChange={(event) =>
                          setNewQuote((prev) =>
                            prev
                              ? { ...prev, channel: event.target.value }
                              : prev
                          )
                        }
                      />
                      <Combobox
                        options={[
                          { value: 'per_1m_token', label: t('per 1M tokens') },
                          { value: 'per_call', label: t('per request') },
                        ]}
                        value={newQuote.unit}
                        onValueChange={(value) =>
                          setNewQuote((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  unit:
                                    value === 'per_call'
                                      ? 'per_call'
                                      : 'per_1m_token',
                                }
                              : prev
                          )
                        }
                        className='w-40'
                      />
                      <Button type='button' size='sm' onClick={addQuote}>
                        {t('Add quote')}
                      </Button>
                      <Button
                        type='button'
                        size='sm'
                        variant='ghost'
                        onClick={() => setNewQuote(null)}
                      >
                        {t('Cancel')}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() =>
                        setNewQuote({
                          rowId: row.id,
                          model: '',
                          official: '',
                          channel: '',
                          unit: 'per_1m_token',
                        })
                      }
                    >
                      <Plus data-icon='inline-start' />
                      <span>{t('Add quote')}</span>
                    </Button>
                  )}
                </div>
              )}

              <SettingsControlChildren className='space-y-2'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <Label tier='default' className='text-muted-foreground'>
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
                    models={modelsForRow(row)}
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
                  <p className='text-muted-foreground text-sm'>
                    {t('No models configured for channel')}
                  </p>
                ) : (
                  row.models.map((rule) => {
                    const modelOptions = modelsForRow(row).map((m) => ({
                      value: m,
                      label: m,
                    }))
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
                            {
                              value: 'multiplier',
                              label: t('Multiplier'),
                            },
                            { value: 'price', label: t('Absolute final price') },
                            {
                              value: 'fixed_base',
                              label: t('Absolute base price'),
                            },
                            {
                              value: 'target_final_discount',
                              label: t('Discount off official price'),
                            },
                          ]}
                          value={rule.mode}
                          onValueChange={(value) =>
                            patchRule(row.id, rule.id, {
                              mode: normalizeRuleMode(value ?? undefined),
                            })
                          }
                          className='w-52'
                        />
                        <Input
                          autoComplete='off'
                          className='w-32'
                          inputMode='decimal'
                          placeholder={rulePlaceholder(rule.mode)}
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
                {/* 「新增模型规则」是这一组里的主操作，用矩形描边按钮而不是
                    无边框的文字按钮：它和底部的「新增渠道规则」同级，样式要一致。 */}
                <Button
                  type='button'
                  variant='outline'
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
                <p className='text-muted-foreground text-sm'>
                  {t('Pricing mode hint')}
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
