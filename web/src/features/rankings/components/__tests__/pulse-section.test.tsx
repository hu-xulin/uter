import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RankingMover } from '../../types'
import { PulseSection } from '../pulse-section'

const { iconSpy } = vi.hoisted(() => ({ iconSpy: vi.fn() }))

vi.mock('@/lib/lobe-icon', () => ({
  colorIconName: (name?: string | null) => name ?? '',
  getLobeIcon: (name?: string, size?: number) => {
    iconSpy(name, size)
    return (
      <span data-testid='model-icon' data-icon={name ?? ''} data-size={size} />
    )
  },
}))

const movers: RankingMover[] = [
  {
    model_name: 'groq-gpt-oss-120b',
    vendor: 'OpenAI',
    vendor_icon: '',
    model_icon: 'OpenAI.Mono',
    rank_delta: 1,
    current_rank: 1,
    growth_pct: 18.4,
  },
  {
    model_name: 'sf-qwen3-8b',
    vendor: 'Qwen',
    vendor_icon: '',
    model_icon: 'Qwen.Color',
    rank_delta: 2,
    current_rank: 2,
    growth_pct: 12.1,
  },
  {
    model_name: 'internal-router-model',
    vendor: 'Uter',
    vendor_icon: '',
    model_icon: 'Uter.Color',
    rank_delta: 3,
    current_rank: 3,
    growth_pct: 9.6,
  },
]

function renderPulse() {
  const root = createRootRoute()
  const index = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => <PulseSection movers={movers} droppers={[]} />,
  })
  const pricing = createRoute({
    getParentRoute: () => root,
    path: '/pricing',
    component: () => <div>pricing</div>,
  })
  const modelDetail = createRoute({
    getParentRoute: () => pricing,
    path: '$modelId',
    component: () => <div>model detail</div>,
  })
  const router = createRouter({
    routeTree: root.addChildren([index, pricing.addChildren([modelDetail])]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router} />)
}

describe('PulseSection ranking model identity', () => {
  beforeEach(() => {
    iconSpy.mockClear()
  })

  it('shows inferred vendor names and per-model product logos', async () => {
    renderPulse()

    expect(await screen.findByText('groq-gpt-oss-120b')).toBeVisible()
    expect(screen.getByText('sf-qwen3-8b')).toBeVisible()
    expect(screen.getByText('OpenAI')).toBeVisible()
    expect(screen.getByText('Qwen')).toBeVisible()
    expect(screen.getByText('Uter')).toBeVisible()
    expect(screen.queryByText(/unknown/i)).not.toBeInTheDocument()

    expect(
      screen.getAllByTestId('model-icon').map((node) => node.dataset.icon)
    ).toEqual(['OpenAI.Mono', 'Qwen.Color', 'Uter.Color'])
  })
})
