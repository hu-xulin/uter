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
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PricingSidebar } from '../components/pricing-sidebar'
import {
  PricingToolbar,
  type PricingToolbarProps,
} from '../components/pricing-toolbar'
import type { PricingModel } from '../types'

function toolbarProps(): PricingToolbarProps {
  return {
    filteredCount: 2,
    totalCount: 2,
    sortBy: 'name',
    tokenUnit: 'M',
    showRechargePrice: false,
    viewMode: 'card',
    quotaTypeFilter: 'all',
    endpointTypeFilter: 'all',
    vendorFilter: 'all',
    groupFilter: 'all',
    tagFilter: 'all',
    onSortChange: vi.fn(),
    onTokenUnitChange: vi.fn(),
    onRechargePriceChange: vi.fn(),
    onViewModeChange: vi.fn(),
    onQuotaTypeChange: vi.fn(),
    onEndpointTypeChange: vi.fn(),
    onVendorChange: vi.fn(),
    onGroupChange: vi.fn(),
    onTagChange: vi.fn(),
    vendors: [],
    groups: ['default', 'premium'],
    groupRatios: { default: 1, premium: 3 },
    tags: [],
    models: [],
    hasActiveFilters: false,
    activeFilterCount: 0,
    onClearFilters: vi.fn(),
  }
}

