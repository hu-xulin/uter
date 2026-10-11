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
import assert from 'node:assert/strict'

import { render } from '@testing-library/react'
import * as katex from 'katex'
import { describe, test } from 'vitest'

import { Markdown } from '../markdown'

function renderMarkdown(markdown: string, baseUrl?: string): string {
  const { container } = render(
    <Markdown baseUrl={baseUrl}>{markdown}</Markdown>
  )
  return container.innerHTML
}

describe('markdown MathML sanitization', () => {
  test('never emits semantics or annotation, which DOMPurify blacklists', () => {
    // KaTeX does produce both tags under `output: 'htmlAndMathml'`. They are
    // an HTML integration point, so allowing them re-opens mXSS namespace
    // confusion. This test fails if anyone re-adds them to ADD_TAGS.
    const formula = renderMarkdown('$$\\frac{a}{b}$$')

    assert.equal(formula.includes('<semantics'), false)
    assert.equal(formula.includes('<annotation'), false)
  })

  test('keeps the rendered formula visible after MathML tags are dropped', () => {
    const formula = renderMarkdown('$$\\frac{a}{b}$$')

    // The MathML branch is clipped to 1px by katex.min.css; the visible glyphs
    // all live in the sibling .katex-html branch, which must survive intact.
    assert.equal(formula.includes('katex-html'), true)
    assert.equal(formula.includes('mfrac'), true)
    assert.equal(formula.includes('class="mord mathnormal"'), true)
  })

  test('renders every KaTeX construct the docs advertise', () => {
    for (const source of [
      '\\frac{a}{b}',
      '\\begin{aligned} a &= b \\\\ c &= d \\end{aligned}',
      '\\href{https://example.com}{link}',
      '\\sqrt{x^2 + y^2}',
      '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}',
    ]) {
      const rendered = renderMarkdown(`$$${source}$$`)

      assert.equal(rendered.includes('katex-html'), true, source)
      assert.equal(rendered.includes('<semantics'), false, source)
    }
  })

  test('drops mXSS payloads that rely on the MathML integration point', () => {
    const payloads = [
      '<math><semantics><annotation-xml encoding="text/html"><img src=x onerror="alert(1)"></annotation-xml></semantics></math>',
      '<math><semantics><annotation encoding="text/html"><img src=x onerror=alert(1)></annotation></semantics></math>',
      '<math><semantics><svg><style><img src=x onerror=alert(1)></style></svg></semantics></math>',
    ]

    for (const payload of payloads) {
      const rendered = renderMarkdown(payload)

      assert.equal(rendered.includes('onerror'), false, payload)
      assert.equal(rendered.toLowerCase().includes('alert(1)'), false, payload)
      assert.equal(rendered.includes('annotation'), false, payload)
    }
  })

  test('still renders KaTeX MathML markup produced by our own renderer', () => {
    const katexHtml = katex.renderToString('\\frac{a}{b}', {
      displayMode: true,
      output: 'htmlAndMathml',
      throwOnError: false,
    })
    const rendered = renderMarkdown(katexHtml)

    assert.equal(rendered.includes('onerror'), false)
    // MathML presentation elements other than the blacklisted pair stay.
    assert.equal(rendered.includes('<mfrac>'), true)
  })
})