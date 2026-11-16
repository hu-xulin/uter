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
 * Shared card shell for the docs' chapter indexes.
 *
 * The framed export's `ContentCardGrid` (retired with `docs-web`) drew a
 * two-column grid of "title + opening sentence" cards. Both the user guide
 * landing and the About landing still use that shape, so the shell lives
 * here rather than being restyled twice. §5 assigns cards `radius-lg`
 * (12px), and §15.1 fixes the focus ring at 2px.
 */
export const CONTENT_CARD_GRID_CLASS = 'mt-8 grid gap-3 sm:grid-cols-2'

export const CONTENT_CARD_CLASS =
  'focus-visible:ring-ring hover:bg-muted flex h-full flex-col rounded-xl border p-6 no-underline transition-colors outline-none focus-visible:ring-2'

export const CONTENT_CARD_TITLE_CLASS = 'text-xl text-fg-primary font-semibold'

export const CONTENT_CARD_TEASER_CLASS = 'text-md text-fg-secondary mt-2'
