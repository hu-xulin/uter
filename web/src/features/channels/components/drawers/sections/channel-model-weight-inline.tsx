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
*/
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSystemOptions } from '@/features/system-settings/hooks/use-system-options'
import { useUpdateOption } from '@/features/system-settings/hooks/use-update-option'

import { CHANNEL_MODEL_WEIGHT_OPTION_KEY } from '@/features/system-settings/billing/channel-model-weight-section'

type Entry = { weight: string; priority: string }
type ChannelEntry = Record<string, { weight: number; priority: number }>
type Setting = { enabled: boolean; channels: Record<string, ChannelEntry> }

function emptyEntry(): Entry {
  return { weight: '', priority: '' }
}

/**
 * Inline per-(channel, model) routing editor mounted inside the channel drawer.
 * Edits only this channel's entries within the shared ChannelModelWeight
 * option; saving merges back into the full setting (other channels untouched).
 */
export function ChannelModelWeightInline({
  channelId,
  models,
}: {
  channelId: number | null
  models: string[]
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const { data: options } = useSystemOptions()

  const existing = useMemo<Setting>(() => {
    const raw = (options as Record<string, string> | undefined)?.[
      CHANNEL_MODEL_WEIGHT_OPTION_KEY
    ]
    if (!raw) return { enabled: false, channels: {} }
    try {
      const parsed = JSON.parse(raw) as Setting
      return { enabled: parsed.enabled === true, channels: parsed.channels ?? {} }
    } catch {
      return { enabled: false, channels: {} }
    }
  }, [options])

  const channelEntry: ChannelEntry =
    channelId == null ? {} : existing.channels[String(channelId)] ?? {}

  const [draft, setDraft] = useState<Record<string, Entry>>({})

  function entryFor(model: string): Entry {
    if (draft[model]) return draft[model]
    const fromOption = channelEntry[model]
    if (fromOption) {
      return {
        weight: String(fromOption.weight ?? ''),
        priority: String(fromOption.priority ?? ''),
      }
    }
    return emptyEntry()
  }

  function setEntry(model: string, patch: Partial<Entry>) {
    setDraft((prev) => ({ ...prev, [model]: { ...entryFor(model), ...patch } }))
  }

  function validate(): boolean {
    for (const model of models) {
      const e = entryFor(model)
      if (e.weight.trim() === '' && e.priority.trim() === '') continue
      const w = Number(e.weight)
      const p = Number(e.priority)
      if (!Number.isFinite(w) || w < 0) {
        toast.error(t('Weight must be a non-negative integer'))
        return false
      }
      if (!Number.isFinite(p) || !Number.isInteger(p)) {
        toast.error(t('Priority must be an integer'))
        return false
      }
    }
    return true
  }

  async function onSave() {
    if (!validate()) return
    if (channelId == null) {
      toast.error(t('Save the channel before setting per-model routing'))
      return
    }
    const next: Setting = {
      enabled: true,
      channels: { ...existing.channels },
    }
    const modelMap: ChannelEntry = {}
    for (const model of models) {
      const e = entryFor(model)
      if (e.weight.trim() === '' && e.priority.trim() === '') continue
      modelMap[model] = {
        weight: Number(e.weight),
        priority: Number(e.priority),
      }
    }
    if (Object.keys(modelMap).length === 0) {
      delete next.channels[String(channelId)]
    } else {
      next.channels[String(channelId)] = modelMap
    }
    if (Object.keys(next.channels).length === 0) next.enabled = false
    await updateOption.mutateAsync({
      key: CHANNEL_MODEL_WEIGHT_OPTION_KEY,
      value: JSON.stringify(next),
    })
  }

  if (channelId == null) {
    return (
      <p className='text-muted-foreground text-xs'>
        {t('Save the channel before setting per-model routing')}
      </p>
    )
  }

  if (models.length === 0) {
    return (
      <p className='text-muted-foreground text-xs'>
        {t('Add at least one model to configure per-model routing')}
      </p>
    )
  }

  return (
    <div className='bg-muted/20 space-y-3 rounded-xl border p-3'>
      <Label className='text-muted-foreground text-xs'>
        {t('Per-model routing')}
      </Label>
      <div className='space-y-2'>
        {models.map((model) => {
          const e = entryFor(model)
          return (
            <div key={model} className='flex flex-wrap items-center gap-2'>
              <span className='w-44 truncate font-mono text-xs' title={model}>
                {model}
              </span>
              <Input
                className='w-24'
                inputMode='decimal'
                placeholder={t('Weight')}
                value={e.weight}
                onChange={(event) =>
                  setEntry(model, { weight: event.target.value })
                }
              />
              <Input
                className='w-24'
                inputMode='decimal'
                placeholder={t('Priority')}
                value={e.priority}
                onChange={(event) =>
                  setEntry(model, { priority: event.target.value })
                }
              />
            </div>
          )
        })}
      </div>
      <Button
        type='button'
        size='sm'
        disabled={updateOption.isPending}
        onClick={() => void onSave()}
      >
        {t('Save channel model weight')}
      </Button>
      <p className='text-muted-foreground text-xs'>
        {t('Per-model weight & priority hint')}
      </p>
    </div>
  )
}
