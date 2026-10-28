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
import { describe, expect, it } from 'vitest'

import { Button } from '../button'

/**
 * `Button` 的加载态契约（`components.md`「状态与可访问性」）：
 *
 * > 加载态不能改变按钮尺寸（用 `loading` 属性，不要替换成 spinner 后丢掉
 * > 文字宽度）
 *
 * 这条约束的实质是「文字必须留在 DOM 里」—— 手写 `{loading ? <Spinner/> :
 * '保存'}` 会把按钮从「保存」的宽度缩成一个方块，点了之后整行布局跳动。
 * 所以这里守三件事：文字还在、spinner 是**追加**的前置图标、按钮自动
 * disabled 且 `aria-busy`。
 */
describe('Button loading state', () => {
  it('keeps the label in the DOM while loading', () => {
    render(<Button loading>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('keeps the accessible name stable across the loading flip', () => {
    const { rerender } = render(<Button>Save</Button>)
    const before = screen.getByRole('button', { name: 'Save' })
    rerender(<Button loading>Save</Button>)
    // spinner 上带 aria-hidden：名称仍是「Save」，不变成「Loading Save」。
    expect(screen.getByRole('button', { name: 'Save' })).toBe(before)
  })

  it('appends a spinner instead of replacing the label', () => {
    const { container } = render(<Button loading>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    const spinner = container.querySelector('[data-slot="button-spinner"]')

    expect(spinner).not.toBeNull()
    // spinner 是第一个子节点：前置图标位，不改变文字基线。
    expect(button.firstElementChild).toBe(spinner)
    expect(button.textContent).toContain('Save')
  })

  it('disables itself and exposes aria-busy while loading', () => {
    render(<Button loading>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toHaveAttribute('data-loading', 'true')
  })

  it('renders no spinner and stays enabled when not loading', () => {
    const { container } = render(<Button>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })

    expect(container.querySelector('[data-slot="button-spinner"]')).toBeNull()
    expect(button).toBeEnabled()
    expect(button).not.toHaveAttribute('aria-busy')
    expect(button).not.toHaveAttribute('data-loading')
  })
})
