import { expect, test } from '@playwright/test'

import {
  hasVisualCredentials,
  loginViaApi,
  VisualAuthUnavailableError,
} from './lib/login'
import { finalizeUapStatus, setUapStatus } from './lib/status'
import { BASE_URL, ISOLATED_TEST_STACK } from './lib/target'

/**
 * 登录链路冒烟：验证凭据有效、/api/user/login 可用。
 *
 * 它不产出任何基线，也不为其他用例提供会话——鉴权页用例各自通过 lib/login.ts
 * 独立登录（refresh cookie 是一次性轮换，跨 context 共享会话必然失效）。
 * 这个冒烟的价值：凭据失效或登录端点异常时，这里先红并给出明确原因，
 * 而不是让 16 个鉴权截图用例各自模糊地失败。
 *
 * 状态语义（全部写入 UAP_STATUS 机读注解，绝不 ok=true 无标注）：
 *  - 缺凭据                         → SKIPPED（配置缺失，不是「验证通过」）；
 *  - 目标非隔离栈且密码登录被禁用   → BLOCKED（生产 PasswordLoginEnabled=false
 *                                     属运营配置，审计红线禁止修改）；
 *  - 隔离栈上登录仍失败 / 凭据错误  → 真 FAIL，绝不吞掉、绝不洗白。
 */

// 给「真正执行过 / 被显式标注」的用例统一补终态注解（见 lib/status.ts）。
test.afterEach(async ({}, testInfo) => finalizeUapStatus(testInfo))

test('登录链路冒烟：凭据可登录', async ({ page }) => {
  if (!hasVisualCredentials()) {
    setUapStatus(test.info(), {
      status: 'SKIPPED',
      reason:
        '未配置 VISUAL_TEST_EMAIL / VISUAL_TEST_PASSWORD（web/.env.local），登录冒烟未执行',
      policy: 'NO_CREDENTIALS_NO_FAKE_PASS',
    })
    test.skip(true, '未配置视觉回归凭据（机读 UAP_STATUS:SKIPPED）')
  }

  try {
    await loginViaApi(page)
  } catch (error) {
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
    // 隔离栈上仍报「禁用密码登录」= 隔离副本没配好，是真红灯；
    // 凭据错误 / 网络错误同样是真红灯。一律原样抛出 → FAIL。
    throw error
  }

  // 已建立登录态：访问需要鉴权的轻量页面应停留在登录后视图，而不是被弹回 /sign-in。
  await page.goto('/dashboard')
  await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 20_000 })
})
