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
import { ChevronDown, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Heading } from '@/design-system'
import { getLobeIcon, monoIconName } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import {
  ENDPOINT_TYPES,
  FILTER_ALL,
  QUOTA_TYPES,
  getEndpointTypeLabels,
  getQuotaTypeLabels,
} from '../constants'
import { hasTaskUsageSchema } from '../lib/dynamic-price'
import { parseTags } from '../lib/filters'
import {
  formatGroupRatio,
  groupRatioBadgeClass,
  hasGroupRatioBadge,
} from '../lib/group-ratio'
import { orderVendorsByModelCount } from '../lib/vendor-order'
import type { PricingModel, PricingVendor } from '../types'

type FilterOption = {
  value: string
  label: string
  count?: number
  suffix?: string
  /** 分组倍率（仅分组筛选带）：<1 才是真折扣，=1 是标准价。 */
  suffixRatio?: number
  icon?: ReactNode
}

type FilterSectionProps = {
  title: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
}

type FilterChipProps = {
  option: FilterOption
  active: boolean
  onClick: () => void
}

export interface PricingSidebarProps {
  quotaTypeFilter: string
  endpointTypeFilter: string
  vendorFilter: string
  groupFilter: string
  tagFilter: string
  onQuotaTypeChange: (value: string) => void
  onEndpointTypeChange: (value: string) => void
  onVendorChange: (value: string) => void
  onGroupChange: (value: string) => void
  onTagChange: (value: string) => void
  vendors: PricingVendor[]
  groups: string[]
  groupRatios?: Record<string, number>
  tags: string[]
  models: PricingModel[]
  hasActiveFilters: boolean
  onClearFilters: () => void
  className?: string
}

function countBy(
  models: PricingModel[],
  predicate: (model: PricingModel) => boolean
): number {
  return models.reduce((count, model) => count + (predicate(model) ? 1 : 0), 0)
}

function FilterChip(props: FilterChipProps) {
  let badgeClass = 'bg-muted text-muted-foreground'
  if (props.option.suffix) {
    badgeClass = groupRatioBadgeClass(props.option.suffixRatio)
  } else if (props.active) {
    // 选中态是品牌主色底，徽标跟着转白字，整块读起来才是一体的。
    // 底色用 `primary-active` 而不是 20% 白蒙版：白字压在半透明白底上
    // 只有约 3.3:1，12px 文字不达 AA；压在主色加深档上是 7.9:1。
    badgeClass = 'bg-primary-active text-primary-foreground'
  }
  return (
    <Button
      type='button'
      variant='outline'
      size='sm'
      onClick={props.onClick}
      aria-pressed={props.active}
      className={cn(
        // 固定 32px 高：分组里「所有分组」没有倍数徽标，此前比带徽标的邻居
        // 矮一截，同一列 chip 高度参差。定高后所有 chip 高度完全一致。
        'h-8 max-w-full gap-1.5 px-2 text-sm',
        // 一行一个，宽度占行宽的 2/3：长名（「SiliconFlow 硅基流动」）不再
        // 被两列布局挤成省略号，右侧留出的 1/3 是固定的呼吸位，不用铺满整行。
        'w-2/3 justify-start',
        // 选中态与工具栏的「标准/充值」分段控件同一套规则：品牌主色底 + 白字。
        // Base UI 的 Button 输出 aria-pressed（不是 data-state），故用 aria-pressed 变体。
        props.active &&
          'aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:shadow-none aria-pressed:hover:bg-primary-hover aria-pressed:hover:text-primary-foreground'
      )}
      title={props.option.label}
    >
      {props.option.icon && (
        <span className='shrink-0'>{props.option.icon}</span>
      )}
      <span className='truncate'>{props.option.label}</span>
      {(props.option.suffix || props.option.count != null) && (
        <span
          className={cn(
            'shrink-0 rounded-md px-1.5 py-0.5 text-sm',
            // 计数贴到 chip 右端，与左对齐的名称拉开距离。
            'ml-auto',
            badgeClass
          )}
        >
          {props.option.suffix ?? props.option.count}
        </span>
      )}
    </Button>
  )
}

