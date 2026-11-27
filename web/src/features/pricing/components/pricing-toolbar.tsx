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
import { ArrowDown, ArrowUp, ArrowUpDown, Filter } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTableViewModeToggle } from '@/components/data-table'
import {
  sideDrawerContentClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

import { SORT_OPTIONS, type ViewMode } from '../constants'
import type {
  PricingChannel,
  PricingFacetModels,
  PricingModel,
  PricingVendor,
  TokenUnit,
} from '../types'
import { PricingSidebar } from './pricing-sidebar'

// 选中态配色对齐「卡片/表格视图」切换按钮（Button variant='default' = bg-primary）。
// 标准/充值、/1M//1K 这两个 outline 分段控件原本选中为 aria-pressed:bg-muted，这里统一改成品牌主色。
// 注意：Base UI 的 Toggle 实际输出 aria-pressed / data-pressed，并非 data-state=on（后者在本项目是死选择器，写它不生效）。
const primarySelectedToggleClass =
  'aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:shadow-none aria-pressed:hover:bg-primary-hover aria-pressed:hover:text-primary-foreground'

// 行高一致：同一行里的按钮、分段控件、视图切换必须等高。
//
// Toggle 的尺寸档是写死的 h-7（28px），而这一行其余控件都是 Button sm
// （--ds-button-height-sm，默认密度 32px）和 h-8 的视图切换 —— 分段控件因此比
// 邻居矮 4px，一行里出现三种高度。这里不用 `size='default'`（h-8 同样是写死
// 值，密度切换时会再次错位），而是直接钉到按钮的高度 Token 上，三种控件跟随
// 同一档密度。
const toolbarSegmentClass = 'h-(--ds-button-height-sm)'

type SortDirectionButtonProps = {
  /** 可见文案（随界面语言）。 */
  label: string
  /** 无障碍名用固定英文「维度 + 方向」，不随语言变化，便于稳定定位。 */
  ariaLabel: string
  active: boolean
  ascending: boolean
  onClick: () => void
}

/**
 * 排序维度按钮：文案固定为维度名，箭头随当前方向切换
 * （升序 ArrowUp、降序 ArrowDown，未选中该维度时显示双向 ArrowUpDown）。
 */
function SortDirectionButton(props: SortDirectionButtonProps) {
  let Icon = ArrowUpDown
  if (props.active) {
    Icon = props.ascending ? ArrowUp : ArrowDown
  }
  return (
    <Button
      type='button'
      variant='outline'
      size='sm'
      aria-label={props.ariaLabel}
      aria-pressed={props.active}
      onClick={props.onClick}
      className={cn(
        'gap-1.5 px-3 text-sm',
        toolbarSegmentClass,
        props.active && primarySelectedToggleClass
      )}
    >
      <Icon className='size-4.5' />
      <span>{props.label}</span>
    </Button>
  )
}

export interface PricingToolbarProps {
  filteredCount: number
  totalCount?: number
  sortBy: string
  onSortChange: (value: string) => void
  tokenUnit: TokenUnit
  onTokenUnitChange: (value: TokenUnit) => void
  showRechargePrice: boolean
  onRechargePriceChange: (value: boolean) => void
  viewMode: ViewMode
  onViewModeChange: (value: ViewMode) => void
  quotaTypeFilter: string
  endpointTypeFilter: string
  vendorFilter: string
  channelFilter: string
  tagFilter: string
  onQuotaTypeChange: (value: string) => void
  onEndpointTypeChange: (value: string) => void
  onVendorChange: (value: string) => void
  onChannelChange: (value: string) => void
  onTagChange: (value: string) => void
  vendors: PricingVendor[]
  channels: string[]
  channelTypes?: Record<string, number>
  channelBrandings?: Record<string, PricingChannel>
  models: PricingModel[]
  facetModels: PricingFacetModels
  hasActiveFilters: boolean
  activeFilterCount: number
  onClearFilters: () => void
}

export function PricingToolbar(props: PricingToolbarProps) {
  const { t } = useTranslation()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  return (
    <div className='bg-card rounded-lg border p-3'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => setMobileFiltersOpen(true)}
            className='gap-1.5 xl:hidden'
          >
            <Filter className='size-4.5' />
            {t('Filter')}
            {props.activeFilterCount > 0 && (
              <Badge className='ml-0.5 size-5 justify-center p-0 text-xs'>
                {props.activeFilterCount}
              </Badge>
            )}
          </Button>

          <div className='text-muted-foreground flex items-baseline gap-1 text-sm'>
            <span className='text-foreground font-semibold tabular-nums'>
              {props.filteredCount.toLocaleString()}
            </span>
            <span>{props.filteredCount === 1 ? t('model') : t('models')}</span>
            {props.totalCount != null &&
              props.filteredCount !== props.totalCount && (
                <span className='text-muted-foreground text-sm'>
                  / {props.totalCount.toLocaleString()}
                </span>
              )}
          </div>
        </div>

        <div className='flex min-w-0 flex-wrap items-center gap-2'>
          <ToggleGroup
            value={[props.showRechargePrice ? 'recharge' : 'standard']}
            onValueChange={(values) => {
              if (values.length > 0) {
                props.onRechargePriceChange(values[0] === 'recharge')
              }
            }}
            variant='outline'
            size='sm'
            aria-label={t('Price display mode')}
          >
            <ToggleGroupItem
              value='standard'
              className={cn(primarySelectedToggleClass, toolbarSegmentClass)}
            >
              {t('Standard')}
            </ToggleGroupItem>
            <ToggleGroupItem
              value='recharge'
              className={cn(primarySelectedToggleClass, toolbarSegmentClass)}
            >
              {t('Recharge')}
            </ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup
            value={[props.tokenUnit]}
            onValueChange={(values) => {
              if (values[0] === 'M' || values[0] === 'K') {
                props.onTokenUnitChange(values[0])
              }
            }}
            variant='outline'
            size='sm'
            aria-label={t('Token unit')}
          >
            <ToggleGroupItem
              value='M'
              className={cn(primarySelectedToggleClass, toolbarSegmentClass)}
            >
              /1M
            </ToggleGroupItem>
            <ToggleGroupItem
              value='K'
              className={cn(primarySelectedToggleClass, toolbarSegmentClass)}
            >
              /1K
            </ToggleGroupItem>
          </ToggleGroup>

          <SortDirectionButton
            label={t('Price discount')}
            ariaLabel={
              props.sortBy === SORT_OPTIONS.DISCOUNT_HIGH_TO_LOW
                ? 'Discount High to Low'
                : 'Discount Low to High'
            }
            active={
              props.sortBy === SORT_OPTIONS.DISCOUNT_LOW_TO_HIGH ||
              props.sortBy === SORT_OPTIONS.DISCOUNT_HIGH_TO_LOW
            }
            ascending={props.sortBy !== SORT_OPTIONS.DISCOUNT_HIGH_TO_LOW}
            onClick={() =>
              props.onSortChange(
                props.sortBy === SORT_OPTIONS.DISCOUNT_LOW_TO_HIGH
                  ? SORT_OPTIONS.DISCOUNT_HIGH_TO_LOW
                  : SORT_OPTIONS.DISCOUNT_LOW_TO_HIGH
              )
            }
          />
          <SortDirectionButton
            label={t('Time')}
            ariaLabel={
              props.sortBy === SORT_OPTIONS.TIME_OLDEST_TO_NEWEST
                ? 'Time Oldest to Newest'
                : 'Time Newest to Oldest'
            }
            active={
              props.sortBy === SORT_OPTIONS.TIME_NEWEST_TO_OLDEST ||
              props.sortBy === SORT_OPTIONS.TIME_OLDEST_TO_NEWEST
            }
            ascending={props.sortBy !== SORT_OPTIONS.TIME_OLDEST_TO_NEWEST}
            onClick={() =>
              props.onSortChange(
                props.sortBy === SORT_OPTIONS.TIME_NEWEST_TO_OLDEST
                  ? SORT_OPTIONS.TIME_OLDEST_TO_NEWEST
                  : SORT_OPTIONS.TIME_NEWEST_TO_OLDEST
              )
            }
          />

          <SortDirectionButton
            label={t('Name')}
            ariaLabel={
              props.sortBy === SORT_OPTIONS.NAME_DESC
                ? 'Name Z to A'
                : 'Name A to Z'
            }
            active={
              props.sortBy === SORT_OPTIONS.NAME ||
              props.sortBy === SORT_OPTIONS.NAME_DESC
            }
            ascending={props.sortBy !== SORT_OPTIONS.NAME_DESC}
            onClick={() =>
              props.onSortChange(
                props.sortBy === SORT_OPTIONS.NAME
                  ? SORT_OPTIONS.NAME_DESC
                  : SORT_OPTIONS.NAME
              )
            }
          />
          <SortDirectionButton
            label={t('Sort price')}
            ariaLabel={
              props.sortBy === SORT_OPTIONS.INPUT_PRICE_HIGH
                ? 'Input Price High to Low'
                : 'Input Price Low to High'
            }
            active={
              props.sortBy === SORT_OPTIONS.INPUT_PRICE_LOW ||
              props.sortBy === SORT_OPTIONS.INPUT_PRICE_HIGH
            }
            ascending={props.sortBy !== SORT_OPTIONS.INPUT_PRICE_HIGH}
            onClick={() =>
              props.onSortChange(
                props.sortBy === SORT_OPTIONS.INPUT_PRICE_LOW
                  ? SORT_OPTIONS.INPUT_PRICE_HIGH
                  : SORT_OPTIONS.INPUT_PRICE_LOW
              )
            }
          />

          <DataTableViewModeToggle
            value={props.viewMode}
            onChange={props.onViewModeChange}
            className='h-(--ds-button-height-sm)'
          />
        </div>
      </div>

      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent
          side='left'
          className={sideDrawerContentClassName('sm:max-w-md')}
        >
          <SheetHeader className={sideDrawerHeaderClassName()}>
            <SheetTitle>{t('Filter')}</SheetTitle>
            <SheetDescription>
              {t('Filter models by channel, vendor, type, endpoint, and tags.')}
            </SheetDescription>
          </SheetHeader>
          <div className={sideDrawerFormClassName('gap-0')}>
            <PricingSidebar
              quotaTypeFilter={props.quotaTypeFilter}
              endpointTypeFilter={props.endpointTypeFilter}
              vendorFilter={props.vendorFilter}
              channelFilter={props.channelFilter}
              tagFilter={props.tagFilter}
              onQuotaTypeChange={props.onQuotaTypeChange}
              onEndpointTypeChange={props.onEndpointTypeChange}
              onVendorChange={props.onVendorChange}
              onChannelChange={props.onChannelChange}
              onTagChange={props.onTagChange}
              vendors={props.vendors}
              channels={props.channels}
              channelTypes={props.channelTypes ?? {}}
              channelBrandings={props.channelBrandings ?? {}}
              models={props.models}
              facetModels={props.facetModels}
              hasActiveFilters={props.hasActiveFilters}
              onClearFilters={props.onClearFilters}
              className='border-0 bg-transparent p-0 shadow-none'
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
