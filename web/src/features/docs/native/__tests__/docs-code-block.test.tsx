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

import { DocsCodeBlock } from '../docs-code-block'
import { PROSE_CLASSES } from '../prose-classes'

afterEach(() => {
  cleanup()
})

/** Reproduce the element tree MDX emits for a fenced code block. */
function mdxPre(language: string, code: string) {
  return (
    <DocsCodeBlock>
      <code className={`language-${language}`}>{code}</code>
    </DocsCodeBlock>
  )
}

describe('DocsCodeBlock (UDS 8.0.0 §24)', () => {
  test('renders an MDX fence as a read-only code block with its language label', () => {
    const { getByRole, getByText } = render(
      mdxPre('bash', 'curl -s "$BASE/models"\n')
    )

    expect(getByText('bash')).not.toBeNull()
    const block = getByRole('textbox', { name: 'bash' })
    expect(block.textContent).toContain('curl -s "$BASE/models"')
  })

  test('highlights shell comments through the shared syntax adapter', async () => {
    const { getByRole } = render(mdxPre('bash', '# 调用前\ncurl -s x\n'))

    const block = getByRole('textbox', { name: 'bash' })
    // Plain text emits no styled spans; the presence of classed spans proves
    // the StreamLanguage shell parser and the --ds-syntax-* adapter ran.
    await waitFor(() => {
      expect(
        block.querySelectorAll('.cm-content span[class]').length
      ).toBeGreaterThan(0)
    })
  })

  test('degrades an unsupported language to plain text without syntax spans', () => {
    const { getByRole } = render(mdxPre('http', 'GET /v1/models HTTP/1.1\n'))

    const block = getByRole('textbox', { name: 'http' })
    expect(block.querySelectorAll('.cm-content span[class]').length).toBe(0)
  })
})

describe('PROSE_CLASSES code and table tokens (UDS 8.0.0 §23 / §24)', () => {
  test('headings follow the 8.0 page-title / section ladder', () => {
    const classes = PROSE_CLASSES.split(' ')
    expect(classes).toContain('[&_h1]:text-4xl')
    expect(classes).toContain('[&_h2]:text-2xl')
    expect(classes).toContain('[&_h3]:text-lg')
    expect(classes).toContain('[&_h4]:text-base')
  })

  test('long-form body copy uses secondary text while headings stay primary', () => {
    const classes = PROSE_CLASSES.split(' ')
    expect(classes).toContain('text-(--ds-color-text-secondary)')
    expect(classes).toContain('[&_h2]:text-(--ds-color-text-primary)')
    expect(classes).toContain('[&_h1]:text-(--ds-color-text-primary)')
  })

  test('inline and block code take the code tokens, not the generic muted surface', () => {
    expect(PROSE_CLASSES).toContain('bg-(--ds-color-code-background)')
    expect(PROSE_CLASSES).toContain('bg-(--ds-color-code-codeblock-background)')
    expect(PROSE_CLASSES).toContain('text-(--ds-color-code-foreground)')
    expect(PROSE_CLASSES).not.toContain('[&_pre]:bg-muted')
    expect(PROSE_CLASSES).not.toContain('[&_code]:bg-muted')
  })

  test('table header and cells use the 14/22 body default with horizontal dividers only', () => {
    const classes = PROSE_CLASSES.split(' ')
    expect(classes).toContain('[&_th]:text-sm')
    expect(classes).toContain('[&_td]:text-sm')
    expect(classes).toContain('[&_thead]:bg-(--ds-color-surface-sunken)')
    expect(classes).toContain('[&_td]:border-b')
    expect(classes).not.toContain('[&_td]:border')
    expect(classes).not.toContain('[&_th]:border')
  })

  test('table first column is emphasised like Clerk row labels', () => {
    expect(PROSE_CLASSES).toContain('[&_tbody_td:first-child]:font-medium')
    expect(PROSE_CLASSES).toContain(
      '[&_tbody_td:first-child]:text-(--ds-color-text-primary)'
    )
    // 圆角外框由 DocsTable 负责，单元格层不再把 table 强制成滚动块。
    expect(PROSE_CLASSES.split(' ')).not.toContain('[&_table]:block')
    expect(PROSE_CLASSES).toContain('[&_tbody_tr:last-child>*]:border-b-0')
  })
})
