/**
 * UDS 6.0 — 真实页面视觉回归（P0 §10）
 *
 * 不只验证 Showcase：用 Playwright 打开 Uter 真实 SPA 路由，验证
 *   1) --ds6-* 运行时桥接在真实页面里确实生效（不是死代码）；
 *   2) Light / Dark 真实渲染、像素确有变化；
 *   3) 品牌渐变文字在浏览器里真的产生多色插值像素（不是纯色 / 不可见）；
 *   4) 控制台 / pageerror 无错误；
 *   5) 截图落盘并可复现。
 *
 * 服务方式：进程内 127.0.0.1 临时静态服务器，托管 web/dist（含刚构建的 bridge CSS），
 * /api /v1 /mj /pg 反向代理到本机已在运行的后端。不启动、不停止、不改动任何既有进程。
 *
 * 输出：audit/visual-regression.json + web/visual-regression/uds6/real-pages/*.png
 * 退出码：0 全部通过；1 存在失败；2 BLOCKED（浏览器 / 构建产物缺失，绝不报 PASS）
 */
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, extname, normalize } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const DS = fileURLToPath(new URL('..', import.meta.url))
const REPO = join(DS, '..', '..', '..')
const WEB = join(REPO, 'web')
const DIST = join(WEB, 'dist')
const AUDIT = join(DS, 'audit')
const SHOTS = join(WEB, 'visual-regression', 'uds6', 'real-pages')
const PLAYWRIGHT = join(WEB, 'node_modules', 'playwright', 'index.mjs')
const SHOWCASE = join(DS, 'SHOWCASE-6.0.html')
const MANIFEST = join(DS, 'TOKEN-MANIFEST.json')
const BACKEND = 'http://127.0.0.1:3000'

mkdirSync(AUDIT, { recursive: true })
mkdirSync(SHOTS, { recursive: true })

const writeJson = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + '\n')
const sha = (buf) => createHash('sha256').update(buf).digest('hex')

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.map': 'application/json', '.gif': 'image/gif',
}

const blocked = (reason) => {
  writeJson(join(AUDIT, 'visual-regression.json'), {
    schema: 'UDS6-VISUAL-REGRESSION/1.0', generated_at: new Date().toISOString(),
    verdict: 'BLOCKED', executed: false, reason, realPages: [], showcase: null,
  })
  console.error('BLOCKED —', reason)
  process.exit(2)
}

if (!existsSync(PLAYWRIGHT)) blocked('Playwright 缺失')
if (!existsSync(join(DIST, 'index.html'))) blocked('web/dist/index.html 缺失（需先 build:check）')
if (!existsSync(SHOWCASE)) blocked('SHOWCASE-6.0.html 缺失')
if (!existsSync(MANIFEST)) blocked('TOKEN-MANIFEST.json 缺失')

const M = JSON.parse(readFileSync(MANIFEST, 'utf8'))
const T = M.tokens
/** 构建器会把 #0000FF 压缩成 #00f；比较前统一展开为 6 位 HEX，避免假阴性。 */
const normHex = (s) => {
  const v = String(s ?? '').trim().toLowerCase()
  const m = /^#([0-9a-f]{3,8})$/.exec(v)
  if (!m) return v
  let h = m[1]
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('')
  return '#' + h.slice(0, 6)
}
const BRAND_LIGHT = normHex(T['--ds-color-brand-1']?.light)
const BRAND_DARK = normHex(T['--ds-color-brand-1']?.dark)
const KEYWORD_LIGHT = normHex(T['--ds-syntax-keyword']?.light)
const KEYWORD_DARK = normHex(T['--ds-syntax-keyword']?.dark)

