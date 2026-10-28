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
import { Eye, EyeOff } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from './ui/button'
import { Input } from './ui/input'

type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> & {
  ref?: React.Ref<HTMLInputElement>
  /**
   * 等宽字形。密码 / 密钥 / Token 都是机器可读的值，默认开启（规范
   * `typography.md`「等宽（mono）的适用范围」）。
   */
  mono?: boolean
}

export function PasswordInput({
  className,
  disabled,
  ref,
  mono = true,
  ...props
}: PasswordInputProps) {
  const { t } = useTranslation()
  const [showPassword, setShowPassword] = React.useState(false)

  return (
    <div className='relative rounded-md'>
      <Input
        type={showPassword ? 'text' : 'password'}
        ref={ref}
        disabled={disabled}
        mono={mono}
        className={className}
        {...props}
      />
      <Button
        type='button'
        variant='ghost'
        size='icon-xs'
        disabled={disabled}
        className='text-muted-foreground absolute end-1 top-1/2 -translate-y-1/2 rounded-md'
        onClick={() => setShowPassword((prev) => !prev)}
        aria-label={t('Toggle password visibility')}
      >
        {showPassword ? (
          <Eye className='size-4.5' aria-hidden='true' />
        ) : (
          <EyeOff className='size-4.5' aria-hidden='true' />
        )}
      </Button>
    </div>
  )
}