describe('pricing controls', () => {
  it('counts each model once per filter and updates counts when the catalog changes', () => {
    const props = toolbarProps()
    const base: PricingModel = {
      id: 1,
      model_name: 'text-model',
      vendor_name: 'Vendor A',
      quota_type: 0,
      model_ratio: 1,
      completion_ratio: 1,
      enable_groups: ['default'],
      tags: 'Chat,chat',
      supported_endpoint_types: ['openai', 'openai'],
    }
    const models: PricingModel[] = [
      base,
      {
        ...base,
        id: 2,
        model_name: 'image-model',
        quota_type: 1,
        tags: 'chat,Image',
        supported_endpoint_types: ['image-generation'],
      },
      {
        ...base,
        id: 3,
        model_name: 'task-model',
        vendor_name: 'Vendor B',
        tags: 'Video',
        supported_endpoint_types: ['openai-video'],
        billing_usage_schema: { seconds: { type: 'number', unit: 'second' } },
      },
    ]
    const sidebarProps = {
      ...props,
      vendors: [
        { id: 1, name: 'Vendor A' },
        { id: 2, name: 'Vendor B' },
      ],
      tags: ['Chat', 'Image', 'Video'],
    }
    const { rerender } = render(
      <PricingSidebar {...sidebarProps} models={models} />
    )

    // 「所有供应商」统计的是**供应商数量**（2 个有模型的供应商），不是模型总数。
    expect(
      screen.getByRole('button', { name: /^All Vendors\s*2$/ })
    ).toBeVisible()
    expect(screen.getByRole('button', { name: /^Vendor A\s*2$/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /^Vendor B\s*1$/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /^Chat\s*2$/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /^Chat\s*1$/ })).toBeVisible()
    expect(
      screen.getByRole('button', { name: /^Token-based\s*1$/ })
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: /^Per Request\s*1$/ })
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: /^Task billing\s*1$/ })
    ).toBeVisible()

    rerender(<PricingSidebar {...sidebarProps} models={[models[1]]} />)
    // 供应商数量随目录变化：Vendor B 已无模型，被移出列表，剩 1 个。
    expect(
      screen.getByRole('button', { name: /^All Vendors\s*1$/ })
    ).toBeVisible()
    expect(screen.getByRole('button', { name: /^Vendor A\s*1$/ })).toBeVisible()
    expect(screen.queryByRole('button', { name: /^Vendor B\s*1$/ })).toBeNull()
    expect(screen.getByRole('button', { name: /^Chat\s*1$/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /^Chat\s*0$/ })).toBeVisible()
    expect(
      screen.getByRole('button', { name: /^Token-based\s*0$/ })
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: /^Task billing\s*0$/ })
    ).toBeVisible()
  })

  // 「所有…」chip 的徽标统一表示该分区的**可选项数量**（分组数、供应商数、
  // 标签数、计费类型数、端点类型数），不是模型总数。此前五个分区全都显示模型
  // 总数，同一串数字重复 5 遍，看不出这一分区有多少个可选项。
  it('counts the options of each section on its "All" chip', () => {
    cleanup()
    const props = toolbarProps()
    const base: PricingModel = {
      id: 1,
      model_name: 'text-model',
      vendor_name: 'Vendor A',
      quota_type: 0,
      model_ratio: 1,
      completion_ratio: 1,
      enable_groups: ['default'],
      tags: 'Chat',
      supported_endpoint_types: ['openai'],
    }
    render(
      <PricingSidebar
        {...props}
        groups={['default', 'premium', 'vip0', 'vip1', 'vip2', 'vip3']}
        vendors={[
          { id: 1, name: 'Vendor A' },
          { id: 2, name: 'Vendor B' },
        ]}
        tags={['Chat', 'Image', 'Video', 'Reasoning']}
        models={[
          base,
          { ...base, id: 2 },
          { ...base, id: 3, vendor_name: 'Vendor B' },
        ]}
      />
    )

    // 分组数
    expect(
      screen.getByRole('button', { name: /^All Groups\s*6$/ })
    ).toBeVisible()
    // 供应商数
    expect(
      screen.getByRole('button', { name: /^All Vendors\s*2$/ })
    ).toBeVisible()
    // 标签数
    expect(screen.getByRole('button', { name: /^All Tags\s*4$/ })).toBeVisible()
    // 计费类型数：按量 / 按次 / 任务计费共 3 种，标题也统一为「所有类型」。
    expect(
      screen.getByRole('button', { name: /^All Types\s*3$/ })
    ).toBeVisible()
    // 端点类型数
    expect(
      screen.getByRole('button', { name: /^All Types\s*8$/ })
    ).toBeVisible()
  })

  it('changes the token unit and keeps the selected unit pressed when clicked again', async () => {
    const props = toolbarProps()
    const user = userEvent.setup()
    const { rerender } = render(<PricingToolbar {...props} />)
    await user.click(screen.getByRole('button', { name: '/1K' }))
    expect(props.onTokenUnitChange).toHaveBeenCalledWith('K')
    rerender(<PricingToolbar {...props} tokenUnit='K' />)
    const selected = screen.getByRole('button', { name: '/1K' })
    expect(selected).toHaveAttribute('aria-pressed', 'true')
    await user.click(selected)
    expect(selected).toHaveAttribute('aria-pressed', 'true')
    expect(props.onTokenUnitChange).toHaveBeenCalledTimes(1)
  })

  it('changes the recharge display mode with an accessible selected state', async () => {
    const props = toolbarProps()
    const user = userEvent.setup()
    const { rerender } = render(<PricingToolbar {...props} />)
    await user.click(screen.getByRole('button', { name: 'Recharge' }))
    expect(props.onRechargePriceChange).toHaveBeenCalledWith(true)
    rerender(<PricingToolbar {...props} showRechargePrice />)
    expect(screen.getByRole('button', { name: 'Recharge' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: 'Standard' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('switches to table view with the keyboard and exposes the selected view', async () => {
    const props = toolbarProps()
    const user = userEvent.setup()
    const { rerender } = render(<PricingToolbar {...props} />)
    const tableButton = screen.getByRole('button', { name: 'Table view' })
    tableButton.focus()
    await user.keyboard('{Enter}')
    expect(props.onViewModeChange).toHaveBeenCalledWith('table')
    rerender(<PricingToolbar {...props} viewMode='table' />)
    expect(tableButton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Card view' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('selects price sorting from the shared dropdown', async () => {
    const props = toolbarProps()
    const user = userEvent.setup()
    render(<PricingToolbar {...props} />)
    await user.click(screen.getByRole('button', { name: 'Name' }))
    await user.click(
      screen.getByRole('menuitem', { name: 'Input Price: Low to High' })
    )
    expect(props.onSortChange).toHaveBeenCalledWith('input-price-low')
  })

  it('opens mobile filters from the left, selects a group, and restores focus on close', async () => {
    const props = toolbarProps()
    const user = userEvent.setup()
    const { rerender } = render(<PricingToolbar {...props} />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    const dialog = await screen.findByRole('dialog', { name: 'Filter' })
    expect(dialog).toHaveAttribute('data-side', 'left')
    expect(within(dialog).getByRole('button', { name: 'Reset' })).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: /premium/ }))
    expect(props.onGroupChange).toHaveBeenCalledWith('premium')
    rerender(
      <PricingToolbar
        {...props}
        groupFilter='premium'
        hasActiveFilters
        activeFilterCount={1}
      />
    )
    expect(
      within(dialog).getByRole('button', { name: /premium/ })
    ).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(dialog).getByRole('button', { name: 'Reset' }))
    expect(props.onClearFilters).toHaveBeenCalledOnce()
    await user.keyboard('{Escape}')
    expect(await screen.findByRole('button', { name: /Filter/ })).toHaveFocus()
  })

  // 侧栏筛选按钮统一「一行一个，宽度占行宽 2/3」：此前分组/供应商是两列
  // 定宽、标签是内容瀑布流，同一张侧栏三种排法，长名被挤成省略号。
  it('stacks every filter chip in a single column at two thirds width', () => {
    // 这份用例文件没有全局 afterEach，前一条用例的 DOM 还挂在 body 上，
    // 不清掉会撞名（同名「All Groups」按钮出现两次）。
    cleanup()
    const props = toolbarProps()
    const base: PricingModel = {
      id: 1,
      model_name: 'text-model',
      vendor_name: 'Vendor A',
      quota_type: 0,
      model_ratio: 1,
      completion_ratio: 1,
      enable_groups: ['default'],
      tags: 'Chat',
      supported_endpoint_types: ['openai'],
    }
    render(
      <PricingSidebar
        {...props}
        vendors={[{ id: 1, name: 'Vendor A' }]}
        tags={['Chat']}
        models={[base, { ...base, id: 2 }, { ...base, id: 3 }]}
      />
    )

    // 名称末尾带计数（如「All Vendors3」），锚定到结尾才能与同名的分区标题
    // 按钮（「All Vendors」折叠触发器）区分开。
    for (const allChip of [
      /^All Groups\d+$/,
      /^All Vendors\d+$/,
      /^All Tags\d+$/,
    ]) {
      const chip = screen.getByRole('button', { name: allChip })
      expect(chip).toHaveClass('w-2/3')
      // 单列容器：父级是 flex 列，不是 grid / flex-wrap。
      const container = chip.parentElement as HTMLElement
      expect(container).toHaveClass('flex', 'flex-col')
      expect(container.className).not.toContain('grid')
      // 同一分区里的每个按钮都是同样的 2/3 宽度。
      const siblings = within(container).getAllByRole('button')
      expect(siblings.length).toBeGreaterThan(1)
      for (const sibling of siblings) {
        expect(sibling).toHaveClass('w-2/3')
      }
    }

    // 「所有分组」的徽标是**分组数量**（props.groups.length），不是模型总数。
    expect(screen.getByRole('button', { name: /^All Groups2$/ })).toBeVisible()
  })

  // 工具栏一行里的按钮、分段控件、视图切换必须等高：分段控件原本是写死的
  // h-7（28px），比 32px 的按钮矮一截，一行里出现三种高度。
  it('keeps every control in the toolbar row on the same height token', () => {
    cleanup()
    render(<PricingToolbar {...toolbarProps()} />)

    for (const name of ['Standard', 'Recharge', '/1M', '/1K', 'Name']) {
      expect(screen.getByRole('button', { name })).toHaveClass(
        'h-(--ds-button-height-sm)'
      )
    }
    expect(screen.getByRole('group', { name: 'View mode' })).toHaveClass(
      'h-(--ds-button-height-sm)'
    )
  })
})
