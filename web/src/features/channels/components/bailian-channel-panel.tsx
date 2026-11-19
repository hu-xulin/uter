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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'

import {
  applyBailianCatalog,
  getBailianSyncStatus,
  refreshBailianCatalog,
  type BailianSyncStatus,
} from '../api'

const REGIONS = [
  { value: 'cn-beijing', suffix: 'cn-beijing.maas.aliyuncs.com' },
  { value: 'ap-southeast-1', suffix: 'ap-southeast-1.maas.aliyuncs.com' },
  { value: 'cn-hongkong', suffix: 'cn-hongkong.maas.aliyuncs.com' },
  { value: 'eu-central-1', suffix: 'eu-central-1.maas.aliyuncs.com' },
  { value: 'ap-northeast-1', suffix: 'ap-northeast-1.maas.aliyuncs.com' },
  { value: 'us-east-1', suffix: 'us-east-1.maas.aliyuncs.com' },
] as const

type RegionValue = (typeof REGIONS)[number]['value']

function parseWorkspaceBase(baseUrl: string): {
  workspace: string
  region: RegionValue
} {
  const match = /^https?:\/\/([^.]+)\.([a-z0-9-]+)\.maas\.aliyuncs\.com/i.exec(
    baseUrl.trim()
  )
  if (match) {
    const region = REGIONS.find((item) => item.suffix.startsWith(match[2]))
    return { workspace: match[1], region: region?.value ?? 'cn-beijing' }
  }
  return { workspace: '', region: 'cn-beijing' }
}

type BailianChannelPanelProps = {
  channelId: number | null
  baseUrl: string
  onChangeBaseUrl: (value: string) => void
}

/**
 * Alibaba Bailian channel configuration and sync state.
 *
 * The Base URL is composed from region + workspace so the channel stores one
 * auditable endpoint. The sync panel only reports reference data: applying the
 * official catalog fills blank metadata and never writes billing prices.
 */
export function BailianChannelPanel(props: BailianChannelPanelProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const parsed = useMemo(
    () => parseWorkspaceBase(props.baseUrl),
    [props.baseUrl]
  )
  const statusQuery = useQuery({
    queryKey: ['bailian-sync-status'],
    queryFn: getBailianSyncStatus,
    enabled: props.channelId != null,
    retry: false,
    meta: { errorToast: false },
  })

  const applyWorkspace = (workspace: string, region: RegionValue) => {
    const suffix = REGIONS.find((item) => item.value === region)?.suffix
    if (!workspace.trim() || !suffix) return
    props.onChangeBaseUrl(`https://${workspace.trim()}.${suffix}`)
  }

  const refresh = useMutation({
    mutationFn: () => refreshBailianCatalog(props.channelId ?? 0),
    onSuccess: () => {
      toast.success(t('Official catalog synchronized'))
      void queryClient.invalidateQueries({ queryKey: ['bailian-sync-status'] })
    },
    onError: (error) =>
      handleServerError(error, t('Failed to sync official catalog')),
  })

  const apply = useMutation({
    mutationFn: () => applyBailianCatalog(props.channelId ?? 0),
    onSuccess: () => {
      toast.success(t('Catalog metadata applied'))
      void queryClient.invalidateQueries({ queryKey: ['bailian-sync-status'] })
    },
    onError: (error) =>
      handleServerError(error, t('Failed to apply catalog metadata')),
  })

  const status =
    statusQuery.data && 'channel_id' in statusQuery.data
      ? (statusQuery.data as BailianSyncStatus)
      : null

  return (
    <div className='space-y-3 rounded-lg border p-3'>
      <div className='space-y-1'>
        <Label>{t('Alibaba Bailian')}</Label>
        <p className='text-muted-foreground text-sm'>
          {t('Build the workspace endpoint from region and workspace ID.')}
        </p>
      </div>

      <div className='grid gap-3 sm:grid-cols-2'>
        <div className='space-y-1.5'>
          <Label htmlFor='bailian-region'>{t('Region')}</Label>
          <Select
            value={parsed.region}
            onValueChange={(value) => {
              if (value) applyWorkspace(parsed.workspace, value as RegionValue)
            }}
          >
            <SelectTrigger id='bailian-region' className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REGIONS.map((region) => (
                <SelectItem key={region.value} value={region.value}>
                  {t(region.value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-1.5'>
          <Label htmlFor='bailian-workspace'>{t('Workspace ID')}</Label>
          <Input
            id='bailian-workspace'
            mono
            defaultValue={parsed.workspace}
            placeholder='ws-xxxxxxxxxxxx'
            onBlur={(event) =>
              applyWorkspace(event.target.value, parsed.region)
            }
          />
        </div>
      </div>

      {props.channelId != null && (
        <div className='space-y-2 border-t pt-3'>
          <div className='flex flex-wrap items-center gap-2'>
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
            >
              <RefreshCw
                className={cn('size-4', refresh.isPending && 'animate-spin')}
              />
              {t('Sync official catalog')}
            </Button>
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() => apply.mutate()}
              disabled={apply.isPending}
            >
              <Sparkles className='size-4' />
              {t('Apply catalog metadata')}
            </Button>
          </div>
          <div className='text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3'>
            <span>
              {t('Actual models')}: {status?.actual_models ?? 0}
            </span>
            <span>
              {t('Catalog models')}: {status?.catalog_models ?? 0}
            </span>
            <span>
              {t('Matched models')}: {status?.matched_models ?? 0}
            </span>
            <span>
              {t('Reference prices')}: {status?.reference_prices ?? 0}
            </span>
            <span>
              {t('Metadata created')}: {status?.metadata_created ?? 0}
            </span>
            <span>
              {t('Metadata updated')}: {status?.metadata_updated ?? 0}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
