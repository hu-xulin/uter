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

/** 桌面 / 移动双视口，与零依赖第一轨（1440x900 + 390x844）保持一致口径。 */
export const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const

export type ViewportName = (typeof VIEWPORTS)[number]['name']
