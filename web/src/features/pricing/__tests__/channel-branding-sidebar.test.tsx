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
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PricingChannel, PricingFacetModels, PricingModel } from '../types'

const mockUseTheme = vi.fn(() => ({ resolvedTheme: 'light' }))
vi.mock('@/context/theme-provider', () => ({
  useTheme: () => mockUseTheme(),
}))

import { PricingSidebar } from '../components/pricing-sidebar'

function model(name: string, channels: string[]): PricingModel {
  return {
    id: 1,
    model_name: name,
    vendor_name: 'Vendor A',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: ['default'],
    channels,
  } as PricingModel
}

function renderSidebar(
  channelBrandings: Record<string, PricingChannel>,
  theme: 'light' | 'dark' = 'light'
) {
  mockUseTheme.mockReturnValue({ resolvedTheme: theme })
  const models = [model('claude-3', ['Claude-Basic'])]
  const facetModels: PricingFacetModels = {
    channel: models,
    vendor: [],
    tag: [],
    quotaType: [],
    endpointType: [],
  }
  return render(
    <PricingSidebar
      quotaTypeFilter='all'
      endpointTypeFilter='all'
      vendorFilter='all'
      channelFilter='all'
      tagFilter='all'
      onQuotaTypeChange={vi.fn()}
      onEndpointTypeChange={vi.fn()}
      onVendorChange={vi.fn()}
      onChannelChange={vi.fn()}
      onTagChange={vi.fn()}
      vendors={[]}
      channels={['Claude-Basic']}
      channelTypes={{ 'Claude-Basic': 64 }}
      channelBrandings={channelBrandings}
      models={models}
      facetModels={facetModels}
      hasActiveFilters={false}
      onClearFilters={vi.fn()}
    />
  )
}

/** 找到渠道 chip（按钮）内部的 img；没有则返回 null。 */
function chipImage(label: string): HTMLImageElement | null {
  const button = screen.getByRole('button', { name: new RegExp(label) })
  return button.querySelector('img')
}

describe('PricingSidebar channel branding', () => {
  beforeEach(() => {
    mockUseTheme.mockReturnValue({ resolvedTheme: 'light' })
  })

  it('renders the custom light logo instead of the type icon for a configured channel', () => {
    renderSidebar({
      'Claude-Basic': {
        name: 'Claude-Basic',
        type: 64,
        display_name: 'Claude 基础版',
        logo: 'data:image/png;base64,LIGHT',
        logo_dark: 'data:image/png;base64,DARK',
      },
    })
    const img = chipImage('Claude-Basic')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBe('data:image/png;base64,LIGHT')
  })

  it('prefers logo_dark in dark theme and falls back to logo when logo_dark is missing', () => {
    const { unmount } = renderSidebar(
      {
        'Claude-Basic': {
          name: 'Claude-Basic',
          type: 64,
          logo: 'data:image/png;base64,LIGHT',
          logo_dark: 'https://cdn.example.com/dark.svg',
        },
      },
      'dark'
    )
    expect(chipImage('Claude-Basic')?.getAttribute('src')).toBe(
      'https://cdn.example.com/dark.svg'
    )
    unmount()

    renderSidebar(
      {
        'Claude-Basic': {
          name: 'Claude-Basic',
          type: 64,
          logo: 'data:image/png;base64,LIGHT',
        },
      },
      'dark'
    )
    expect(chipImage('Claude-Basic')?.getAttribute('src')).toBe(
      'data:image/png;base64,LIGHT'
    )
  })

  it('falls back to the type icon when no branding logo is configured', () => {
    renderSidebar(
      { 'Claude-Basic': { name: 'Claude-Basic', type: 64 } },
      'light'
    )
    expect(chipImage('Claude-Basic')).toBeNull()
  })
})
