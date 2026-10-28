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
import { InputGroup, InputGroupTextarea } from '../input-group'

/**
 * 输入组（InputGroup）的禁用态淡出只能由**输入控件本身**触发。
 *
 * 曾经的写法是 `has-disabled:opacity-50` / `has-disabled:bg-input/50`，展开后
 * 是 `&:has(:disabled)` —— 组里任意一个禁用按钮（输入舱空文本时的发送按钮、
 * 没有历史时的「清空」按钮）都会把整个输入组打到 50% 不透明度，面板看起来
 * 像一层半透明玻璃。jsdom 不跑 Tailwind，所以这里守的是类名本身：
 * 未加限定的 `has-disabled:` 一旦回来，用例就红。
 */
describe('InputGroup disabled styling', () => {
  function renderGroup(disabledControl: boolean) {
    render(
      <InputGroup data-testid='group'>
        <InputGroupTextarea
          disabled={disabledControl}
          placeholder='say something'
        />
        {/* 组内的禁用按钮：不应影响输入组本身的外观 */}
        <Button type='button' disabled>
          Clear
        </Button>
      </InputGroup>
    )
    return screen.getByTestId('group')
  }

  it('scopes the disabled fade to the input control, not to any disabled child', () => {
    const group = renderGroup(false)
    const classes = group.className

    // 带 `[data-slot=input-group-control]` 限定的写法才允许出现。
    expect(classes).toContain(
      'has-[[data-slot=input-group-control]:disabled]:opacity-50'
    )
    expect(classes).toContain(
      'has-[[data-slot=input-group-control]:disabled]:bg-input/50'
    )

    // 未限定的 `has-disabled:`（`:has(:disabled)`）会命中组内的禁用按钮。
    expect(classes).not.toMatch(/(?:^|\s|:)has-disabled:/)
    expect(classes).not.toContain('dark:has-disabled:')
  })

  it('keeps the control and its addons rendered while the group has a disabled child', () => {
    renderGroup(false)
    expect(screen.getByPlaceholderText('say something')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled()
  })
})
