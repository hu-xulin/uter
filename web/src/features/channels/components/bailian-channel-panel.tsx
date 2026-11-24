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

import { Badge } from '@/components/ui/badge'
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
  getBailianCatalogCoverage,
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
  onCreateDraft?: () => Promise<number | null>
  onChangeBaseUrl: (value: string) => void
}

/**
 * Alibaba Bailian channel configuration and sync state.
 *
 * The Base URL is composed from region + workspace so the channel stores one
 * auditable endpoint. The sync panel only reports reference data: applying the
 * channel catalog fills blank metadata and never overwrites the Uter sale price.
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

  const coverageQuery = useQuery({
    queryKey: ['bailian-catalog-coverage', props.channelId],
    queryFn: () => getBailianCatalogCoverage(props.channelId ?? 0),
    enabled: props.channelId != null,
    retry: false,
    meta: { errorToast: false },
  })
  const refresh = useMutation({
    mutationFn: () => refreshBailianCatalog(props.channelId ?? 0),
    onSuccess: () => {
      toast.success(t('Channel catalog synchronized'))
      void queryClient.invalidateQueries({ queryKey: ['bailian-sync-status'] })
    },
    onError: (error) =>
      handleServerError(error, t('Failed to sync channel catalog')),
  })

  const apply = useMutation({
    mutationFn: () => applyBailianCatalog(props.channelId ?? 0),
    onSuccess: () => {
      toast.success(t('Catalog metadata applied'))
      void queryClient.invalidateQueries({ queryKey: ['bailian-sync-status'] })
      void queryClient.invalidateQueries({
        queryKey: ['channel-model-pricing', props.channelId],
      })
    },
    onError: (error) =>
      handleServerError(error, t('Failed to apply catalog metadata')),
  })

  const payload = statusQuery.data
  const status: BailianSyncStatus | null =
    payload?.post_create ??
    (payload?.channel_id != null ? (payload as BailianSyncStatus) : null)
  const scheduled = payload?.scheduled ?? null
  let bailianSyncLabel = t('Not synced yet')
  let bailianSyncVariant: 'secondary' | 'warning' | 'default' = 'warning'
  if (refresh.isPending || apply.isPending || statusQuery.isLoading) {
    bailianSyncLabel = t('Syncing...')
    bailianSyncVariant = 'secondary'
  } else if (status?.finished_at || scheduled?.finished_at) {
    bailianSyncLabel = t('Synced')
    bailianSyncVariant = 'default'
  }

  return (
    <div className='space-y-3 rounded-lg border p-3'>
      <div className='space-y-1'>
        <Label>{t('Alibaba Bailian')}</Label>
        <p className='text-muted-foreground text-sm'>
          {t('Build the workspace endpoint from region and workspace ID.')}
        </p>
        <div className='flex flex-wrap items-center gap-1.5 pt-1'>
          <span className='text-muted-foreground text-xs'>
            {t('Synced fields')}:
          </span>
          {[
            'Description',
            'Icon',
            'Tags',
            'Vendor',
            'Endpoints',
            'Context window',
            'Max output',
            'Knowledge cutoff',
            'Release date',
            'Input modalities',
            'Output modalities',
            'Channel prices',
          ].map((field) => (
            <Badge key={field} variant='outline' className='font-normal'>
              {t(field)}
            </Badge>
          ))}
        </div>
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
              disabled={refresh.isPending || props.channelId == null}
            >
              <RefreshCw
                className={cn('size-4', refresh.isPending && 'animate-spin')}
              />
              {t('Sync channel catalog')}
            </Button>
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() => apply.mutate()}
              disabled={apply.isPending || props.channelId == null}
            >
              <Sparkles className='size-4' />
              {t('Apply catalog metadata')}
            </Button>
            <Badge variant={bailianSyncVariant}>{bailianSyncLabel}</Badge>
          </div>
          {props.channelId == null ? (
            <p className='text-muted-foreground text-sm'>
              {t('A draft channel is created automatically to fetch prices.')}
            </p>
          ) : null}
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
              {t('Channel prices')}: {status?.reference_prices ?? 0}
            </span>
            <span>
              {t('Metadata created')}: {status?.metadata_created ?? 0}
            </span>
            <span>
              {t('Metadata updated')}: {status?.metadata_updated ?? 0}
            </span>
            <span>
              {t('Pricing records')}: {status?.pricing_records ?? 0}
            </span>
          </div>
          {scheduled ? (
            <div className='text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-2 text-sm sm:grid-cols-3'>
              <span className='flex items-center gap-1.5'>
                {t('Scheduled sync')}:
                <Badge variant={scheduled.success ? 'default' : 'warning'}>
                  {t(scheduled.success ? 'Success' : 'Failed')}
                </Badge>
              </span>
              <span>
                {t('Models')}: {scheduled.models}
              </span>
              <span>
                {t('Prices written')}: {scheduled.written}
              </span>
              <span>
                {t('Price changes')}: {scheduled.changes}
              </span>
              <span>
                {t('Reviews')}: {scheduled.reviews}
              </span>
              <span>
                {t('Due channels')}: {scheduled.due_channels}
              </span>
            </div>
          ) : null}

          {coverageQuery.data ? (
            <div className='space-y-1.5 border-t pt-2'>
              <div className='flex flex-wrap items-center gap-2 text-sm'>
                <span className='text-muted-foreground'>
                  {t('Catalog coverage')}:
                </span>
                <Badge variant='outline'>
                  {coverageQuery.data.matched} /{' '}
                  {coverageQuery.data.channel_models}
                </Badge>
                {coverageQuery.data.unmatched > 0 ? (
                  <Badge variant='warning'>
                    {t('{{count}} unmatched', {
                      count: coverageQuery.data.unmatched,
                    })}
                  </Badge>
                ) : null}
              </div>
              {coverageQuery.data.unmatched > 0 ? (
                <ul className='text-muted-foreground space-y-0.5 text-sm'>
                  {coverageQuery.data.models
                    .filter((item) => !item.in_catalog)
                    .slice(0, 8)
                    .map((item) => (
                      <li key={item.model_name}>
                        {item.model_name} · {t(item.action)}
                      </li>
                    ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
