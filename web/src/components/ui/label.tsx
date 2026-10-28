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
'use client'

import * as React from 'react'

import {
  formLabelTierClassName,
  useFormLabelTier,
  type FormLabelTier,
} from '@/components/ui/form-label-tier'
import { cn } from '@/lib/utils'

function Label({
  className,
  children,
  required = false,
  tier,
  ...others
}: React.ComponentProps<'label'> & {
  required?: boolean
  tier?: FormLabelTier
}) {
  const activeTier = useFormLabelTier(tier)

  return (
    <label
      data-slot='label'
      data-tier={activeTier}
      className={cn(
        'flex items-center gap-2 text-sm font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        // 档位类放在基础类之后：twMerge 会让后写的同名工具类胜出，
        // 因此 `field` 档的 text-base / font-semibold 能覆盖上面的 text-sm。
        formLabelTierClassName(activeTier),
        className
      )}
      {...others}
    >
      {required ? (
        <span>
          {children}{' '}
          <span data-slot='required-indicator' className='text-destructive'>
            *
          </span>
        </span>
      ) : (
        children
      )}
    </label>
  )
}

export { Label }
