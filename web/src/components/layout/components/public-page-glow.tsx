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
 * Top-of-page brand glow shared by the public marketing pages.
 *
 * The hue is derived from `--primary` (not a hard-coded oklch literal) so a
 * theme preset switch carries through. Decorative only: `aria-hidden` and
 * `pointer-events-none` keep it out of the accessibility tree and out of the
 * way of the content layered above it.
 */
export function PublicPageGlow() {
  return (
    <div
      data-public-page-glow=''
      aria-hidden
      className='pointer-events-none absolute inset-x-0 top-0 h-[600px] opacity-20 dark:opacity-10'
      style={{
        background: [
          'radial-gradient(ellipse 60% 50% at 20% 20%, color-mix(in oklch, var(--primary) 80%, transparent) 0%, transparent 70%)',
          'radial-gradient(ellipse 50% 40% at 80% 15%, color-mix(in oklch, var(--primary) 55%, transparent) 0%, transparent 70%)',
          'radial-gradient(ellipse 40% 35% at 50% 70%, color-mix(in oklch, var(--primary) 35%, transparent) 0%, transparent 70%)',
        ].join(', '),
        maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to bottom, black 40%, transparent 100%)',
      }}
    />
  )
}
