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

import { Input } from '../input'
import { Textarea } from '../textarea'

/**
 * placeholder 兜底不得覆盖显式 label 的可访问名。
 * 这条回归曾让 88 个业务用例无法通过 getByRole/getByLabelText 找到字段。
 */
describe('Input / Textarea 可访问名来源', () => {
  it('有 label for 时以 label 为可访问名，不写 placeholder 兜底 aria-label', () => {
    render(
      <>
        <label htmlFor='model-name'>Model name</label>
        <Input id='model-name' placeholder='gpt-4' />
      </>
    )
    const input = screen.getByRole('textbox', { name: 'Model name' })
    expect(input).not.toHaveAttribute('aria-label')
    expect(input).toHaveValue('')
  })

  it('完全无外部名称时仍用 placeholder 兜底 aria-label', () => {
    render(<Input placeholder='Search' />)
    const input = screen.getByRole('textbox', { name: 'Search' })
    expect(input).toHaveAttribute('aria-label', 'Search')
  })

  it('显式 aria-label 始终优先', () => {
    render(<Input aria-label='Custom name' placeholder='Search' />)
    expect(screen.getByRole('textbox', { name: 'Custom name' })).toBeVisible()
  })

  it('Textarea 与 Input 使用同一口径', () => {
    render(
      <>
        <label htmlFor='description'>Description</label>
        <Textarea id='description' placeholder='Details' />
      </>
    )
    const textarea = screen.getByRole('textbox', { name: 'Description' })
    expect(textarea).not.toHaveAttribute('aria-label')

    render(<Textarea placeholder='Notes' />)
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveAttribute(
      'aria-label',
      'Notes'
    )
  })
})
