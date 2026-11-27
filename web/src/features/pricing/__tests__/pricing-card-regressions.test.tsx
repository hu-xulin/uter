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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'

import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import { ModelCard } from '../components/model-card'
import type { PricingModel } from '../types'

vi.mock('@/hooks/use-admin', () => ({ useIsSuperAdmin: () => false }))

beforeEach(() => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    key: (index: number) => [...storage.keys()][index] ?? null,
    get length() {
      return storage.size
    },
  })
  useSystemConfigStore.persist.setOptions({
    storage: createJSONStorage(() => localStorage),
  })
  useSystemConfigStore.getState().setConfig({
    currency: { ...DEFAULT_CURRENCY_CONFIG, quotaDisplayType: 'USD' },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderCard(model: PricingModel, official: Record<string, number>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ModelCard
        model={model}
        onClick={() => {}}
        priceRate={1}
        usdExchangeRate={1}
        tokenUnit='M'
        selectedGroup='all'
        pricingSource='models.dev'
        officialPrices={{ [model.model_name]: official }}
      />
    </QueryClientProvider>
  )
}

const seedance: PricingModel = {
  id: 207,
  model_name: 'doubao-seedance-2-5-260628',
  icon: 'Doubao.Color',
  quota_type: 0,
  model_ratio: 4.9875,
  completion_ratio: 1,
  model_price: 0,
  enable_groups: ['default'],
  channels: ['优特-精选'],
  billing_usage_schema: {
    resolution: { enum: ['480p', '720p', '1080p'] },
    tokens: { type: 'number', unit: 'token' },
    video_input: { enum: ['none', 'video'] },
  },
}

const wanVideo: PricingModel = {
  id: 203,
  model_name: 'wan3.0-video',
  icon: 'Wan.Color',
  quota_type: 2,
  model_ratio: 0,
  completion_ratio: 1,
  model_price: 0,
  enable_groups: ['default'],
  channels: ['优特-精选'],
  channel_internal_per_second_usd: 0.0494011976,
  billing_usage_schema: {
    resolution: { enum: ['480P', '720P', '1080P'] },
    seconds: { type: 'number', unit: 'second' },
  },
}

const qwenAsr: PricingModel = {
  id: 291,
  model_name: 'qwen-audio-3.0-asr-flash',
  icon: 'Qwen.Color',
  quota_type: 2,
  model_ratio: 0,
  completion_ratio: 1,
  model_price: 0,
  enable_groups: ['default'],
  channels: ['优特-百炼'],
  channel_internal_per_second_usd: 0.0000362275,
}

const minimaxH3: PricingModel = {
  id: 211,
  model_name: 'MiniMax-H3',
  icon: 'Minimax.Color',
  quota_type: 0,
  model_ratio: 0,
  completion_ratio: 0,
  model_price: 0,
  enable_groups: ['default'],
  channels: ['优特-精选'],
  billing_mode: 'tiered_expr',
  billing_expr:
    'has(lower(param("metadata.parameters.resolution")), "2k") || has(lower(param("size")), "2k") ? tier("2k", duration * 0.0656716419) : tier("768p", duration * 0.0410447762)',
  billing_usage_schema: {
    input_images: { type: 'number', unit: 'count' },
    input_video_seconds: { type: 'number', unit: 'second' },
    resolution: { enum: ['768P', '2K'] },
    seconds: { type: 'number', unit: 'second' },
  },
}

describe('定价页卡片展示回归', () => {
  it('doubao-seedance 已有 model_ratio 时展示 token 价格而非「尚未配置定价」', () => {
    renderCard(seedance, { model_ratio: 5.25, completion_ratio: 1 })
    expect(screen.queryByText(/price not configured/i)).toBeNull()
    expect(screen.getAllByText(/Input|Output/i).length).toBeGreaterThan(0)
  })

  it('wan3.0-video 按秒模型展示优特价与官方价', () => {
    renderCard(wanVideo, { official_price_per_second: 0.04491017964071856 })
    expect(screen.queryByText(/price not configured/i)).toBeNull()
    expect(screen.getByText(/\$0\.049401\s*\/\s*second/i)).toBeTruthy()
    expect(screen.getByText(/\$0\.04491\s*\/\s*second/i)).toBeTruthy()
  })

  it('qwen-audio ASR 按秒模型展示优特价与官方价', () => {
    renderCard(qwenAsr, { official_price_per_second: 0.000032983508245877065 })
    expect(screen.queryByText(/price not configured/i)).toBeNull()
    expect(screen.getByText(/\$0\.000036\s*\/\s*second/i)).toBeTruthy()
    expect(screen.getByText(/\$0\.000033\s*\/\s*second/i)).toBeTruthy()
  })

  it('MiniMax-H3 表达式解析为可读档位而非直接展示原文', () => {
    renderCard(minimaxH3, { official_price_per_second: 0.0746268657 })
    expect(screen.queryByText(/Special billing expression/i)).toBeNull()
    expect(screen.queryByText(/has\(lower\(param/i)).toBeNull()
    expect(screen.getByText(/\$0\.041045\s*–\s*\$0\.065672/)).toBeTruthy()
  })
})
