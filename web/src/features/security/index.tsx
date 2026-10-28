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
import { Link2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout/components/section-page-layout'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import { Heading } from '@/design-system'
import { useProfile } from '@/features/profile/hooks/use-profile'

import { AccessTokensCard } from './components/access-tokens-card'
import { AccountActionCard } from './components/account-action-card'
import { AccountBindings } from './components/account-bindings'
import { LoginSessionsCard } from './components/login-sessions-card'
import { PasskeyCard } from './components/passkey-card'
import { PrivacyCard } from './components/privacy-card'
import { TwoFACard } from './components/two-fa-card'

export function Security() {
  const { t } = useTranslation()
  const { profile, loading, refreshProfile, fetchProfile } = useProfile()

  let content: ReactNode
  if (loading) {
    content = (
      <div role='status' aria-label={t('Loading...')} className='space-y-4'>
        <Skeleton className='h-28 w-full' />
        <Skeleton className='h-52 w-full' />
        <Skeleton className='h-52 w-full' />
      </div>
    )
  } else if (!profile) {
    content = (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{t('Failed to load profile')}</EmptyTitle>
          <EmptyDescription>
            {t('Refresh the list and try again.')}
          </EmptyDescription>
        </EmptyHeader>
        <Button
          type='button'
          variant='outline'
          onClick={() => void fetchProfile()}
        >
          {t('Retry')}
        </Button>
      </Empty>
    )
  } else {
    content = (
      <div className='grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.46fr)] xl:items-start'>
        <div className='min-w-0 space-y-4 sm:space-y-6'>
          <section
            aria-labelledby='security-authentication'
            className='space-y-3'
          >
            <Heading
              variant='section-title'
              level={2}
              id='security-authentication'
            >
              {t('Login & Authentication')}
            </Heading>
            <AccountActionCard
              action='password'
              username={profile.username}
              hasPassword={profile.has_password}
              onUpdate={refreshProfile}
            />
            <TitledCard
              title={t('Account Bindings')}
              icon={<Link2 className='size-4' />}
              headerClassName='px-3 py-2.5 !pb-2.5 sm:px-4 sm:py-2.5 sm:!pb-2.5'
              contentClassName='p-3 sm:p-3'
              disableHoverEffect
            >
              <AccountBindings profile={profile} onUpdate={refreshProfile} />
            </TitledCard>
          </section>
          <section aria-labelledby='security-access' className='space-y-4'>
            <Heading variant='section-title' level={2} id='security-access'>
              {t('Sessions & Access')}
            </Heading>
            <LoginSessionsCard />
            <AccessTokensCard />
          </section>
          <section aria-labelledby='security-account' className='space-y-4'>
            <Heading variant='section-title' level={2} id='security-account'>
              {t('Account Actions')}
            </Heading>
            <AccountActionCard action='delete' username={profile.username} />
          </section>
        </div>
        <aside
          aria-labelledby='security-verification'
          className='min-w-0 space-y-4 sm:space-y-6 xl:sticky xl:top-0'
        >
          <div className='space-y-3'>
            <Heading
              variant='section-title'
              level={2}
              id='security-verification'
            >
              {t('Security verification')}
            </Heading>
            <PasskeyCard loading={loading} />
            <TwoFACard loading={loading} />
          </div>
          <section aria-labelledby='security-privacy' className='space-y-4'>
            <Heading variant='section-title' level={2} id='security-privacy'>
              {t('Privacy')}
            </Heading>
            <PrivacyCard profile={profile} onUpdate={refreshProfile} />
          </section>
        </aside>
      </div>
    )
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Security & Access')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto w-full max-w-7xl'>{content}</div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
