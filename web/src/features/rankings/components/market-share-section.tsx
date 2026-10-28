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
import { VChart } from '@visactor/react-vchart'
import { PieChart } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Heading } from '@/design-system'
import {
  VENDOR_BRAND_COLORS,
  VENDOR_FALLBACK_PALETTE,
} from '@/design-system/tokens/brand-colors'
import { CHART_FONT_SIZE } from '@/design-system/tokens/chart-typography'
import { useChartAxisColors, useChartTheme } from '@/lib/use-chart-theme'
import { VCHART_OPTION } from '@/lib/vchart'

import { formatShare, formatTokens } from '../lib/format'
import type { RankingPeriod, VendorRanking, VendorShareSeries } from '../types'
import { VendorLink } from './entity-links'

const PERIOD_DESCRIPTIONS: Record<RankingPeriod, string> = {
  today: 'Token share by model author across the last 24 hours',
  week: 'Token share by model author across the past few weeks',
  month: 'Token share by model author across the past month',
  year: 'Token share by model author across the past year',
}

/**
 * 厂商 → 品牌色。色表集中在 `design-system/tokens/brand-colors`：
 * 第三方商标配色无法语义化（改成 `--primary` 等于改人家 logo），
 * 只能在设计系统里集中登记，不允许散落在组件中。
 */
const VENDOR_COLOURS = VENDOR_BRAND_COLORS

const FALLBACK_PALETTE = VENDOR_FALLBACK_PALETTE

function buildVendorColourMap(names: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  let fallbackIdx = 0
  for (const name of names) {
    if (VENDOR_COLOURS[name]) {
      result[name] = VENDOR_COLOURS[name]
    } else {
      result[name] = FALLBACK_PALETTE[fallbackIdx % FALLBACK_PALETTE.length]
      fallbackIdx += 1
    }
  }
  return result
}

const MAX_VENDORS_IN_LIST = 12

type MarketShareSectionProps = {
  history: VendorShareSeries
  rows: VendorRanking[]
  period: RankingPeriod
}

/**
 * Combined "Market Share" card: a 100%-stacked bar chart showing each
 * vendor's slice of total token volume, paired below with a two-column
 * vendor list.
 */