/* ── 进程内静态服务 + API 代理 ──────────────────────────────────────────── */
const server = createServer(async (req, res) => {
  const u = new URL(req.url || '/', 'http://127.0.0.1')
  const pathname = decodeURIComponent(u.pathname)

  if (/^\/(api|v1|mj|pg)(\/|$)/.test(pathname)) {
    try {
      const chunks = []
      for await (const c of req) chunks.push(c)
      const body = chunks.length && req.method !== 'GET' && req.method !== 'HEAD' ? Buffer.concat(chunks) : undefined
      const headers = { ...req.headers }
      delete headers.host
      delete headers['content-length']
      const up = await fetch(BACKEND + req.url, { method: req.method, headers, body, redirect: 'manual' })
      // fetch() 已透明解压响应体；若把上游的 content-encoding / content-length 原样转发，
      // 浏览器会对已解压的字节再次解压 → ERR_CONTENT_DECODING_FAILED。必须剥掉。
      const outHeaders = Object.fromEntries(up.headers.entries())
      delete outHeaders['content-encoding']
      delete outHeaders['content-length']
      delete outHeaders['transfer-encoding']
      res.writeHead(up.status, outHeaders)
      res.end(Buffer.from(await up.arrayBuffer()))
    } catch (e) {
      res.writeHead(502, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'backend_unreachable', detail: String(e) }))
    }
    return
  }

  const rel = normalize(pathname).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '')
  let file = join(DIST, rel)
  if (!file.startsWith(DIST)) file = join(DIST, 'index.html')
  if (!existsSync(file) || !statSync(file).isFile()) file = join(DIST, 'index.html')
  try {
    const buf = readFileSync(file)
    res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream' })
    res.end(buf)
  } catch (e) {
    res.writeHead(500); res.end(String(e))
  }
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const PORT = server.address().port
const BASE = `http://127.0.0.1:${PORT}`
console.log('[UDS6-REGRESSION] static server', BASE, '→ dist; API proxy →', BACKEND)

const { chromium } = await import(pathToFileURL(PLAYWRIGHT).href)
let browser
try { browser = await chromium.launch({ headless: true }) }
catch (e) { server.close(); blocked('Chromium 无法启动: ' + String(e)) }

/** 把 PNG 交给浏览器 canvas 做真实像素分析（不引入第三方图像库）。 */
async function analyzePng(page, buf) {
  const b64 = buf.toString('base64')
  return page.evaluate(async (data) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + data
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth; c.height = img.naturalHeight
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    const colors = new Set()
    let lumSum = 0, lumSq = 0, n = 0, opaqueTextPixels = 0
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3]
      if (a < 16) continue
      colors.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3))
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
      lumSum += lum; lumSq += lum * lum; n++
      if (lum < 220) opaqueTextPixels++
    }
    const mean = n ? lumSum / n : 0
    return {
      width: c.width, height: c.height, sampledPixels: n,
      distinctColors: colors.size,
      meanLuminance: Math.round(mean * 100) / 100,
      luminanceStdDev: Math.round(Math.sqrt(Math.max(0, (n ? lumSq / n : 0) - mean * mean)) * 100) / 100,
      nonWhitePixelRatio: n ? Math.round((opaqueTextPixels / n) * 10000) / 10000 : 0,
    }
  }, b64)
}

const ROUTES = [
  { path: '/', name: 'Home / Landing', expect: ['h1', 'button'] },
  { path: '/login', name: 'Authentication / Login', expect: ['h1', 'input'] },
  { path: '/about', name: 'About / Marketing', expect: ['h1'] },
  { path: '/docs', name: 'Documentation / Code UI', expect: ['h1'] },
]
const THEMES = ['light', 'dark']
const results = []
const errors = []

