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
import { useNavigate } from '@tanstack/react-router'
import { Activity, Eye, Loader2, Pencil, Play, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  StaticDataTable,
  type StaticDataTableColumn,
} from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { toIntlLocale } from '@/i18n/languages'
import { getServerErrorMessage } from '@/lib/server-error-message'

import {
  deleteUpstreamMonitorTask,
  listUpstreamMonitorTasks,
  runUpstreamMonitorNow,
} from '../api'
import {
  formatMonitorScore,
  orderMonitorTasksByChannel,
  upstreamMonitorQueryKeys,
} from '../lib/upstream-monitor-actions'
import type { UpstreamMonitorTask, UpstreamVerdict } from '../types'

type UpstreamMonitorTableProps = {
  onEdit: (task: UpstreamMonitorTask) => void
  refreshTrigger: number
}

const verdictTone: Record<UpstreamVerdict, string> = {
  pass: 'text-success',
  marginal: 'text-warning',
  fail: 'text-destructive',
  error: 'text-destructive',
  unknown: 'text-muted-foreground',
}

export function UpstreamMonitorTable(props: UpstreamMonitorTableProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [pendingDelete, setPendingDelete] = useState<number | null>(null)

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: upstreamMonitorQueryKeys.tasks(),
    queryFn: listUpstreamMonitorTasks,
  })

  // 与定价页左侧渠道使用同一固定顺序：渠道任务按渠道顺序排列，
  // 手动任务排在最后。
  const orderedTasks = useMemo(() => orderMonitorTasksByChannel(tasks), [tasks])

  const runMutation = useMutation({
    mutationFn: (id: number) => runUpstreamMonitorNow(id),
    onMutate: () => {
      // A full monitor run probes every model and can take several minutes.
      // Show an upfront, persistent hint so the click is never mistaken for
      // a no-op while the request is in flight.
      toast.loading(t('Monitor run started; this may take several minutes.'), {
        id: 'upstream-monitor-run',
      })
    },
    onSuccess: (result) => {
      toast.success(
        t('Monitor run finished: {{score}} ({{verdict}})', {
          score: result.score,
          verdict: result.verdict,
        }),
        { id: 'upstream-monitor-run' }
      )
      void queryClient.invalidateQueries({
        queryKey: upstreamMonitorQueryKeys.tasks(),
      })
    },
    onError: (error) => {
      toast.error(getServerErrorMessage(error, t('Failed to run monitor')), {
        id: 'upstream-monitor-run',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteUpstreamMonitorTask(id),
    onSuccess: () => {
      toast.success(t('Monitor task deleted'))
      void queryClient.invalidateQueries({
        queryKey: upstreamMonitorQueryKeys.tasks(),
      })
    },
    onError: (error) => {
      toast.error(
        getServerErrorMessage(error, t('Failed to delete monitor task'))
      )
    },
  })

  const columns: StaticDataTableColumn<UpstreamMonitorTask>[] = [
    {
      id: 'name',
      header: t('Name'),
      cell: (task) => (
        <div className='flex flex-col'>
          <span className='font-medium'>{task.name}</span>
          <span className='text-muted-foreground text-xs'>
            {(task.models?.length ?? 0) > 1
              ? t('{{count}} models', { count: task.models.length })
              : (task.models?.[0] ?? task.model)}
          </span>
        </div>
      ),
    },
    {
      id: 'base_url',
      header: t('Endpoint'),
      cell: (task) => (
        <div className='flex flex-col'>
          <span className='font-medium'>
            {task.channel_name || t('Manual endpoint')}
          </span>
          <span className='text-muted-foreground text-xs'>
            {task.channel_group ? `${task.channel_group} · ` : ''}
            {task.base_url}
          </span>
        </div>
      ),
    },
    {
      id: 'protocol',
      header: t('Protocol'),
      cell: (task) => task.protocol,
    },
    {
      id: 'status',
      header: t('Status'),
      cell: (task) => (
        <span className={verdictTone[task.status]}>{t(task.status)}</span>
      ),
    },
    {
      id: 'score',
      header: t('Score'),
      cell: (task) => formatMonitorScore(task.last_score, task.last_run_at),
    },
    {
      id: 'interval',
      header: t('Interval'),
      cell: (task) => `${task.check_interval_minute}m`,
    },
    {
      id: 'last_run_at',
      header: t('Last run'),
      cell: (task) =>
        task.last_run_at > 0
          ? new Date(task.last_run_at * 1000).toLocaleString(locale)
          : '—',
    },
    {
      id: 'actions',
      header: t('Actions'),
      cell: (task) => (
        <div className='flex gap-1'>
          <Button
            variant='ghost'
            size='icon'
            aria-label={t('Run monitor now')}
            disabled={runMutation.isPending}
            onClick={() => runMutation.mutate(task.id)}
          >
            {runMutation.isPending && runMutation.variables === task.id ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <Play className='size-4' />
            )}
          </Button>
          <Button
            variant='ghost'
            size='icon'
            aria-label={t('View reports')}
            onClick={() =>
              navigate({
                to: '/upstream-monitor/$taskId',
                params: { taskId: String(task.id) },
              })
            }
          >
            <Eye className='size-4' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            aria-label={t('Edit monitor')}
            onClick={() => props.onEdit(task)}
          >
            <Pencil className='size-4' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            aria-label={t('Delete monitor')}
            onClick={() => setPendingDelete(task.id)}
          >
            <Trash2 className='size-4' />
          </Button>
        </div>
      ),
    },
  ]

  if (!isLoading && orderedTasks.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title={t('No monitors yet')}
        description={t(
          'Add an upstream endpoint to start continuous monitoring.'
        )}
      />
    )
  }

  return (
    <>
      <StaticDataTable
        data={orderedTasks}
        columns={columns}
        getRowKey={(task) => task.id}
        empty={isLoading}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t('Delete monitor task')}
        desc={t('This also removes all stored reports for this task.')}
        confirmText={t('Delete')}
        destructive
        handleConfirm={() => {
          if (pendingDelete !== null) deleteMutation.mutate(pendingDelete)
          setPendingDelete(null)
        }}
      />
    </>
  )
}
