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

import { AspectRatio } from '../aspect-ratio'
import { DiscountBadge } from '../discount-badge'
import { IconBadge } from '../icon-badge'
import { Kbd, KbdGroup } from '../kbd'
import { Separator } from '../separator'
import { Skeleton } from '../skeleton'
import { Spinner } from '../spinner'

/** 取元素 class 列表，断言语义类名是否存在（调用方 className 覆盖仍合法）。 */
function classes(el: Element | null): string[] {
  // SVG 元素的 className 是 SVGAnimatedString，需取 baseVal
  const raw = el?.className as string | { baseVal?: string } | undefined
  const value = typeof raw === 'string' ? raw : (raw?.baseVal ?? '')
  return value.split(/\s+/).filter(Boolean)
}
function has(el: Element | null, token: string): boolean {
  return classes(el).includes(token)
}

/**
 * UDS8 展示/布局组件的稳定契约守卫（第 1 批）。
 * 断言点：data-slot 语义锚点、Token 化语义类名、ARIA role/label、
 * cva 变体落点。均为规范约束的用户可见/可访问行为，不测实现细节。
 */
describe('UDS8 展示/布局组件契约', () => {
  test('Skeleton 暴露 data-slot=skeleton 且使用 Token 化底色与动效', () => {
    const { container } = render(<Skeleton />)
    const el = container.querySelector('[data-slot="skeleton"]')
    expect(el).not.toBeNull()
    expect(has(el, 'bg-muted')).toBe(true)
    expect(has(el, 'animate-pulse')).toBe(true)
  })

  test('Skeleton 允许调用方 className 覆盖而不丢失语义锚点', () => {
    const { container } = render(<Skeleton className='h-4 w-32' />)
    const el = container.querySelector('[data-slot="skeleton"]')
    expect(has(el, 'h-4')).toBe(true)
    expect(has(el, 'w-32')).toBe(true)
    expect(has(el, 'bg-muted')).toBe(true)
  })

  test('AspectRatio 把比例写入 --ratio 变量并使用 aspect-(--ratio) 类', () => {
    const { container } = render(<AspectRatio ratio={16 / 9} />)
    const el = container.querySelector(
      '[data-slot="aspect-ratio"]'
    ) as HTMLElement
    expect(el).not.toBeNull()
    expect(el.style.getPropertyValue('--ratio')).toBe(String(16 / 9))
    expect(has(el, 'relative')).toBe(true)
    expect(classes(el).some((c) => c.includes('aspect-'))).toBe(true)
  })

  test('Kbd 暴露 data-slot=kbd 且使用语义色与规范字号档', () => {
    const { container } = render(<Kbd>⌘K</Kbd>)
    const el = container.querySelector('[data-slot="kbd"]')
    expect(el).not.toBeNull()
    expect(has(el, 'bg-muted')).toBe(true)
    expect(has(el, 'text-xs')).toBe(true)
  })

  test('KbdGroup 以 kbd-group 语义锚点组织按键组', () => {
    const { container } = render(
      <KbdGroup>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
    )
    expect(container.querySelector('[data-slot="kbd-group"]')).not.toBeNull()
    expect(container.querySelectorAll('[data-slot="kbd"]')).toHaveLength(2)
  })

  test('Separator 默认 horizontal 暴露原生 separator 角色', () => {
    render(<Separator />)
    const el = screen.getByRole('separator')
    expect(el).not.toBeNull()
    expect(el.getAttribute('data-orientation')).toBe('horizontal')
  })

  test('Separator 垂直方向通过 data-orientation 暴露状态', () => {
    render(<Separator orientation='vertical' />)
    const el = screen.getByRole('separator')
    expect(el.getAttribute('data-orientation')).toBe('vertical')
  })

  test('Spinner 暴露 status 角色与可访问名称', () => {
    render(<Spinner />)
    const el = screen.getByRole('status')
    expect(el).not.toBeNull()
    expect(el.getAttribute('aria-label')).toBeTruthy()
    expect(has(el, 'animate-spin')).toBe(true)
  })

  test('Spinner 描边宽度默认 2（UDS8 图标线宽唯一值）', () => {
    render(<Spinner />)
    const el = screen.getByRole('status')
    expect(el.getAttribute('stroke-width')).toBe('2')
  })

  test('DiscountBadge 折扣倍率 <1 用成功语义色', () => {
    render(<DiscountBadge ratio={0.9}>-10%</DiscountBadge>)
    const el = screen.getByText('-10%')
    expect(has(el, 'bg-success-hover')).toBe(true)
    expect(has(el, 'text-on-emphasis')).toBe(true)
  })

  test('DiscountBadge 溢价倍率 >1 用危险语义色', () => {
    render(<DiscountBadge ratio={1.2}>+20%</DiscountBadge>)
    const el = screen.getByText('+20%')
    expect(has(el, 'bg-destructive-hover')).toBe(true)
  })

  test('DiscountBadge 持平倍率=1 用中性色而非溢价红', () => {
    render(<DiscountBadge ratio={1}>持平</DiscountBadge>)
    const el = screen.getByText('持平')
    expect(has(el, 'bg-muted')).toBe(true)
    expect(has(el, 'text-fg-secondary')).toBe(true)
    expect(has(el, 'bg-destructive-hover')).toBe(false)
  })

  test('IconBadge 默认装饰性：aria-hidden=true', () => {
    render(<IconBadge>+</IconBadge>)
    const el = screen.getByText('+')
    expect(el.getAttribute('aria-hidden')).toBe('true')
  })

  test('IconBadge 非装饰 tone=success 落 success-soft 令牌类', () => {
    render(
      <IconBadge tone='success' decorative={false}>
        ✓
      </IconBadge>
    )
    const el = screen.getByText('✓')
    expect(el.getAttribute('aria-hidden')).toBe('false')
    expect(has(el, 'bg-success-soft')).toBe(true)
    expect(has(el, 'text-success')).toBe(true)
  })

  test('IconBadge size=lg 落 40px 档（size-10）', () => {
    render(
      <IconBadge size='lg'>
        <span>图标</span>
      </IconBadge>
    )
    const el = screen.getByText('图标').parentElement
    expect(has(el, 'size-10')).toBe(true)
    expect(has(el, 'rounded-xl')).toBe(true)
  })
})
