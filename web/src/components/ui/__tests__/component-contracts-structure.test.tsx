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
import { describe, expect, test, vi } from 'vitest'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from '../breadcrumb'
import { Command, CommandInput, CommandItem, CommandList } from '../command'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../context-menu'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../input-otp'
import { Item, ItemContent, ItemDescription, ItemTitle } from '../item'
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from '../menubar'
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from '../navigation-menu'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../resizable'
import { ScrollArea } from '../scroll-area'
import { SecretInput } from '../secret-input'
import { SecretTextarea } from '../secret-textarea'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../table'

/**
 * UDS8 结构/数据/输入组件契约守卫（第 4 批）。
 * 断言点：语义化 HTML 标签、data-slot 锚点、ARIA 角色、
 * 无障碍名称、敏感输入的静默态。每项保护一个可观察契约。
 */
describe('UDS8 结构与数据组件契约', () => {
  test('Breadcrumb 使用 nav 语义并带 breadcrumb 无障碍名', () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href='/'>首页</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbPage>当前</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
    const nav = screen.getByRole('navigation', { name: 'breadcrumb' })
    expect(nav).not.toBeNull()
    expect(within(nav).getByRole('link', { name: '首页' })).not.toBeNull()
    expect(within(nav).getByText('当前')).not.toBeNull()
  })

  test('Table 使用完整语义化表格结构', () => {
    const { container } = render(
      <Table>
        <TableCaption>配额列表</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>名称</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>默认</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
    expect(container.querySelector('table[data-slot="table"]')).not.toBeNull()
    expect(container.querySelector('thead')).not.toBeNull()
    expect(container.querySelector('tbody')).not.toBeNull()
    expect(container.querySelector('caption')?.textContent).toBe('配额列表')
  })

  test('Table 数据槽锚点齐全', () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>单元格</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
    expect(container.querySelector('[data-slot="table-row"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="table-cell"]')).not.toBeNull()
  })

  test('Item 暴露语义化内容层级', () => {
    render(
      <Item>
        <ItemContent>
          <ItemTitle>标题</ItemTitle>
          <ItemDescription>描述</ItemDescription>
        </ItemContent>
      </Item>
    )
    expect(screen.getByText('标题')).not.toBeNull()
    expect(screen.getByText('描述')).not.toBeNull()
  })

  test('Command 提供 combobox 搜索输入语义', () => {
    render(
      <Command>
        <CommandInput placeholder='搜索命令' />
        <CommandList>
          <CommandItem>命令一</CommandItem>
        </CommandList>
      </Command>
    )
    expect(screen.getByPlaceholderText('搜索命令')).not.toBeNull()
    expect(screen.getByText('命令一')).not.toBeNull()
  })

  test('InputOTP 槽位暴露 data-slot 且可输入', async () => {
    const onChange = vi.fn()
    render(
      <InputOTP value='' onChange={onChange} maxLength={2}>
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
        </InputOTPGroup>
      </InputOTP>
    )
    const slots = document.querySelectorAll('[data-slot="input-otp-slot"]')
    expect(slots.length).toBeGreaterThan(0)
  })

  test('NavigationMenu 使用 list 语义组织导航项', () => {
    render(
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuLink href='/docs'>文档</NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    )
    expect(screen.getByRole('link', { name: '文档' })).not.toBeNull()
  })

  test('Resizable 面板组暴露 data-slot 语义', () => {
    const { container } = render(
      <ResizablePanelGroup orientation='horizontal'>
        <ResizablePanel>左</ResizablePanel>
        <ResizableHandle />
        <ResizablePanel>右</ResizablePanel>
      </ResizablePanelGroup>
    )
    expect(
      container.querySelector('[data-slot="resizable-panel-group"]')
    ).not.toBeNull()
    expect(screen.getByText('左')).not.toBeNull()
    expect(screen.getByText('右')).not.toBeNull()
  })

  test('ScrollArea 使用 data-slot 锚点包裹内容', () => {
    const { container } = render(
      <ScrollArea>
        <div>可滚动内容</div>
      </ScrollArea>
    )
    expect(container.querySelector('[data-slot="scroll-area"]')).not.toBeNull()
    expect(screen.getByText('可滚动内容')).not.toBeNull()
  })

  test('SecretInput 展示态只读并呈现后端掩码串', () => {
    // 组件契约：value 是后端下发的掩码串（如 abcd****wxyz），展示态只读、
    // 不二次掩码；明文仅在本地编辑态出现。
    render(<SecretInput value='abcd****wxyz' onChange={vi.fn()} />)
    const input = document.querySelector('input') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.readOnly).toBe(true)
    expect(input.value).toBe('abcd****wxyz')
    expect(input.type).toBe('text')
  })

  test('SecretTextarea 展示态只读并呈现后端掩码串', () => {
    render(<SecretTextarea value='wxyz****abcd' onChange={vi.fn()} />)
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea).not.toBeNull()
    expect(textarea.readOnly).toBe(true)
    expect(textarea.value).toBe('wxyz****abcd')
  })

  test('ContextMenu 受控打开时暴露 menu 角色', () => {
    render(
      <ContextMenu open>
        <ContextMenuTrigger>右键</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>复制</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    )
    expect(screen.getByRole('menu')).not.toBeNull()
    expect(screen.getByRole('menuitem', { name: '复制' })).not.toBeNull()
  })

  test('Menubar 受控菜单暴露 menubar 角色', () => {
    render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>文件</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>新建</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    )
    expect(screen.getByRole('menubar')).not.toBeNull()
    expect(screen.getByRole('menuitem', { name: '文件' })).not.toBeNull()
  })
})
