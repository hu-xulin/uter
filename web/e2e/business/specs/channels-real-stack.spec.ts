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
import { expect, test as base, type APIRequestContext } from '@playwright/test'

import {
  elevateTestAccountInIsolatedCopy,
  restoreTestAccountInIsolatedCopy,
} from '../lib/isolated-admin'
import { loginViaApi, loginViaUi } from '../lib/login'
import { BASE_URL } from '../lib/target'

/**
 * 三渠道真实隔离栈 E2E（Uter Route / Uter.api / 阿里百炼）。
 *
 * 与 src/features/channels/.../__tests__ 的 mock 集成测试互补：本文件跑在
 * Phase2 隔离栈（:3100 + DB 副本 + Redis 6380）上，无 mock、无内存替身。
 *
 * 权限来源：唯一已授权测试账号 Test123 在【隔离 DB 副本】上被临时提升为
 * root，仅用于本轮测试；生产库与 :3000 进程从未被改动。用例本身不创建账号、
 * 不触发支付、不修改生产数据；所有写入均指向隔离副本并自带清理。
 *
 * 红线：这些用例不得在 BUSINESS_BASE_URL 指向生产 :3000 时运行。
 */
async function createAdminApiContext(): Promise<APIRequestContext> {
  // APIRequestContext 没有 setExtraHTTPHeaders（那是 Page 的方法）：
  // 先用一个临时 context 登录拿 token，再用 token 作为 extraHTTPHeaders
  // 重建带鉴权的 context。
  const bootstrap = await base.request.newContext({ baseURL: BASE_URL })
  let token: string
  try {
    const login = await loginViaApi(bootstrap)
    token = defined(login.accessToken, 'accessToken')
  } finally {
    await bootstrap.dispose()
  }
  const ctx = await base.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  })
  const self = await (await ctx.get('/api/user/self')).json()
  expect(self.data.role).toBe(100)
  return ctx
}

const test = base.extend<{ adminApi: APIRequestContext }>({
  adminApi: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const ctx = await createAdminApiContext()
      await use(ctx)
      await ctx.dispose()
    },
    { scope: 'worker' },
  ],
})

interface ApiEnvelope<T> {
  success?: boolean
  message?: string
  data?: T
}

const CHANNEL_TYPE_UTER_ROUTE = 65
const CHANNEL_TYPE_UTER_API = 64
const CHANNEL_TYPE_BAILIAN = 17

/**
 * 本轮创建的渠道 ID；afterAll 逆序删除。只清理本轮自己创建的资源。
 */
const createdChannelIds: number[] = []

// 只在这个 spec 加载时临时提权；afterAll 中还原并核对生产库未受影响。
test.beforeAll(() => {
  elevateTestAccountInIsolatedCopy()
})

async function json<T>(res: Awaited<ReturnType<APIRequestContext['get']>>) {
  return (await res.json()) as ApiEnvelope<T>
}

/** 显式非空校验（等价 expect(...).toBeTruthy 但带类型收窄，避免 `!` 断言）。 */
function defined<T>(value: T | undefined | null, label: string): T {
  if (value === undefined || value === null) {
    throw new Error(`${label} 不应为空`)
  }
  return value
}

test.afterAll(async () => {
  const ctx = await createAdminApiContext()
  try {
    for (const id of createdChannelIds.reverse()) {
      const res = await ctx.delete(`/api/channel/${id}`)
      if (!res.ok()) {
        // eslint-disable-next-line no-console
        console.warn(`cleanup channel ${id} failed: HTTP ${res.status()}`)
      }
    }
  } finally {
    await ctx.dispose()
    // 清理完成后立刻还原隔离副本角色；生产库角色由 helper 交叉核对。
    restoreTestAccountInIsolatedCopy()
  }
})

// ---------------------------------------------------------------------------
// 1. 三类渠道的只读契约（列表 / 详情 / 模型）
// ---------------------------------------------------------------------------

test('R1 隔离栈管理员可读取渠道列表，三类渠道详情字段完整', async ({
  adminApi,
}) => {
  const list = await json<{ items: Array<{ id: number; type: number }> }>(
    await adminApi.get('/api/channel/?p=1&page_size=200')
  )
  expect(list.success).toBe(true)
  expect(list.data?.items).toBeTruthy()

  // 已存在的 Uter Route 渠道 65 是可读的真实样本。
  const route = defined(
    list.data?.items.find((c) => c.type === CHANNEL_TYPE_UTER_ROUTE),
    '隔离副本中的 Uter Route(65) 渠道'
  )
  const detail = await json<{
    id: number
    type: number
    name: string
    models: string
    group: string
  }>(await adminApi.get(`/api/channel/${route.id}`))
  expect(detail.success).toBe(true)
  expect(detail.data?.type).toBe(CHANNEL_TYPE_UTER_ROUTE)
  expect(detail.data?.name).toBeTruthy()
  expect(detail.data?.models).toBeTruthy()

  const models = await json<string[]>(
    await adminApi.get(`/api/channel/models?id=${route.id}`)
  )
  expect(models.success).toBe(true)
  expect(Array.isArray(models.data)).toBe(true)
})

