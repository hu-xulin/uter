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
 * MDX table → Clerk-style rounded frame.
 *
 * The compiler emits a bare `<table>`, so the frame cannot be drawn by the
 * prose descendant selectors alone: a rounded, 1px-bordered container has to
 * wrap it. The outer box owns the radius and clips the sunken header band; the
 * inner scroller keeps wide tables reachable without squaring off the corners.
 * Cell typography and dividers stay in `PROSE_CLASSES` (§23: 12/13px, horizontal
 * dividers only).
 */
export function DocsTable({ children }: { children?: ReactNode }) {
  return (
    <div className='my-6 overflow-hidden rounded-xl border border-(--ds-color-border-table)'>
      <div className='overflow-x-auto'>
        <table className='w-full border-collapse text-left'>{children}</table>
      </div>
    </div>
  )
}
