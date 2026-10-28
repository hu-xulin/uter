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
import { availableParallelism } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * 273 个 jsdom 测试文件在 16 核机器上默认会铺满 16 个 worker：每个文件都要现搭一次
 * jsdom 环境 + 模块图（占全量耗时约 30%），彼此抢 CPU 时随机把某个用例顶过
 * `testTimeout`。表现是**每次全量跑红的文件都不一样**（本机连跑三次分别红在
 * channel-configuration / discount-tag / api-key-listing，`src/features/pricing`
 * 单跑又 287/287 全绿），归因成本远高于限流的代价。
 *
 * 实测：默认并发 ~4min 但随机红；限到 6 个 worker 后 273 文件 / 2927 用例稳定全绿
 * （~8min）。需要更快时用 `VITEST_MAX_WORKERS=12 bun run test` 显式提速。
 */
const maxWorkers = Number(
  process.env.VITEST_MAX_WORKERS ?? Math.min(6, availableParallelism())
)

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    server: {
      deps: { inline: [/@lobehub\//, /antd-style/] },
    },
    setupFiles: ['./src/test-setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    // jsdom interaction tests (e.g. channel-configuration) drive heavy
    // userEvent flows that occasionally run past the 5s default under CI
    // load and flake on timeout. 20s keeps a comfortable headroom.
    testTimeout: 20000,
    maxWorkers,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
