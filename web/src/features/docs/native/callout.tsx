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
import type { ReactNode } from 'react'

/**
 * Native docs callout — the SPA's replacement for fumadocs' `<Callout>`.
 *
 * Authored in MDX as `<Callout type="…">`; the MDX compiler resolves it
 * through `MDXProvider` (see the native docs view). Styled with the design
 * system's status tokens (`*-soft` surfaces) so it follows the app's
 * light/dark themes instead of the fumadocs `fd-*` palette.
 */
const TONES: Record<string, string> = {
  info: 'border-info/40 bg-info-soft',
  warn: 'border-warning/40 bg-warning-soft',
  warning: 'border-warning/40 bg-warning-soft',
  danger: 'border-destructive/40 bg-destructive-soft',
  success: 'border-success/40 bg-success-soft',
}

export function Callout({
  type = 'info',
  children,
}: {
  type?: string
  children?: ReactNode
}) {
  return (
    <div
      className={`my-4 rounded-lg border p-4 text-sm [&_ol]:my-1 [&_p]:my-1 [&_ul]:my-1 ${
        TONES[type] ?? TONES.info
      }`}
    >
      {children}
    </div>
  )
}
