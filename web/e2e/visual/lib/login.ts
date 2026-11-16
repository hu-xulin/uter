import fs from 'node:fs'
import path from 'node:path'

import type { Page } from '@playwright/test'

import { WEB_ROOT } from './target'

/**
 * 鉴权辅助：读取本地凭据 + API 级登录，并把真实登录响应写入 SPA 会话。
 *
 * 为什么用 API 登录而不是 UI 登录：
 *  - 登录接口有 CriticalRateLimit（20 次/20 分钟/IP，成败都计数），必须把登录次数
 *    压到最低。鉴权页的基线用例设计为「每个视口一个长用例：登录 1 次、串行截全部
 *    页面」，整轮只用 2 次；auth.setup.spec.ts 冒烟再用 1 次。
 *
 * 为什么不共享 storageState：uter 的 refresh cookie 是一次性轮换（OWASP 推荐），
 * 多个 context 复用同一份会话快照会在几个用例后触发 /api/user/auth/refresh 401
 * 并被全局登出（2026-10-30 实测）。每个长用例独立登录、互不干扰。
 *
 * 为什么「只靠 Set-Cookie」不够（2026-11-14 实测修复）：
 *  - SPA 把认证放在纯内存 Zustand store（web/src/stores/auth-store.ts，无持久化
 *    key），冷启动只能由 `/api/user/auth/refresh` 响应里的 AuthBundle 经
 *    `setBundle()` 写入 user + accessToken；`_authenticated/route.tsx` 守卫据此
 *    决定是否弹回 /sign-in。
 *  - `new_api_refresh` 是 `HttpOnly; Path=/api/user/auth; SameSite=Strict`，且
 *    API 登录不会触发登录页 JS 的 `applyAuthBundle()`，页面级会话建立不了，访问
 *    /dashboard 被弹回登录页。
 *  - 修复见 loginViaApi()：用真实登录响应里的完整 AuthBundle 驱动 SPA 真实的
 *    `resolveAuthentication → applyAuthBundle → setBundle` 代码路径。
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
  return Boolean(
    process.env.VISUAL_TEST_EMAIL && process.env.VISUAL_TEST_PASSWORD
  )
}

function readVisualCredentials(): VisualCredentials {
  loadLocalEnv()
  const username = process.env.VISUAL_TEST_EMAIL ?? ''
  const password = process.env.VISUAL_TEST_PASSWORD ?? ''
  return { username, password }
}

/**
 * 后端明确报告「管理员已禁用密码登录」的字面量特征。
 * 该文案来自 PasswordLoginEnabled=false 的运营配置，属于**环境性不可用**，
 * 与「用户名或密码错误」这种真实的鉴权失败必须严格区分。
 */
export const PASSWORD_LOGIN_DISABLED_MESSAGE =
  /password login has been disabled by administrator/i

export type VisualAuthUnavailableReason = 'PASSWORD_LOGIN_DISABLED'

/**
 * 目标栈未开放密码登录时抛出的精确、可判定错误。
 *
 * 与 `Error`（凭据错误 / 网络错误 / 非 JSON 响应）分开的原因：
 *  - `Error`            → 真 FAIL，绝不吞掉；
 *  - 本错误            → 当目标不是测试专用隔离栈时判 BLOCKED（生产运营配置
 *                        PasswordLoginEnabled=false，审计红线禁止修改）。
 * 隔离栈上若仍抛本错误，说明隔离副本没配好，同样是真 FAIL，不会被洗白。
 */
export class VisualAuthUnavailableError extends Error {
  readonly reason: VisualAuthUnavailableReason = 'PASSWORD_LOGIN_DISABLED'
  readonly httpStatus: number
  readonly backendMessage: string

  constructor(backendMessage: string, httpStatus: number) {
    super(
      `目标栈未开放密码登录（PasswordLoginEnabled=false）：${backendMessage}`
    )
    this.name = 'VisualAuthUnavailableError'
    this.httpStatus = httpStatus
    this.backendMessage = backendMessage
  }
}

/**
 * 登录响应 `data` 的结构 —— 与 SPA `web/src/stores/auth-store.ts` 的
 * `setBundle(bundle: AuthBundle)` 及 `web/src/lib/auth-session.ts` 的
 * `isAuthBundle()` 完全一致。uter 的 /api/user/login 成功响应体本身就是一个
 * 完整 AuthBundle（controller/user.go writeLoginResponse）：
 *   { access_token, token_type, access_expires_at, session, user }
 * user 必含 id / username / role，session 必含 sid / current / login_method /
 * ip / user_agent / created_at / last_active_at / expires_at。形状不符时 SPA 的
 * parseBundle 会判「无效刷新响应」并登出，所以测试侧必须先用同一套校验确认这是
 * 真实可用的 bundle，绝不注入伪造数据。
 */
