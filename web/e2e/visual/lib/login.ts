import fs from 'node:fs'
import path from 'node:path'

import type { Page } from '@playwright/test'

import { WEB_ROOT } from './target'

/**
 * 鉴权辅助：读取本地凭据 + API 级登录。
 *
 * 为什么用 API 登录而不是 UI 登录：
 *  - 登录接口有 CriticalRateLimit（20 次/20 分钟/IP，成败都计数），必须把登录次数
 *    压到最低。鉴权页的基线用例设计为「每个视口一个长用例：登录 1 次、串行截全部
 *    页面」，整轮只用 2 次；auth.setup.spec.ts 冒烟再用 1 次。
 *  - `page.request` 与浏览器上下文共享 cookie jar：登录返回的 Set-Cookie 直接生效，
 *    随后的 page.goto 即为登录态。
 *
 * 为什么不共享 storageState：uter 的 refresh cookie 是一次性轮换（OWASP 推荐），
 * 多个 context 复用同一份会话快照会在几个用例后触发 /api/user/auth/refresh 401
 * 并被全局登出（2026-10-30 实测）。每个长用例独立登录、互不干扰。
 */

/**
 * 读取 `web/.env.local`（已被 `*.local` 规则 gitignore）里的视觉回归测试凭据。
 * 不走 Playwright 内置 dotenv（它只加载 `.env`，且会在双引号内展开 `$VAR`），
 * 手动解析，仅对未设置的键注入，不覆盖已有环境。凭据明文只落本机 gitignore 文件。
 */
export function loadLocalEnv(): void {
  const file = path.join(WEB_ROOT, '.env.local')
  if (!fs.existsSync(file)) return
  const text = fs.readFileSync(file, 'utf8')
  for (const raw of text.split('\n')) {
    const match = raw.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/)
    if (!match) continue
    const key = match[1]
    let value = match[2]
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

export interface VisualCredentials {
  username: string
  password: string
}

/** 凭据是否已配置（可在测试收集阶段静态判断，用于整组 skip 而非假通过）。 */
export function hasVisualCredentials(): boolean {
  loadLocalEnv()
  return Boolean(process.env.VISUAL_TEST_EMAIL && process.env.VISUAL_TEST_PASSWORD)
}

function readVisualCredentials(): VisualCredentials {
  loadLocalEnv()
  const username = process.env.VISUAL_TEST_EMAIL ?? ''
  const password = process.env.VISUAL_TEST_PASSWORD ?? ''
  return { username, password }
}

/**
 * 通过登录 API 建立登录态（cookie 直接写入 page 所在 context）。
 * 失败立即抛错——绝不允许「没登录却截了登录页还当基线」。
 */
export async function loginViaApi(page: Page): Promise<void> {
  const { username, password } = readVisualCredentials()
  if (!username || !password) {
    throw new Error(
      '缺少 VISUAL_TEST_EMAIL / VISUAL_TEST_PASSWORD（web/.env.local），无法建立登录态'
    )
  }

  const response = await page.request.post('/api/user/login', {
    data: { username, password },
  })
  // ⚠ 必须校验业务 success 字段，不能只看 HTTP 状态：登录接口失败时也返回
  // HTTP 200 + {"success":false,"message":"Password login has been disabled…"}
  // （2026-10-31 实测：PasswordLoginEnabled=false 时截了 18 张登录页当基线）。
  let body: { success?: boolean; message?: string } = {}
  try {
    body = (await response.json()) as typeof body
  } catch {
    // 非 JSON 响应按失败处理
  }
  if (!response.ok() || body.success !== true) {
    throw new Error(
      `API 登录失败：HTTP ${response.status()} ${body.message ?? '(无错误信息)'}`
    )
  }
}
