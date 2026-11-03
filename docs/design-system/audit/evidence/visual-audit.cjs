// UTER 3.0 设计合规审计 · Phase 6/7 浏览器视觉与无障碍采集脚本
// 只读审计：不修改被审计项目任何文件。产物写入 audit/evidence/。
const path = require('path')
const fs = require('fs')
const { chromium } = require('@playwright/test')

const BASE = 'http://127.0.0.1:3000'
const OUT = '/Users/lincolnhu/uter/docs/design-system/audit/evidence'
const SHOTS = path.join(OUT, 'shots')
const AXE_JS = path.join(OUT, 'axe.min.js')
fs.mkdirSync(SHOTS, { recursive: true })

const envText = fs.readFileSync('/Users/lincolnhu/uter/web/.env.local', 'utf8')
const env = Object.fromEntries(
  envText.split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => {
    const i = l.indexOf('=')
    return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]
  }),
)

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'h5', width: 390, height: 844 },
]
const THEMES = ['light', 'dark']
const PUBLIC_PAGES = [
  { path: '/', name: 'home' },
  { path: '/pricing', name: 'pricing' },
  { path: '/sign-in', name: 'sign-in' },
]
const AUTH_PAGES = [
  { path: '/dashboard', name: 'dashboard' },
  { path: '/keys', name: 'keys' },
  { path: '/wallet', name: 'wallet' },
  { path: '/models', name: 'models' },
  { path: '/usage-logs', name: 'usage-logs' },
  { path: '/playground', name: 'playground' },
  { path: '/channels', name: 'channels' },
  { path: '/profile', name: 'profile' },
  { path: '/subscriptions', name: 'subscriptions' },
]

async function login(page) {
  // API 登录（与 e2e/visual/lib/login.ts 一致）：/api/user/login 返回的 Set-Cookie
  // 直接写入当前 context，随后 page.goto 即为登录态。比 UI 表单登录鲁棒，且
  // 登录次数可控（CriticalRateLimit 成败都计数）。
  const res = await page.request.post(BASE + '/api/user/login', {
    data: {
      username: env.VISUAL_TEST_EMAIL,
      password: env.VISUAL_TEST_PASSWORD,
    },
  })
  const body = (await res.json().catch(() => ({}))) || {}
  if (!res.ok() || body.success !== true) {
    throw new Error(
      `API 登录失败：HTTP ${res.status()} ${body.message ?? '(无错误信息)'}`,
    )
  }
  return true
}

;(async () => {
  const results = []
  let loginOk = false
  let loginError = null
  const browser = await chromium.launch()

  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
      })
      const page = await ctx.newPage()
      const consoleErrors = []
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200))
      })
      await page.addInitScript((t) => {
        window.localStorage.setItem('newapi:theme:v1:mode', t)
      }, theme)

      // public pages
      for (const p of PUBLIC_PAGES) {
        try {
          await page.goto(BASE + p.path, { waitUntil: 'networkidle', timeout: 30000 })
          await page.waitForTimeout(800)
          const shot = `${p.name}_${vp.name}_${theme}.png`
          await page.screenshot({ path: path.join(SHOTS, shot), fullPage: false })
          let axe = null
          try {
            await page.addScriptTag({ path: AXE_JS })
            const r = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }))
            axe = r.violations
              .filter((v) => v.impact === 'critical' || v.impact === 'serious')
              .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help }))
          } catch (e) {
            axe = [{ error: String(e).slice(0, 120) }]
          }
          results.push({ page: p.path, name: p.name, viewport: vp.name, theme, shot, consoleErrors: consoleErrors.splice(0), axe })
        } catch (e) {
          results.push({ page: p.path, name: p.name, viewport: vp.name, theme, error: String(e).slice(0, 160) })
        }
      }

      // auth pages: only login on first pass, session persists in this context
      if (!loginOk && vp.name === 'desktop' && theme === 'light') {
        try {
          await login(page)
          loginOk = true
        } catch (e) {
          loginError = String(e).slice(0, 200)
        }
      }
      if (loginOk) {
        for (const p of AUTH_PAGES) {
          try {
            await page.goto(BASE + p.path, { waitUntil: 'networkidle', timeout: 30000 })
            await page.waitForTimeout(1000)
            const shot = `${p.name}_${vp.name}_${theme}.png`
            await page.screenshot({ path: path.join(SHOTS, shot), fullPage: false })
            let axe = null
            try {
              await page.addScriptTag({ path: AXE_JS })
              const r = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }))
              axe = r.violations
                .filter((v) => v.impact === 'critical' || v.impact === 'serious')
                .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help }))
            } catch (e) {
              axe = [{ error: String(e).slice(0, 120) }]
            }
            results.push({ page: p.path, name: p.name, viewport: vp.name, theme, shot, consoleErrors: consoleErrors.splice(0), axe })
          } catch (e) {
            results.push({ page: p.path, name: p.name, viewport: vp.name, theme, error: String(e).slice(0, 160) })
          }
        }
      }
      await ctx.close()
    }
  }
  await browser.close()
  fs.writeFileSync(
    path.join(OUT, '06-visual-a11y.json'),
    JSON.stringify({ loginOk, loginError, results }, null, 2),
  )
  const ok = results.filter((r) => !r.error).length
  console.log(`loginOk=${loginOk} loginError=${loginError || 'none'}`)
  console.log(`results: ${ok}/${results.length} ok, shots=${fs.readdirSync(SHOTS).length}`)
  const axeIds = {}
  for (const r of results) for (const v of r.axe || []) if (v.id) axeIds[v.id] = (axeIds[v.id] || 0) + v.nodes
  console.log('axe serious/critical totals:', JSON.stringify(axeIds))
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
