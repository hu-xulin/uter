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
export function callbackAddressWarning(
  value?: string
): 'http' | 'private' | 'path' | 'invalid' | null {
  const raw = value?.trim()
  if (!raw) return null
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return 'invalid'
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'invalid'
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') return 'path'
  if (parsed.protocol === 'http:') return 'http'
  const host = parsed.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '::1' ||
    host === '[::1]' ||
    host.startsWith('127.') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return 'private'
  }
  return null
}

export function callbackAddressWarningText(
  warning: ReturnType<typeof callbackAddressWarning>
): string | null {
  switch (warning) {
    case 'http':
      return 'Payment providers call this URL from the internet over HTTPS. An HTTP origin will not receive callbacks.'
    case 'private':
      return 'This origin points to localhost or a private address. Alipay and WeChat servers cannot reach it; use the filed payment domain or a public tunnel.'
    case 'path':
      return 'Enter only the origin, without a path such as /api/user/alipay/notify.'
    case 'invalid':
      return 'Enter a valid absolute http(s) origin.'
    default:
      return null
  }
}
