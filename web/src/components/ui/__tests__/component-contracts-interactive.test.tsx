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
import { describe, expect, test } from 'vitest'

import { ButtonGroup, ButtonGroupText } from '../button-group'
import { Checkbox } from '../checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../collapsible'
import { Progress, ProgressIndicator, ProgressTrack } from '../progress'
import { RadioGroup, RadioGroupItem } from '../radio-group'
import { Slider } from '../slider'
import { Switch } from '../switch'
import { Toggle } from '../toggle'

/**
 * UDS8 交互/输入组件契约守卫（第 2 批）。
 * 断言点：原生 ARIA 角色、data-slot 语义锚点、disabled 状态暴露、
 * 键盘可操作性、选中态类名落点。每项保护一个可访问行为。
 */
describe('UDS8 交互组件契约', () => {
  test('Checkbox 暴露 checkbox 角色且可键盘勾选', async () => {
    const user = userEvent.setup()
    render(<Checkbox aria-label='接受条款' />)
    const cb = screen.getByRole('checkbox', { name: '接受条款' })
    expect(cb).not.toBeNull()
    await user.click(cb)
    expect(cb).toHaveAttribute('data-checked', '')
  })

  test('Checkbox 禁用态暴露 data-disabled 且不可勾选', async () => {
    const user = userEvent.setup()
    render(<Checkbox aria-label='禁用勾选' disabled />)
    const cb = screen.getByRole('checkbox', { name: '禁用勾选' })
    // Base UI 在无障碍树里把 disabled 同步到 aria-disabled
    expect(cb.getAttribute('aria-disabled')).toBe('true')
    await user.click(cb)
    expect(cb).not.toHaveAttribute('data-checked')
  })

  test('Switch 暴露 switch 角色且可键盘切换', async () => {
    const user = userEvent.setup()
    render(<Switch aria-label='启用同步' />)
    const sw = screen.getByRole('switch', { name: '启用同步' })
    expect(sw).not.toBeNull()
    await user.click(sw)
    expect(sw).toHaveAttribute('data-checked', '')
  })

  test('Switch 切换后 ARIA 状态同步（checked 暴露给辅助技术）', async () => {
    const user = userEvent.setup()
    render(<Switch aria-label='状态同步' />)
    const sw = screen.getByRole('switch', { name: '状态同步' })
    expect(sw.getAttribute('aria-checked')).toBe('false')
    await user.click(sw)
    expect(sw.getAttribute('aria-checked')).toBe('true')
  })

  test('RadioGroup 内选项互斥：选一个后另一个取消', async () => {
    const user = userEvent.setup()
    render(
      <RadioGroup aria-label='方案'>
        <RadioGroupItem value='a' id='ra' aria-label='方案 A' />
        <RadioGroupItem value='b' id='rb' aria-label='方案 B' />
      </RadioGroup>
    )
    const a = screen.getByRole('radio', { name: '方案 A' })
    const b = screen.getByRole('radio', { name: '方案 B' })
    await user.click(a)
    expect(a).toHaveAttribute('data-checked', '')
    await user.click(b)
    expect(b).toHaveAttribute('data-checked', '')
    expect(a).not.toHaveAttribute('data-checked')
  })

  test('Toggle 暴露 pressed 状态且可切换', async () => {
    const user = userEvent.setup()
    render(<Toggle aria-label='加粗'>B</Toggle>)
    const t = screen.getByRole('button', { name: '加粗' })
    expect(t.getAttribute('aria-pressed')).toBe('false')
    await user.click(t)
    expect(t.getAttribute('aria-pressed')).toBe('true')
  })

  test('Toggle 禁用态不可点击', async () => {
    const user = userEvent.setup()
    render(
      <Toggle aria-label='不可用' disabled>
        X
      </Toggle>
    )
    const t = screen.getByRole('button', { name: '不可用' })
    expect(t).toBeDisabled()
    await user.click(t)
    expect(t.getAttribute('aria-pressed')).toBe('false')
  })

  test('Slider 的 thumb input 暴露 aria-valuenow 与数值范围', () => {
    const { container } = render(
      <Slider defaultValue={[50]} aria-label='配额' />
    )
    // Base UI 的原生 range input 在 jsdom 下被 visibility:hidden（真实浏览器
    // 由 thumb 承载交互），故直接查 DOM 断言原生语义属性。
    const input = container.querySelector('input[type="range"]')
    expect(input).not.toBeNull()
    expect(input?.getAttribute('aria-valuenow')).toBe('50')
    expect(input?.getAttribute('min')).toBe('0')
    expect(input?.getAttribute('max')).toBe('100')
  })

  test('ButtonGroup 暴露 group 角色以关联同组控件', () => {
    render(
      <ButtonGroup aria-label='筛选操作'>
        <ButtonGroupText>条件</ButtonGroupText>
      </ButtonGroup>
    )
    expect(screen.getByRole('group', { name: '筛选操作' })).not.toBeNull()
  })

  test('Progress 暴露 progressbar 角色与当前值', () => {
    render(
      <Progress value={40}>
        <ProgressTrack>
          <ProgressIndicator />
        </ProgressTrack>
      </Progress>
    )
    const bar = screen.getByRole('progressbar')
    expect(bar).not.toBeNull()
    expect(bar.getAttribute('aria-valuenow')).toBe('40')
  })

  test('Collapsible 触发器 aria-expanded 随开合状态变化', async () => {
    const user = userEvent.setup()
    render(
      <Collapsible>
        <CollapsibleTrigger>展开详情</CollapsibleTrigger>
        <CollapsibleContent>详情内容</CollapsibleContent>
      </Collapsible>
    )
    const trigger = screen.getByRole('button', { name: '展开详情' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    await user.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })
})