function FilterSection(props: FilterSectionProps) {
  return (
    <Collapsible
      defaultOpen
      className='border-border/70 border-b pb-3 last:border-b-0'
    >
      {/* 折叠组标题是卡片**内部**的分组标题：group-title 16/600/24。
          此前是 14/600（text-sm font-semibold），属于规范硬规则 2 明令
          禁止的「用 text-sm font-semibold 做分组标题」。

          结构是 ARIA accordion 的标准写法：标题元素包住触发器，而不是
          在 `<button>` 里塞一个 `<span>` 假装标题 —— button 的内容模型
          只允许 phrasing content，塞不进 h4。 */}
      <Heading variant='group-title' level={4}>
        <CollapsibleTrigger className='group flex w-full items-center justify-between py-2.5 text-left'>
          <span>{props.title}</span>
          <ChevronDown className='text-muted-foreground size-4 transition-transform group-data-[panel-open]:rotate-180' />
        </CollapsibleTrigger>
      </Heading>
      <CollapsibleContent>
        {/* 一行一个：所有筛选按钮纵向排列，宽度由 FilterChip 固定为行宽的
            2/3。此前「分组」「供应商」两列定宽、「标签」按内容瀑布流，同一张
            侧栏里三种排法，长名还被挤成省略号。 */}
        <div className='flex flex-col items-start gap-1.5'>
          {props.options.map((option) => (
            <FilterChip
              key={option.value}
              option={option}
              active={props.value === option.value}
              onClick={() => props.onChange(option.value)}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function PricingSidebar(props: PricingSidebarProps) {
  const { t } = useTranslation()
  const quotaTypeLabels = getQuotaTypeLabels(t)
  const endpointTypeLabels = getEndpointTypeLabels(t)

  // Vendors are ordered by how many models they publish (most models first),
  // so the largest providers surface at the top. Equal counts fall back to
  // name order to keep the list deterministic. "All Vendors" stays pinned
  // first because it resets the filter.
  const orderedVendors = orderVendorsByModelCount(props.models, props.vendors)

  // 「所有…」chip 的徽标统一表示**该分区里可选项的数量**，不是模型总数。
  // 此前五个分区（分组/供应商/标签/计费类型/端点类型）的「所有…」都显示模型
  // 总数：同一串数字重复 5 遍，既看不出这一分区有多少个可选项，也和旁边
  // 展示模型数的具体项混在一起。现在各分区各说各的：分组数、供应商数、
  // 标签数、计费类型数、端点类型数。
  const vendorOptions: FilterOption[] = [
    {
      value: FILTER_ALL,
      label: t('All Vendors'),
      // 与下方列出的具体供应商数量一致（列表已剔除 0 模型的供应商）。
      count: orderedVendors.length,
    },
    ...orderedVendors.map((vendor) => ({
      value: vendor.name,
      label: vendor.name,
      count: vendor.count,
      // Vendor chips stay monochrome so the colored model cards keep the
      // visual weight; any stored ".Color" key is stripped here.
      icon: vendor.icon
        ? getLobeIcon(monoIconName(vendor.icon), 14)
        : undefined,
    })),
  ]

  // 「所有分组」统计的是**分组数量**（如 VIP0-VIP5 共 6 个），具体分组仍只带
  // 倍率徽标（x1.0、x0.9）：两者语义不同，不合并。
  const groupOptions: FilterOption[] = [
    {
      value: FILTER_ALL,
      label: t('All Groups'),
      count: props.groups.length,
    },
    ...props.groups.map((group) => {
      const ratio = props.groupRatios?.[group]
      return {
        value: group,
        label: group,
        // 倍率为 0 = 该档未配置计价，渲染成 x0.0 会被误读成「免费」，直接不显示徽标。
        suffix: hasGroupRatioBadge(ratio) ? formatGroupRatio(ratio) : undefined,
        suffixRatio: ratio,
      }
    }),
  ]

  const quotaTypeOptions: FilterOption[] = [
    {
      value: QUOTA_TYPES.TOKEN,
      label: quotaTypeLabels[QUOTA_TYPES.TOKEN],
      count: countBy(
        props.models,
        (model) => model.quota_type === 0 && !hasTaskUsageSchema(model)
      ),
    },
    {
      value: QUOTA_TYPES.REQUEST,
      label: quotaTypeLabels[QUOTA_TYPES.REQUEST],
      count: countBy(
        props.models,
        (model) => model.quota_type === 1 && !hasTaskUsageSchema(model)
      ),
    },
    {
      value: QUOTA_TYPES.TASK,
      label: quotaTypeLabels[QUOTA_TYPES.TASK],
      count: countBy(props.models, (model) => hasTaskUsageSchema(model)),
    },
  ]

  const quotaOptions: FilterOption[] = [
    {
      value: QUOTA_TYPES.ALL,
      label: quotaTypeLabels[QUOTA_TYPES.ALL],
      count: quotaTypeOptions.length,
    },
    ...quotaTypeOptions,
  ]

  const tagOptions: FilterOption[] = [
    {
      value: FILTER_ALL,
      label: t('All Tags'),
      count: props.tags.length,
    },
    ...props.tags.map((tag) => ({
      value: tag,
      label: tag,
      count: countBy(props.models, (model) =>
        parseTags(model.tags)
          .map((item) => item.toLowerCase())
          .includes(tag.toLowerCase())
      ),
    })),
  ]

  const endpointTypeOptions: FilterOption[] = Object.entries(endpointTypeLabels)
    .filter(([value]) => value !== ENDPOINT_TYPES.ALL)
    .map(([value, label]) => ({
      value,
      label,
      count: countBy(
        props.models,
        (model) => model.supported_endpoint_types?.includes(value) ?? false
      ),
    }))

  const endpointOptions: FilterOption[] = [
    {
      value: ENDPOINT_TYPES.ALL,
      label: endpointTypeLabels[ENDPOINT_TYPES.ALL],
      count: endpointTypeOptions.length,
    },
    ...endpointTypeOptions,
  ]

  return (
    <aside className={cn('bg-card rounded-xl border p-3', props.className)}>
      <div className='mb-2.5 flex items-center justify-between gap-2'>
        <div>
          {/* 侧栏是一张卡片，所以「筛选」是**卡片标题**（h3 18/600/28），
              不是卡片内的分组标题。此前写成 16/600，既不是 18 的卡片标题，
              也不是 16 的分组标题档位对应位置（它在卡片头部，不在卡片内部再分组）。
              下面 FilterSection 的「分组」「供应商」才是 group-title 16/600。 */}
          <Heading variant='card-title' level={2}>
            {t('Filter')}
          </Heading>
          <p className='text-muted-foreground mt-1 text-sm'>
            {t('Refine models by provider, group, type, and tags.')}
          </p>
        </div>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={props.onClearFilters}
          disabled={!props.hasActiveFilters}
          className='gap-1.5 px-2 text-sm'
        >
          <RotateCcw className='size-4.5' />
          {t('Reset')}
        </Button>
      </div>

      {props.hasActiveFilters && (
        <Badge variant='secondary' className='mb-3'>
          {t('Filters active')}
        </Badge>
      )}

      <div className='space-y-1'>
        <FilterSection
          title={t('Groups')}
          value={props.groupFilter}
          options={groupOptions}
          onChange={props.onGroupChange}
        />
        <FilterSection
          title={t('All Vendors')}
          value={props.vendorFilter}
          options={vendorOptions}
          onChange={props.onVendorChange}
        />
        <FilterSection
          title={t('Model Tags')}
          value={props.tagFilter}
          options={tagOptions}
          onChange={props.onTagChange}
        />
        <FilterSection
          title={t('Pricing Type')}
          value={props.quotaTypeFilter}
          options={quotaOptions}
          onChange={props.onQuotaTypeChange}
        />
        <FilterSection
          title={t('Endpoint Type')}
          value={props.endpointTypeFilter}
          options={endpointOptions}
          onChange={props.onEndpointTypeChange}
        />
      </div>
    </aside>
  )
}
