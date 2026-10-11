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

import { getSafeHttpUrl, isHttpUrl } from '../content-format'

describe('getSafeHttpUrl', () => {
  test('passes through http and https URLs', () => {
    assert.equal(
      getSafeHttpUrl('https://github.com/uter-ai/uter/releases/tag/v1.0.0'),
      'https://github.com/uter-ai/uter/releases/tag/v1.0.0'
    )
    assert.equal(
      getSafeHttpUrl('http://example.com/a'),
      'http://example.com/a'
    )
  })

  test('rejects executable and non-web schemes', () => {
    for (const value of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      '  javascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'blob:https://example.com/uuid',
      'ftp://example.com/x',
    ]) {
      assert.equal(getSafeHttpUrl(value), undefined, value)
    }
  })

  test('rejects empty and unparseable values', () => {
    for (const value of [
      undefined,
      null,
      '',
      '   ',
      'not a url',
      '/relative/path',
      '//protocol-relative.example.com/x',
    ]) {
      assert.equal(getSafeHttpUrl(value), undefined, String(value))
    }
  })

  test('cannot be fooled by an embedded newline before the scheme', () => {
    // Browsers strip control characters when parsing a URL, so a value that
    // looks rejected here must not smuggle a javascript: scheme through.
    assert.equal(getSafeHttpUrl('java\nscript:alert(1)'), undefined)
    assert.equal(getSafeHttpUrl('java\tscript:alert(1)'), undefined)
  })

  test('agrees with isHttpUrl on what counts as a web URL', () => {
    for (const value of ['https://a.example', 'javascript:alert(1)', 'nope']) {
      assert.equal(isHttpUrl(value), getSafeHttpUrl(value) !== undefined, value)
    }
  })
})