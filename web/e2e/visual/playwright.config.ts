import { defineConfig } from '@playwright/test'

import { BASE_URL } from './lib/target'

/**
 * 视觉回归（真实业务页面）专用 Playwright 配置。
 *
 * 两条轨的分工（2026-10-30 决策 B：双轨并存，互不替代）：
 *  - 第一轨 `scripts/visual-regression.mjs`（零依赖）：只截 docs/design-system/showcase.html
 *    静态核查页，秒级完成，本机 Chrome headless 即可。
 *  - 第二轨（本文件）：跑真实路由，含鉴权页，需要完整栈（Go 后端 + 前端 dev server）。
 *
 * 本轨刻意**不接 CI**（决策 C）：像素基线依赖本机字体渲染与 GPU 合成，
 * 跨 OS 会产生随机红灯；比对只在开发机手动执行。
 *
 * 路径约定：Playwright 把 testDir / outputDir / snapshotDir / globalSetup 都按
 * 本配置文件所在目录解析，所以一律用相对字符串，避免 ESM 下 `__dirname` 不可用。
 *
 * 前置条件：Go 后端 + `bun run dev` 已在运行。缺栈时 lib/service-gate.ts 判 BLOCKED
 * 并让整轮 fail —— 不允许把「服务没起」报成通过。
 */

export default defineConfig({
  testDir: '.',
  // 产物一律落在 gitignore 的 .visual-e2e/ 下，不污染 web/ 工作区。
  outputDir: '../../.visual-e2e/results',
  snapshotDir: '.',
  globalSetup: './lib/service-gate.ts',
  // 截图比对对并行不友好：多 worker 争抢 GPU 会引入合成抖动。
  fullyParallel: false,
  workers: 1,
  // 单用例上限：登录 setup（等跳转）与慢路由截图都需要远超默认 30s 的余量。
  timeout: 120_000,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: '../../.visual-e2e/report' }],
  ],
  use: {
    // 默认空 → 使用 Playwright 自带 Chromium（授权 D：下载官方二进制）。
    // 若本机无法下载官方二进制，可用系统 Chrome 兜底：
    //   PLAYWRIGHT_CHANNEL=chrome bun run test:visual:e2e
    channel: process.env.PLAYWRIGHT_CHANNEL,
    // 单一来源在 lib/target.ts：默认 Go 后端 :3000（内嵌 web/dist，title=Uter）。
    // ⚠ 本机 :3200 可能是 uter-cs 智能客服的 dev server（同有登录页，端点是
    // /api/auth/login），勿当 uter 目标——认准方法：uter 登录页调 /api/user/login。
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    // 固定渲染环境，避免跨次基线漂移：
    // 时区跟随系统时区会因机器而异，统一锁 Asia/Shanghai；
    // 语言锁 zh-CN（国内主战场），切英文口径用 VISUAL_LOCALE 覆盖。
    timezoneId: 'Asia/Shanghai',
    locale: process.env.VISUAL_LOCALE ?? 'zh-CN',
    trace: 'retain-on-failure',
  },
  expect: {
    toHaveScreenshot: {
      // 关掉动画与光标闪烁，否则同一页面相邻两次截图必然报差异。
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      // 只抗亚像素/字体微调抖动，不放宽到掩盖真实回归：
      // 1440x900 的 0.15% ≈ 1900 像素，肉眼可见的错位远超这个量级。
      maxDiffPixelRatio: 0.0015,
      threshold: 0.2,
    },
  },
  projects: [
    {
      // 登录链路冒烟：凭据失效时这里先红，不让 16 个鉴权用例各自模糊失败。
      name: 'auth-setup',
      testMatch: /auth\.setup\.spec\.ts/,
    },
    {
      // 主轨：公开页未登录即可截（uter 公开页未登录渲染真实内容）；
      // 鉴权页在 authed.spec.ts 内部按视口独立 API 登录（refresh cookie 一次性
      // 轮换，不能跨 context 共享 storageState；登录接口限流也要求最少化登录次数）。
      name: 'chromium',
      testIgnore: /auth\.setup\.spec\.ts/,
      use: {
        browserName: 'chromium',
      },
    },
  ],
})
