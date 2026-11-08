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
import { defineConfig } from '@playwright/test'

import { BASE_URL } from './lib/target'

/**
 * axe 可访问性扫描（WCAG 2.2 A/AA 口径）专用 Playwright 配置。
 *
 * 与 e2e/visual（第二轨）同一架构约定：
 *  - 需要完整栈（Go 后端 + 前端页面），globalSetup 服务门禁不可达即整轮
 *    fail（BLOCKED，不得当作通过）；
 *  - 刻意**不接 CI**（决策 C 同源）：CI 没有运行中的 Go 后端 + Redis 硬依赖栈，
 *    塞进去只会制造常态红灯；本轨定位为开发机可执行门禁，
 *    由 `bun run test:axe` 手动/验收时执行。
 *
 * 路径约定：Playwright 把 testDir / outputDir / globalSetup 都按本配置文件
 * 所在目录解析，所以一律用相对字符串。
 */

export default defineConfig({
  testDir: '.',
  // 产物落在 gitignore 的 .axe-e2e/ 下，不污染 web/ 工作区。
  outputDir: '../../.axe-e2e/results',
  globalSetup: './lib/service-gate.ts',
  // 扫描对服务端限流敏感（鉴权轨只登录 1 次），不做并行。
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: '../../.axe-e2e/report' }],
  ],
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL,
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    // 与视觉回归同口径，保证两轨看到的是同一个渲染环境。
    timezoneId: 'Asia/Shanghai',
    locale: process.env.VISUAL_LOCALE ?? 'zh-CN',
    trace: 'retain-on-failure',
  },
})
