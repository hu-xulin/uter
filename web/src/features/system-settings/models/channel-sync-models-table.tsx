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
import { RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

import { getDreamRouterSyncModels, runDreamRouterSync } from '../api'
import type { DreamRouterPriceLine, DreamRouterSyncModelRow } from '../types'

const SYNC_MODELS_QUERY_KEY = ['dreamrouter-sync-models'] as const

/**
 * 上游（创梦 / DreamRouter）与 Uter 的逐模型价格对照表。
 *
 * 数据来自后端最近一次成功同步写入的快照，因此这里展示的是**落库后的现值**，
 * 而不是「本次算出来的目标值」——一行既回答「卖多少钱」，也回答「有没有真的
 * 写进去」。行末的对齐状态就是这条证据：`aligned` 为 false 说明 Uter 侧现值
 * 与「官方价 × 价格规则系数」不一致。
 *
 * 价格单位固定为美元：上游目录价与 Uter 倍率都以美元计价（model_ratio 1 =
 * $2 / 1M tokens），换算成展示货币只会让两侧比较变得难以核对。
 */
export function ChannelSyncModelsTable() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: SYNC_MODELS_QUERY_KEY,
    queryFn: getDreamRouterSyncModels,
    // 快照只在同步后变化；避免在设置页里反复轮询。
    staleTime: 60_000,
  })

  const sync = useMutation({
    mutationFn: () => runDreamRouterSync(false),
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.message || t('Sync failed'))
        return
      }
      const verified = result.data.verified
      // 用复核分母而不是上游原始记录数：上游 data[] 里混着 vendor 缺失的
      // 孤儿记录（不会同步），拿它当分母会永远显示「68 of 69 verified」。
      const total = result.data.verifiable_count ?? result.data.upstream_count
      toast.success(
        t('Sync finished: {{verified}} of {{total}} models verified', {
          verified,
          total,
        })
      )
      queryClient.invalidateQueries({ queryKey: SYNC_MODELS_QUERY_KEY })
    },
    onError: () => toast.error(t('Sync failed')),
  })

  const payload = data?.data
  const rows = payload?.models ?? []
  const summary = payload?.summary ?? {}

  let tableBody: ReactNode
  if (isLoading) {
    tableBody = <p className='text-muted-foreground text-sm'>{t('Loading…')}</p>
  } else if (rows.length === 0) {
    tableBody = (
      <p className='text-muted-foreground text-sm'>
        {t('No sync data yet. Run a sync to compare prices.')}
      </p>
    )
  } else {
    tableBody = (
      <div className='border-border/60 max-h-[32rem] overflow-auto rounded-lg border'>
        <Table>
          <TableHeader className='bg-muted/40 sticky top-0 z-10'>
            <TableRow>
              <TableHead colSpan={4} className='text-foreground font-medium'>
                {t('Upstream (DreamRouter)')}
              </TableHead>
              <TableHead
                colSpan={4}
                className='text-foreground border-l-border/60 border-l font-medium'
              >
                {t('Uter')}
              </TableHead>
              <TableHead className='border-l-border/60 border-l text-right font-medium'>
                {t('Alignment')}
              </TableHead>
            </TableRow>
            <TableRow>
              <TableHead>{t('Model')}</TableHead>
              <TableHead className='text-right'>{t('List price')}</TableHead>
              <TableHead className='text-right'>
                {t('Discount multiplier')}
              </TableHead>
              <TableHead className='text-right'>
                {t('Discount price')}
              </TableHead>
              <TableHead className='border-l-border/60 border-l'>
                {t('Model')}
              </TableHead>
              <TableHead className='text-right'>{t('List price')}</TableHead>
              <TableHead className='text-right'>
                {t('Discount multiplier')}
              </TableHead>
              <TableHead className='text-right'>
                {t('Discount price')}
              </TableHead>
              <TableHead className='border-l-border/60 border-l text-right'>
                {t('Status')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.upstream_name}>
                <TableCell className='text-mono font-mono'>
                  {row.upstream_name}
                </TableCell>
                <TableCell className='text-right tabular-nums'>
                  {formatLinePrice(row.official, row)}
                </TableCell>
                <TableCell className='text-right tabular-nums'>
                  <DiscountMultiplier zhe={row.upstream_zhe} />
                </TableCell>
                <TableCell className='text-right tabular-nums'>
                  {formatLinePrice(row.upstream, row)}
                </TableCell>

                <TableCell className='border-l-border/60 text-mono border-l font-mono'>
                  {row.local_name}
                </TableCell>
                <TableCell className='text-right tabular-nums'>
                  {formatLinePrice(row.official, row)}
                </TableCell>
                <TableCell className='text-right tabular-nums'>
                  <DiscountMultiplier zhe={row.uter_zhe} />
                </TableCell>
                <TableCell className='text-right tabular-nums'>
                  {formatLinePrice(row.uter, row)}
                </TableCell>

                <TableCell className='border-l-border/60 border-l text-right'>
                  {row.aligned ? (
                    <Badge variant='secondary'>{t('Aligned')}</Badge>
                  ) : (
                    <Badge variant='destructive'>{t('Drifted')}</Badge>
                  )}
                  {row.note && (
                    <span className='text-muted-foreground mt-1 block text-xs'>
                      {row.note}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-foreground text-sm font-medium'>
            {t('Upstream vs Uter price comparison')}
          </span>
          {payload?.synced && (
            <>
              <Badge variant='secondary'>
                {t('{{count}} models', { count: summary.total ?? 0 })}
              </Badge>
              <Badge
                variant={summary.all_aligned ? 'secondary' : 'destructive'}
              >
                {summary.all_aligned
                  ? t('All aligned')
                  : t('{{count}} drifted', { count: summary.drifted ?? 0 })}
              </Badge>
              {payload.synced_at && (
                <span className='text-muted-foreground text-xs'>
                  {t('Synced at {{time}}', {
                    time: new Date(payload.synced_at).toLocaleString(),
                  })}
                </span>
              )}
            </>
          )}
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={sync.isPending}
          onClick={() => sync.mutate()}
        >
          <RefreshCw
            className={cn('size-4', sync.isPending && 'animate-spin')}
            aria-hidden='true'
          />
          {sync.isPending ? t('Syncing…') : t('Sync now')}
        </Button>
      </div>

      <p className='text-muted-foreground text-sm'>
        {t(
          'Prices are in USD: per 1M tokens for token-billed models, per request for image and video models. The discount ratio is measured against the upstream list price.'
        )}
      </p>

      {tableBody}
    </div>
  )
}

/**
 * 折扣倍率：折数 6 → `x0.6`，7.5 → `x0.75`；无折扣显示「—」而不是 `x1`。
 *
 * 后端 `*_zhe` 是「折数」（0.6 折率 → 6），这里除以 10 还原成倍率，
 * 与定价页角标、上游 list price 的 `x` 写法保持同一口径。
 *
 * 倍率 > 1（uter 按价格规则算出高于上游原价，如 +1 折叠在 5% 折扣上 →
 * `x1.05`）用琥珀色：绿色在这套界面里恒表示「对用户有利」，加价不是。
 *
 * 用 `warning-soft-foreground` 而不是 `warning`：`#D97706` 落在白底上只有
 * 3.2:1，14px 文字达不到 AA 4.5:1；soft-foreground 是同一色相的可读档。
 */
function DiscountMultiplier(props: { zhe: number }) {
  const text = formatMultiplier(props.zhe)
  if (text === '—') {
    return <span className='text-muted-foreground'>{text}</span>
  }
  const isMarkup = props.zhe > 10 + 1e-9
  return (
    <span
      className={cn('font-medium', isMarkup && 'text-warning-soft-foreground')}
    >
      {text}
    </span>
  )
}

/** 折扣倍率文本：折数 6 → `x0.6`，10.5 → `x1.05`；无折扣显示「—」。 */
function formatMultiplier(zhe: number): string {
  if (!Number.isFinite(zhe) || zhe <= 0) return '—'
  return `x${Math.round((zhe / 10) * 100) / 100}`
}

/**
 * 一行价格的展示：按次计费模型显示「美元 / 次」，其余显示「美元 / 1M tokens」。
 * 缺失价格显示「—」，绝不显示 $0（0 与「未配置」是两件事）。
 */
function formatLinePrice(
  line: DreamRouterPriceLine,
  row: DreamRouterSyncModelRow
): string {
  const value = line?.input ?? 0
  if (!Number.isFinite(value) || value <= 0) return '—'
  let digits = 4
  if (value >= 1) {
    digits = 2
  } else if (value >= 0.01) {
    digits = 3
  }
  const formatted = value.toFixed(digits).replace(/\.?0+$/, '')
  return row.quota_type === 1 || row.billing_class === 'per_call'
    ? `$${formatted}`
    : `$${formatted}/1M`
}
