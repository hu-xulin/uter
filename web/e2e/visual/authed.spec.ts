import { expect, test } from '@playwright/test'

import { openRoute, toMaskLocators } from './lib/harness'
import {
  hasVisualCredentials,
  loginViaApi,
  VisualAuthUnavailableError,
} from './lib/login'
import { enabledRoutes, AUTHENTICATED_ROUTES } from './lib/pages'
import { finalizeUapStatus, setUapStatus } from './lib/status'
import { BASE_URL, ISOLATED_TEST_STACK, VIEWPORTS } from './lib/target'

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
 * 桌面 / 移动两个用例都保留；隔离栈正确配置时登录真实成功、29 个视觉用例真实跑。
 * 目标非隔离栈且密码登录被禁用时如实标 BLOCKED（机读注解），既不静默
 * skip 成 ok=true，也不伪装成 PASS；缺凭据标 SKIPPED。
 */

// 给「真正执行过 / 被显式标注」的用例统一补终态注解（见 lib/status.ts）。
test.afterEach(async ({}, testInfo) => finalizeUapStatus(testInfo))

function skipOrBlockOnAuthUnavailable(error: unknown): void {
  if (error instanceof VisualAuthUnavailableError && !ISOLATED_TEST_STACK) {
    setUapStatus(test.info(), {
      status: 'BLOCKED',
      reason:
        `${error.backendMessage}；目标 ${BASE_URL} 不是测试专用隔离栈，` +
        'PasswordLoginEnabled=false 是生产运营配置，审计红线禁止修改。' +
        '请启动 scripts/phase2-test-stack.sh 并把 VISUAL_BASE_URL 指向隔离前端。',
      policy: 'AUDIT_RED_LINE_NO_PRODUCTION_AUTH_CHANGE',
    })
    test.skip(true, `BLOCKED: ${error.message}`)
  }
  // 隔离栈上仍失败 / 凭据错误 / 网络错误 → 调用方原样抛出 → FAIL。
}

const routes = enabledRoutes(AUTHENTICATED_ROUTES)

for (const viewport of VIEWPORTS) {
  test(`鉴权页面基线 - ${viewport.name}`, async ({ page }) => {
    if (!hasVisualCredentials()) {
      setUapStatus(test.info(), {
        status: 'SKIPPED',
        reason:
          '未配置 VISUAL_TEST_EMAIL / VISUAL_TEST_PASSWORD（web/.env.local），鉴权页场景未执行',
        policy: 'NO_CREDENTIALS_NO_FAKE_PASS',
      })
      test.skip(true, '未配置视觉回归凭据（机读 UAP_STATUS:SKIPPED）')
    }

    try {
      await loginViaApi(page)
    } catch (error) {
      skipOrBlockOnAuthUnavailable(error)
      throw error
    }

    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    })

    for (const route of routes) {
      await openRoute(page, route.path, route)
      await expect(page).toHaveScreenshot(
        `${route.name}-${viewport.name}.png`,
        {
          fullPage: route.fullPage ?? false,
          mask: toMaskLocators(page, route.mask),
        }
      )
    }
  })
}
