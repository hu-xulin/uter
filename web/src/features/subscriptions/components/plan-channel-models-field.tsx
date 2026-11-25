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

import { MultiSelect } from '@/components/multi-select'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { getChannels } from '@/features/channels/api'
import { parseChannelModels } from '@/features/subscriptions/lib/channel-models'

type Props = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

type ChannelModelRow = {
  key: string
  channelId: string
  models: string[]
}

let rowSeq = 0
const nextKey = () => `cm-${Date.now()}-${rowSeq++}`

function channelModelOptions(models: string) {
  return models
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)
    .map((m) => ({ value: m, label: m }))
}

export function PlanChannelModelsField({ value, onChange, disabled }: Props) {
  const { t } = useTranslation()
  const [rows, setRows] = useState<ChannelModelRow[]>(() => {
    const parsed = parseChannelModels(value)
    return Object.entries(parsed).map(([channelId, models]) => ({
      key: nextKey(),
      channelId,
      models,
    }))
  })

  const channelsQuery = useQuery({
    queryKey: ['subscription-channel-options'],
    queryFn: async () => {
      const res = await getChannels()
      return res.data?.items ?? []
    },
    enabled: !disabled,
    retry: false,
  })
  // data 引用稳定，但 `?? []` 每次渲染会造新数组，导致下游 useMemo 反复计算。
  const channels = useMemo(() => channelsQuery.data ?? [], [channelsQuery.data])

  const channelOptions = useMemo(
    () =>
      channels.map((ch) => ({
        value: String(ch.id),
        label: ch.name ? `${ch.name} (#${ch.id})` : `#${ch.id}`,
      })),
    [channels]
  )

  const emit = (nextRows: ChannelModelRow[]) => {
    setRows(nextRows)
    const out: Record<string, string[]> = {}
    for (const row of nextRows) {
      if (!row.channelId || row.models.length === 0) continue
      out[row.channelId] = row.models
    }
    onChange(Object.keys(out).length > 0 ? JSON.stringify(out) : '')
  }

  const addRow = () => {
    emit([...rows, { key: nextKey(), channelId: '', models: [] }])
  }

  const updateRow = (key: string, patch: Partial<ChannelModelRow>) => {
    emit(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const removeRow = (key: string) => {
    emit(rows.filter((row) => row.key !== key))
  }

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between gap-2'>
        <div>
          <Label>{t('Allowed channels & models')}</Label>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Restrict this plan to specific models on specific channels. Leave empty to allow all.'
            )}
          </p>
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={disabled}
          onClick={addRow}
        >
          <Plus className='size-4' />
          {t('Add channel')}
        </Button>
      </div>

      {rows.map((row) => {
        const channel = channels.find((ch) => String(ch.id) === row.channelId)
        const modelOptions = channel
          ? channelModelOptions(channel.models || '')
          : []
        return (
          <div
            key={row.key}
            className='border-border space-y-2 rounded-lg border p-3'
          >
            <div className='flex items-start gap-2'>
              <div className='min-w-0 flex-1 space-y-1.5'>
                <Label>{t('Channel')}</Label>
                <Combobox
                  options={channelOptions}
                  value={row.channelId}
                  onValueChange={(v) =>
                    updateRow(row.key, { channelId: v ?? '', models: [] })
                  }
                  className='w-full'
                  placeholder={t('Select a channel')}
                  disabled={disabled}
                />
              </div>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                disabled={disabled}
                className='text-muted-foreground hover:text-destructive mt-6'
                onClick={() => removeRow(row.key)}
                aria-label={t('Remove channel')}
              >
                <Trash2 className='size-4' />
              </Button>
            </div>

            {row.channelId && (
              <div className='space-y-1.5'>
                <Label>{t('Models')}</Label>
                <MultiSelect
                  options={modelOptions}
                  selected={row.models}
                  onChange={(values) => updateRow(row.key, { models: values })}
                  className='w-full'
                  placeholder={t('Select models')}
                  emptyText={t('This channel has no models')}
                  disabled={disabled}
                />
              </div>
            )}
          </div>
        )
      })}

      {rows.length === 0 && (
        <p className='text-muted-foreground text-sm'>
          {t('No channel restriction configured.')}
        </p>
      )}
    </div>
  )
}