for (const route of ROUTES) {
  for (const theme of THEMES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
    await ctx.addInitScript((t) => {
      try { localStorage.setItem('newapi:theme:v1:mode', t) } catch (e) {}
    }, theme)
    const page = await ctx.newPage()
    const consoleErrors = []
    page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)))
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push('console: ' + m.text().slice(0, 200)) })
    let status = null
    try {
      const resp = await page.goto(BASE + route.path, { waitUntil: 'domcontentloaded', timeout: 20000 })
      status = resp?.status() ?? null
      await page.waitForTimeout(1500)
      const dom = await page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement)
        const get = (n) => cs.getPropertyValue(n).trim().toLowerCase()
        return {
          title: document.title,
          h1: document.querySelector('h1')?.textContent?.trim().slice(0, 80) ?? null,
          bodyChars: document.body.innerText.length,
          buttons: document.querySelectorAll('button').length,
          inputs: document.querySelectorAll('input').length,
          tables: document.querySelectorAll('table').length,
          htmlClass: document.documentElement.className,
          ds6Brand: get('--ds6-color-brand-1'),
          ds6Keyword: get('--ds6-syntax-keyword'),
          ds6TerminalBg: get('--ds6-color-terminal-background'),
          ds6SurfaceOverlay: get('--ds-color-surface-overlay'),
          gradientInterpolationSupported: CSS.supports('background-image', 'linear-gradient(90deg in srgb, red, blue)'),
        }
      })
      const shot = await page.screenshot({ fullPage: false })
      const name = route.path === '/' ? 'home' : route.path.slice(1).replace(/\//g, '-')
      const pngPath = join(SHOTS, `${name}-${theme}.png`)
      writeFileSync(pngPath, shot)
      const pixels = await analyzePng(page, shot)

      const expectedBrand = theme === 'light' ? BRAND_LIGHT : BRAND_DARK
      const expectedKeyword = theme === 'light' ? KEYWORD_LIGHT : KEYWORD_DARK
      const checks = {
        http200: status === 200,
        hasHeading: Boolean(dom.h1),
        // 登录页只有标题 + 两个输入框，真实正文约 93 字符；阈值按最短真实页面设定。
        renderedContent: dom.bodyChars >= 50,
        bridgeLive: normHex(dom.ds6Brand) === expectedBrand,
        syntaxBridgeLive: normHex(dom.ds6Keyword) === expectedKeyword,
        terminalBridgeLive: /^#[0-9a-f]{6}$/.test(dom.ds6TerminalBg),
        // 3.0 的 --ds-color-surface-overlay 必须保持 #000（语义反转），证明 --ds6-* 隔离命名没有覆盖旧变量。
        legacyTokenIsolated: normHex(dom.ds6SurfaceOverlay) === '#000000',
        nonBlankPixels: pixels.sampledPixels > 10000 && pixels.distinctColors > 20,
        noConsoleErrors: consoleErrors.length === 0,
      }
      const pass = Object.values(checks).every(Boolean)
      if (!pass) errors.push(`${route.path} ${theme}: ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(',')}`)
      results.push({
        route: route.path, name: route.name, theme, httpStatus: status,
        dom, checks, pixels, screenshot: `web/visual-regression/uds6/real-pages/${name}-${theme}.png`,
        screenshotSha256: sha(shot), consoleErrors, pass,
      })
    } catch (e) {
      errors.push(`${route.path} ${theme}: exception ${String(e).slice(0, 160)}`)
      results.push({ route: route.path, name: route.name, theme, pass: false, error: String(e).slice(0, 300) })
    }
    await ctx.close()
  }
}

