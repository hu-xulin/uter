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
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'

import { Callout } from '../callout'

afterEach(() => {
  cleanup()
})

describe('Callout (Clerk anatomy + UDS 8.0.0 §21)', () => {
  test('warning renders a white ringed surface with a left rail, 20px icon and bold title', () => {
    const { container, getByText } = render(
      <Callout type='warn'>密钥等同于密码</Callout>
    )

    const callout = container.firstElementChild as HTMLElement
    // Clerk: white surface + neutral border, not a coloured soft block.
    expect(callout.className).toContain('bg-(--ds-color-surface-base)')
    expect(callout.className).toContain('border-(--ds-color-border-default)')

    // Clerk ties the rail, icon and title to one semantic hue.
    const rail = callout.querySelector('span[aria-hidden="true"]')
    expect(rail?.getAttribute('class')).toContain('w-0.5')
    expect(rail?.getAttribute('class')).toContain(
      'bg-(--ds-color-status-warning)'
    )

    const icon = callout.querySelector('svg')
    expect(icon?.getAttribute('aria-hidden')).toBe('true')
    expect(icon?.getAttribute('class')).toContain('size-5')
    expect(icon?.getAttribute('class')).toContain(
      'text-(--ds-color-status-warning)'
    )

    const title = getByText('Warning')
    expect(title.className).toContain('font-semibold')
    expect(title.className).toContain('text-(--ds-color-status-warning)')
  })

  test('idea tone maps to a Tip title on the success hue', () => {
    const { container, getByText } = render(<Callout type='idea'>建议</Callout>)

    expect(getByText('Tip')).not.toBeNull()
    const rail = container.querySelector('span[aria-hidden="true"]')
    expect(rail?.getAttribute('class')).toContain(
      'bg-(--ds-color-status-success)'
    )
  })

  test('hint body copy uses the 14/22 text-sm scale', () => {
    const { container } = render(<Callout type='warn'>密钥等同于密码</Callout>)

    const callout = container.firstElementChild as HTMLElement
    expect(callout.className).toContain('text-sm')
    const body = callout.lastElementChild as HTMLElement
    expect(body.className).toContain('text-sm')
    expect(body.className).toContain('[&_p]:text-sm!')
  })

  test('unknown tone falls back to the info rail and Note title', () => {
    const { container, getByText } = render(
      <Callout type='mystery'>提示</Callout>
    )

    expect(getByText('Note')).not.toBeNull()
    const rail = container.querySelector('span[aria-hidden="true"]')
    expect(rail?.getAttribute('class')).toContain('bg-(--ds-color-status-info)')
  })

  test('body copy shares the title column instead of aligning under the icon', () => {
    const { container, getByText } = render(
      <Callout type='idea'>推荐奖励与充值额度分别记账</Callout>
    )

    const callout = container.firstElementChild as HTMLElement
    // 图标独占第一列并跨两行；标题与正文显式同处第二列，因此正文左边缘
    // 与标题文字左边缘一致，而不是与图标左边缘一致。
    expect(callout.className).toContain('grid-cols-[auto_1fr]')

    const icon = callout.querySelector('svg')
    expect(icon?.getAttribute('class')).toContain('row-span-2')

    const title = getByText('Tip')
    expect(title.className).toContain('col-start-2')

    const body = callout.lastElementChild as HTMLElement
    expect(body.className).toContain('col-start-2')
  })
})
