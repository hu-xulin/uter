/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public
License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  openPaymentRedirect,
  resolvePaymentRedirectUrl,
} from './payment-redirect'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('resolvePaymentRedirectUrl', () => {
  test('rejects non-http schemes', () => {
    expect(
      resolvePaymentRedirectUrl('javascript:alert(document.cookie)')
    ).toBeNull()
    expect(
      resolvePaymentRedirectUrl('data:text/html,<script>1</script>')
    ).toBeNull()
    expect(resolvePaymentRedirectUrl('file:///etc/passwd')).toBeNull()
  })

  test('rejects empty and non-string values', () => {
    expect(resolvePaymentRedirectUrl('')).toBeNull()
    expect(resolvePaymentRedirectUrl('   ')).toBeNull()
    expect(resolvePaymentRedirectUrl(undefined)).toBeNull()
    expect(resolvePaymentRedirectUrl(null)).toBeNull()
    expect(resolvePaymentRedirectUrl(42)).toBeNull()
  })

  test('rejects plain HTTP while the site itself is served over HTTPS', () => {
    vi.stubGlobal('window', { location: { protocol: 'https:' } })
    expect(resolvePaymentRedirectUrl('http://pay.example.com/x')).toBeNull()
  })

  test('accepts HTTPS for providers without a host allowlist', () => {
    expect(
      resolvePaymentRedirectUrl('https://pay.example.com/x', 'waffo')
    ).toBe('https://pay.example.com/x')
  })

  test('enforces the host allowlist for known providers', () => {
    expect(
      resolvePaymentRedirectUrl('https://checkout.stripe.com/c/pay', 'stripe')
    ).toBe('https://checkout.stripe.com/c/pay')
    expect(
      resolvePaymentRedirectUrl('https://evil.test/x', 'stripe')
    ).toBeNull()
    expect(
      resolvePaymentRedirectUrl('https://stripe.com.evil.test/x', 'stripe')
    ).toBeNull()
  })

  test('allows plain HTTP only when the app itself is on plain HTTP', () => {
    vi.stubGlobal('window', { location: { protocol: 'http:' } })
    expect(resolvePaymentRedirectUrl('http://pay.example.com/x')).toBe(
      'http://pay.example.com/x'
    )
  })
})

describe('openPaymentRedirect', () => {
  test('opens the validated URL with noopener and noreferrer', () => {
    const open = vi.fn().mockReturnValue({})
    vi.stubGlobal('open', open)

    expect(
      openPaymentRedirect('https://checkout.stripe.com/pay', 'stripe')
    ).toBe(true)
    expect(open).toHaveBeenCalledWith(
      'https://checkout.stripe.com/pay',
      '_blank',
      'noopener,noreferrer'
    )
  })

  test('reports failure instead of navigating when the URL is invalid', () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)

    expect(openPaymentRedirect('javascript:alert(1)')).toBe(false)
    expect(open).not.toHaveBeenCalled()
  })

  test('reports failure when the browser blocks the popup', () => {
    vi.stubGlobal('open', vi.fn().mockReturnValue(null))

    expect(
      openPaymentRedirect('https://checkout.stripe.com/pay', 'stripe')
    ).toBe(false)
  })
})
