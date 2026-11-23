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
import type { ReactNode } from 'react'

import { SectionPageLayout } from '@/components/layout'

import type { UserProfile } from '../types'
import { ProfileHeader } from './profile-header'

interface PersonalPageLayoutProps {
  title: string
  profile: UserProfile | null
  loading: boolean
  children: ReactNode
}

export function PersonalPageLayout(props: PersonalPageLayoutProps) {
  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{props.title}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5'>
          <ProfileHeader profile={props.profile} loading={props.loading} />
          {props.children}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