interface LoginBundle {
  access_token: string
  token_type: string
  access_expires_at: number
  user: {
    id: number
    username: string
    role: number
    [key: string]: unknown
  }
  session: {
    sid: string
    current: boolean
    login_method: string
    ip: string
    user_agent: string
    created_at: number
    last_active_at: number
    expires_at: number
    [key: string]: unknown
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

/** 与 SPA isAuthBundle 等价的结构校验：确保只使用服务端真实签发的 bundle。 */
function isLoginBundle(value: unknown): value is LoginBundle {
  if (!isRecord(value)) return false
  if (
    typeof value.access_token !== 'string' ||
    value.access_token.length === 0 ||
    typeof value.token_type !== 'string' ||
    value.token_type.length === 0 ||
    typeof value.access_expires_at !== 'number' ||
    !Number.isFinite(value.access_expires_at) ||
    value.access_expires_at <= 0
  ) {
    return false
  }
  const user = value.user
  if (
    !isRecord(user) ||
    !Number.isInteger(user.id) ||
    Number(user.id) <= 0 ||
    typeof user.username !== 'string' ||
    typeof user.role !== 'number'
  ) {
    return false
  }
  const session = value.session
  if (!isRecord(session)) return false
  return (
    typeof session.sid === 'string' &&
    session.sid.length > 0 &&
    typeof session.current === 'boolean' &&
    typeof session.login_method === 'string' &&
    typeof session.ip === 'string' &&
    typeof session.user_agent === 'string' &&
    typeof session.created_at === 'number' &&
    typeof session.last_active_at === 'number' &&
    typeof session.expires_at === 'number'
  )
}

/**
 * 通过登录 API 建立「页面级」登录态。
 *
 * 失败立即抛错——绝不允许「没登录却截了登录页还当基线」。
 *
 * 拿到**真实登录响应**里的完整 AuthBundle（服务端真实签发的 access_token +
 * user + session，绝非伪造）后，用两处 Playwright 注入把它写入 SPA 真正读取的
 * 会话通道：
 *  1. `addInitScript` 写入脚本可读的 session hint（`new_api_has_session=1`，
 *     Path=/、不含凭证）。它只是「提示位」，让 SPA 的 `bootstrapAuthentication()`
 *     不把访客判成 anonymous；真实授权仍完全依赖 access_token。
 *  2. `page.route` 接管冷启动的 `/api/user/auth/refresh` 请求，把这份真实 bundle
 *     作为 refresh 响应喂回 SPA 的 `resolveAuthentication → applyAuthBundle →
 *     setBundle` 真实代码路径，从而真实建立内存 store 里的 user + accessToken。
 *
 * 不改 web/src/**、不关闭路由保护、不改生产认证策略、不把测试认证塞进生产构建：
 * 未登录的全新 context 没有 hint、也没有本 route 注入，守卫依旧把它弹回
 * /sign-in；而登录后页面请求携带真实 `Authorization: Bearer <access_token>`，
 * 由后端真实校验，是可用会话而非「假登录态」。
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
  let body: { success?: boolean; message?: string; data?: unknown } = {}
  try {
    body = (await response.json()) as typeof body
  } catch {
    // 非 JSON 响应按失败处理
  }
  if (!response.ok() || body.success !== true) {
    const message = body.message ?? '(无错误信息)'
    // 严格校验保持不变：success !== true 一律失败，绝不吞掉。
    // 仅把「后端明确禁用密码登录」这一类升级为可判定的 typed error，
    // 供鉴权轨区分「环境 BLOCKED」与「凭据错误 FAIL」。
    if (PASSWORD_LOGIN_DISABLED_MESSAGE.test(message)) {
      throw new VisualAuthUnavailableError(message, response.status())
    }
    throw new Error(`API 登录失败：HTTP ${response.status()} ${message}`)
  }

  // 登录成功必须拿到服务端真实签发的完整 bundle；缺失/畸形都是真失败，绝不吞掉，
  // 也不注入任何伪造的 token/user。
  if (!isLoginBundle(body.data)) {
    throw new Error(
      'API 登录成功但响应 data 不是可用的 AuthBundle（缺 access_token/user/session），无法建立应用会话'
    )
  }
  const bundle: LoginBundle = body.data

  // 1) session hint：脚本可读、Path=/、不含凭证，仅让 SPA 跳过「必定失败的冷启动
  //    刷新」优化。用 addInitScript 保证每次导航都在页面脚本之前就绪。
  //    （回调在浏览器端求值，只含字面量，不捕获 Node 侧变量。）
  await page.addInitScript(() => {
    document.cookie = 'new_api_has_session=1; path=/'
  })

  // 2) 把真实 bundle 通过 SPA 真正读取的 refresh 通道写入内存 store。
  //    该 handler 在 Node 侧运行，可安全捕获 bundle。
  await page.route('**/api/user/auth/refresh', async (route) => {
    const origin = route.request().headers()['origin']
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'cache-control': 'no-store',
        // /api 走独立 dev server 反代时浏览器仍视为同源；仅在确有 Origin 头时
        // 补 CORS，避免个别跨端口栈的凭证请求被预检拦下。
        ...(origin
          ? {
              'access-control-allow-origin': origin,
              'access-control-allow-credentials': 'true',
              'access-control-allow-headers':
                'content-type, cache-control, x-auth-session',
            }
          : {}),
      },
      body: JSON.stringify({ success: true, message: '', data: bundle }),
    })
  })
}
