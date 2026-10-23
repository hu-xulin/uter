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

import { cn } from '@/lib/utils'

/**
 * The Uter brand mark, inline so it inherits the surrounding layout box.
 *
 * Geometry, colours and ordering are transcribed verbatim from the approved
 * `uter.svg` master; keep the two in step when the mark is revised. The raster
 * and BIMI copies live in `web/public/logo.png` and `web/public/uter-bimi.svg`.
 */
/**
 * The Uter brand mark geometry, shared by every rendering of the logo so the
 * header, the sidebar and the channel-type icons can never drift apart.
 *
 * Geometry, colours and ordering are transcribed verbatim from the approved
 * `uter.svg` master; keep the two in step when the mark is revised. The raster
 * and BIMI copies live in `web/public/logo.png` and `web/public/uter-bimi.svg`.
 */
export function UterLogoPaths() {
  return (
    <>
      <path
        d='M37.6407 53.4241C37.6895 60.3393 39.4297 66.9403 42.5547 72.9889C50.3223 88.0249 66.6465 99.6475 86.8106 104.1732C80.834 105.516 74.5215 106.2347 67.9922 106.2347C57.084 106.2347 46.7735 104.2282 37.6387 100.6607C15.3223 91.9494 0 73.9319 0 53.1174L0 14.7018C0 11.2839 1.5137 8.1284 4.0449 5.6244L4.0449 5.6229C7.4981 2.2049 12.8457 0 18.8184 0C23.9922 0 28.6992 1.6541 32.1114 4.3198C33.0774 5.0739 33.9367 5.9073 34.6739 6.8054C36.5489 9.0897 37.6387 11.8027 37.6387 14.7034L37.6387 53.1174C37.6387 53.2196 37.6387 53.3218 37.6407 53.4241Z'
        fill='#FFD166'
        transform='translate(32.3867 71.8864)'
      />
      <path
        d='M95.7051 14.7018C97.4238 10.0327 98.3437 5.101 98.3437 0L98.3437 29.4037C98.3437 50.2182 83.0215 68.2358 60.7051 76.9486C57.0066 78.3936 53.1449 79.5691 49.1699 80.4596C29.0059 75.9338 12.6816 64.3112 4.9141 49.2752C1.7891 43.2266 0.0469 36.6257 0 29.7104C0.209 42.5629 13.5078 52.9511 29.957 53.1143C30.0879 53.1158 30.2187 53.1158 30.3496 53.1158C30.4805 53.1158 30.6113 53.1158 30.7422 53.1143C41.5059 53.067 51.6758 51.0651 60.7031 47.5418C77.5547 40.9668 90.414 29.0848 95.7051 14.7018Z'
        fill='#F77F00'
        transform='translate(70.0254 95.6001)'
      />
      <path
        d='M62.0703 4.3198C62.5957 4.7302 63.0879 5.1636 63.5488 5.6198C66.082 8.1238 67.5976 11.2823 67.5976 14.7034L67.5976 23.7152C67.5976 28.8162 66.6777 33.7494 64.959 38.417C59.668 52.8015 46.8066 64.682 29.9609 71.2601C20.9355 74.7833 10.7656 76.7837 0 76.8326C16.582 76.6678 29.9609 66.1163 29.9609 53.1204L29.9609 14.7034C29.9609 11.8027 31.0508 9.0912 32.9277 6.8069C35.5937 3.5553 39.8555 1.1673 44.832 0.3281C46.1074 0.1144 47.4277 0 48.7812 0C53.1602 0 57.1992 1.1841 60.4082 3.1631C60.9883 3.5233 61.543 3.9078 62.0703 4.3198Z'
        fill='#D90429'
        transform='translate(100.773 71.8849)'
      />
      <circle
        cx='19.5312'
        cy='19.5312'
        r='19.5312'
        fill='#D90429'
        transform='translate(129.285 21.8788)'
      />
      <circle
        cx='19.5312'
        cy='19.5312'
        r='19.5312'
        fill='#FFD166'
        transform='translate(31.6289 21.8788)'
      />
    </>
  )
}

export function Logo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      id='Uter-logo'
      viewBox='0 0 200 200'
      xmlns='http://www.w3.org/2000/svg'
      height='24'
      width='24'
      className={cn('size-6', className)}
      {...props}
    >
      <title>Uter</title>
      <UterLogoPaths />
    </svg>
  )
}