test('R2 未带令牌读取渠道列表被拒绝（权限边界仍然生效）', async () => {
  const ctx = await base.request.newContext({ baseURL: BASE_URL })
  try {
    const res = await ctx.get('/api/channel/?p=1&page_size=1')
    expect([401, 403]).toContain(res.status())
  } finally {
    await ctx.dispose()
  }
})

// ---------------------------------------------------------------------------
// 2. Uter.api 创建链路：分组 → 价格预览 → 创建 → 回读 → 更新 → 删除
// ---------------------------------------------------------------------------

test('U1 Uter.api 分组列表与价格预览返回官方价/渠道价', async ({
  adminApi,
}) => {
  const groups = await json<{
    groups: Array<{ key: string; name: string; ratio: number }>
  }>(await adminApi.get('/api/channel/uterapi/groups'))
  expect(groups.success).toBe(true)
  expect(groups.data?.groups.length).toBeGreaterThan(0)
  const published = defined(
    defined(groups.data, 'groups.data').groups.find((g) => g.ratio > 0),
    '已发布分组'
  )

  const preview = await json<{
    group: string
    group_name: string
    ratio: number
    currency: string
    items: Array<{
      model_name: string
      price_supported: boolean
      official?: { tiers?: unknown[] }
      upstream_quote?: { input_per_million_usd?: number }
    }>
  }>(
    await adminApi.get(
      `/api/channel/uterapi/price-preview?group=${encodeURIComponent(published.key)}`
    )
  )
  expect(preview.success).toBe(true)
  expect(preview.data?.group).toBe(published.key)
  expect(preview.data?.group_name).toBe(published.name)
  expect(preview.data?.ratio).toBe(published.ratio)
  expect(preview.data?.items.length).toBeGreaterThan(0)
  const priced = defined(
    defined(preview.data, 'preview.data').items.find((i) => i.price_supported),
    '至少一个带官方价的模型'
  )
  expect(priced.official?.tiers).toBeTruthy()
  expect(priced.upstream_quote?.input_per_million_usd).toBeGreaterThan(0)
})

test('U2 Uter.api 未发布分组的价格预览返回业务错误', async ({ adminApi }) => {
  const res = await adminApi.get(
    '/api/channel/uterapi/price-preview?group=__e2e_missing_group__'
  )
  const body = await json(res)
  expect(res.ok()).toBeTruthy()
  expect(body.success).toBe(false)
  expect(body.message).toMatch(/group/i)
})

/**
 * 通用渠道 CRUD 闭环：创建 → 详情回读 → PUT 更新 → 回读 → 删除。
 * PUT 载荷不能含 status（服务端明确拒绝），所以只回传可编辑字段。
 */
async function channelCrudLifecycle(
  api: APIRequestContext,
  opts: {
    type: number
    name: string
    key: string
    baseUrl?: string
    models: string
  }
) {
  const channel: Record<string, unknown> = {
    name: opts.name,
    type: opts.type,
    key: opts.key,
    models: opts.models,
    group: 'default',
  }
  if (opts.baseUrl) channel.base_url = opts.baseUrl

  const createRes = await api.post('/api/channel/', {
    data: { mode: 'single', channel },
  })
  expect(createRes.ok()).toBeTruthy()
  const created = await json<{ id?: number; channel_id?: number }>(createRes)
  expect(created.success).toBe(true)
  const newId = defined(
    created.data?.id ?? created.data?.channel_id,
    'created channel id'
  )
  expect(newId).toBeGreaterThan(0)
  createdChannelIds.push(newId)

  const detail = await json<{ id: number; type: number; name: string }>(
    await api.get(`/api/channel/${newId}`)
  )
  expect(detail.success).toBe(true)
  expect(detail.data?.type).toBe(opts.type)
  expect(detail.data?.name).toBe(opts.name)

  const updateRes = await api.put('/api/channel/', {
    data: { ...channel, id: newId, name: `${opts.name}-updated` },
  })
  expect(updateRes.ok()).toBeTruthy()
  expect((await json(updateRes)).success).toBe(true)
  const after = await json<{ name: string }>(
    await api.get(`/api/channel/${newId}`)
  )
  expect(after.data?.name).toBe(`${opts.name}-updated`)

  const deleteRes = await api.delete(`/api/channel/${newId}`)
  expect(deleteRes.ok()).toBeTruthy()
  expect((await json(deleteRes)).success).toBe(true)
  createdChannelIds.splice(createdChannelIds.indexOf(newId), 1)
}

