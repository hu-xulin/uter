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
 * GFM task lists (`- [x] 说明`) are rendered by remark-gfm / marked as a
 * disabled `<input type="checkbox">` with no accessible name. axe reports this
 * as a critical `label` violation on every docs page containing a checklist.
 *
 * The checkbox is a read-only visual marker, so the surrounding list item's
 * own text is the correct accessible name: it is already translated with the
 * document and describes exactly what the marker refers to. Real form controls
 * keep their own label and are never touched.
 */
function hasAccessibleName(input: HTMLInputElement): boolean {
  if (input.getAttribute('aria-label')?.trim()) return true
  if (input.getAttribute('aria-labelledby')?.trim()) return true
  if (input.getAttribute('title')?.trim()) return true
  return (input.labels?.length ?? 0) > 0
}

/**
 * Add accessible names to unlabeled task-list checkboxes under `root`.
 * Returns how many checkboxes were labeled. Safe to call repeatedly.
 */
export function labelTaskListCheckboxes(root: ParentNode): number {
  if (typeof root.querySelectorAll !== 'function') return 0
  let labeled = 0
  root
    .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    .forEach((input) => {
      if (hasAccessibleName(input)) return
      const item = input.closest('li')
      if (!item) return
      const text = item.textContent?.replaceAll(/\s+/g, ' ').trim()
      if (!text) return
      input.setAttribute('aria-label', text)
      labeled += 1
    })
  return labeled
}
