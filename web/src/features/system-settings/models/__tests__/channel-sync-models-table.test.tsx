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
import { expect, it, vi } from 'vitest'

import { ChannelSyncModelsTable } from '../channel-sync-models-table'

// `vi.mock` is hoisted above the module scope, so the fixture has to live
// inside the factory rather than in a top-level const.
vi.mock('../../api', () => {
  const priceLine = (input: number) => ({
    input,
    output: input * 5,
    cache: 0,
    create_cache: 0,
  })
  return {
    getDreamRouterSyncModels: vi.fn(async () => ({
      data: {
        models: [
          {
            upstream_name: 'claude-sonnet',
            local_name: 'claude-sonnet',
            billing_class: 'per_token',
            quota_type: 0,
            group_ratio: 1,
            official: priceLine(3),
            upstream: priceLine(1.8),
            uter: priceLine(2.1),
            upstream_discount_percent: 40,
            uter_discount_percent: 30,
            // The API sends 折数 (0.6 ratio → 6), not the ratio itself.
            upstream_zhe: 6,
            uter_zhe: 7,
            aligned: false,
          },
          {
            // 上游 5% 折扣（9.5 折）+ 加价 1 折 → Uter 比原价贵 5%，
            // 折扣列必须写成 x1.05 而不是 10.5 折。
            upstream_name: 'MiniMax-M2.5',
            local_name: 'MiniMax-M2.5',
            billing_class: 'per_token',
            quota_type: 0,
            group_ratio: 0.95,
            official: priceLine(0.3),
            upstream: priceLine(0.285),
            uter: priceLine(0.315),
            upstream_discount_percent: 5,
            uter_discount_percent: 0,
            upstream_zhe: 9.5,
            uter_zhe: 10.5,
            aligned: true,
          },
        ],
        summary: {},
      },
    })),
    runDreamRouterSync: vi.fn(),
  }
})

/**
 * 「折扣」列过去把折率写成「6折」，和定价页角标、上游 list price 的 `x`
 * 写法对不上，运营要自己换算。现在统一成倍率：0.6 折率 → `x0.6`。
 */
it('writes the discount as a multiplier, not as 折', async () => {
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <ChannelSyncModelsTable />
    </QueryClientProvider>
  )

  // 表头两处（上游 / Uter）都叫「折扣」；无 i18n provider 时渲染的是 key。
  expect(await screen.findByText('x0.6')).toBeVisible()
  expect(screen.getByText('x0.7')).toBeVisible()
  expect(screen.getAllByText('Discount multiplier')).toHaveLength(2)
  // 折数写法（6折 / 7.5折）必须彻底消失，只允许 x 倍率。
  expect(screen.queryByText(/^\d+(\.\d+)?\s*折$/)).toBeNull()
})

/** Uter 价高于上游原价时，折扣列显示 x1.05，并用琥珀色标出加价。 */
it('marks a price above the list price as x1.05 in the warning color', async () => {
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <ChannelSyncModelsTable />
    </QueryClientProvider>
  )

  const markup = await screen.findByText('x1.05')
  expect(markup).toBeVisible()
  expect(markup).toHaveClass('text-warning-soft-foreground')
  // 上游自己的 5% 折扣仍是绿色语义（不加 warning）。
  expect(screen.getByText('x0.95')).not.toHaveClass(
    'text-warning-soft-foreground'
  )
})
