import {
  expect,
  test as base,
  type Page,
} from '@playwright/test'

import { AuthedApi, createToken } from '../lib/authed-api'
import { loginViaApi, loginViaUi, readBusinessCredentials } from '../lib/login'

/**
 * Phase 2 业务 E2E —— 24 场景（biz_01..biz_24）。
 *
 * 原则（Phase 2 指令 §5）：
 *  - 全部跑真实应用：真实浏览器 + 真实后端 API + 隔离 SQLite 副本 + Redis 6380。
 *    无 Mock / 无内存替身；Mock 不得替代任何场景。
 *  - 红线：绝不创建账号（biz_01 按策略 BLOCKED）、绝不触发真实支付/退款
 *    （充值相关场景全部只读）、不创建充值订单（只调只读查询接口）。
 *  - 登录限流（CriticalRateLimit 20/20min）：worker 级共享一个已登录
 *    AuthedApi，整个套件只登 3 次（worker 1 次 + biz_02/biz_08 各自独立 1 次）。
 *  - 密钥 CRUD 用例自带创建→回读→更新→删除闭环，worker 收尾兜底清理。
 *
 * BLOCKED 语义：biz_01 是唯一 skip 项，skip 原因写入报告，绝不把「没测」算成通过。
 */

interface UterResponse<T = unknown> {
  success?: boolean
  message?: string
  data?: T
}

const test = base.extend<{ authedApi: AuthedApi; authedPage: Page }>({
  authedApi: [
    async ({ browser }, use) => {
      const api = await AuthedApi.create()
      await use(api)
      await api.dispose()
    },
    { scope: 'worker' },
  ],
  authedPage: [
    async ({ authedApi, browser }, use) => {
      const context = await browser.newContext()
      const state = await authedApi.storageState()
      await context.addCookies(state.cookies)
      const page = await context.newPage()
      await use(page)
      await context.close()
    },
    { scope: 'worker' },
  ],
})

// workers=1 + fullyParallel=false 已保证按文件顺序串行；serial 模式会让
// 单点失败连锁 skip 后续用例，掩盖真实覆盖面，故不启用 serial。
test.describe.configure({ mode: 'default' })

// ---------------------------------------------------------------------------
// 1. 账号与鉴权域（biz_01–biz_08）
// ---------------------------------------------------------------------------

test('biz_01 注册新用户 [BLOCKED_BY_POLICY]', async ({ request }) => {
  // 双重阻断：站点 RegisterEnabled=false（运营配置，不得改动）+
  // 全局红线禁止在任何环境创建账号。按 Phase 2 语义如实标 BLOCKED，
  // 绝不伪造「注册成功」。
  test.info().annotations.push({
    type: 'BLOCKED_BY_POLICY',
    description: 'RegisterEnabled=false 且红线禁止创建账号；注册场景只能等待用户显式授权解禁',
  })
  const status = await request.get('/api/status')
  const body = (await status.json()) as UterResponse<{ register_enabled?: boolean }>
  expect(status.ok()).toBeTruthy()
  expect(body.success).toBe(true)
  // 验证阻断事实真实存在：站点确实关闭注册。
  expect(body.data?.register_enabled ?? false).toBe(false)
  test.skip(true, 'BLOCKED_BY_POLICY: 红线禁止创建账号（本地/E2E/冒烟/脚本全覆盖）')
})

test('biz_02 密码登录成功（真实凭据）', async () => {
  // 独立登录：不污染 worker 共享会话。
  const ctx = await base.request.newContext()
  const res = await ctx.post('/api/user/login', {
    data: readBusinessCredentials(),
  })
  const body = (await res.json()) as UterResponse<{ access_token?: string }>
  expect(res.ok()).toBeTruthy()
  expect(body.success).toBe(true)
  expect(body.data?.access_token).toBeTruthy()
  await ctx.dispose()
})

test('biz_03 错误密码登录被拒绝', async () => {
  const ctx = await base.request.newContext()
  const res = await ctx.post('/api/user/login', {
    data: { username: readBusinessCredentials().username, password: 'definitely-wrong-password' },
  })
  const body = (await res.json()) as UterResponse
  // uter 登录失败也返回 HTTP 200 + success:false —— 必须看业务字段。
  expect(body.success).toBe(false)
  expect(body.message).toBeTruthy()
  await ctx.dispose()
})

test('biz_04 未登录调用受保护 API 被 401 拒绝', async () => {
  const ctx = await base.request.newContext()
  const res = await ctx.get('/api/user/self')
  expect(res.status()).toBe(401)
  await ctx.dispose()
})