/* ── Showcase 渐变文字：真实像素插值验证 ─────────────────────────────────── */
let gradient = null
try {
  const gctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const gpage = await gctx.newPage()
  await gpage.goto('file://' + SHOWCASE, { waitUntil: 'load' })
  const perTheme = {}
  for (const theme of THEMES) {
    await gpage.evaluate((t) => document.documentElement.setAttribute('data-ds-theme', t), theme)
    await gpage.waitForTimeout(150)
    const el = gpage.locator('.g-new.g-hero').first()
    const buf = await el.screenshot()
    const px = await analyzePng(gpage, buf)
    writeFileSync(join(SHOTS, `gradient-hero-${theme}.png`), buf)
    perTheme[theme] = { ...px, sha256: sha(buf) }
  }
  const cssInterpolation = await gpage.evaluate(() => {
    const el = document.querySelector('.g-new.g-hero')
    return {
      computed: getComputedStyle(el).backgroundImage,
      supportsInSrgb: CSS.supports('background-image', 'linear-gradient(90deg in srgb, red, blue)'),
    }
  })
  // Chromium 的 getComputedStyle 会把默认的 in srgb 归一化掉，因此「插值空间一致」
  // 必须以 CSS 源码 / 构建产物为准，浏览器只负责证明它真的解析并渲染出多色像素。
  const ownerCss = readFileSync(join(WEB, 'src', 'design-system', 'foundations', 'typography.css'), 'utf8')
  const cssDir = join(DIST, 'static', 'css')
  const distCss = readdirSync(cssDir).filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(cssDir, f), 'utf8')).join('\n')
  gradient = {
    computedBackgroundImage: cssInterpolation.computed,
    computedStyleNote: 'Chromium 归一化：sRGB 为默认插值空间，computed style 省略 in srgb',
    browserSupportsInSrgb: cssInterpolation.supportsInSrgb,
    ownerDeclaresInSrgb: /linear-gradient\(\s*90deg in srgb/.test(ownerCss),
    distDeclaresInSrgb: /linear-gradient\(90deg in srgb/.test(distCss),
    light: perTheme.light, dark: perTheme.dark,
    themePixelsDiffer: perTheme.light.sha256 !== perTheme.dark.sha256,
    gradientIsPolychromatic: perTheme.light.distinctColors >= 8 && perTheme.dark.distinctColors >= 8,
    gradientVisible: perTheme.light.nonWhitePixelRatio > 0.005 && perTheme.dark.nonWhitePixelRatio > 0.005,
  }
  gradient.pass = gradient.ownerDeclaresInSrgb && gradient.distDeclaresInSrgb && gradient.browserSupportsInSrgb &&
    gradient.themePixelsDiffer && gradient.gradientIsPolychromatic && gradient.gradientVisible
  if (!gradient.pass) errors.push('gradient pixel validation failed')
  await gctx.close()
} catch (e) {
  gradient = { pass: false, error: String(e).slice(0, 300) }
  errors.push('gradient: ' + String(e).slice(0, 160))
}

/* ── forced-colors 真实浏览器验证（bridge 回退规则） ─────────────────────── */
let forcedColors = null
try {
  const fctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const fpage = await fctx.newPage()
  await fpage.emulateMedia({ forcedColors: 'active' })
  // 1) 真实页面：正文文字在 forced-colors 下必须保持不透明、可读；
  //    hero 渐变文字（runtime owner .ds-text-gradient-brand）必须回退为实色
  await fpage.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await fpage.waitForTimeout(900)
  const pageCheck = await fpage.evaluate(() => {
    const els = [...document.querySelectorAll('h1, p, a, button')].slice(0, 30)
    const transparent = els.filter((el) => {
      const cs = getComputedStyle(el)
      return cs.color === 'transparent' || cs.visibility === 'hidden'
    }).length
    const hero = document.querySelector('.ds-text-gradient-brand')
    const heroColor = hero ? getComputedStyle(hero).color : null
    return { sampled: els.length, transparent, heroFound: Boolean(hero), heroColor, heroTransparent: heroColor === 'transparent' }
  })
  // 2) Showcase 渐变演示（.g-new）：forced-colors 下必须回退为 CanvasText 实色
  await fpage.goto('file://' + SHOWCASE, { waitUntil: 'load' })
  await fpage.waitForTimeout(400)
  const gradientFallback = await fpage.evaluate(() => {
    const el = document.querySelector('.g-new')
    if (!el) return { found: false }
    const cs = getComputedStyle(el)
    return { found: true, color: cs.color, transparent: cs.color === 'transparent' }
  })
  const shot = await fpage.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 900 } })
  writeFileSync(join(SHOTS, 'forced-colors-showcase.png'), shot)
  forcedColors = {
    executed: true,
    pageTextTransparentCount: pageCheck.transparent,
    pageTextSampled: pageCheck.sampled,
    heroFoundOnRealPage: pageCheck.heroFound,
    heroFallbackColor: pageCheck.heroColor,
    heroFallbackTransparent: pageCheck.heroTransparent,
    gradientFallbackFound: gradientFallback.found,
    gradientFallbackColor: gradientFallback.color ?? null,
    gradientFallbackTransparent: gradientFallback.transparent ?? null,
  }
  forcedColors.pass = forcedColors.executed && pageCheck.transparent === 0 &&
    pageCheck.heroFound === true && pageCheck.heroTransparent === false &&
    gradientFallback.found === true && gradientFallback.transparent === false
  if (!forcedColors.pass) errors.push('forced-colors validation failed')
  await fctx.close()
} catch (e) {
  forcedColors = { executed: false, pass: false, error: String(e).slice(0, 300) }
  errors.push('forced-colors: ' + String(e).slice(0, 160))
}

await browser.close()
server.close()

const verdict = errors.length === 0 ? 'PASS' : 'FAIL'
const payload = {
  schema: 'UDS6-VISUAL-REGRESSION/1.0',
  generated_at: new Date().toISOString(),
  method: 'Playwright chromium headless · in-process static server on web/dist · API proxy to 127.0.0.1:3000 · canvas getImageData pixel analysis',
  backend: BACKEND, dist: 'web/dist', verdict,
  executed: true,
  realPageCount: ROUTES.length,
  scenarioCount: results.length,
  themeScenarios: THEMES,
  routes: ROUTES.map((r) => r.path),
  checksApplied: ['http200', 'hasHeading', 'renderedContent', 'bridgeLive', 'syntaxBridgeLive', 'terminalBridgeLive', 'legacyTokenIsolated', 'nonBlankPixels', 'noConsoleErrors'],
  results, gradient, forcedColors,
  errors,
  scopeNote: '真实 SPA 路由回归；未登录，故不含需要认证的 Dashboard / Billing / Orders / Refunds 等页面。该限制如实登记，不得视为已覆盖。',
}
writeJson(join(AUDIT, 'visual-regression.json'), payload)
console.log('[UDS6-REGRESSION] verdict', verdict, 'scenarios', results.length, 'errors', errors.length)
if (errors.length) console.log(errors.join('\n'))
process.exit(verdict === 'PASS' ? 0 : 1)
