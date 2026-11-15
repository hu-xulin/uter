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
 * UTER DESIGN SYSTEM 6.0 — 真实无头浏览器视觉验证
 * 输出：web/visual-regression/uds6/{screenshots,run-log.json}
 * 退出码：0 全部通过；1 存在渲染错误；2 浏览器缺失（BLOCKED，绝不报 PASS）
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DS = fileURLToPath(new URL('..', import.meta.url))
const REPO = join(DS, '..', '..', '..')
const OUT = join(REPO, 'web', 'visual-regression', 'uds6')
const HTML = join(DS, 'SHOWCASE-6.0.html')
const PLAYWRIGHT = join(REPO, 'web', 'node_modules', 'playwright', 'index.mjs')

mkdirSync(join(OUT, 'screenshots'), { recursive: true })

if (!existsSync(PLAYWRIGHT) || !existsSync(HTML)) {
  writeFileSync(join(OUT, 'run-log.json'), JSON.stringify({ verdict: 'BLOCKED', reason: 'Playwright 或 Showcase 缺失', executed: false }, null, 2))
  console.error('BLOCKED — Playwright 或 Showcase 缺失，未执行')
  process.exit(2)
}

const { chromium } = await import(PLAYWRIGHT)
let browser
try {
  browser = await chromium.launch({ headless: true })
} catch (e) {
  writeFileSync(join(OUT, 'run-log.json'), JSON.stringify({ verdict: 'BLOCKED', reason: String(e), executed: false }, null, 2))
  console.error('BLOCKED — Chromium 无法启动:', String(e))
  process.exit(2)
}

const cases = [
  { theme: 'light', viewport: 'desktop', width: 1440, height: 900 },
  { theme: 'dark', viewport: 'desktop', width: 1440, height: 900 },
  { theme: 'light', viewport: 'mobile', width: 390, height: 844 },
  { theme: 'dark', viewport: 'mobile', width: 390, height: 844 },
]

const results = []
let totalErrors = 0

for (const c of cases) {
  const page = await browser.newPage({ viewport: { width: c.width, height: c.height }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e)}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
  await page.goto(`file://${HTML}`, { waitUntil: 'load' })
  await page.evaluate((t) => document.documentElement.setAttribute('data-ds-theme', t), c.theme)
  if (c.viewport === 'mobile') await page.evaluate(() => document.body.setAttribute('data-viewport', 'mobile'))
  await page.waitForTimeout(120)

  const info = await page.evaluate(() => {
    const root = document.documentElement
    const cs = getComputedStyle(root)
    const g = document.querySelector('.g-new')
    const old = document.querySelector('.g-old')
    const q = (sel) => document.querySelectorAll(sel).length
    return {
      theme: root.getAttribute('data-ds-theme'),
      viewport: document.body.getAttribute('data-viewport'),
      modules: q('[data-module-id]'),
      sections: q('[data-section]'),
      tokenRows: q('[data-token]'),
      languages: q('[data-language]'),
      syntaxSwatches: q('.syn-sw'),
      componentStates: q('.state-cell'),
      gradientSamples: q('#gradient tbody tr'),
      brandVar: cs.getPropertyValue('--ds-color-brand-1').trim(),
      bodyFontVar: cs.getPropertyValue('--ds-text-sm').trim(),
      gradientFrom: cs.getPropertyValue('--ds-color-gradient-light-from').trim(),
      syntaxKeyword: cs.getPropertyValue('--ds-syntax-keyword').trim(),
      bodyBg: getComputedStyle(document.body).backgroundColor,
      bodyFg: getComputedStyle(document.body).color,
      newGradientImage: g ? getComputedStyle(g).backgroundImage.slice(0, 220) : null,
      oldGradientImage: old ? getComputedStyle(old).backgroundImage.slice(0, 220) : null,
      scrollHeight: document.documentElement.scrollHeight,
      reducedMotionRule: Array.from(document.styleSheets).some((s) => {
        try { return Array.from(s.cssRules).some((r) => r.cssText.includes('prefers-reduced-motion')) } catch (e) { return false }
      }),
    }
  })

  const shot = join(OUT, 'screenshots', `uds6-${c.theme}-${c.viewport}.png`)
  await page.screenshot({ path: shot })
  totalErrors += errors.length
  results.push({ ...c, screenshot: `web/visual-regression/uds6/screenshots/uds6-${c.theme}-${c.viewport}.png`, info, errors })
  await page.close()
}

await browser.close()

// 真实差异：Light vs Dark 的计算样式（不是声明值）
const light = results.find((r) => r.theme === 'light' && r.viewport === 'desktop').info
const dark = results.find((r) => r.theme === 'dark' && r.viewport === 'desktop').info
const diff = ['brandVar', 'bodyBg', 'bodyFg', 'newGradientImage'].map((k) => ({ key: k, light: light[k], dark: dark[k], changed: light[k] !== dark[k] }))

const verdict = totalErrors === 0 && results.every((r) => r.info.modules === 38 && r.info.sections === 418 && r.info.languages >= 10 && r.info.tokenRows >= 250 && r.info.reducedMotionRule) && diff.every((d) => d.changed)
  ? 'PASS'
  : 'FAIL'

const log = {
  checker: 'visual-check.mjs', executed: true, engine: 'Playwright Chromium (headless)',
  started_at: new Date().toISOString(), verdict,
  cases: results, lightDarkDiff: diff,
  consoleErrors: totalErrors,
  limitation: '仅覆盖 6.0 Showcase 单文件在 Light/Dark × Desktop/Mobile 的真实渲染；真实产品页面（React 路由）视觉回归需完整服务栈，状态 BLOCKED，未执行，不得计为 PASS。',
}
writeFileSync(join(OUT, 'run-log.json'), JSON.stringify(log, null, 2) + '\n')
console.log(JSON.stringify({ verdict, cases: results.length, consoleErrors: totalErrors, diff, modules: light.modules, sections: light.sections, languages: light.languages, tokenRows: light.tokenRows }, null, 2))
process.exit(verdict === 'PASS' ? 0 : 1)
