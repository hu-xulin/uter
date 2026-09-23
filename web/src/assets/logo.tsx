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
import { type SVGProps } from 'react'

import { cn } from '@/lib/utils'

export function Logo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      id='Uter-logo'
      viewBox='0 0 24 24'
      xmlns='http://www.w3.org/2000/svg'
      height='24'
      width='24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={cn('size-6', className)}
      {...props}
    >
      <title>Uter</title>
      <path
        d='M86.6484 106.996C92.2349 106.996 97.621 106.092 102.683 104.416L128.088 86.214C134.332 78.1151 138.467 68.1499 139.616 57.2394C140.54 48.4565 148.07 42.1232 156.434 43.0936C164.799 44.0639 170.831 51.9705 169.906 60.7534C167.581 82.8481 157.478 102.478 142.534 116.55L116.425 133.275C107.174 136.971 97.1368 138.995 86.6484 138.995C53.7309 138.995 25.2809 119.049 11.594 90.1136C7.85047 82.1992 10.9258 72.5974 18.4628 68.6669C25.9999 64.7363 35.1446 67.9653 38.8881 75.8796C47.6291 94.3579 65.7504 106.996 86.6484 106.996Z'
        fill='#FA9D3B'
      />
      <path
        d='M86.1878 18C91.9596 18 97.2353 21.424 99.8172 26.8443L153.149 138.842C156.912 146.746 153.861 156.355 146.334 160.307C138.807 164.259 129.654 161.056 125.89 153.152L86.1878 69.7758L69.8206 104.147C59.7699 100.637 51.0418 94.0645 44.643 85.4679L72.5589 26.8443C75.1402 21.424 80.416 18 86.1878 18Z'
        fill='#D90429'
      />
      <path
        d='M46.4851 153.152C42.7215 161.056 33.5687 164.259 26.0416 160.307C18.5145 156.355 15.4636 146.745 19.2271 138.842L30.1303 115.945C37.653 123.173 46.4383 128.981 56.1008 132.959L46.4851 153.152Z'
        fill='#D90429'
      />
    </svg>
  )
}
