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
import os from 'node:os'
import path from 'node:path'

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

/**
 * 每轮使用唯一 outputDir（os.tmpdir() 下带 pid + 时间戳）。
 * Playwright 启动会清空 outputDir；固定目录累积 279 个 trace 后，一次清空
 * 触发宿主批量删除保护 SAFE_DELETE_BULK_GUARD_ERROR，runner 在收集用例前
 * 就崩掉（与 business / visual 两轨同款根因）。一次性空目录让清空成为
 * no-op；机读报告仍固定写 `.axe-e2e/report.json`，主流程读取路径不变。
 */
const uniqueOutputDir = path.join(
  os.tmpdir(),
  `uter-axe-e2e-${process.pid}-${Date.now()}`
)

export default defineConfig({
  testDir: '.',
  // 产物落在唯一临时目录，不污染 web/ 工作区，也不触发批量删除保护。
  outputDir: uniqueOutputDir,
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
    // 机读产物：UAP verify-e2e 读这份文件而不是解析 stdout（stdout 会与
    // list 输出/截断互相干扰，曾导致「exit=1 但 0 规格被解析」的假诊断）。
    ['json', { outputFile: '../../.axe-e2e/report.json' }],
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
