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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { enUS } from 'react-day-picker/locale'
import { describe, expect, it, vi } from 'vitest'

import { Calendar } from '../calendar'
import { ComboboxInput, type ComboboxInputOption } from '../combobox-input'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../empty'
import { TitledCard } from '../titled-card'

const OPTIONS: readonly ComboboxInputOption[] = [
  { value: 'alpha', label: 'Alpha provider' },
  { value: 'beta', label: 'Beta provider' },
]

function classes(el: Element | null): string[] {
  const raw = el?.className as string | { baseVal?: string } | undefined
  const value = typeof raw === 'string' ? raw : (raw?.baseVal ?? '')
  return value.split(/\s+/).filter(Boolean)
}

function has(el: Element | null, token: string): boolean {
  return classes(el).includes(token)
}

/**
 * UDS8 最后一批 PARTIAL 组件的契约守卫。
 * 断言点限定为规范可验证项：语义锚点、ARIA 角色与状态、键盘行为、
 * 既有 Token 类名。测试不修改组件源码，也不引入新的字号规则。
 */
describe('UDS8 Calendar 契约', () => {
  it('暴露 data-slot=calendar、导航按钮与默认内容宽度', () => {
    const { container } = render(
      <Calendar
        locale={enUS}
        defaultMonth={new Date(2026, 10, 1)}
        mode='single'
        onSelect={vi.fn()}
      />
    )

    const root = container.querySelector('[data-slot="calendar"]')
    expect(root).not.toBeNull()
    expect(has(root, 'group/calendar')).toBe(true)
    expect(has(root, 'w-fit')).toBe(true)
    expect(container.querySelectorAll('.rdp-nav button')).toHaveLength(2)
  })

  it('fullWidth 使用 w-full 而不是默认内容宽度', () => {
    const { container } = render(
      <Calendar
        locale={enUS}
        defaultMonth={new Date(2026, 10, 1)}
        mode='single'
        onSelect={vi.fn()}
        fullWidth
      />
    )

    const root = container.querySelector('[data-slot="calendar"]')
    expect(has(root, 'w-full')).toBe(true)
    expect(has(root, 'w-fit')).toBe(false)
  })

  it('选中态与禁用态通过 data 属性和原生 disabled 暴露', () => {
    const { container } = render(
      <Calendar
        locale={enUS}
        defaultMonth={new Date(2026, 10, 1)}
        mode='single'
        selected={new Date(2026, 10, 24)}
        onSelect={vi.fn()}
        disabled={{ before: new Date(2026, 10, 10) }}
      />
    )

    const selected = container.querySelector('[data-day="11/24/2026"]')
    expect(selected).not.toBeNull()
    expect(selected?.getAttribute('data-selected-single')).toBe('true')

    const disabled = container.querySelector('[data-day="11/9/2026"]')
    expect(disabled).not.toBeNull()
    expect(disabled).toBeDisabled()
  })
})

