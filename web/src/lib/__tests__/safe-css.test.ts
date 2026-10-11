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

import { describe, test } from 'vitest'

import { sanitizeInlineStyle, sanitizeStyleSheet } from '../safe-css'

describe('sanitizeInlineStyle', () => {
  test('keeps ordinary layout and typography declarations', () => {
    assert.equal(
      sanitizeInlineStyle(
        'color: #333; font-size: 14px; margin-top: 8px; text-align: center'
      ),
      'color: #333; font-size: 14px; margin-top: 8px; text-align: center'
    )
  })

  test('keeps theme variables on non-resource properties', () => {
    // The product theme is driven by CSS variables; blocking var() outright
    // would visibly break admin-authored pages.
    const result = sanitizeInlineStyle('color: var(--primary); gap: var(--gap)')

    assert.equal(result.includes('var(--primary)'), true)
    assert.equal(result.includes('var(--gap)'), true)
  })

  test('drops url() so a background cannot beacon out', () => {
    for (const value of [
      'background-image: url(//evil.com/track.png)',
      'background-image: url("https://evil.com/track.png")',
      'background: url(https://evil.com/a.css)',
      'background-image: URL(//evil.com/track.png)',
    ]) {
      assert.equal(sanitizeInlineStyle(value), '', value)
    }
  })

  test('drops the escape-encoded spelling of url()', () => {
    // \75 rl( decodes to url(
    assert.equal(sanitizeInlineStyle('background-image: \\75 rl(//evil.com)'), '')
  })

  test('rejects @import, expression and script URLs', () => {
    for (const value of [
      'width: expression(alert(1))',
      'background-image: javascript:alert(1)',
      'behavior: url(#default#time2)',
      'width: -moz-binding: url(//evil.com/x.xml)',
    ]) {
      assert.equal(sanitizeInlineStyle(value), '', value)
    }

    // A valid declaration alongside an @import survives; only the import goes.
    const mixed = sanitizeInlineStyle('color: red; @import url(//evil.com/a.css)')
    assert.equal(mixed, 'color: red')
    assert.equal(mixed.includes('@import'), false)
  })

  test('does not launder a URL through var() on a resource property', () => {
    assert.equal(sanitizeInlineStyle('background-image: var(--evil)'), '')
  })

  test('drops attr(), which can read attribute values', () => {
    assert.equal(sanitizeInlineStyle('width: attr(data-x)'), '')
  })

  test('drops properties that are not on the allowlist', () => {
    assert.equal(sanitizeInlineStyle('-moz-binding: none'), '')
    assert.equal(sanitizeInlineStyle('offset-path: path("x")'), '')
  })

  test('one bad declaration does not take the rest of the rule with it', () => {
    const result = sanitizeInlineStyle(
      'display: flex; background-image: url(//evil.com/x.png); gap: 12px'
    )

    assert.equal(result, 'display: flex; gap: 12px')
  })

  test('strips comments used to hide a payload', () => {
    assert.equal(sanitizeInlineStyle('color: red/*; background: url(//e.com)'), 'color: red')
  })
})

describe('sanitizeStyleSheet', () => {
  test('keeps selectors and plain rules', () => {
    // Declaration whitespace is normalised; selectors and values are preserved.
    assert.equal(
      sanitizeStyleSheet('.card { color: #111; padding: 12px; }'),
      '.card {color: #111; padding: 12px}'
    )
  })

  test('removes @import so no remote stylesheet is fetched', () => {
    const result = sanitizeStyleSheet(
      '@import url("//evil.com/a.css"); .a { color: red; }'
    )

    assert.equal(result.includes('@import'), false)
    assert.equal(result.includes('evil.com'), false)
    assert.equal(result.includes('color: red'), true)
  })

  test('removes url() inside a rule but keeps the rest of the rule', () => {
    const result = sanitizeStyleSheet(
      '.a { background-image: url(//evil.com/t.png); color: red; }'
    )

    assert.equal(result.includes('evil.com'), false)
    assert.equal(result.includes('color: red'), true)
  })

  test('filters rules nested inside @media', () => {
    const result = sanitizeStyleSheet(
      '@media (min-width: 768px) { .a { background: url(//evil.com/x.png); color: blue; } }'
    )

    assert.equal(result.includes('evil.com'), false)
    assert.equal(result.includes('color: blue'), true)
  })

  test('removes @charset', () => {
    assert.equal(sanitizeStyleSheet('@charset "utf-8"; .a { color: red; }').includes('@charset'), false)
  })

  test('filters a block the author left unclosed', () => {
    // A browser auto-closes a block at end of input, so an unterminated rule is
    // still a live rule and its url() would still be fetched.
    const result = sanitizeStyleSheet('.a { background: url(//evil.com/x.png)')

    assert.equal(/url\s*\(/i.test(result), false)
    assert.equal(result.includes('evil.com'), false)
  })

  test('filters a url() that sits outside any block', () => {
    const result = sanitizeStyleSheet('background: url(//evil.com/x.png)')

    assert.equal(/url\s*\(/i.test(result), false)
    assert.equal(result.includes('evil.com'), false)
  })

  test('never returns a stylesheet that still contains a fetch pattern', () => {
    for (const css of [
      '.a { background: url(//evil.com/x.png)',
      '.a { background: \\75 rl(//evil.com/x.png) }',
      'background: url(//evil.com/x.png)',
      '@media screen { .a { background: url(//evil.com/x.png) } }',
      '.a { background: url(//evil.com/x.png) }',
      '.a { background: url(//evil.com/x.png)',
    ]) {
      const result = sanitizeStyleSheet(css)

      assert.equal(/url\s*\(/i.test(result), false, css)
      assert.equal(result.includes('evil.com'), false, css)
    }
  })

  test('leaves a legitimate stylesheet intact', () => {
    assert.equal(sanitizeStyleSheet('.a { color: red }'), '.a {color: red}')
  })
})