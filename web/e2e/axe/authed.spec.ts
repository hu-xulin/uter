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
  // 凭据已配置但产品侧禁用了密码登录（如站点仅开放 OAuth）时，
  // 无法建立会话属于「没测」而不是「违规」：显式 skip 并写明原因，
  // 与「缺凭据跳过」同一口径，绝不允许退化成假通过。
  try {
    await loginViaApi(page)
  } catch (err) {
    test.skip(
      true,
      `无法建立登录态，鉴权页 axe 扫描未执行：${(err as Error).message}`
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
            .map((n) => n.target.join(' '))
            .join('; ')
      )
    }
  }

  expect(
    blockingByRoute,
    '鉴权页存在 critical/serious 可访问性违规：\n' + blockingByRoute.join('\n')
  ).toEqual([])
})
