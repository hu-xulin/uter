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
/*
 * UTER DESIGN SYSTEM 8.0.0 — 真实 axe-core 无障碍检查
 * 对 SHOWCASE-8.0.0.html 在 Light/Dark × Desktop/Mobile 运行 WCAG 2.0/2.1/2.2 A+AA 规则，
 * 并做真实键盘 Tab 焦点可见性检查。输出 web/visual-regression/uds8/a11y-log.json。
 * 退出码 0 = 0 critical/serious violation；1 = 存在；2 = BLOCKED。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DS = fileURLToPath(new URL('..', import.meta.url))
const REPO = join(DS, '..', '..')
const OUT = join(REPO, 'web', 'visual-regression', 'uds8')
const HTML = join(DS, 'SHOWCASE-8.0.0.html')
const AXE = join(REPO, 'web', 'node_modules', 'axe-core', 'axe.min.js')
const PLAYWRIGHT = join(REPO, 'web', 'node_modules', 'playwright', 'index.mjs')

mkdirSync(OUT, { recursive: true })
if (!existsSync(AXE) || !existsSync(PLAYWRIGHT) || !existsSync(HTML)) {
  writeFileSync(join(OUT, 'a11y-log.json'), JSON.stringify({ verdict: 'BLOCKED', executed: false, reason: 'axe-core / Playwright / Showcase 缺失' }, null, 2))
  console.error('BLOCKED')
  process.exit(2)
}

const axeSource = readFileSync(AXE, 'utf8')
const { chromium } = await import(PLAYWRIGHT)
const browser = await chromium.launch({ headless: true })

const cases = [
  { theme: 'light', viewport: 'desktop', width: 1440, height: 900 },
  { theme: 'dark', viewport: 'desktop', width: 1440, height: 900 },
  { theme: 'light', viewport: 'mobile', width: 390, height: 844 },
  { theme: 'dark', viewport: 'mobile', width: 390, height: 844 },
]

const results = []
for (const c of cases) {
  const page = await browser.newPage({ viewport: { width: c.width, height: c.height } })
  await page.goto(`file://${HTML}`, { waitUntil: 'load' })
  await page.evaluate((t) => document.documentElement.setAttribute('data-ds-theme', t), c.theme)
  if (c.viewport === 'mobile') {
    await page.evaluate(() => document.body.setAttribute('data-viewport', 'mobile'))
    await page.setViewportSize({ width: 390, height: 844 })
  }
  await page.addScriptTag({ content: axeSource })
  const axe = await page.evaluate(async () => {
    const r = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      resultTypes: ['violations'],
    })
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }))
  })

  // 真实键盘 Tab 焦点可见性（必须用真实 Tab 触发 :focus-visible，JS .focus() 不会触发）
  await page.evaluate(() => { window.scrollTo(0, 0); document.body.focus() })
  const rows = []
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab')
    const row = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const cs = getComputedStyle(el)
      return {
        tag: el.tagName.toLowerCase(),
        label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
        outlineWidth: cs.outlineWidth,
        outlineStyle: cs.outlineStyle,
        hasVisibleFocus: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2,
      }
    })
    if (row) rows.push(row)
  }
  const focus = { checked: rows.length, visible: rows.filter((r) => r.hasVisibleFocus).length, rows }

  results.push({ ...c, violations: axe, focus })
  await page.close()
}
await browser.close()

const all = results.flatMap((r) => r.violations.map((v) => ({ ...v, case: `${r.theme}-${r.viewport}` })))
const blocking = all.filter((v) => v.impact === 'critical' || v.impact === 'serious')
const focusOk = results.every((r) => r.focus.visible === r.focus.checked)
const verdict = blocking.length === 0 && focusOk ? 'PASS' : 'FAIL'
const log = {
  checker: 'a11y-check.mjs', executed: true, engine: 'axe-core (WCAG 2.0/2.1/2.2 A+AA) + real keyboard Tab',
  started_at: new Date().toISOString(), verdict,
  cases: results,
  violationsTotal: all.length, blockingViolations: blocking.length,
  keyboardFocus: { checked: results[0].focus.checked, allVisible: focusOk },
  limitation: '覆盖 8.0.0 Showcase 单文件；真实产品页面的 axe / 屏幕阅读器 / 键盘路径需完整服务栈，状态 BLOCKED，未执行。',
}
writeFileSync(join(OUT, 'a11y-log.json'), JSON.stringify(log, null, 2) + '\n')
console.log(JSON.stringify({ verdict, cases: results.length, violationsTotal: all.length, blocking: blocking.length, focusOk, violations: all.slice(0, 20) }, null, 2))
process.exit(verdict === 'PASS' ? 0 : 1)
