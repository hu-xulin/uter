import { expect, test } from '@playwright/test'

import { openRoute, toMaskLocators } from './lib/harness'
import { hasVisualCredentials, loginViaApi } from './lib/login'
import { enabledRoutes, AUTHENTICATED_ROUTES } from './lib/pages'
import { VIEWPORTS } from './lib/target'

/**
 * 需登录路由的像素基线。
 *
 * 架构约束（2026-10-30 实测结论）：
 *  - uter 的 refresh cookie 是一次性轮换（OWASP 推荐），多个 context 复用同一份
 *    storageState 会在几个用例后触发 /api/user/auth/refresh 401 并被全局登出；
 *  - 登录接口有 CriticalRateLimit（20 次/20 分钟/IP，成败都计数）。
 *
 * 因此每个视口一个**长用例**：API 登录 1 次（cookie 直接进当前 context），随后
 * 串行走全部鉴权页截图。整轮鉴权轨只消耗 2 次登录配额。单个页面的截图差异会让
 * 所在用例失败并在报告中指明是哪张 PNG，修好后重跑即可。
 *
 * 缺凭据时整组标记 **skipped 而不是 passed**：门禁产出必须能区分「测过没问题」
 * 与「没测」。
 */

test.skip(
  !hasVisualCredentials(),
  '未配置 VISUAL_TEST_EMAIL / VISUAL_TEST_PASSWORD（web/.env.local），鉴权页场景跳过'
)

const routes = enabledRoutes(AUTHENTICATED_ROUTES)

for (const viewport of VIEWPORTS) {
  test(`鉴权页面基线 - ${viewport.name}`, async ({ page }) => {
    await loginViaApi(page)
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    })

    for (const route of routes) {
      await openRoute(page, route.path, route)
      await expect(page).toHaveScreenshot(`${route.name}-${viewport.name}.png`, {
        fullPage: route.fullPage ?? false,
        mask: toMaskLocators(page, route.mask),
      })
    }
  })
}
