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
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  StaticDataTable,
  type StaticDataTableColumn,
} from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { SectionPageLayout } from '@/components/layout'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TitledCard } from '@/components/ui/titled-card'
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

  // 页面壳与钱包页一致：标题区 + 内容区，加载/错误/空态也保留同样的外边距。
  const shell = (children: ReactNode) => (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Upstream Monitor')}
        <p className='text-muted-foreground mt-1 text-sm font-normal'>
          {reportQuery.data?.model ?? props.model ?? t('All models')}
        </p>
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          variant='outline'
          size='sm'
          onClick={() => void navigate({ to: '/upstream-monitor' })}
        >
          <ArrowLeft className='size-4' />
          {t('Back')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>{children}</SectionPageLayout.Content>
    </SectionPageLayout>
  )

  if (reportsQuery.isLoading || reportQuery.isLoading || taskQuery.isLoading) {
    return shell(<LoadingState />)
  }
  if (reportsQuery.isError || reportQuery.isError || taskQuery.isError) {
    return shell(<ErrorState />)
  }
  const report = reportQuery.data
  if (!report) {
    return shell(<EmptyState title={t('No reports yet')} />)
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

  // 卡片自带边框，表格去掉自身边框，避免双线；间距沿用钱包页的
  // gap-4 sm:gap-5（16 / 20px，均为 4px 网格档）。
  return shell(
    <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5'>
      <TitledCard
        title={t('Overview')}
        disableHoverEffect
        contentClassName='space-y-4 sm:space-y-6'
      >
        <div className='flex flex-wrap items-center gap-3'>
          <span className='text-muted-foreground text-sm'>{t('Model')}</span>
          <Select
            value={props.model ?? '__all__'}
            onValueChange={(value) =>
              changeModelFilter(
                value && value !== '__all__' ? value : undefined
              )
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

        <div className='flex flex-wrap items-center gap-4 sm:gap-6'>
          <div className='bg-secondary rounded-lg p-4 text-center'>
            <div className='text-muted-foreground text-sm'>
              {t('Overall score')}
            </div>
            <div className='text-3xl font-medium'>{report.score}</div>
            <div className='text-muted-foreground text-sm'>/ 100</div>
          </div>
          <div>
            <p className='font-medium'>{t(report.verdict)}</p>
            <p className='text-muted-foreground mt-1 text-sm'>
              {report.model} ·{' '}
              {new Date(report.created_at * 1000).toLocaleString(locale)}
            </p>
            {report.error ? (
              <p className='mt-1 text-sm'>{report.error}</p>
            ) : null}
          </div>
        </div>
      </TitledCard>

      <TitledCard title={t('Dimension scores')} disableHoverEffect>
        <StaticDataTable
          className='rounded-none border-0'
          data={report.dimensions ?? []}
          columns={dimensionColumns}
          getRowKey={(dimension, index) => dimension.key || index}
        />
      </TitledCard>

      <TitledCard title={t('Probe results')} disableHoverEffect>
        <StaticDataTable
          className='rounded-none border-0'
          data={report.probes ?? []}
          columns={probeColumns}
          getRowKey={(probe, index) => probe.key || index}
        />
      </TitledCard>

      <TitledCard
        title={t('Measured metrics')}
        disableHoverEffect
        contentClassName='grid gap-4 sm:grid-cols-2'
      >
        <p className='text-sm'>
          {t('TTFT')}: {report.metrics?.ttft_ms ?? 0} ms
        </p>
        <p className='text-sm'>
          {t('TPOT')}: {report.metrics?.tpot_ms ?? 0} ms
        </p>
        <p className='text-sm'>
          {t('Throughput')}: {report.metrics?.tps ?? 0} tok/s
        </p>
        <p className='text-sm'>
          {t('Token inflation ratio')}:{' '}
          {report.metrics?.token_inflation_ratio ?? 0}
        </p>
      </TitledCard>

      <TitledCard title={t('History')} disableHoverEffect>
        <StaticDataTable
          className='rounded-none border-0'
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
      </TitledCard>
    </div>
  )
}
