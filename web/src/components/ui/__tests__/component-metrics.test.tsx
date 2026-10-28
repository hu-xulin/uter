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
import { describe, expect, test } from 'vitest'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { Dialog as DialogRoot, DialogContent, DialogFooter } from '../dialog'

/**
 * 规范 §2.1 组件表的度量不变量。字号/圆角/投影已有
 * `scripts/check-design-tokens.mjs`（T1–T7）把守，但**尺寸与内边距没有
 * 任何自动化约束**——本次按规范校正的 7 项就是长期漂移的结果
 * （Badge 20px vs 规范 24px、Card 16px vs 24px、Tabs 容器 32px vs 40px、
 * Button 两档内边距都不对、Dialog 384px vs 420px）。
 *
 * 这些断言故意写成「类名包含规范值」而不是精确相等：调用方的 className
 * 覆盖是合法用法，不能被测试拦死。
 */

function classes(el: Element | null): string[] {
  return (el?.className ?? '').split(/\s+/).filter(Boolean)
}

function has(el: Element | null, token: string): boolean {
  return classes(el).includes(token)
}

describe('规范 §2.1 组件度量', () => {
  test('Badge：高 24px、内边距 12×4px、胶囊 r-full', () => {
    const { container } = render(<Badge>运行中</Badge>)
    const badge = container.querySelector('[data-slot="badge"]')

    expect(has(badge, 'h-6')).toBe(true)
    // 12×4 来自 §1.3 间距表（sp-2-5 / sp-0-5），不是 §2.1 原先写的 10×2：
    // caption 行高 16 + 上下各 4 = 24，正好等于徽标高度，表里的值才自洽。
    expect(has(badge, 'px-3')).toBe(true)
    expect(has(badge, 'py-1')).toBe(true)
    expect(has(badge, 'px-2.5')).toBe(false)
    expect(has(badge, 'py-0.5')).toBe(false)
    // 胶囊形态不能依赖「半径 ≈ 高度」的巧合（原 rounded-4xl 在 20px 高时
    // 恰好也是胶囊，高度一改就露馅）。
    expect(has(badge, 'rounded-full')).toBe(true)
    expect(has(badge, 'rounded-4xl')).toBe(false)
    // 字号 caption 12px
    expect(has(badge, 'text-xs')).toBe(true)
  })

  test('Card：内边距走 --ds-card-padding，不写死 16px', () => {
    const { container } = render(
      <Card>
        <CardHeader>标题</CardHeader>
        <CardContent>内容</CardContent>
        <CardFooter>操作</CardFooter>
      </Card>
    )

    const card = container.querySelector('[data-slot="card"]')
    const header = container.querySelector('[data-slot="card-header"]')
    const content = container.querySelector('[data-slot="card-content"]')
    const footer = container.querySelector('[data-slot="card-footer"]')

    for (const el of [card, header, content, footer]) {
      const cls = (el as HTMLElement).className
      expect(cls).toContain('--ds-card-padding')
      // 不得回退到写死的 16px 档
      expect(cls).not.toMatch(/(^|\s)(p|px|py)-4(\s|$)/)
    }
  })

  test('Tabs：容器 40px、内边距 4px、触发器 12×6px、容器 secondary 底', () => {
    const { container } = render(
      <Tabs defaultValue='a'>
        <TabsList>
          <TabsTrigger value='a'>标准</TabsTrigger>
          <TabsTrigger value='b'>充值</TabsTrigger>
        </TabsList>
      </Tabs>
    )

    const list = container.querySelector('[data-slot="tabs-list"]')
    const trigger = container.querySelector('[data-slot="tabs-trigger"]')

    expect(has(list, 'group-data-horizontal/tabs:h-10')).toBe(true)
    expect(has(list, 'p-1')).toBe(true)
    // 规范：容器 Surface/secondary；激活触发器才是 background。
    // 提交 875581015 曾把容器改成 bg-background，与规范相反。
    expect(has(list, 'bg-secondary')).toBe(true)
    expect(has(list, 'bg-background')).toBe(false)

    expect(has(trigger, 'px-3')).toBe(true)
    expect(has(trigger, 'py-1.5')).toBe(true)
    expect(has(trigger, 'px-1.5')).toBe(false)
    expect(has(trigger, 'py-0.5')).toBe(false)
  })

  test('Tabs：触发器与容器同心，不吃 calc(100%-1px) 的偏差', () => {
    // 历史 bug：触发器用 `h-[calc(100%-1px)]` + 容器 `items-center`，
    // 在 grid 轨道里实测上间距 5.5px、下间距 1.5px —— 激活块明显偏下，
    // 就是「按钮上下不居中」。改成容器 `items-stretch` + 触发器 `h-full`
    // 后上下间距恒等于容器内边距。
    const { container } = render(
      <Tabs defaultValue='a'>
        <TabsList>
          <TabsTrigger value='a'>标准</TabsTrigger>
          <TabsTrigger value='b'>充值</TabsTrigger>
        </TabsList>
      </Tabs>
    )

    const list = container.querySelector('[data-slot="tabs-list"]')
    const trigger = container.querySelector('[data-slot="tabs-trigger"]')

    expect(has(list, 'items-stretch')).toBe(true)
    expect(has(list, 'items-center')).toBe(false)
    expect(has(trigger, 'h-full')).toBe(true)
    expect(has(trigger, 'min-h-0')).toBe(true)
    expect(has(trigger, 'h-[calc(100%-1px)]')).toBe(false)
  })

  test('Button：md 内边距 12px/图文 4px，sm 内边距 8px/图文 0', () => {
    const { container: md } = render(<Button>主操作</Button>)
    const mdBtn = md.querySelector('[data-slot="button"]')
    expect(has(mdBtn, 'px-3')).toBe(true)
    expect(has(mdBtn, 'gap-1')).toBe(true)
    expect(has(mdBtn, 'px-2.5')).toBe(false)

    const { container: sm } = render(<Button size='sm'>次操作</Button>)
    const smBtn = sm.querySelector('[data-slot="button"]')
    expect(has(smBtn, 'px-2')).toBe(true)
    expect(has(smBtn, 'gap-0')).toBe(true)
    expect(has(smBtn, 'px-2.5')).toBe(false)
  })

  test('Dialog：宽 420px、左右 24px、上 24px、下 32px，footer 负边距成对', () => {
    render(
      <DialogRoot open>
        <DialogContent>
          <p>内容</p>
        </DialogContent>
      </DialogRoot>
    )
    const popup = screen.getByRole('dialog')

    expect(has(popup, 'sm:max-w-[26.25rem]')).toBe(true) // 420px
    expect(has(popup, 'px-6')).toBe(true)
    expect(has(popup, 'pt-6')).toBe(true)
    expect(has(popup, 'pb-8')).toBe(true)
    expect(has(popup, 'sm:max-w-sm')).toBe(false)
  })

  test('Dialog footer：负边距与 popup 内边距成对，否则贴不到底边', () => {
    render(<DialogFooter>好</DialogFooter>)
    const footer = document.querySelector('[data-slot="dialog-footer"]')
    // -mx-6 / -mb-8 必须与 popup 的 px-6 / pb-8 对应
    expect(has(footer, '-mx-6')).toBe(true)
    expect(has(footer, '-mb-8')).toBe(true)
    expect(has(footer, '-mx-4')).toBe(false)
    expect(has(footer, '-mb-4')).toBe(false)
  })
})
