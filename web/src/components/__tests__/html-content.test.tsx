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
import { beforeEach, describe, test, vi } from 'vitest'

import { HtmlContent } from '../html-content'

// The component attaches the shadow root itself, so the only way a test can
// inspect the sanitized output is to capture the root that attachShadow
// returns. That also proves the root exists without going through
// `host.shadowRoot`, which is exactly what `mode: 'closed'` takes away.
//
// Roots are recorded in an array rather than read from `mock.results` because
// the suite clears mocks between tests.
const attachedRoots: ShadowRoot[] = []
const nativeAttachShadow = Element.prototype.attachShadow

beforeEach(() => {
  attachedRoots.length = 0
  vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (
    this: Element,
    init: ShadowRootInit
  ) {
    const root = nativeAttachShadow.call(this, init)
    attachedRoots.push(root)
    return root
  })
})

function lastShadowRoot(): ShadowRoot {
  const root = attachedRoots.at(-1)

  assert.ok(root, 'expected the component to attach a shadow root')
  return root
}

/**
 * The component injects base styles and a wrapper div before the sanitized
 * content, so assertions target the last div, which is the admin-authored one.
 */
function contentDiv(root: ShadowRoot): HTMLDivElement {
  const divs = root.querySelectorAll('div')
  const div = divs.item(divs.length - 1)

  assert.ok(div, 'expected the sanitized content to contain a div')
  return div as HTMLDivElement
}

describe('HtmlContent isolated variant', () => {
  test('strips @import from an admin-authored stylesheet', () => {
    render(
      <HtmlContent
        content='<style>@import url("//evil.com/a.css"); .a { color: red; }</style>'
        variant='isolated'
      />
    )
    const html = lastShadowRoot().innerHTML

    assert.equal(html.includes('@import'), false)
    assert.equal(html.includes('evil.com'), false)
    assert.equal(html.includes('color: red'), true)
  })

  test('strips url() from a style attribute but keeps other declarations', () => {
    render(
      <HtmlContent
        content='<div style="background-image: url(//evil.com/track.png); color: red">x</div>'
        variant='isolated'
      />
    )
    const div = contentDiv(lastShadowRoot())

    assert.equal(div.getAttribute('style'), 'color: red')
  })

  test('drops a style attribute entirely when nothing survives', () => {
    render(
      <HtmlContent
        content='<div style="background: url(//evil.com/track.png)">x</div>'
        variant='isolated'
      />
    )
    const div = contentDiv(lastShadowRoot())

    assert.equal(div.hasAttribute('style'), false)
  })

  test('keeps ordinary inline styling so layouts still render', () => {
    render(
      <HtmlContent
        content='<div style="display: flex; gap: 12px; color: #333">x</div>'
        variant='isolated'
      />
    )
    const div = contentDiv(lastShadowRoot())

    assert.equal(
      div.getAttribute('style'),
      'display: flex; gap: 12px; color: #333'
    )
  })

  test('still blocks scripts and event handlers', () => {
    render(
      <HtmlContent
        content='<script>alert(1)<\/script><img src=x onerror="alert(1)">'
        variant='isolated'
      />
    )
    const html = lastShadowRoot().innerHTML

    assert.equal(html.includes('onerror'), false)
    assert.equal(html.includes('<script'), false)
  })

  test('still sandboxes iframes and drops srcdoc', () => {
    render(
      <HtmlContent
        content='<iframe src="https://example.com" srcdoc="<script>alert(1)<\/script>"></iframe>'
        variant='isolated'
      />
    )
    const frame = lastShadowRoot().querySelector('iframe')

    assert.equal(frame?.hasAttribute('srcdoc'), false)
    assert.match(frame?.getAttribute('sandbox') ?? '', /allow-forms/)
  })

  test('uses a closed shadow root so page scripts cannot reach the content', () => {
    const { container } = render(
      <HtmlContent content='<p>x</p>' variant='isolated' />
    )
    const host = container.firstElementChild as HTMLElement

    // A closed root is not exposed on the host element.
    assert.equal(host.shadowRoot, null)
  })

  test('reuses the same shadow root when content changes', () => {
    const { rerender } = render(
      <HtmlContent content='<p>first</p>' variant='isolated' />
    )
    const rootsAfterMount = attachedRoots.length

    // attachShadow throws if called twice on the same element, so re-running
    // the effect with new content must not call it again.
    rerender(<HtmlContent content='<p>second</p>' variant='isolated' />)

    assert.equal(attachedRoots.length, rootsAfterMount)
    assert.equal(contentDiv(lastShadowRoot()).textContent, 'second')
  })
})