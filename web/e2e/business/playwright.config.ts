import { defineConfig } from '@playwright/test'

import { BASE_URL } from './lib/target'

/**
 * 业务 E2E（Phase 2，24 场景）专用 Playwright 配置。
 *
 * 前置条件：Phase 2 隔离栈（后端 :3100 + Redis 6380 + /tmp 隔离库副本）已启动。
 * 缺栈时 lib/service-gate.ts 判 BLOCKED 并让整轮 fail —— 不允许「服务没起」报成通过。
 *
 * workers=1 + serial：共享一个已登录 request context（登录接口有限流，
 * 必须把登录次数压到最低；refresh cookie 一次性轮换导致 storageState 不可共享，
 * 故整个 worker 共用同一 cookie jar，按用例顺序保证登出用例排在最后）。
 */

export default defineConfig({
  testDir: '.',
  outputDir: '../../.business-e2e/results',
  globalSetup: './lib/service-gate.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: '../../.business-e2e/report.json' }],
  ],
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL,
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    timezoneId: 'Asia/Shanghai',
    locale: 'zh-CN',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
})
