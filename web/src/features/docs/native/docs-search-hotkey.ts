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
 * The native docs search hotkey, declared once.
 *
 * Three consumers have to agree on the combination: the keydown handler
 * in `DocsSearchDialog`, `aria-keyshortcuts` on the sidebar button, and
 * the `<kbd>` glyphs a sighted keyboard user reads. Deriving all three
 * from this module is what keeps the hint honest.
 *
 * `Meta` *or* `Ctrl` is accepted so the same combo works on macOS and on
 * Windows/Linux, including tablets with an external keyboard. This is
 * also why `aria-keyshortcuts` lists both spellings.
 *
 * The global app command palette uses the same shortcut, but its
 * `SearchProvider` is mounted only inside `AuthenticatedLayout`; public
 * docs pages use `PublicLayout`, so the two never compete.
 */

/** Token list for `aria-keyshortcuts`, per the ARIA spec. */
export const DOCS_SEARCH_HOTKEY_ARIA = 'Meta+K Control+K'

/** Glyphs painted into the sidebar button, modifier first. */
export const DOCS_SEARCH_HOTKEY_DISPLAY: readonly string[] = ['⌘/Ctrl', 'K']

/** True when the event is the docs search shortcut. */
export function isDocsSearchHotkey(event: KeyboardEvent): boolean {
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === 'k'
  )
}
