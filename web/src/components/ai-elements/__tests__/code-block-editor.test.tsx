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
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'

import { CodeBlock, CodeBlockEditor } from '../code-block'

afterEach(() => {
  cleanup()
})

function editorTree(value: string) {
  // A fresh inline onKeyDown per call mirrors PlaygroundMessageEditor, which
  // recreates its handler on every keystroke-driven render.
  return (
    <CodeBlockEditor
      ariaLabel='Edit message'
      language='markdown'
      onChange={() => undefined}
      onKeyDown={() => undefined}
      value={value}
    />
  )
}

describe('CodeBlockEditor', () => {
  test('does not add a second vertical inset to the line-number gutter for multiline source', () => {
    const { getByRole } = render(
      <CodeBlockEditor
        ariaLabel='Plugin source'
        autoFocus={false}
        language='javascript'
        onChange={() => undefined}
        value={'2\n1\n1'}
      />
    )

    const editor = getByRole('textbox', { name: 'Plugin source' })
    const gutters = editor.querySelector('.cm-gutters')

    // CodeMirror already offsets each gutter line by the content padding.
    // Extra vertical padding here shifts every number below its source line.
    expect(gutters).toHaveStyle({ paddingTop: '0px', paddingBottom: '0px' })
  })

  test('keeps the same editor instance when value and onKeyDown change on rerender', () => {
    const { rerender } = render(editorTree('h'))

    const contentBefore = document.querySelector('.cm-content')
    expect(contentBefore).not.toBeNull()

    rerender(editorTree('hi'))

    const contentAfter = document.querySelector('.cm-content')
    // If the EditorView were torn down and rebuilt, the content node would be
    // replaced and the cursor would reset to the document start, making typed
    // characters pile up at the beginning (text appears right-to-left).
    expect(contentAfter).toBe(contentBefore)
    expect(contentAfter?.textContent).toContain('hi')
  })
})

describe('CodeBlock language coverage (UDS 8.0.0 Phase 3)', () => {
  const cases: Array<{ code: string; language: string }> = [
    { language: 'json', code: '{"name": "uter", "count": 1}' },
    { language: 'python', code: 'def hello():\n    return 42\n' },
    { language: 'go', code: 'package main\n\nfunc main() {}\n' },
    { language: 'bash', code: 'echo "hello"\n' },
    { language: 'sql', code: 'SELECT id FROM users WHERE id = 1;\n' },
    { language: 'yaml', code: 'name: uter\ncount: 1\n' },
  ]

  for (const { language, code } of cases) {
    test(`highlights ${language} with real syntax tokens`, async () => {
      const { getByRole } = render(
        <CodeBlock code={code} language={language} showToolbar={false} />
      )
      const block = getByRole('textbox', { name: language })
      // 纯文本没有高亮 span；出现带 class 的 span 证明语言解析器真实生效。
      await waitFor(() => {
        expect(
          block.querySelectorAll('.cm-content span[class]').length
        ).toBeGreaterThan(0)
      })
    })
  }

  test('plaintext stays unhighlighted (negative control)', () => {
    const { getByRole } = render(
      <CodeBlock code='def hello():\n    return 42\n' language='plaintext' />
    )
    const block = getByRole('textbox', { name: 'plaintext' })
    expect(block.querySelectorAll('.cm-content span[class]').length).toBe(0)
  })
})

describe('Code chrome (UDS 8.0.0 §5.3 / §5.4)', () => {
  test('code block and editor use separate background tokens', () => {
    const { getByRole, rerender } = render(
      <CodeBlock code='x' language='plaintext' />
    )
    expect(
      getByRole('textbox', { name: 'plaintext' }).closest('.group\\/code-block')
        ?.className
    ).toContain('bg-(--ds8-color-code-codeblock-background)')

    rerender(
      <CodeBlockEditor
        ariaLabel='Edit'
        autoFocus={false}
        language='plaintext'
        onChange={() => undefined}
        value='x'
      />
    )
    expect(
      getByRole('textbox', { name: 'Edit' }).closest('.group\\/code-block')
        ?.className
    ).toContain('bg-(--ds8-color-code-editor-background)')
  })

  test('active line highlight only applies to the editable editor', () => {
    const { getByRole, rerender } = render(
      <CodeBlockEditor
        ariaLabel='Edit'
        autoFocus={false}
        language='javascript'
        onChange={() => undefined}
        value={'const a = 1\nconst b = 2\n'}
      />
    )
    expect(
      getByRole('textbox', { name: 'Edit' }).querySelector('.cm-activeLine')
    ).not.toBeNull()

    rerender(<CodeBlock code={'const a = 1\n'} language='javascript' />)
    expect(
      getByRole('textbox', { name: 'javascript' }).querySelector(
        '.cm-activeLine'
      )
    ).toBeNull()
  })
})
