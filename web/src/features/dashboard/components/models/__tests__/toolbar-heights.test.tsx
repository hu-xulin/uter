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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

import type { DashboardChartPreferences } from '@/features/dashboard/types'
import { useAuthStore } from '@/stores/auth-store'

import { buildDefaultDashboardFilters } from '../../../lib'
import { ModelsChartPreferences } from '../models-chart-preferences'
import { ModelsFilter } from '../models-filter-dialog'

const preferences: DashboardChartPreferences = {
  consumptionDistributionChart: 'bar',
  modelAnalyticsChart: 'trend',
  defaultTimeRangeDays: 7,
  defaultTimeGranularity: 'day',
}

beforeEach(() => {
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'dashboard-user',
    role: 10,
    quota: 0,
    used_quota: 0,
    request_count: 0,
  })
})

it('keeps the preferences and filter buttons on the same control height', () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  render(
    <QueryClientProvider client={client}>
      <ModelsChartPreferences
        preferences={preferences}
        onPreferencesChange={vi.fn()}
      />
      <ModelsFilter
        preferences={preferences}
        currentFilters={buildDefaultDashboardFilters(preferences)}
        onFilterChange={vi.fn()}
        onReset={vi.fn()}
      />
    </QueryClientProvider>
  )

  for (const name of [/Preferences/, /Filter/]) {
    expect(screen.getByRole('button', { name })).toHaveClass(
      'h-(--ds-control-height-md)'
    )
  }
})