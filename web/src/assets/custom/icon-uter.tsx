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
import type { SVGProps } from 'react'

import { UterLogoPaths } from '@/assets/logo'

type IconUterProps = SVGProps<SVGSVGElement> & {
  size?: number
}

/**
 * The Uter brand mark as a size-aware icon.
 *
 * `Logo` is hard-wired to `size-6` for the page headers; this variant honours
 * the requested `size` so it can stand in for a provider glyph inside 16–20px
 * table cells and filter chips. Both render the exact same paths from
 * `UterLogoPaths`, so the two can never drift apart.
 */
export function IconUter({ size = 20, ...props }: IconUterProps) {
  return (
    <svg
      viewBox='0 0 200 200'
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      aria-hidden='true'
      {...props}
    >
      <title>Uter</title>
      <UterLogoPaths />
    </svg>
  )
}
