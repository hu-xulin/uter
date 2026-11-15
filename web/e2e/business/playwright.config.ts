import os from 'node:os'
import path from 'node:path'

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

/**
 * 每轮运行使用「全新唯一」的 outputDir（os.tmpdir() 下带 pid + 时间戳）。
 *
 * 根因（2026-11-14 实测）：Playwright 在 runner 启动时会清空 outputDir。旧的固定
 * 目录 `../../.business-e2e/results` 会累积上百个 trace/截图文件，清空动作一次删除
 * 116 个文件，触发宿主删除保护 shim 的批量删除阈值（>50，SAFE_DELETE_BULK_
 * CONFIRM_REQUIRED），runner 直接异常退出 —— 于是 JSON 报告 stats.expected=0、
 * suites=[]，24 个 biz_01..biz_24 场景一个都没被收集执行。
 *
 * 改成一次性空目录后，清空动作是 no-op（0 文件删除），从根源上绕开批量删除保护。
 * 机读报告仍固定写 `../../.business-e2e/report.json`（主流程 cmdVerifyE2E
 * 的读取路径不变，切勿改动）。
 */
const uniqueOutputDir = path.join(
  os.tmpdir(),
  `uter-business-e2e-${process.pid}-${Date.now()}`
)

export default defineConfig({
  testDir: '.',
  outputDir: uniqueOutputDir,
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