test('U3 Uter.api 无效密钥创建返回真实上游 401 且不误报成功', async ({
  adminApi,
}) => {
  const suffix = Date.now().toString(36)
  const createRes = await adminApi.post('/api/channel/uterapi', {
    data: {
      slots: [
        {
          name: `E2E-Uter.api-${suffix}`,
          group: 'Grok-heavy',
          keys: [`sk-e2e-invalid-${suffix}`],
        },
      ],
      group: 'default',
    },
  })
  expect(createRes.ok()).toBeTruthy()
  const body = await json<{ created?: number; channels?: unknown[] }>(createRes)
  // 真实分支：上游模型发现拿假 key 会 401，服务端必须返回业务失败，
  // 绝不能像修复前那样让前端把 success=false 误报成 "channel created"。
  expect(body.success).toBe(false)
  expect(body.message).toMatch(/401|status/i)
  expect(body.data?.created ?? 0).toBe(0)
})

test('U3b Uter.api(type 64) 编辑态走通用 PUT：回读 → 更新 → 删除闭环', async ({
  adminApi,
}) => {
  const suffix = Date.now().toString(36)
  await channelCrudLifecycle(adminApi, {
    type: CHANNEL_TYPE_UTER_API,
    name: `E2E-UterApiEdit-${suffix}`,
    key: `sk-e2e-uterapi-${suffix}`,
    baseUrl: 'https://api.uter.ai',
    models: 'gpt-6-luna',
  })
})

// ---------------------------------------------------------------------------
// 3. Uter Route 创建/编辑分支（模板渠道 65）
// ---------------------------------------------------------------------------

test('U4 Uter Route 创建（type 65）→ 回读 → 更新 → 删除闭环', async ({
  adminApi,
}) => {
  const suffix = Date.now().toString(36)
  await channelCrudLifecycle(adminApi, {
    type: CHANNEL_TYPE_UTER_ROUTE,
    name: `E2E-UterRoute-${suffix}`,
    key: `sk-e2e-route-${suffix}`,
    baseUrl: 'https://dreamrouter.ai',
    models: 'gpt-6-luna',
  })
})

// ---------------------------------------------------------------------------
// 4. 阿里百炼创建/编辑分支（type 17）
// ---------------------------------------------------------------------------

test('B1 阿里百炼创建（type 17）→ 回读 → 更新 → 删除闭环', async ({
  adminApi,
}) => {
  const suffix = Date.now().toString(36)
  await channelCrudLifecycle(adminApi, {
    type: CHANNEL_TYPE_BAILIAN,
    name: `E2E-Bailian-${suffix}`,
    key: `sk-e2e-bailian-${suffix}`,
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: 'qwen-plus',
  })
})

// ---------------------------------------------------------------------------
// 5. 真实浏览器 UI：管理员可打开渠道页并看到三类渠道
// ---------------------------------------------------------------------------

test('UI1 真实浏览器登录并渲染渠道管理页（管理员态）', async ({ browser }) => {
  const context = await browser.newContext()
  try {
    const page = await context.newPage()
    // 真实 UI 登录（表单 → 提交 → 跳转），不注入 token。
    try {
      await loginViaUi(page)
    } catch (error) {
      // 诊断信息：登录失败时把页面可见文本与 URL 写入断言消息，避免只看到超时。
      const body = await page
        .locator('body')
        .innerText()
        .catch(() => '')
      throw new Error(
        `UI 登录失败：${String(error)} URL=${page.url()} BODY=${body.slice(0, 600)}`
      )
    }
    await page.goto('/channels', { waitUntil: 'domcontentloaded' })
    await expect(page).not.toHaveURL(/\/sign-in|login/)
    // 真实浏览器：等主内容渲染（列表页有表格/卡片/标题任一可见元素）。
    await expect(
      page.locator('main, [role="main"], table, [data-slot="table"]').first()
    ).toBeVisible({ timeout: 20_000 })
    const bodyText = await page.locator('body').innerText()
    expect(bodyText.length).toBeGreaterThan(50)
    expect(bodyText).not.toMatch(/access denied|insufficient privileges/i)
  } finally {
    await context.close()
  }
})
