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
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PersonalPageLayout } from '../components/personal-page-layout'
import type { UserProfile } from '../types'

const profile: UserProfile = {
  id: 53,
  username: 'uter',
  display_name: 'Uter',
  role: 1,
  group: 'default',
  quota: 110100,
  used_quota: 100,
  request_count: 1,
  status: 1,
  aff_count: 0,
  aff_quota: 0,
  aff_history_quota: 0,
  created_time: 0,
}

describe('PersonalPageLayout', () => {
  it('places the account identity and balance summary above page content', () => {
    render(
      <PersonalPageLayout title='兑换码' profile={profile} loading={false}>
        <div data-testid='page-content'>Content</div>
      </PersonalPageLayout>
    )

    expect(
      screen.getByRole('heading', { level: 2, name: '兑换码' })
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Uter' })
    ).toBeVisible()
    expect(screen.getByText(/U100000053/)).toBeVisible()
    expect(screen.getByText('default')).toBeVisible()
    expect(screen.getByText('Account Balance')).toBeVisible()
    expect(screen.getByText('Total Usage')).toBeVisible()
    expect(screen.getByText('API Requests')).toBeVisible()
    expect(screen.getByTestId('page-content')).toBeVisible()
  })
})
