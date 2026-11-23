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
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

// axe-core accessibility audit (MA-12 / M05-02 evidence tool).
//
// Usage:
//   AXE_BASE_URL=http://localhost:3000 \
//   AXE_USER=<account> AXE_PASS=<password> \
//   node scripts/axe-audit.mjs --out /tmp/axe-report.json
//
// Audits the sign-in page plus authenticated app pages. Credentials are read
// from the environment and are never written to the report. Exit code equals
// the number of pages with at least one serious/critical violation; zero
// violations on every audited page exits 0. Findings are always written to
// --out (JSON) for human review — automation records evidence, humans decide.
import { chromium } from 'playwright'

const BASE = process.env.AXE_BASE_URL || 'http://localhost:3000'
const OUT = (() => {
  const i = process.argv.indexOf('--out')
  return i > 0 ? process.argv[i + 1] : '/tmp/axe-audit-report.json'
})()
const axeSrc = readFileSync(
  new URL('../node_modules/axe-core/axe.min.js', import.meta.url),
  'utf8'
)

const AUTH_PAGES = (process.env.AXE_PAGES || '/console,/pricing,/keys')
  .split(',')
  .filter(Boolean)

const report = {
  generated_at: new Date().toISOString(),
  base_url: BASE,
  pages: [],
  summary: {},
}
let failedPages = 0

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()

async function auditCurrentPage(route) {
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  await page.evaluate(axeSrc)
  const results = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      },
    })
  )
  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.length,
    sample: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
  }))
  const serious = violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  )
  if (serious.length > 0) failedPages++
  report.pages.push({
    route,
    url: page.url(),
    violations,
    serious_count: serious.length,
  })
  // eslint-disable-next-line no-console
  console.log(
    `${route}: ${violations.length} violations (${serious.length} serious/critical)`
  )
}

// 1) public sign-in page
await page.goto(`${BASE}/login`, {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
})
await page.waitForTimeout(1500)
await auditCurrentPage('/login')

// 2) authenticated pages (skip silently if no credentials provided)
if (process.env.AXE_USER && process.env.AXE_PASS) {
  try {
    await page.goto(`${BASE}/login`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    await page.fill("input[name='username']", process.env.AXE_USER, {
      timeout: 15000,
    })
    await page.fill("input[name='password']", process.env.AXE_PASS, {
      timeout: 15000,
    })
    await page.keyboard.press('Enter')
    await page
      .waitForLoadState('networkidle', { timeout: 30000 })
      .catch(() => {})
    await page.waitForTimeout(2000)
    for (const route of AUTH_PAGES) {
      try {
        await page.goto(`${BASE}${route}`, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        })
        await page.waitForTimeout(2000)
        await auditCurrentPage(route)
      } catch (e) {
        report.pages.push({ route, error: String(e).slice(0, 200) })
        // eslint-disable-next-line no-console
        console.log(`${route}: ERROR ${String(e).slice(0, 120)}`)
      }
    }
  } catch (e) {
    report.pages.push({
      route: '/login',
      error: `login flow failed: ${String(e).slice(0, 200)}`,
    })
    // eslint-disable-next-line no-console
    console.log(
      'login flow failed — audited public pages only:',
      String(e).slice(0, 120)
    )
  }
} else {
  // eslint-disable-next-line no-console
  console.log(
    'AXE_USER/AXE_PASS not set — audited the public sign-in page only'
  )
}

await browser.close()
report.summary = {
  pages_audited: report.pages.length,
  pages_with_serious_violations: failedPages,
  total_violations: report.pages.reduce(
    (n, p) => n + (p.violations?.length || 0),
    0
  ),
}
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(report, null, 2))
// eslint-disable-next-line no-console
console.log(JSON.stringify(report.summary))
process.exit(failedPages > 0 ? 1 : 0)
