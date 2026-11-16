import fs from 'node:fs'
import path from 'node:path'

import type { APIRequestContext, Page } from '@playwright/test'

import { WEB_ROOT } from './target'

/**
 * 业务 E2E 鉴权辅助（与视觉轨 login.ts 同源约定）。
 *
 * - 只使用既有 E2E 账号（web/.env.local 的 VISUAL_TEST_*），**绝不创建账号**
 *   （红线：任何环节禁止注册/插入账号）。
 * - API 登录压到最低次数：登录接口 CriticalRateLimit（20 次/20 分钟/IP）。
 * - uter 登录失败也返回 HTTP 200 + success:false，必须校验业务字段。
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

export function readBusinessCredentials(): {
  username: string
  password: string
} {
  loadLocalEnv()
  return {
    username: process.env.VISUAL_TEST_EMAIL ?? '',
    password: process.env.VISUAL_TEST_PASSWORD ?? '',
  }
}

export function hasBusinessCredentials(): boolean {
  return Boolean(
    readBusinessCredentials().username && readBusinessCredentials().password
  )
}

export interface LoginResult {
  ok: boolean
  status: number
  message?: string
  /** 登录响应体里的短时访问令牌（后续请求以 Authorization: Bearer 携带）。 */
  accessToken?: string
}

/** 在给定 request context 上完成 API 登录；失败抛错，绝不静默继续。 */
export async function loginViaApi(
  request: APIRequestContext
): Promise<LoginResult> {
  const { username, password } = readBusinessCredentials()
  if (!username || !password) {
    throw new Error(
      '缺少 VISUAL_TEST_EMAIL / VISUAL_TEST_PASSWORD（web/.env.local）'
    )
  }
  const response = await request.post('/api/user/login', {
    data: { username, password },
  })
  let body: {
    success?: boolean
    message?: string
    data?: { access_token?: string }
  } = {}
  try {
    body = (await response.json()) as typeof body
  } catch {
    // 非 JSON 按失败处理
  }
  if (!response.ok() || body.success !== true) {
    throw new Error(
      `API 登录失败：HTTP ${response.status()} ${body.message ?? '(无错误信息)'}`
    )
  }
  return {
    ok: true,
    status: response.status(),
    message: body.message,
    accessToken: body.data?.access_token,
  }
}

/** 浏览器页面登录（真实 UI 链路：表单填写 → 提交 → 等跳转）。 */
export async function loginViaUi(page: Page): Promise<void> {
  const { username, password } = readBusinessCredentials()
  await page.goto('/sign-in', { waitUntil: 'domcontentloaded' })

  // 站点启用用户协议/隐私政策后，SignInForm 的 onSubmit 会先校验法律同意勾选，
  // 未勾选直接 toast 并 return，根本不发起 /api/user/login。原生 input 被
  // Base UI 的 Checkbox 以 clip-path 隐藏在视口外（-1,-1），check() 会报
  // "Element is outside of the viewport"；真实用户点的是可见的
  // span[role="checkbox"]。这里走真实可点击元素，不做 DOM 直接改属性。
  const consent = page.getByRole('checkbox')
  if (
    (await consent.count()) > 0 &&
    !(await page.locator('#legal-consent').isChecked())
  ) {
    await consent.first().click()
  }

  await page.locator('form input').first().fill(username)
  await page.locator('form input[type="password"]').fill(password)
  await page.locator('form button[type="submit"]').click()
  await page.waitForURL((u) => !u.pathname.includes('sign-in'), {
    timeout: 30_000,
  })
}
