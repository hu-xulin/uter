import { expect, test } from '@playwright/test'

import { hasVisualCredentials, loginViaApi } from './lib/login'

/**
 * 登录链路冒烟：验证凭据有效、/api/user/login 可用。
 *
 * 它不产出任何基线，也不为其他用例提供会话——鉴权页用例各自通过 lib/login.ts
 * 独立登录（refresh cookie 是一次性轮换，跨 context 共享会话必然失效）。
 * 这个冒烟的价值：凭据失效或登录端点异常时，这里先红并给出明确原因，
 * 而不是让 16 个鉴权截图用例各自模糊地失败。
 *
 * 缺凭据时标记 **skipped 而不是 passed**：配置缺失与「验证通过」必须能一眼区分。
 */

test.skip(
  !hasVisualCredentials(),
  '未配置 VISUAL_TEST_EMAIL / VISUAL_TEST_PASSWORD（web/.env.local），登录冒烟跳过'
)

test('登录链路冒烟：凭据可登录', async ({ page }) => {
  await loginViaApi(page)

  // 已建立登录态：访问需要鉴权的轻量页面应停留在登录后视图，而不是被弹回 /sign-in。
  await page.goto('/dashboard')
  await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 20_000 })
})
