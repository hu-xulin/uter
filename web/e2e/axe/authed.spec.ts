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
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

import { hasVisualCredentials, loginViaApi } from '../visual/lib/login'
import { enabledRoutes, AUTHENTICATED_ROUTES } from '../visual/lib/pages'

/**
 * 需登录页 axe 可访问性扫描（钱包 / 控制台等核心业务页）。
 *
 * 复用视觉回归轨的会话约束：refresh cookie 一次性轮换、登录接口
 * CriticalRateLimit（20 次/20 分钟，成败都计数），因此采用「长用例」——
 * API 登录 1 次，随后串行扫描全部启用路由，只消耗 1 次登录配额。
 *
 * 缺凭据时整组标记 **skipped 而不是 passed**：门禁产出必须能区分
 * 「测过没问题」与「没测」。
 *
 * 阻断口径与公开页一致：critical / serious 必须为 0；
 * moderate / minor 打印供跟进，暂不阻断（升级路径见 public.spec.ts）。
 */

test.skip(
  !hasVisualCredentials(),
  '未配置 VISUAL_TEST_EMAIL / VISUAL_TEST_PASSWORD（web/.env.local），鉴权页 axe 扫描跳过'
)

const BLOCKING_IMPACTS = new Set(['critical', 'serious'])
const routes = enabledRoutes(AUTHENTICATED_ROUTES)

test('axe: 鉴权页批量扫描', async ({ page }) => {
  // 单个「长用例」串行扫描 9 个启用鉴权路由：每次都要真实导航、等待 SPA
  // 守卫、等字体就绪、再跑一次完整 axe 分析。项目级 120s 超时是给单页
  // 用例定的，实测 9 页真实扫描会超过它（2026-11-14 验收：120000ms
  // timeout，13 个公开页用例全绿而本用例被硬杀）。给本用例单独放宽到
  // 10 分钟，只是让真实扫描跑完；不跳过任何路由、不关闭任何 axe 规则、
  // 不降低 critical/serious 的阻断口径。
  test.setTimeout(600_000)

  // 凭据已配置但产品侧禁用了密码登录（如站点仅开放 OAuth）时，
  // 无法建立会话属于「没测」而不是「违规」：显式 skip 并写明原因，
  // 与「缺凭据跳过」同一口径，绝不允许退化成假通过。
  // 注意：test.skip 内部会抛特殊异常，必须放在 try/catch 之外，
  // 否则会被上面的 catch 吞掉、退化为「登录失败却扫了登录页还当基线」。
  let loginError: unknown = null
  try {
    await loginViaApi(page)
  } catch (err) {
    loginError = err
  }
  if (loginError) {
    test.skip(
      true,
      `无法建立登录态，鉴权页 axe 扫描未执行：${(loginError as Error).message}`
    )
  }

  // 探活：API 登录成功后访问首个鉴权路由。SPA 会在加载后把未登录态客户端弹回
  // /sign-in（不是服务端 302），所以等一小段再判定 URL。若仍被弹回 /sign-in，
  // 说明当前栈无法建立「页面级」会话——后端 new_api_refresh 会话 cookie 的
  // Path=/api/user/auth 不随 /dashboard 顶部导航携带，且 API 登录不写 SPA 存储
  // （无 access_token），鉴权页守卫据此判未登录。这属于「测不了」而非「违规」：
  // 显式 skip，绝不与真实违规混为一谈（也不洗白成通过）。
  await page.goto(routes[0].path, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  if (/\/sign-in/.test(page.url())) {
    test.skip(
      true,
      `登录态未能在页面级生效（访问 ${routes[0].path} 被弹回 /sign-in），鉴权页 axe 扫描未执行`
    )
  }

  const blockingByRoute: string[] = []
  for (const route of routes) {
    await page.goto(route.path, { waitUntil: 'domcontentloaded' })
    await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 20_000 })
    await page.evaluate(() => document.fonts.ready)
    const anchor = route.ready
      ? `${route.ready}, main, header, form, [role="main"]`
      : 'main, header, form, [role="main"]'
    await page
      .locator(anchor)
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 })
      .catch(() => {})
    await page.waitForTimeout(250)

    const results = await new AxeBuilder({ page }).analyze()
    const blocking = results.violations.filter(
      (v) => v.impact && BLOCKING_IMPACTS.has(v.impact)
    )
    for (const v of results.violations) {
      const tag =
        v.impact && BLOCKING_IMPACTS.has(v.impact) ? 'blocking' : 'advisory'
      console.log(
        `[axe:${tag}][${route.path}] ${v.impact ?? 'unknown'} ${v.id}: ${v.help} ` +
          `(${v.nodes.length} nodes)`
      )
    }
    for (const v of blocking) {
      blockingByRoute.push(
        `${route.path} ${v.impact}/${v.id} "${v.help}" -> ` +
          v.nodes
            .slice(0, 5)
            .map((n) => {
              // Keep the ACTUAL measured colours in the failure message so a
              // contrast regression can be fixed against real numbers instead
              // of guessed CSS. axe exposes them on the rule's `any[0].data`.
              const data = (n.any?.[0] as { data?: Record<string, unknown> } | undefined)?.data
              const measured = data
                ? ` [fg=${data.fgColor ?? '?'} bg=${data.bgColor ?? '?'} ratio=${data.contrastRatio ?? '?'} expected=${data.expectedContrastRatio ?? '?'}]`
                : ''
              return `${n.target.join(' ')}${measured}`
            })
            .join('; ')
      )
    }
  }

  expect(
    blockingByRoute,
    `鉴权页存在 critical/serious 可访问性违规：\n${blockingByRoute.join('\n')}`
  ).toEqual([])
})