export function MarketShareSection(props: MarketShareSectionProps) {
  const { t } = useTranslation()
  const { resolvedTheme, themeReady } = useChartTheme()
  const { textColor: chartTextColor, gridColor: chartGridColor } =
    useChartAxisColors()

  const colourMap = useMemo(
    () => buildVendorColourMap(props.history.vendors.map((v) => v.name)),
    [props.history]
  )

  const orderedPoints = useMemo(() => {
    const order = new Map(
      props.history.vendors.map((v, idx) => [v.name, idx] as const)
    )
    return [...props.history.points].sort((a, b) => {
      const tsCmp = a.ts.localeCompare(b.ts)
      if (tsCmp !== 0) return tsCmp
      return (order.get(a.vendor) ?? 999) - (order.get(b.vendor) ?? 999)
    })
  }, [props.history])

  const spec = useMemo(() => {
    if (orderedPoints.length === 0) return null
    return {
      type: 'bar' as const,
      data: [{ id: 'vendor-share', values: orderedPoints }],
      xField: 'label',
      yField: 'share',
      seriesField: 'vendor',
      stack: true,
      paddingInner: 0.12,
      legends: { visible: false },
      color: { specified: colourMap },
      axes: [
        {
          orient: 'bottom',
          label: {
            style: { fill: chartTextColor, fontSize: CHART_FONT_SIZE },
            autoHide: true,
            autoLimit: true,
          },
          tick: { visible: false },
        },
        {
          orient: 'left',
          min: 0,
          max: 1,
          label: {
            formatMethod: (val: number | string) =>
              `${Math.round(Number(val) * 100)}%`,
            style: { fill: chartTextColor, fontSize: CHART_FONT_SIZE },
          },
          grid: {
            visible: true,
            style: { lineDash: [3, 3], stroke: chartGridColor },
          },
        },
      ],
      tooltip: {
        mark: {
          content: [
            {
              key: (datum: Record<string, unknown>) =>
                String(datum?.vendor ?? ''),
              value: (datum: Record<string, unknown>) =>
                `${(Number(datum?.share) * 100).toFixed(1)}% · ${formatTokens(Number(datum?.tokens) || 0)}`,
            },
          ],
        },
        dimension: {
          title: {
            value: (datum: Record<string, unknown>) =>
              String(datum?.label ?? ''),
          },
          content: [
            {
              key: (datum: Record<string, unknown>) =>
                String(datum?.vendor ?? ''),
              value: (datum: Record<string, unknown>) =>
                Number(datum?.share) || 0,
            },
          ],
          updateContent: (
            array: Array<{ key: string; value: string | number }>
          ) => {
            return array
              .filter((item) => Number(item.value) > 0.001)
              .sort((a, b) => Number(b.value) - Number(a.value))
              .map((item) => ({
                key: item.key,
                value: `${(Number(item.value) * 100).toFixed(1)}%`,
              }))
          },
        },
      },
      animationAppear: { duration: 500 },
    }
  }, [chartGridColor, chartTextColor, colourMap, orderedPoints])

  const visible = props.rows.slice(0, MAX_VENDORS_IN_LIST)
  const half = Math.ceil(visible.length / 2)
  const left = visible.slice(0, half)
  const right = visible.slice(half)

  return (
    <section className='bg-card overflow-hidden rounded-lg border'>
      {/* Chart block ----------------------------------------------------- */}
      <header className='px-5 py-4'>
        {/* 这是榜单页的顶层区块标题（第 2 层 section-title 24/600/32），
            此前是 18px，与卡片标题同档，页面层级塌了一层。 */}
        <Heading
          variant='section-title'
          className='inline-flex items-center gap-2'
        >
          <PieChart className='text-primary size-4' />
          {t('Market Share')}
        </Heading>
        <p className='text-muted-foreground mt-1 text-sm'>
          {t(PERIOD_DESCRIPTIONS[props.period])}
        </p>
      </header>

      <div className='px-5 pb-5'>
        <div className='h-60 sm:h-72'>
          {themeReady && spec ? (
            <VChart
              key={`vendor-share-${resolvedTheme}-${props.period}`}
              spec={{
                ...spec,
                theme: resolvedTheme === 'dark' ? 'dark' : 'light',
                background: 'transparent',
              }}
              option={VCHART_OPTION}
            />
          ) : (
            <div className='text-muted-foreground flex h-full items-center justify-center text-xs'>
              {t('No history data available')}
            </div>
          )}
        </div>
      </div>

      {/* Vendor list block ----------------------------------------------- */}
      <div className='border-t'>
        <header className='px-5 pt-4 pb-2'>
          <h3 className='text-foreground text-lg font-semibold'>
            {t('By model author')}
          </h3>
          {/* 与上方「LLM 排行」说明同档：14/400，不用 12px caption。 */}
          <p className='text-muted-foreground mt-1 text-sm'>
            {t('Vendors ranked by aggregated token volume')}
          </p>
        </header>
        {visible.length === 0 ? (
          <div className='text-muted-foreground px-5 py-8 text-center text-sm'>
            {t('No vendor data available')}
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-x-8 px-5 pt-1 pb-4 md:grid-cols-2'>
            <VendorList rows={left} colourMap={colourMap} />
            {right.length > 0 && (
              <VendorList rows={right} colourMap={colourMap} />
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function VendorList(props: {
  rows: VendorRanking[]
  colourMap: Record<string, string>
}) {
  return (
    <ul>
      {props.rows.map((vendor) => (
        <li key={vendor.vendor} className='flex items-center gap-3 py-2.5'>
          <span className='text-muted-foreground w-6 shrink-0 text-right text-xs tabular-nums'>
            {vendor.rank}.
          </span>
          <span
            aria-hidden
            className='size-2.5 shrink-0 rounded-full'
            style={{
              backgroundColor:
                props.colourMap[vendor.vendor] ?? VENDOR_BRAND_COLORS.Others,
            }}
          />
          <VendorLink
            vendor={vendor.vendor}
            className='text-foreground min-w-0 flex-1 truncate text-sm font-medium'
          >
            {vendor.vendor}
          </VendorLink>
          <div className='shrink-0 text-right'>
            <div className='text-foreground text-sm font-semibold tabular-nums'>
              {formatTokens(vendor.total_tokens)}
            </div>
            <div className='text-muted-foreground text-xs tabular-nums'>
              {formatShare(vendor.share)}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
