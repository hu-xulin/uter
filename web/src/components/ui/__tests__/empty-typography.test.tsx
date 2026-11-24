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
 * 空状态字号层级守卫（UDS 8.0.0 §14-CONTENT-AND-WRITING-STANDARD）：
 *   空状态标题 18px/26px（text-lg）+ 说明 14px/22px（text-sm）。
 *
 * 回归背景：空状态常放在表格 <td> 内，而 <Table> 根元素给单元格后代设了
 * `[&_:is(th,td)_*]:[font-size:inherit]`，READABLE_TABLE_CLASS 又加了
 * `[&_[data-slot=table]_td_*]:text-sm`。两者特异性都高于 EmptyTitle 自身的
 * text-lg，导致标题被抹平成与说明相同的 14px，层级消失（用户反馈
 * 「未找到日志」与下方说明看起来一样大）。
 *
 * 修复：EmptyTitle 用 text-lg! / EmptyDescription 用 text-sm!（important），
 * 压制表格通吃选择器的覆盖；需要刻意降级的调用方（通知浮层、访问令牌）
 * 传 text-sm! 由 twMerge 同组覆盖。本测试锁定这两条契约。
 */
describe('空状态字号层级（UDS 8.0.0）', () => {
  it('EmptyTitle 默认是 18px（text-lg!），能抵抗表格通吃选择器的覆盖', () => {
    render(<EmptyTitle>未找到日志</EmptyTitle>)
    const title = screen.getByText('未找到日志')
    expect(title.className).toContain('text-lg!')
    expect(title.className).toContain('font-semibold')
  })

  it('EmptyDescription 默认是 14px（text-sm!）', () => {
    render(<EmptyDescription>暂无使用日志</EmptyDescription>)
    const desc = screen.getByText('暂无使用日志')
    expect(desc.className).toContain('text-sm!')
  })

  it('标题与说明保持至少一档字号差（lg > sm），层级不被抹平', () => {
    const { container } = render(
      <>
        <EmptyTitle>标题</EmptyTitle>
        <EmptyDescription>说明</EmptyDescription>
      </>
    )
    const title = container.querySelector('[data-slot=empty-title]')!
    const desc = container.querySelector('[data-slot=empty-description]')!
    const tier = (c: string) => (c.includes('text-lg!') ? 3 : c.includes('text-sm!') ? 2 : 0)
    expect(tier(title.className)).toBeGreaterThan(tier(desc.className))
  })

  it('刻意降级为说明文字时，调用方可用 text-sm! 覆盖标题的 important 字号', () => {
    render(
      <EmptyTitle className='text-muted-foreground text-sm! font-normal'>
        占位说明
      </EmptyTitle>
    )
    const el = screen.getByText('占位说明')
    // twMerge 把 text-lg! 与 text-sm! 视为同组冲突，后者胜，且不残留 text-lg!。
    expect(el.className).not.toContain('text-lg!')
    expect(el.className).toContain('text-sm!')
  })
})
