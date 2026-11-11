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
 * Whether the public header should render its solid (scrolled) variant.
 *
 * At the top of a page the header is transparent so the shared top-of-page
 * brand glow (rendered once by the `_public` layout route) bleeds through
 * behind it — matching the pricing page. Once the reader scrolls, the header
 * gains its solid, blurred background. This holds for every public page,
 * including the framed docs/about pages: their iframe owns the scrolling, so
 * the host never scrolls and the header simply stays in its transparent,
 * glow-bearing state.
 */
export function shouldUseSolidHeader(
  _pathname: string,
  scrolled: boolean
): boolean {
  return scrolled
}