describe('UDS8 ComboboxInput 契约', () => {
  it('暴露 combobox/listbox/option 角色与受控选中语义', async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(
      <ComboboxInput
        options={OPTIONS}
        value=''
        onValueChange={onValueChange}
        placeholder='选择供应商'
        aria-label='供应商'
      />
    )

    const input = screen.getByRole('combobox', { name: '供应商' })
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(input).toHaveAttribute('aria-haspopup', 'listbox')
    expect(input).toHaveAttribute('aria-autocomplete', 'list')

    await user.click(input)
    expect(input).toHaveAttribute('aria-expanded', 'true')
    const list = screen.getByRole('listbox')
    expect(input).toHaveAttribute('aria-controls', list.id)

    const beta = screen.getByRole('option', { name: 'Beta provider' })
    expect(beta).toHaveAttribute('aria-selected', 'false')
    await user.click(beta)
    expect(onValueChange).toHaveBeenCalledWith('beta')
  })

  it('支持方向键高亮并用 Enter 提交，Escape 关闭浮层', async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(
      <ComboboxInput
        options={OPTIONS}
        value=''
        onValueChange={onValueChange}
        placeholder='选择供应商'
        aria-label='供应商'
      />
    )

    const input = screen.getByRole('combobox', { name: '供应商' })
    await user.tab()
    expect(input).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{ArrowDown}')
    const first = screen.getByRole('option', { name: 'Alpha provider' })
    expect(first).toHaveAttribute('data-highlighted', 'true')
    expect(input).toHaveAttribute('aria-activedescendant', first.id)

    await user.keyboard('{Enter}')
    expect(onValueChange).toHaveBeenCalledWith('alpha')
    expect(input).toHaveAttribute('aria-expanded', 'false')

    await user.click(input)
    await user.keyboard('{Escape}')
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('搜索仅保留匹配项，disabled 状态通过原生属性暴露', async () => {
    const user = userEvent.setup()
    const view = render(
      <ComboboxInput
        options={OPTIONS}
        value='alpha'
        onValueChange={vi.fn()}
        placeholder='选择供应商'
        aria-label='供应商'
      />
    )

    const input = screen.getByRole('combobox', { name: '供应商' })
    await user.click(input)
    await user.type(input, 'beta')
    expect(screen.queryByRole('option', { name: 'Alpha provider' })).toBeNull()
    expect(screen.getByRole('option', { name: 'Beta provider' })).toBeVisible()

    view.rerender(
      <ComboboxInput
        options={OPTIONS}
        value='alpha'
        onValueChange={vi.fn()}
        placeholder='选择供应商'
        aria-label='供应商'
        disabled
        aria-invalid='true'
      />
    )
    const disabledInput = screen.getByRole('combobox', { name: '供应商' })
    expect(disabledInput).toBeDisabled()
    expect(disabledInput).toHaveAttribute('aria-invalid', 'true')
    expect(disabledInput).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('UDS8 Empty 契约', () => {
  it('通过 data-slot 暴露空状态结构锚点与图标变体', () => {
    const { container } = render(
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <span>图标</span>
          </EmptyMedia>
          <EmptyTitle>暂无数据</EmptyTitle>
          <EmptyDescription>请稍后再试</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>内容区</EmptyContent>
      </Empty>
    )

    expect(container.querySelector('[data-slot="empty"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="empty-header"]')).not.toBeNull()
    expect(
      container.querySelector('[data-slot="empty-content"]')
    ).not.toBeNull()

    const media = container.querySelector('[data-slot="empty-icon"]')
    expect(media?.getAttribute('data-variant')).toBe('icon')
    expect(has(media, 'size-8')).toBe(true)

    const title = container.querySelector('[data-slot="empty-title"]')
    const description = container.querySelector(
      '[data-slot="empty-description"]'
    )
    expect(has(title, 'text-sm!')).toBe(true)
    expect(has(title, 'font-medium!')).toBe(true)
    expect(has(description, 'text-sm!')).toBe(true)
    expect(has(description, 'font-normal!')).toBe(true)
  })

  it('allowProps 透传原生 ARIA，可表达 loading/error 状态', () => {
    const view = render(
      <Empty role='status' aria-busy='true'>
        加载中
      </Empty>
    )
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')

    view.rerender(<Empty role='alert'>加载失败</Empty>)
    expect(screen.getByRole('alert')).toHaveTextContent('加载失败')
  })
})

describe('UDS8 TitledCard 契约', () => {
  it('组合 Card 锚点、标题、描述、内容区与操作区', () => {
    const { container } = render(
      <TitledCard
        title='标题'
        description='说明'
        icon={<span>图标</span>}
        action={<button type='button'>操作</button>}
      >
        内容
      </TitledCard>
    )

    const card = container.querySelector('[data-slot="card"]')
    expect(card).not.toBeNull()
    expect(card?.querySelector('[data-slot="card-header"]')).not.toBeNull()
    expect(card?.querySelector('[data-slot="card-title"]')).toHaveTextContent(
      '标题'
    )
    expect(
      card?.querySelector('[data-slot="card-description"]')
    ).toHaveTextContent('说明')
    expect(card?.querySelector('[data-slot="card-content"]')).toHaveTextContent(
      '内容'
    )
    expect(screen.getByRole('button', { name: '操作' })).toBeVisible()
    expect(screen.getByText('图标')).toBeVisible()
  })

  it('disableHoverEffect 通过 data-card-hover=false 暴露状态', () => {
    const { container } = render(
      <TitledCard title='标题' disableHoverEffect>
        内容
      </TitledCard>
    )

    const card = container.querySelector('[data-slot="card"]')
    expect(card?.getAttribute('data-card-hover')).toBe('false')
  })
})
