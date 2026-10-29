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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Heading } from '@/design-system'

import { AuthLayout } from '../auth-layout'
import { SignUpForm } from './components/sign-up-form'

export function SignUp() {
  const { t } = useTranslation()

  return (
    <AuthLayout>
      <div className='w-full space-y-8'>
        <div className='space-y-2'>
          <Heading
            variant='page-title'
            level={1}
            className='text-center sm:text-left'
          >
            {t('Create an account')}
          </Heading>
          <p className='text-muted-foreground text-left text-sm'>
            {t('Already have an account?')}{' '}
            <Link to='/sign-in' className='hover:text-primary font-medium'>
              {t('Sign in')}
            </Link>
            .
          </p>
        </div>

        <SignUpForm />
      </div>
    </AuthLayout>
  )
}
