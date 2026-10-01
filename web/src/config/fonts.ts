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

For commercial licensing, please contact support@Uter.ai.com
*/
/**
 * The single UI typeface shipped by the product: Inter for Latin letters
 * and digits, paired with 思源黑体 (Source Han Sans) for Chinese.
 *
 * The font switcher has been removed — `web/src/styles/theme.css` maps
 * `--font-inter` / `--font-sans` / `--font-manrope` all to one stack
 * (`--font-ui`), so every value here resolves to the same face. The array
 * is kept (rather than deleted) because `FontProvider` still reads a
 * `font` cookie and mirrors it onto `<html>` as `font-<name>`; listing
 * only `inter` makes a stale `manrope` / `system` cookie fall back to it,
 * so a user who once picked another font cannot end up on an OS face.
 *
 * Adding a face back is a two-step change: install + `@import` the
 * `@fontsource-variable/<name>` package in `styles/index.css`, then give
 * it its own `--font-<name>` token in `theme.css`.
 */
export const fonts = ['inter'] as const
