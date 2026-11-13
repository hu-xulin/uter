import type { APIRequestContext, APIResponse } from '@playwright/test'

import { loginViaApi } from './login'
import { cleanupTokens, trackToken } from './cleanup'

/**
 * 带 Bearer 头的已登录 API 客户端。
 *
 * uter 的面板鉴权是「短时 access_token（Authorization: Bearer）+ 一次性轮换的
 * refresh cookie」。access token 在登录响应体里而不是 cookie，所以每个请求
 * 都要显式带 Bearer 头；refresh 会轮换 session 版本使旧 token 失效，
 * 因此 refresh() 必须同步替换本客户端持有的 token。
 */
export class AuthedApi {
  private token: string

  private constructor(
    readonly context: APIRequestContext,
    token: string
  ) {
    this.token = token
  }

  static async create(): Promise<AuthedApi> {
    const ctx = await import('@playwright/test').then((m) => m.request.newContext())
    const login = await loginViaApi(ctx)
    if (!login.accessToken) {
      await ctx.dispose()
      throw new Error('登录响应未包含 access_token，无法建立 Bearer 会话')
    }
    return new AuthedApi(ctx, login.accessToken)
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return { Authorization: `Bearer ${this.token}`, ...extra }
  }

  private options(opts: { headers?: Record<string, string>; data?: unknown } = {}) {
    return {
      headers: this.headers(opts.headers),
      ...(opts.data !== undefined ? { data: opts.data } : {}),
    }
  }

  get(url: string): Promise<APIResponse> {
    return this.context.get(url, { headers: this.headers() })
  }

  post(url: string, opts: { headers?: Record<string, string>; data?: unknown } = {}): Promise<APIResponse> {
    return this.context.post(url, this.options(opts))
  }

  put(url: string, opts: { headers?: Record<string, string>; data?: unknown } = {}): Promise<APIResponse> {
    return this.context.put(url, this.options(opts))
  }

  delete(url: string, opts: { headers?: Record<string, string> } = {}): Promise<APIResponse> {
    return this.context.delete(url, { headers: this.headers(opts.headers) })
  }

  /** 刷新会话：refresh cookie 轮换 + 换取新 access token（旧 token 立即失效）。 */
  async refresh(): Promise<APIResponse> {
    const res = await this.context.post('/api/user/auth/refresh')
    const body = (await res.json()) as { success?: boolean; data?: { access_token?: string } }
    if (body.success && body.data?.access_token) {
      this.token = body.data.access_token
    }
    return res
  }

  storageState() {
    return this.context.storageState()
  }

  async dispose(): Promise<void> {
    await cleanupTokens(this.context)
    await this.context.dispose()
  }
}

// 密钥创建统一走这里：保证任何用例创建的资源都被登记进清理清单。
// POST /api/token/ 只回 {success:true} 不带 id，故按名回查列表定位 id。
export async function createToken(api: AuthedApi, name: string): Promise<number> {
  const res = await api.post('/api/token/', {
    data: { name, expired_time: -1, remain_quota: 0, unlimited_quota: false },
  })
  const body = (await res.json()) as { success?: boolean }
  if (!body.success) {
    throw new Error(`创建密钥失败：HTTP ${res.status()} ${JSON.stringify(body).slice(0, 200)}`)
  }
  const search = await api.get(`/api/token/search?keyword=${encodeURIComponent(name)}&p=1&page_size=50`)
  const found = (await search.json()) as {
    success?: boolean
    data?: { items?: { id: number; name: string }[]; total?: number }
  }
  const item = (found.data?.items ?? []).find((t) => t.name === name)
  if (!item) {
    throw new Error(`创建后按名回查未命中：${name}`)
  }
  trackToken(item.id)
  return item.id
}
