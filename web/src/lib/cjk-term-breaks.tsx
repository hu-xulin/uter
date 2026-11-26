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
import * as React from 'react'

import { isCjkNowrapTerm, segmentCjkWords } from './cjk-text'

/**
 * 把 ReactNode 里的中文文本在词边界插入 `<wbr>`（表格首列专用）。
 *
 * 只处理「字符串」与「原生 HTML 元素（strong/span/a/em/code…）」的文本子节点
 * —— MDX 术语表首列是 `<strong>个人信息</strong>`，必须进入 strong 才能加
 * 分词点。自定义组件（Badge、Tooltip、按钮）保持原样，避免改写其封装结构。
 */
export function withCjkTermBreaks(node: React.ReactNode): React.ReactNode {
  if (typeof node === 'string') return segmentWithBreaks(node)
  // MDX 把「文本 + <strong> + 文本」编译成子节点数组；不递归数组会让
  // 混合结构的首列整段丢掉词边界（隐私政策「营销信息推送（非必需）」）。
  // Children.map 保留原 key，避免用数组下标当 key。
  if (Array.isArray(node)) {
    return React.Children.map(node, (child) => withCjkTermBreaks(child))
  }
  if (
    typeof node !== 'object' ||
    node === null ||
    !React.isValidElement(node)
  ) {
    return node
  }

  if (typeof node.type !== 'string') return node

  const element = node as React.ReactElement<{ children?: React.ReactNode }>
  if (element.props.children === undefined) return element
  return React.cloneElement(
    element,
    undefined,
    withCjkTermBreaks(element.props.children)
  )
}

// 只有含中日韩统一表意文字的文本才需要构词断点。纯拉丁/数字/ID 保持原样，
// 避免给模型名（gpt-4o-mini）这类本来就有合法断点的文本插入多余 wbr。
const CJK_RE =
  /[\u2E80-\u2EFF\u3000-\u303F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/

function segmentWithBreaks(value: string): React.ReactNode {
  if (value === '' || !CJK_RE.test(value)) return value
  // 四字术语 / 括号短语整体成行：包成原子节点，由 CSS 禁止内部断行。
  if (isCjkNowrapTerm(value)) return <span data-cjk-nowrap>{value}</span>
  const words = segmentCjkWords(value)
  if (words.length <= 1) return value

  // 用「词内容 + 该词出现序号」做 key：词可能重复（如「模型模型」），
  // 纯词内容会冲突；出现序号由数据本身决定，不用数组下标。
  const occurrences = new Map<string, number>()
  return words.map((word, index) => {
    const count = occurrences.get(word) ?? 0
    occurrences.set(word, count + 1)
    return (
      <React.Fragment key={`${word}#${count}`}>
        {index > 0 ? <wbr /> : null}
        {word}
      </React.Fragment>
    )
  })
}
