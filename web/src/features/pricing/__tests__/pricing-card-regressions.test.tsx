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

/**
 * 回归背景（2026-11-27 用户反馈）：deepseek-v4.x 分时模型卡片，标题角标 x1.1、
 * 价格行倍率 x2.2。根因是官方基准只有 offpeak 一个价，角标拿 offpeak 优特价比
 * offpeak 官方价（1.1），价格行拿 peak 优特价比同一个 offpeak 官方价（2.2）。
 * 平台对所有时段统一加价 10%，正确倍率恒为 x1.1。
 */
const deepseekTimePricing: PricingModel = {
  id: 999,
  model_name: 'deepseek-v4.1-flash',
  icon: 'DeepSeek.Color',
  quota_type: 0,
  model_ratio: 0,
  completion_ratio: 0,
  model_price: 0,
  enable_groups: ['default'],
  channels: ['优特-百炼'],
  billing_mode: 'tiered_expr',
  billing_expr:
    '(hour("Asia/Shanghai") >= 22 || hour("Asia/Shanghai") < 8 ? tier("offpeak:Default", p * 0.1649175412 + c * 0.6596701649 + cr * 0.0032983508) : tier("peak:Default", p * 0.3298350825 + c * 1.3193403298 + cr * 0.0065967016))',
}

const deepseekOfficial = {
  model_ratio: 0.07496251874062969,
  completion_ratio: 4,
  cache_ratio: 0.02,
}

describe('分时定价倍率一致性', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('MiniMax-H3 动态分支展示官方秒价而非 "-"（优特精选渠道）', () => {
    // tiered_expr 按秒任务模型，channel_internal_per_second_usd 缺失时走动态
    // 分支。过去 presetOfficialUSDFor 只认 model_ratio，官方单元格恒为 "-"。
    renderCard(minimaxH3, { official_price_per_second: 0.0746268657 })
    expect(screen.getByText('$0.074627')).toBeTruthy()
    // Uter 价仍展示档位区间，官方价不再缺失。
    expect(screen.getByText(/\$0\.041045\s*–\s*\$0\.065672/)).toBeTruthy()
  })

  it('峰时角标与价格行倍率一致为 x1.1，不再出现 x2.2', () => {
    // 北京 12:00（UTC 04:00）命中 peak 档。
    vi.setSystemTime(new Date('2026-11-27T04:00:00Z'))
    renderCard(deepseekTimePricing, deepseekOfficial)
    expect(screen.getAllByText('x1.1').length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText('x2.2')).toBeNull()
  })

  it('平时角标与价格行倍率一致为 x1.1', () => {
    // 北京 06:00（UTC 22:00）命中 offpeak 档。
    vi.setSystemTime(new Date('2026-11-26T22:00:00Z'))
    renderCard(deepseekTimePricing, deepseekOfficial)
    expect(screen.getAllByText('x1.1').length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText('x2.2')).toBeNull()
  })
})
