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

/**
 * Paths whose content lives in a same-origin iframe. The frame owns its own
 * scrolling, so the host document never scrolls and `useScrolled()` stays
 * false forever — without this the shared public header would remain fully
 * transparent on those pages while pricing/rankings gain their solid,
 * blurred treatment as soon as they scroll.
 */
const FRAMED_PAGE_PREFIXES = ['/docs', '/about'] as const

/** Whether the public header should render its solid (scrolled) variant. */
export function shouldUseSolidHeader(
  pathname: string,
  scrolled: boolean
): boolean {
  if (scrolled) return true
  return FRAMED_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}
