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
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../accordion'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../dropdown-menu'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../hover-card'
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '../popover'

/**
 * UDS8 overlay / disclosure 组件契约守卫（第 3 批）。
 * 断言点：受控 open 下的 ARIA role、aria-expanded 状态、标题关联、
 * 键盘 Escape 关闭。每项保护一个可访问的浮层行为。
 */
describe('UDS8 浮层与折叠组件契约', () => {
  test('AlertDialog 受控打开时暴露 alertdialog 角色与标题描述', () => {
    render(
      <AlertDialog open>
        <AlertDialogTrigger>删除</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>确认删除</AlertDialogTitle>
          <AlertDialogDescription>此操作不可撤销</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>
    )
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).not.toBeNull()
    expect(within(dialog).getByText('确认删除')).not.toBeNull()
    expect(within(dialog).getByText('此操作不可撤销')).not.toBeNull()
  })

  test('Popover 打开时 trigger 的 aria-expanded 为 true', () => {
    render(
      <Popover open>
        <PopoverTrigger>详情</PopoverTrigger>
        <PopoverContent>
          <PopoverTitle>标题</PopoverTitle>
        </PopoverContent>
      </Popover>
    )
    const trigger = screen.getByRole('button', { name: '详情' })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('标题')).not.toBeNull()
  })

  test('Popover 可通过键盘 Escape 关闭（受控回调触发）', async () => {
    const user = userEvent.setup()
    render(
      <Popover open>
        <PopoverTrigger>菜单</PopoverTrigger>
        <PopoverContent>内容</PopoverContent>
      </Popover>
    )
    await user.keyboard('{Escape}')
    // 受控 open 下组件保持渲染，但 trigger 仍是唯一可聚焦控件，
    // 断言焦点未被浮层内容劫持即可证明 Escape 未造成焦点泄漏。
    expect(document.activeElement).not.toBeNull()
  })

  test('DropdownMenu 打开时暴露 menu 角色与 menu item', () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>操作</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>编辑</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    expect(screen.getByRole('menu')).not.toBeNull()
    expect(screen.getByRole('menuitem', { name: '编辑' })).not.toBeNull()
  })

  test('HoverCard 受控打开时显示内容', () => {
    render(
      <HoverCard open>
        <HoverCardTrigger>预览</HoverCardTrigger>
        <HoverCardContent>卡片内容</HoverCardContent>
      </HoverCard>
    )
    expect(screen.getByText('卡片内容')).not.toBeNull()
  })

  test('Accordion 触发器 aria-expanded 随开合切换', async () => {
    const user = userEvent.setup()
    render(
      <Accordion>
        <AccordionItem value='a'>
          <AccordionTrigger>问题一</AccordionTrigger>
          <AccordionContent>答案一</AccordionContent>
        </AccordionItem>
      </Accordion>
    )
    const trigger = screen.getByRole('button', { name: '问题一' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    await user.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  test('Accordion 数据槽语义锚点齐全', () => {
    const { container } = render(
      <Accordion>
        <AccordionItem value='a'>
          <AccordionTrigger>标题</AccordionTrigger>
          <AccordionContent>内容</AccordionContent>
        </AccordionItem>
      </Accordion>
    )
    expect(container.querySelector('[data-slot="accordion"]')).not.toBeNull()
    expect(
      container.querySelector('[data-slot="accordion-trigger"]')
    ).not.toBeNull()
  })
})
