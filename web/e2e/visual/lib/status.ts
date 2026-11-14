import type { TestInfo } from '@playwright/test'

/**
 * UAP 门禁统一机读状态（视觉轨）。
 *
 * 背景：Playwright JSON reporter 对「被 skip 的用例」给出 `ok: true`，
 * 于是 E2E-RESULTS.json 里 biz_01（注册，策略性 BLOCKED）被算成了 PASS。
 * 修复方式不是取消 skip（语义上它就是 BLOCKED），而是让**原始 Playwright
 * 输出**携带一条显式、机读的状态注解，供 `.uap/bin/uap.mjs` 的 reporter
 * 读取并重新归类，而不是靠 stdout 文本或 `ok` 字段猜。
 *
 * 注解同时出现在 JSON reporter 的 `spec.tests[].annotations` 与
 * `results[].annotations` 两处（Playwright 1.64 实测），声明式与运行时都可写。
 *
 * 注：本文件与 `e2e/business/lib/status.ts` 是刻意重复的同一份最小实现——
 * 两轨不共享 web/e2e/ 下的公共文件（该目录不归本任务所有）。
 */

export type UapTestStatus =
  | 'PASS'
  | 'FAIL'
  | 'SKIPPED'
  | 'BLOCKED'
  | 'NOT_RUN'
  | 'NOT_APPLICABLE'

export const UAP_STATUS_ANNOTATION = 'UAP_STATUS'

export interface UapStatusPayload {
  status: UapTestStatus
  reason?: string
  policy?: string
  /** 对应的审计业务流名称，便于 reporter 汇总 20 流覆盖。 */
  flow?: string
}

/** 生成一条 UAP_STATUS 注解对象（声明式 `test(..., { annotation })` 用）。 */
export function uapStatusAnnotation(payload: UapStatusPayload): {
  type: string
  description: string
} {
  return {
    type: UAP_STATUS_ANNOTATION,
    description: JSON.stringify(payload),
  }
}

/**
 * 运行时把最终状态写到当前用例。
 * 先把本用例已有的 UAP_STATUS 清掉再写，保证 reporter 读到唯一确定的一条
 * （避免声明式默认值与运行时结果并存造成歧义）。
 */
export function setUapStatus(
  testInfo: TestInfo,
  payload: UapStatusPayload
): void {
  for (let i = testInfo.annotations.length - 1; i >= 0; i -= 1) {
    if (testInfo.annotations[i].type === UAP_STATUS_ANNOTATION) {
      testInfo.annotations.splice(i, 1)
    }
  }
  testInfo.annotations.push(uapStatusAnnotation(payload))
}

function declaredStatus(testInfo: TestInfo): UapTestStatus | undefined {
  const found = testInfo.annotations.find(
    (annotation) => annotation.type === UAP_STATUS_ANNOTATION
  )
  if (!found?.description) return undefined
  try {
    const parsed = JSON.parse(found.description) as { status?: UapTestStatus }
    return parsed.status
  } catch {
    return undefined
  }
}

/**
 * `test.afterEach` 用：给「真正执行过」的用例补一条终态注解。
 *  - 执行异常（failed/timedOut/interrupted）一律 FAIL，哪怕声明是 BLOCKED：
 *    一个自己报错的 BLOCKED 用例就是真红灯，不能被注解洗白。
 *  - 已显式声明 BLOCKED / SKIPPED / NOT_APPLICABLE / NOT_RUN 的保持原状。
 *  - 其余按 Playwright 实测结果写 PASS / SKIPPED。
 */
export function finalizeUapStatus(testInfo: TestInfo): void {
  const status = testInfo.status
  if (
    status === 'failed' ||
    status === 'timedOut' ||
    status === 'interrupted'
  ) {
    setUapStatus(testInfo, {
      status: 'FAIL',
      reason: `用例执行异常：${status}`,
    })
    return
  }

  const declared = declaredStatus(testInfo)
  if (
    declared === 'BLOCKED' ||
    declared === 'SKIPPED' ||
    declared === 'NOT_APPLICABLE' ||
    declared === 'NOT_RUN'
  ) {
    return
  }

  setUapStatus(testInfo, {
    status: status === 'skipped' ? 'SKIPPED' : 'PASS',
  })
}
