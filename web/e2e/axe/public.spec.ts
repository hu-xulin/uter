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

import { PUBLIC_ROUTES } from '../visual/lib/pages'

/**
 * 公开页 axe 可访问性扫描（无需登录）。
 *
 * 阻断口径（首版）：impact 为 `critical` / `serious` 的违规必须为 0；
 * `moderate` / `minor` 逐条打印到输出供人工跟进，暂不阻断。
 * 升级路径：当存量 moderate 清理完毕后，把对应等级移入阻断集合。
 *
 * 任何违规都会让所在用例失败并指出页面 + 规则 + 目标节点，
 * 不允许以「降阈值」「跳过规则」的方式把违规洗成通过。
 */

const BLOCKING_IMPACTS = new Set(['critical', 'serious'])

/**
 * 页面就绪等待：与 e2e/visual/lib/harness.ts 的 openRoute 同口径 ——
 * goto(domcontentloaded) + fonts.ready + OR 兜底软锚点（失败不硬退，
 * 锚点只是骨架屏启发式；axe 扫的是真实 DOM，多等少等不改变违规判定），
 * 最后短沉降避开入场动画中的中间态。
 */
async function openForScan(
  page: import('@playwright/test').Page,
  path: string,
  ready?: string
): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => document.fonts.ready)
  const anchor = ready
    ? `${ready}, main, header, form, [role="main"]`
    : 'main, header, form, [role="main"]'
  await page
    .locator(anchor)
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 })
    .catch(() => {})
  // 等入场动画（landing-animate-*：fade-up/in、scale-in 等）跑到终态再扫描，
  // 否则 opacity<1 的中间态会让 axe 把静止态本就达标的配色误判成
  // color-contrast 违规（对比度按「元素与页面背景的混合色」计算）。
  await page
    .waitForFunction(
      () =>
        [
          ...document.querySelectorAll(
            '.landing-animate-fade-up, .landing-animate-fade-in, .landing-animate-scale-in, .landing-animate-fade-left, .landing-animate-fade-right'
          ),
        ].every((el) => getComputedStyle(el).opacity === '1'),
      undefined,
      { timeout: 10_000 }
    )
    .catch(() => {})
  await page.waitForTimeout(250)
}

for (const route of PUBLIC_ROUTES) {
  test(`axe: 公开页 ${route.path}`, async ({ page }) => {
    await openForScan(page, route.path, route.ready)

    const results = await new AxeBuilder({ page }).analyze()

    const blocking = results.violations.filter((v) =>
      v.impact ? BLOCKING_IMPACTS.has(v.impact) : false
    )
    const advisory = results.violations.filter(
      (v) => !v.impact || !BLOCKING_IMPACTS.has(v.impact)
    )
    if (advisory.length > 0) {
      for (const v of advisory) {
        // eslint-disable-next-line no-console
        console.log(
          `[axe:advisory][${route.path}] ${v.impact ?? 'unknown'} ${v.id}: ${v.help} (${v.nodes.length} nodes)`
        )
      }
    }

    expect(
      blocking,
      `${route.path} 存在 critical/serious 可访问性违规：${blocking
        .map(
          (v) =>
            `${v.impact}/${v.id} "${v.help}" -> ${v.nodes
              .slice(0, 5)
              .map((n) => n.target.join(' '))
              .join('; ')}`
        )
        .join('\n')}`
    ).toEqual([])
  })
}
