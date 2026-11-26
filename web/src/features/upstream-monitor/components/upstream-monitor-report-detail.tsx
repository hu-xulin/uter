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
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import {
  StaticDataTable,
  type StaticDataTableColumn,
} from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Heading } from '@/design-system'
import { toIntlLocale } from '@/i18n/languages'

import {
  getUpstreamMonitorReport,
  getUpstreamMonitorTask,
  listUpstreamMonitorReports,
} from '../api'
import { upstreamMonitorQueryKeys } from '../lib/upstream-monitor-actions'
import type {
  UpstreamDimension,
  UpstreamMonitorReport,
  UpstreamProbe,
} from '../types'

type Props = {
  taskId: number
  reportId?: number
  model?: string
}

export function UpstreamMonitorReportDetail(props: Props) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const navigate = useNavigate()

  const taskQuery = useQuery({
    queryKey: upstreamMonitorQueryKeys.task(props.taskId),
    queryFn: () => getUpstreamMonitorTask(props.taskId),
  })
  const reportsQuery = useQuery({
    queryKey: upstreamMonitorQueryKeys.reports(props.taskId, props.model),
    queryFn: () => listUpstreamMonitorReports(props.taskId, 0, 20, props.model),
  })

  const selectedId = props.reportId ?? reportsQuery.data?.items[0]?.id ?? 0
  const reportQuery = useQuery({
    queryKey: upstreamMonitorQueryKeys.report(selectedId),
    queryFn: () => getUpstreamMonitorReport(selectedId),
    enabled: selectedId > 0,
  })

  if (reportsQuery.isLoading || reportQuery.isLoading || taskQuery.isLoading) {
    return <LoadingState />
  }
  if (reportsQuery.isError || reportQuery.isError || taskQuery.isError) {
    return <ErrorState />
  }
  const report = reportQuery.data
  if (!report) {
    return <EmptyState title={t('No reports yet')} />
  }
  const models = taskQuery.data?.models ?? []
  const changeModelFilter = (nextModel?: string) => {
    void navigate({
      to: '/upstream-monitor/$taskId',
      params: { taskId: String(props.taskId) },
      search: { model: nextModel, reportId: undefined },
    })
  }
  const openReport = (nextReportId: number) => {
    void navigate({
      to: '/upstream-monitor/$taskId',
      params: { taskId: String(props.taskId) },
      search: { model: props.model, reportId: nextReportId },
    })
  }

  const dimensionColumns: StaticDataTableColumn<UpstreamDimension>[] = [
    {
      id: 'label',
      header: t('Dimension'),
      cell: (dimension) => t(dimension.key, { defaultValue: dimension.label }),
    },
    {
      id: 'score',
      header: t('Score'),
      cell: (dimension) => `${dimension.score}/100`,
    },
    {
      id: 'weight',
      header: t('Weight'),
      cell: (dimension) => `${dimension.weight}%`,
    },
    {
      id: 'summary',
      header: t('Summary'),
      cell: (dimension) => dimension.summary,
    },
  ]

  const probeColumns: StaticDataTableColumn<UpstreamProbe>[] = [
    {
      id: 'label',
      header: t('Probe'),
      cell: (probe) => t(probe.key, { defaultValue: probe.label }),
    },
    {
      id: 'result',
      header: t('Result'),
      cell: (probe) => {
        if (probe.skipped) return t('Skipped')
        return probe.passed ? t('Passed') : t('Failed')
      },
    },
    {
      id: 'detail',
      header: t('Detail'),
      cell: (probe) => probe.detail,
    },
  ]

  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap items-center gap-2'>
        <span className='text-muted-foreground text-sm'>{t('Model')}</span>
        <Select
          value={props.model ?? '__all__'}
          onValueChange={(value) =>
            changeModelFilter(value && value !== '__all__' ? value : undefined)
          }
        >
          <SelectTrigger className='w-72'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='__all__'>{t('All models')}</SelectItem>
            {models.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className='flex items-center gap-6'>
        <div className='bg-secondary rounded-lg p-4 text-center'>
          <div className='text-muted-foreground text-sm'>
            {t('Overall score')}
          </div>
          <div className='text-3xl font-medium'>{report.score}</div>
          <div className='text-muted-foreground text-sm'>/ 100</div>
        </div>
        <div>
          <Heading variant='group-title' level={3}>
            {t(report.verdict)}
          </Heading>
          <p className='text-muted-foreground text-sm'>
            {report.model} ·{' '}
            {new Date(report.created_at * 1000).toLocaleString(locale)}
          </p>
          {report.error ? <p className='text-sm'>{report.error}</p> : null}
        </div>
      </div>

      <section className='space-y-2'>
        <Heading variant='group-title' level={3}>
          {t('Dimension scores')}
        </Heading>
        <StaticDataTable
          data={report.dimensions ?? []}
          columns={dimensionColumns}
          getRowKey={(dimension, index) => dimension.key || index}
        />
      </section>

      <section className='space-y-2'>
        <Heading variant='group-title' level={3}>
          {t('Probe results')}
        </Heading>
        <StaticDataTable
          data={report.probes ?? []}
          columns={probeColumns}
          getRowKey={(probe, index) => probe.key || index}
        />
      </section>

      <section className='space-y-2'>
        <Heading variant='group-title' level={3}>
          {t('Measured metrics')}
        </Heading>
        <div className='text-sm'>
          <p>
            {t('TTFT')}: {report.metrics?.ttft_ms ?? 0} ms
          </p>
          <p>
            {t('TPOT')}: {report.metrics?.tpot_ms ?? 0} ms
          </p>
          <p>
            {t('Throughput')}: {report.metrics?.tps ?? 0} tok/s
          </p>
          <p>
            {t('Token inflation ratio')}:{' '}
            {report.metrics?.token_inflation_ratio ?? 0}
          </p>
        </div>
      </section>

      <section className='space-y-2'>
        <Heading variant='group-title' level={3}>
          {t('History')}
        </Heading>
        <StaticDataTable
          data={(reportsQuery.data?.items ?? []) as UpstreamMonitorReport[]}
          columns={[
            {
              id: 'model',
              header: t('Model'),
              cell: (item) => item.model || '—',
            },
            {
              id: 'time',
              header: t('Time'),
              cell: (item) =>
                new Date(item.created_at * 1000).toLocaleString(locale),
            },
            {
              id: 'score',
              header: t('Score'),
              cell: (item) => `${item.score}/100`,
            },
            {
              id: 'verdict',
              header: t('Verdict'),
              cell: (item) => t(item.verdict),
            },
            {
              id: 'open',
              header: t('Actions'),
              cell: (item) => (
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => openReport(item.id)}
                >
                  {t('View report')}
                </Button>
              ),
            },
          ]}
          getRowKey={(item) => item.id}
        />
      </section>
    </div>
  )
}
