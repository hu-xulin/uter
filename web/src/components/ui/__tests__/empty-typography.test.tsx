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

import { EmptyDescription, EmptyTitle } from '../empty'

/**
 * 空状态字号层级守卫（UDS 8.0.0 + 设置引导步骤行契约）：
 *   标题 14px/500（text-sm! font-medium）+ 说明 14px/400（text-sm! font-normal）。
 *
 * 层级靠「字重」而非字号区分——与设置引导的 StartStepItem（同样是 14px
 * 标题 medium + 14px 描述 normal）保持同一套逻辑。旧版曾用 text-lg(18px)
 * 标题 + text-sm(14px) 说明靠字号拉开层级，现统一为 14px。
 *
 * ⚠️ `!` 仍必需：空状态常嵌在表格 <td> 内，<Table> 根元素给单元格后代设了
 * `[&_:is(th,td)_*]:[font-size:inherit]`，READABLE_TABLE_CLASS 又加了
 * `[&_[data-slot=table]_td_*]:text-sm`。两者特异性高于组件自身类，important
 * 才能锁定字号与字重不被抹平。
 */
describe('空状态字号层级（UDS 8.0.0）', () => {
  it('EmptyTitle 默认是 14px/500（text-sm! font-medium）', () => {
    render(<EmptyTitle>未找到日志</EmptyTitle>)
    const title = screen.getByText('未找到日志')
    expect(title.className).toContain('text-sm!')
    expect(title.className).toContain('font-medium!')
    expect(title.className).not.toContain('text-lg!')
  })

  it('EmptyDescription 默认是 14px/400（text-sm! font-normal）', () => {
    render(<EmptyDescription>暂无使用日志</EmptyDescription>)
    const desc = screen.getByText('暂无使用日志')
    expect(desc.className).toContain('text-sm!')
    expect(desc.className).toContain('font-normal!')
  })

  it('标题与说明同为 14px，仅靠字重区分层级（medium > normal）', () => {
    const { container } = render(
      <>
        <EmptyTitle>标题</EmptyTitle>
        <EmptyDescription>说明</EmptyDescription>
      </>
    )
    const title = container.querySelector('[data-slot=empty-title]')!
    const desc = container.querySelector('[data-slot=empty-description]')!
    // 字号一致：两者都用 text-sm!
    expect(title.className).toContain('text-sm!')
    expect(desc.className).toContain('text-sm!')
    // 字重分层：标题 medium、描述 normal
    expect(title.className).toContain('font-medium!')
    expect(desc.className).toContain('font-normal!')
  })

  it('刻意降级为普通说明时，调用方可用 font-normal! 覆盖标题字重', () => {
    render(
      <EmptyTitle className='text-muted-foreground text-sm! font-normal!'>
        占位说明
      </EmptyTitle>
    )
    const el = screen.getByText('占位说明')
    // twMerge 把 font-medium! 与 font-normal! 视为同组冲突，后者胜。
    expect(el.className).toContain('font-normal!')
    expect(el.className).not.toContain('font-medium!')
  })
})
