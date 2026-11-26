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
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { withCjkTermBreaks } from '@/lib/cjk-term-breaks'

import { CjkTermText } from '../cjk-term-text'

/**
 * 回归：首列中文术语在词边界插入 <wbr>，且不改变可见文本。
 * 用户决定（2026-11-26）：「个人信息」不得拆成「个人信」+「息」。
 */
describe('CjkTermText', () => {
  it('在「个人信息」的两个词之间插入一个 wbr', () => {
    const { container } = render(<CjkTermText>个人信息</CjkTermText>)
    expect(container.querySelectorAll('wbr')).toHaveLength(1)
    expect(container.textContent).toBe('个人信息')
  })

  it('在「敏感个人信息」的三个词之间插入两个 wbr', () => {
    const { container } = render(<CjkTermText>敏感个人信息</CjkTermText>)
    expect(container.querySelectorAll('wbr')).toHaveLength(2)
    expect(container.textContent).toBe('敏感个人信息')
  })

  it('wbr 位置精确落在用户裁决的构词边界', () => {
    // 只数 wbr 数量不足以防回归：切在「个人信|息」同样是 1 个 wbr。
    // 这里把 DOM 子节点折叠成「文本|文本」串，精确锁定断点位置。
    const breaks = (container: HTMLElement) =>
      [...container.childNodes]
        .map((node) =>
          node.nodeName === 'WBR' ? '|' : (node.textContent ?? '')
        )
        .join('')

    const cases: Array<[string, string]> = [
      ['个人信息处理者', '个人信息|处理者'],
      ['受托处理者', '受托|处理者'],
      ['上游模型提供商', '上游模型|提供商'],
      // 语境依赖：同一个「个人信息」单独出现时仍按「个人/信息」断开。
      ['个人信息', '个人|信息'],
    ]
    for (const [text, expected] of cases) {
      const { container } = render(<CjkTermText>{text}</CjkTermText>)
      expect(breaks(container)).toBe(expected)
      expect(container.textContent).toBe(text)
    }
  })

  it('四字术语渲染成不可断行的原子节点，不插 wbr', () => {
    // 用户 18:52 裁决：「违约程度」这一列四个字必须在同一行。
    for (const term of [
      '违约程度',
      '一般违约',
      '较重违约',
      '严重违约',
      '涉嫌违法',
    ]) {
      const { container } = render(<CjkTermText>{term}</CjkTermText>)
      const atom = container.querySelector('[data-cjk-nowrap]')
      expect(atom?.textContent, term).toBe(term)
      expect(container.querySelectorAll('wbr'), term).toHaveLength(0)
    }
  })

  it('混合子节点（文本 + strong + 尾文本）仍插入词边界', () => {
    // 隐私政策「营销信息推送（**非必需**）」编译成三个 React 子节点；
    // 早期实现不递归数组，导致整个首列丢掉全部 wbr。
    const { container } = render(
      <CjkTermText>
        营销信息推送（<strong>非必需</strong>）
      </CjkTermText>
    )
    expect(container.innerHTML).toContain('营销信息推送<wbr>（')
    expect(container.querySelector('[data-cjk-nowrap]')?.textContent).toBe(
      '非必需'
    )
    expect(container.textContent).toBe('营销信息推送（非必需）')
  })

  it('问号不单独成节点：与前文同属一个分词片段', () => {
    const { container } = render(
      <CjkTermText>余额快用完会突然停服吗？</CjkTermText>
    )
    expect(container.textContent).toBe('余额快用完会突然停服吗？')
    const parts = [...container.childNodes].filter((n) => n.nodeName !== 'WBR')
    expect(parts.at(-1)?.textContent).toBe('突然停服吗？')
  })

  it('进入原生 strong 元素给 MDX 术语表首列加断点', () => {
    const { container } = render(
      <CjkTermText>
        <strong>个人信息</strong>
      </CjkTermText>
    )
    expect(container.querySelector('strong')).toBeTruthy()
    expect(
      container.querySelector('strong')?.querySelectorAll('wbr')
    ).toHaveLength(1)
    expect(container.textContent).toBe('个人信息')
  })

  it('不改写自定义组件的封装结构（无 wbr 注入）', () => {
    const Custom = ({ children }: { children: React.ReactNode }) => (
      <span data-custom='1'>{children}</span>
    )
    const { container } = render(
      <CjkTermText>
        <Custom>个人信息</Custom>
      </CjkTermText>
    )
    expect(container.querySelector('[data-custom]')).toBeTruthy()
    expect(container.querySelectorAll('wbr')).toHaveLength(0)
  })

  it('英文/数字首列不产生 wbr', () => {
    for (const text of ['gpt-4o-mini', 'VIP0', '12345']) {
      const { container } = render(<CjkTermText>{text}</CjkTermText>)
      expect(container.querySelectorAll('wbr')).toHaveLength(0)
      expect(container.textContent).toBe(text)
    }
  })

  it('非字符串节点（数字/空）原样返回', () => {
    expect(withCjkTermBreaks(12)).toBe(12)
    expect(withCjkTermBreaks(null)).toBe(null)
  })
})
