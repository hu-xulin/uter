import { expect, test } from '@playwright/test'

import { openRoute, toMaskLocators } from './lib/harness'
import { enabledRoutes, PUBLIC_ROUTES } from './lib/pages'
import { VIEWPORTS } from './lib/target'

/**
 * 免登录路由 × 双视口（1440x900 / 390x844）的像素基线。
 *
 * 更新基线：`bun run test:visual:e2e:update`
 * 每次更新都必须自己 review diff —— 无脑 -u 等于把回归写进基线。
 */

const routes = enabledRoutes(PUBLIC_ROUTES)

// 串行：截图与 GPU 合成争抢会让并行结果不可复现。
test.describe.configure({ mode: 'default' })

for (const route of routes) {
  for (const viewport of VIEWPORTS) {
    test(`${route.name} - ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })
      await openRoute(page, route.path, route)
      await expect(page).toHaveScreenshot(
        `${route.name}-${viewport.name}.png`,
        {
          fullPage: route.fullPage ?? false,
          mask: toMaskLocators(page, route.mask),
        }
      )
    })
  }
}
