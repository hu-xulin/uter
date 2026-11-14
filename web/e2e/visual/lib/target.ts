import path from 'node:path'

/**
 * 视觉回归（Playwright 轨）的公共常量。
 *
 * 单独成文件而非放在 playwright.config.ts 里，是为了避免 `globalSetup` 反向
 * import 配置文件造成的循环依赖（Playwright 加载配置时会先求值 config，
 * config 再触发 globalSetup，globalSetup 又回头读 config）。
 *
 * ⚠ 路径基准：Playwright 会把 spec 及其 import 连同 bundle 后再求值，
 * `import.meta.url` 指向 bundle 入口而非本文件源码位置，不能用它们推根目录。
 * 这里以 `process.cwd()` 为准 —— bun run 脚本固定从 web/ 发起（见 package.json）。
 */

/** web/ 目录根，用于把产物锚定到仓库已知位置。 */
export const WEB_ROOT = process.cwd()

/** 视觉回归目标。默认 Go 后端 :3000（内嵌 web/dist）；dev 模式用 VISUAL_BASE_URL 覆盖。 */
export const BASE_URL = process.env.VISUAL_BASE_URL ?? 'http://localhost:3000'

/**
 * 当前目标是否为「测试专用隔离栈」（scripts/phase2-test-stack.sh 启动：
 * 前端 :3101 / 后端 :3100，独立 DB 副本 + Redis 6380）。
 *
 * 仅用于给 BLOCKED 注解补充精确归因，不改变任何请求行为：
 *  - 显式开关 UTER_TEST_STACK=isolated 优先（隔离栈 env.sh 会 export 它）；
 *  - 或 VISUAL_BASE_URL 指向隔离栈专用端口 3100 / 3101。
 * 生产 :3000、uter-cs :3200 以及任何自定义端口均视为「非隔离栈」。
 *
 * axe 轨直接复用本文件的 BASE_URL，因此同一开关对 visual + axe 同时生效。
 */
export const ISOLATED_TEST_STACK =
  process.env.UTER_TEST_STACK === 'isolated' ||
  /^https?:\/\/(localhost|127\.0\.0\.1):(3100|3101)(?:\/|$)/i.test(BASE_URL)

/** 桌面 / 移动双视口，与零依赖第一轨（1440x900 + 390x844）保持一致口径。 */
export const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const

export type ViewportName = (typeof VIEWPORTS)[number]['name']
