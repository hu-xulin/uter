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
import { isValidElement, type ReactNode } from 'react'

import {
  CodeBlock,
  CodeBlockCopyButton,
} from '@/components/ai-elements/code-block'

const LANGUAGE_CLASS = /(?:^|\s)language-([\w+#.-]+)/

function textOf(node: ReactNode): string {
  if (typeof node === 'string') {
    return node
  }
  if (typeof node === 'number') {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join('')
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textOf(node.props.children)
  }
  return ''
}

/**
 * MDX fenced code → the shared UDS 8.0.0 code block (`§24`).
 *
 * The compiler emits `<pre><code class="language-x">`, so the language and raw
 * source are read from the child element. Highlighting, code chrome, syntax
 * colours and the copy affordance all come from `CodeBlock`, which routes every
 * engine through `--ds-syntax-*` / `--ds-color-code-*`. Collapsing stays off:
 * a docs snippet must be readable in full without an extra interaction.
 */
export function DocsCodeBlock({ children }: { children?: ReactNode }) {
  const child = Array.isArray(children) ? children[0] : children
  const codeChild = isValidElement<{
    className?: string
    children?: ReactNode
  }>(child)
    ? child
    : null
  const language =
    codeChild?.props.className?.match(LANGUAGE_CLASS)?.[1] ?? 'plaintext'
  const code = textOf(codeChild?.props.children ?? children).replace(/\n$/, '')

  return (
    <CodeBlock
      // 文档代码块：外层灰色卡（语言栏）+ 内层白色代码卡（行号 + 投影）。
      // 行号栏保持透明、无竖线；高度按内容自适应，单行片段不留空白。
      className={[
        '[&_[role=textbox]]:min-h-0! [&_.cm-scroller]:min-h-0!',
        '[&_.cm-content]:min-h-0! [&_.cm-content]:pl-4!',
        '[&>div:first-child]:border-b-0! [&>div:first-child]:bg-transparent!',
        '[&_.cm-gutters]:border-r-0! [&_.cm-gutters]:bg-transparent! [&_.cm-gutters]:pl-4!',
        '[&_.cm-activeLine]:bg-transparent! [&_.cm-activeLine]:shadow-none!',
        '[&_.cm-line]:bg-none!',
        '[&_.code-block-scroll]:m-2 [&_.code-block-scroll]:rounded-xl',
        '[&_.code-block-scroll]:bg-(--ds-color-surface-base)',
        '[&_.code-block-scroll]:shadow-(--ds-elevation-raised)',
      ].join(' ')}
      code={code}
      enableCollapse={false}
      language={language}
      showLineNumbers
      showToolbar
    >
      <CodeBlockCopyButton />
    </CodeBlock>
  )
}