test('biz_05 未登录访问受保护页面跳转登录页', async ({ page }) => {
  await page.goto('/wallet', { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/sign-in|login/, { timeout: 15_000 })
  expect(page.url()).toMatch(/sign-in|login/)
})

test('biz_06 已登录读取个人信息 /api/user/self', async ({ authedApi }) => {
  const res = await authedApi.get('/api/user/self')
  const body = (await res.json()) as UterResponse<{ username?: string }>
  expect(res.ok()).toBeTruthy()
  expect(body.success).toBe(true)
  expect(body.data?.username).toBe(readBusinessCredentials().username)
})

test('biz_07 会话刷新成功且 access token 轮换', async ({ authedApi }) => {
  const res = await authedApi.refresh()
  const body = (await res.json()) as UterResponse
  expect(res.ok()).toBeTruthy()
  expect(body.success).toBe(true)
  // refresh 内部已把新 token 写回客户端：后续请求携带的是新 token。
  const verify = await authedApi.get('/api/user/self')
  expect(verify.ok()).toBeTruthy()
})

test('biz_08 登出后受保护 API 失效', async () => {
  const ctx = await base.request.newContext()
  await loginViaApi(ctx)
  const res = await ctx.post('/api/user/auth/logout')
  expect(res.ok()).toBeTruthy()
  const after = await ctx.get('/api/user/self')
  expect([401, 403]).toContain(after.status())
  await ctx.dispose()
})

// ---------------------------------------------------------------------------
// 2. 公开/模块内容域（biz_09–biz_12，pricing/rankings 需登录态）
// ---------------------------------------------------------------------------

test('biz_09 站点状态 /api/status（公开）', async ({ request }) => {
  const res = await request.get('/api/status')
  const body = (await res.json()) as UterResponse
  expect(res.ok()).toBeTruthy()
  expect(body.success).toBe(true)
  expect(body.data).toBeTruthy()
})

test('biz_10 公告接口 /api/notice（公开）', async ({ request }) => {
  const res = await request.get('/api/notice')
  expect(res.ok()).toBeTruthy()
  const body = (await res.json()) as UterResponse
  expect(body.success).toBe(true)
})

test('biz_11 定价接口 /api/pricing（登录态）', async ({ authedApi }) => {
  const res = await authedApi.get('/api/pricing')
  const body = (await res.json()) as UterResponse
  expect(res.ok()).toBeTruthy()
  expect(body.success).toBe(true)
})

test('biz_12 排行榜 /api/rankings（登录态）', async ({ authedApi }) => {
  const res = await authedApi.get('/api/rankings')
  const body = (await res.json()) as UterResponse
  expect(res.ok()).toBeTruthy()
  expect(body.success).toBe(true)
})

// ---------------------------------------------------------------------------
// 3. 密钥管理域（biz_13–biz_16，自带清理闭环）
// ---------------------------------------------------------------------------

test('biz_13 密钥列表 /api/token/（登录态）', async ({ authedApi }) => {
  const res = await authedApi.get('/api/token/')
  const body = (await res.json()) as UterResponse<{ items?: unknown[]; total?: number }>
  expect(res.ok()).toBeTruthy()
  expect(body.success).toBe(true)
  // 分页结构：{ page, page_size, total, items }。
  expect(Array.isArray(body.data?.items)).toBe(true)
  expect(typeof body.data?.total).toBe('number')
})

test('biz_14 创建密钥 POST /api/token/', async ({ authedApi }) => {
  const id = await createToken(authedApi, `phase2-biz14-${Date.now()}`)
  expect(typeof id).toBe('number')
  const detail = await authedApi.get(`/api/token/${id}`)
  const body = (await detail.json()) as UterResponse<{ id?: number; name?: string }>
  expect(body.success).toBe(true)
  expect(body.data?.id).toBe(id)
})

test('biz_15 更新密钥改名并回读验证', async ({ authedApi }) => {
  const id = await createToken(authedApi, `phase2-biz15-${Date.now()}`)
  const newName = `phase2-biz15-renamed-${Date.now()}`
  const update = await authedApi.put('/api/token/', {
    data: {
      id,
      name: newName,
      expired_time: -1,
      remain_quota: 0,
      unlimited_quota: false,
    },
  })
  const updated = (await update.json()) as UterResponse
  expect(updated.success).toBe(true)

  const list = await authedApi.get('/api/token/?p=1&page_size=100')
  const listBody = (await list.json()) as UterResponse<{
    items?: { id: number; name: string }[]
  }>
  const found = (listBody.data?.items ?? []).find((t) => t.id === id)
  expect(found?.name).toBe(newName)
})

test('biz_16 删除密钥后列表不再包含', async ({ authedApi }) => {
  const id = await createToken(authedApi, `phase2-biz16-${Date.now()}`)
  const del = await authedApi.delete(`/api/token/${id}`)
  expect(del.ok()).toBeTruthy()
  // 回读验证：列表里不再有该密钥。
  const list = await authedApi.get('/api/token/?p=1&page_size=100')
  const listBody = (await list.json()) as UterResponse<{ items?: { id: number }[] }>
  expect((listBody.data?.items ?? []).some((t) => t.id === id)).toBe(false)
})

// ---------------------------------------------------------------------------
// 4. 用户数据域（biz_17–biz_21、biz_24，全部只读）
// ---------------------------------------------------------------------------

test('biz_17 用户可用模型 /api/user/models', async ({ authedApi }) => {
  const res = await authedApi.get('/api/user/models')
  const body = (await res.json()) as UterResponse
  expect(res.ok()).toBeTruthy()
  expect(body.success).toBe(true)
})

test('biz_18 用户分组 /api/user/self/groups', async ({ authedApi }) => {
  const res = await authedApi.get('/api/user/self/groups')
  const body = (await res.json()) as UterResponse
  expect(res.ok()).toBeTruthy()
  expect(body.success).toBe(true)
})

test('biz_19 用户日志 /api/log/self（登录态）', async ({ authedApi }) => {
  const res = await authedApi.get('/api/log/self')
  const body = (await res.json()) as UterResponse
  expect(res.ok()).toBeTruthy()
  expect(body.success).toBe(true)
})

test('biz_20 充值订单列表 /api/user/topup/self（只读，不创建订单）', async ({ authedApi }) => {
  const res = await authedApi.get('/api/user/topup/self')
  const body = (await res.json()) as UterResponse
  expect(res.ok()).toBeTruthy()
  expect(body.success).toBe(true)
  // 绝不触发真实支付：只读查询。
  test.info().annotations.push({
    type: 'READ_ONLY',
    description: '充值域只调只读列表接口，不 POST /api/user/topup、不触发任何支付网关',
  })
})

test('biz_21 签到状态 /api/user/checkin（只读 GET，不 POST）', async ({ authedApi }) => {
  const res = await authedApi.get('/api/user/checkin')
  const body = (await res.json()) as UterResponse
  expect(res.ok()).toBeTruthy()
  expect(body.success).toBe(true)
})

test('biz_24 用户用量统计 /api/log/self/stat', async ({ authedApi }) => {
  const res = await authedApi.get('/api/log/self/stat')
  const body = (await res.json()) as UterResponse
  expect(res.ok()).toBeTruthy()
  expect(body.success).toBe(true)
})

// ---------------------------------------------------------------------------
// 5. 权限边界与真实 UI（biz_22–biz_23）
// ---------------------------------------------------------------------------

test('biz_22 普通用户访问管理 API 被 403 拒绝', async ({ authedApi }) => {
  const res = await authedApi.get('/api/user/')
  // AdminAuth 门禁：role=1 普通用户必须被拒。
  expect(res.status()).toBe(403)
})

test('biz_23 浏览器真实登录（表单）后 dashboard 渲染', async ({ authedApi, browser }) => {
  // 用例标题要求的是「浏览器真实登录（表单）」。原先复用 worker 级 authedPage
  // 只注入了 API 登录的 cookie：前端的 access_token 在响应体而不是 cookie 里，
  // 所以该页面其实从未真正登录，只是先撞上 /_authenticated 的客户端重定向再
  // 尝试表单兜底。完整套件里 worker 会话被前面用例轮换过、dev server 又可能
  // 正在 HMR 重建，页面会停在空白 shell，连 form 都等不到。
  // 改为本用例独占一个浏览器上下文，无条件走真实表单登录，链路最确定。
  const context = await browser.newContext()
  try {
    const page = await context.newPage()
    await loginViaUi(page)
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    // 主内容真实渲染（不是空白/错误页）：断言本身不放宽。
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 20_000 })
    // 网络层复核：worker 会话（Bearer）读自身信息成功。
    const res = await authedApi.get('/api/user/self')
    const body = (await res.json()) as UterResponse<{ username?: string }>
    expect(body.success).toBe(true)
    expect(body.data?.username).toBe(readBusinessCredentials().username)
  } finally {
    await context.close()
  }
})
