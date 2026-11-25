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
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { Carousel, CarouselContent, CarouselItem } from '../carousel'

const SRC = join(process.cwd(), 'src/components/ui')
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8')

/**
 * UDS8 复杂/原语组件契约守卫（第 5 批）。
 * Carousel 用渲染断言语义锚点；Chart / Sonner / Direction 用源码守卫断言
 * 其稳定契约（Token 映射、导出契约、图标线宽）——与项目既有
 * `uds8-decision-fixes.test.ts` 同款，避免为纯原语/重导出写无意义 smoke。
 */
describe('UDS8 复杂组件契约', () => {
  test('Carousel 暴露 data-slot 语义锚点并渲染条目', () => {
    // Embla 依赖 IntersectionObserver，jsdom 未提供；此处补最小环境 stub
    // （仅测试边界，不 mock 被测组件）。
    const OriginalIO = globalThis.IntersectionObserver
    globalThis.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
      root = null
      rootMargin = ''
      thresholds = []
    } as unknown as typeof IntersectionObserver
    try {
      const { container } = render(
        <Carousel>
          <CarouselContent>
            <CarouselItem>第 1 页</CarouselItem>
          </CarouselContent>
        </Carousel>
      )
      expect(container.querySelector('[data-slot="carousel"]')).not.toBeNull()
      expect(
        container.querySelector('[data-slot="carousel-content"]')
      ).not.toBeNull()
      expect(screen.getByText('第 1 页')).not.toBeNull()
    } finally {
      globalThis.IntersectionObserver = OriginalIO
    }
  })

  test('Chart 从 config 动态生成 --color-<key> 令牌而非硬编码色值', () => {
    const src = read('chart.tsx')
    // 真实契约：chartColorStyles 按 config 的 color/theme 生成 CSS 变量，
    // 颜色来自调用方 token，源码不含硬编码调色板色值。
    expect(src).toContain('--color-${key}')
    expect(src).not.toMatch(/#[0-9a-fA-F]{6}/)
  })

  test('Chart 导出容器/提示/图例等完整契约', () => {
    const src = read('chart.tsx')
    for (const name of [
      'ChartContainer',
      'ChartTooltip',
      'ChartTooltipContent',
      'ChartLegend',
      'ChartLegendContent',
      'ChartStyle',
    ]) {
      expect(src).toContain(name)
    }
  })

  test('Sonner 状态图标使用 UDS8 统一 2 单位线宽', () => {
    const src = read('sonner.tsx')
    // 5 个状态图标均用 size-4.5 与默认 strokeWidth（Lucide 2），
    // 不存在自定义 strokeWidth 覆盖。
    expect(src).toContain('CircleCheck')
    expect(src).toContain('CircleAlert')
    expect(src).toContain('LoaderCircle')
    expect(src).not.toMatch(/strokeWidth=\{[^2]/)
  })

  test('Sonner 使用语义 Token 映射浮层表面/文字/边框', () => {
    const src = read('sonner.tsx')
    expect(src).toContain('--normal-bg')
    expect(src).toContain('var(--popover)')
    expect(src).toContain('var(--popover-foreground)')
    expect(src).toContain('var(--border)')
  })

  test('Direction 保持 Base UI 方向原语的 re-export 契约', () => {
    const src = read('direction.tsx')
    expect(src).toContain('DirectionProvider')
    expect(src).toContain('useDirection')
    expect(src).toContain('@base-ui/react/direction-provider')
  })
})
