/**
 * UDS 7.0 — 真实页面视觉回归（P0 §10）
 *
 * 不只验证 Showcase：用 Playwright 打开 Uter 真实 SPA 路由，验证
 *   1) --ds7-* 运行时桥接在真实页面里确实生效（不是死代码）；
 *   2) Light / Dark 真实渲染、像素确有变化；
 *   3) 品牌渐变文字在浏览器里真的产生多色插值像素（不是纯色 / 不可见）；
 *   4) 控制台 / pageerror 无错误；
 *   5) 截图落盘并可复现。
 *
 * 服务方式：进程内 127.0.0.1 临时静态服务器，托管 web/dist（含刚构建的 bridge CSS），
 * /api /v1 /mj /pg 反向代理到本机已在运行的后端。不启动、不停止、不改动任何既有进程。
 *
 * 输出：audit/visual-regression.json + web/visual-regression/uds7/real-pages/*.png
 * 退出码：0 全部通过；1 存在失败；2 BLOCKED（浏览器 / 构建产物缺失，绝不报 PASS）
 */
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, extname, normalize } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const DS = fileURLToPath(new URL('..', import.meta.url))
const REPO = join(DS, '..', '..')
const WEB = join(REPO, 'web')
const DIST = join(WEB, 'dist')
const AUDIT = join(DS, 'audit')
const SHOTS = join(WEB, 'visual-regression', 'uds7', 'real-pages')
const PLAYWRIGHT = join(WEB, 'node_modules', 'playwright', 'index.mjs')
const SHOWCASE = join(DS, 'SHOWCASE-7.0.html')
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
    schema: 'UDS7-VISUAL-REGRESSION/1.0', generated_at: new Date().toISOString(),
    verdict: 'BLOCKED', executed: false, reason, realPages: [], showcase: null,
  })
  console.error('BLOCKED —', reason)
  process.exit(2)
}

if (!existsSync(PLAYWRIGHT)) blocked('Playwright 缺失')
if (!existsSync(join(DIST, 'index.html'))) blocked('web/dist/index.html 缺失（需先 build:check）')
if (!existsSync(SHOWCASE)) blocked('SHOWCASE-7.0.html 缺失')
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
function makeServer(backend) {
  return createServer(async (req, res) => {
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
      const up = await fetch(backend + req.url, { method: req.method, headers, body, redirect: 'manual' })
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
}

const server = makeServer(BACKEND)
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const PORT = server.address().port
const BASE = `http://127.0.0.1:${PORT}`
console.log('[UDS7-REGRESSION] static server', BASE, '→ dist; API proxy →', BACKEND)

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
          ds6Brand: get('--ds7-color-brand-1'),
          ds6Keyword: get('--ds7-syntax-keyword'),
          ds6TerminalBg: get('--ds7-color-terminal-background'),
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
        // 3.0 的 --ds-color-surface-overlay 必须保持 #000（语义反转），证明 --ds7-* 隔离命名没有覆盖旧变量。
        legacyTokenIsolated: normHex(dom.ds6SurfaceOverlay) === '#000000',
        nonBlankPixels: pixels.sampledPixels > 10000 && pixels.distinctColors > 20,
        noConsoleErrors: consoleErrors.length === 0,
      }
      const pass = Object.values(checks).every(Boolean)
      if (!pass) errors.push(`${route.path} ${theme}: ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(',')}`)
      results.push({
        route: route.path, name: route.name, theme, httpStatus: status,
        dom, checks, pixels, screenshot: `web/visual-regression/uds7/real-pages/${name}-${theme}.png`,
        screenshotSha256: sha(shot), consoleErrors, pass,
      })
    } catch (e) {
      errors.push(`${route.path} ${theme}: exception ${String(e).slice(0, 160)}`)
      results.push({ route: route.path, name: route.name, theme, pass: false, error: String(e).slice(0, 300) })
    }
    await ctx.close()
  }
}

/* ── 认证页面 Light/Dark：隔离栈真实登录 ────────────────────────────────────
 * 凭据读取 web/.env.local（与 e2e 视觉轨同源），目标是 phase2-test-stack.sh
 * 隔离后端（默认 :3100），绝不触碰用户 :3000 会话。隔离栈不可达 / 凭据缺失 /
 * 登录失败时如实登记，绝不伪造覆盖。每个主题一次 API 登录（refresh cookie
 * 一次性轮换，不能跨 context 共享），全程 2 次登录，远低于限流阈值。 */
const AUTH_BACKEND = process.env.UDS7_AUTH_BACKEND ?? 'http://127.0.0.1:3100'
const AUTH_ROUTES = [
  { path: '/dashboard', name: 'Dashboard / Console' },
  { path: '/wallet', name: 'Wallet / Billing' },
  { path: '/keys', name: 'API Keys' },
  { path: '/usage-logs', name: 'Usage Logs' },
]
const authenticated = {
  executed: false, backend: AUTH_BACKEND,
  routes: AUTH_ROUTES.map((r) => r.path), reason: '',
}
const creds = {}
const envLocalPath = join(WEB, '.env.local')
if (existsSync(envLocalPath)) {
  for (const line of readFileSync(envLocalPath, 'utf8').split('\n')) {
    const m = /^\s*(VISUAL_TEST_EMAIL|VISUAL_TEST_PASSWORD)\s*=\s*(.*?)\s*$/.exec(line)
    if (m) creds[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
let authServer = null
let authBase = null
if (!creds.VISUAL_TEST_EMAIL || !creds.VISUAL_TEST_PASSWORD) {
  authenticated.reason = 'web/.env.local 未配置 VISUAL_TEST_EMAIL / VISUAL_TEST_PASSWORD'
} else {
  try {
    const st = await fetch(AUTH_BACKEND + '/api/status', { signal: AbortSignal.timeout(3000) })
    if (!st.ok) {
      authenticated.reason = `隔离栈 /api/status HTTP ${st.status}`
    } else {
      authServer = makeServer(AUTH_BACKEND)
      // 固定端口（默认 3102，可用 UDS7_HARNESS_PORT 覆盖）：phase2-test-stack.sh
      // 已把 http://127.0.0.1:<port> 追加进隔离后端的 CORS_ALLOWED_ORIGINS。
      // 浏览器从本服务器发起的带凭证 POST（如 /api/user/amount）携带该 Origin，
      // 随机端口不在白名单里会被 CORS 以 403 空 body 拒绝（/wallet 两主题失败的根因）。
      // 端口被占用时 fail-closed：随机换端口会再次脱离白名单，绝不静默降级。
      const harnessPort = Number(process.env.UDS7_HARNESS_PORT ?? 3102)
      try {
        await new Promise((resolve, reject) => {
          authServer.once('error', reject)
          authServer.listen(harnessPort, '127.0.0.1', resolve)
        })
      } catch (e) {
        authServer = null
        authenticated.reason = `认证场景固定端口 ${harnessPort} 不可用（${String(e?.code ?? e).slice(0, 60)}）；该端口须在隔离栈 CORS 白名单内，请释放端口或同步调整 UDS7_HARNESS_PORT 与隔离栈`
      }
      if (authServer) authBase = `http://127.0.0.1:${authServer.address().port}`
    }
  } catch (e) {
    authenticated.reason = '隔离栈不可达：' + String(e).slice(0, 120)
  }
}
if (authBase) {
  authenticated.executed = true
  console.log('[UDS7-REGRESSION] auth server', authBase, '→ dist; API proxy →', AUTH_BACKEND)
  for (const theme of THEMES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
    await ctx.addInitScript((t) => {
      try { localStorage.setItem('newapi:theme:v1:mode', t) } catch (e) {}
    }, theme)
    const login = await ctx.request.post(authBase + '/api/user/login', {
      data: { username: creds.VISUAL_TEST_EMAIL, password: creds.VISUAL_TEST_PASSWORD },
    })
    const loginBody = await login.json().catch(() => ({}))
    if (!login.ok() || loginBody.success !== true) {
      authenticated.reason = `登录失败 HTTP ${login.status()}：${String(loginBody.message ?? '').slice(0, 120)}`
      errors.push(`auth login ${theme}: ${authenticated.reason}`)
      await ctx.close()
      break
    }
    const bundle = loginBody.data
    if (!bundle || typeof bundle.access_token !== 'string' || !bundle.access_token || !bundle.user || !bundle.session?.sid) {
      authenticated.reason = '登录成功但响应 data 不是可用的 AuthBundle（缺 access_token/user/session）'
      errors.push(`auth login ${theme}: ${authenticated.reason}`)
      await ctx.close()
      break
    }
    // 会话提示位（不含凭证）：让 SPA bootstrapAuthentication 不把访客判成 anonymous。
    await ctx.addInitScript(() => { document.cookie = 'new_api_has_session=1; path=/' })
    for (const route of AUTH_ROUTES) {
      const page = await ctx.newPage()
      // 与 web/e2e/visual/lib/login.ts loginViaApi 同契约：把服务端真实签发的 bundle
      // 经 refresh 通道喂回 SPA 真实 setBundle 代码路径；此后页面请求携带真实
      // Authorization: Bearer <access_token>，由后端真实校验，不是假登录态。
      await page.route('**/api/user/auth/refresh', async (r) => {
        const origin = r.request().headers()['origin']
        await r.fulfill({
          status: 200, contentType: 'application/json',
          headers: {
            'cache-control': 'no-store',
            ...(origin ? {
              'access-control-allow-origin': origin,
              'access-control-allow-credentials': 'true',
              'access-control-allow-headers': 'content-type, cache-control, x-auth-session',
            } : {}),
          },
          body: JSON.stringify({ success: true, message: '', data: bundle }),
        })
      })
      const consoleErrors = []
      const httpErrors = []
      page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)))
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push('console: ' + m.text().slice(0, 200)) })
      page.on('response', (resp) => { if (resp.status() >= 400) httpErrors.push({ url: resp.url(), status: resp.status() }) })
      let status = null
      try {
        const resp = await page.goto(authBase + route.path, { waitUntil: 'domcontentloaded', timeout: 20000 })
        status = resp?.status() ?? null
        await page.waitForTimeout(1500)
        const dom = await page.evaluate(() => {
          const cs = getComputedStyle(document.documentElement)
          const get = (n) => cs.getPropertyValue(n).trim().toLowerCase()
          return {
            title: document.title,
            url: location.pathname,
            main: Boolean(document.querySelector('main, [role="main"]')),
            bodyChars: document.body.innerText.length,
            tables: document.querySelectorAll('table').length,
            htmlClass: document.documentElement.className,
            ds6Brand: get('--ds7-color-brand-1'),
            ds6Keyword: get('--ds7-syntax-keyword'),
            ds6TerminalBg: get('--ds7-color-terminal-background'),
            ds6SurfaceOverlay: get('--ds-color-surface-overlay'),
          }
        })
        const shot = await page.screenshot({ fullPage: false })
        const name = 'auth-' + route.path.slice(1).replace(/\//g, '-')
        const pngPath = join(SHOTS, `${name}-${theme}.png`)
        writeFileSync(pngPath, shot)
        const pixels = await analyzePng(page, shot)
        const checks = {
          http200: status === 200,
          // 已登录渲染：主布局存在且未被重定向回登录页。
          authenticatedRender: dom.main && !dom.url.startsWith('/login') && !dom.url.startsWith('/sign-in'),
          renderedContent: dom.bodyChars >= 50,
          bridgeLive: normHex(dom.ds6Brand) === (theme === 'light' ? BRAND_LIGHT : BRAND_DARK),
          syntaxBridgeLive: normHex(dom.ds6Keyword) === (theme === 'light' ? KEYWORD_LIGHT : KEYWORD_DARK),
          terminalBridgeLive: /^#[0-9a-f]{6}$/.test(dom.ds6TerminalBg),
          legacyTokenIsolated: normHex(dom.ds6SurfaceOverlay) === '#000000',
          nonBlankPixels: pixels.sampledPixels > 10000 && pixels.distinctColors > 20,
          noConsoleErrors: consoleErrors.length === 0,
        }
        const pass = Object.values(checks).every(Boolean)
        if (!pass) errors.push(`auth ${route.path} ${theme}: ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(',')}`)
        if (httpErrors.length) console.log(`[UDS7-REGRESSION] auth ${route.path} ${theme} HTTP>=400:`, JSON.stringify(httpErrors))
        results.push({
          route: route.path, name: route.name, theme, authenticated: true, httpStatus: status,
          dom, checks, pixels, screenshot: `web/visual-regression/uds7/real-pages/${name}-${theme}.png`,
          screenshotSha256: sha(shot), consoleErrors, httpErrors, pass,
        })
      } catch (e) {
        errors.push(`auth ${route.path} ${theme}: exception ${String(e).slice(0, 160)}`)
        results.push({ route: route.path, name: route.name, theme, authenticated: true, pass: false, error: String(e).slice(0, 300) })
      }
      await page.close()
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
if (authServer) authServer.close()

const verdict = errors.length === 0 ? 'PASS' : 'FAIL'
const payload = {
  schema: 'UDS7-VISUAL-REGRESSION/1.0',
  generated_at: new Date().toISOString(),
  method: 'Playwright chromium headless · in-process static server on web/dist · API proxy to 127.0.0.1:3000 · canvas getImageData pixel analysis' +
    (authenticated.executed ? ` · authenticated scenarios via isolated stack ${AUTH_BACKEND}（真实 API 登录）` : ''),
  backend: BACKEND, dist: 'web/dist', verdict,
  executed: true,
  realPageCount: ROUTES.length,
  scenarioCount: results.length,
  themeScenarios: THEMES,
  routes: ROUTES.map((r) => r.path),
  checksApplied: ['http200', 'hasHeading', 'renderedContent', 'bridgeLive', 'syntaxBridgeLive', 'terminalBridgeLive', 'legacyTokenIsolated', 'nonBlankPixels', 'noConsoleErrors'],
  authChecksApplied: ['http200', 'authenticatedRender', 'renderedContent', 'bridgeLive', 'syntaxBridgeLive', 'terminalBridgeLive', 'legacyTokenIsolated', 'nonBlankPixels', 'noConsoleErrors'],
  authenticated,
  results, gradient, forcedColors,
  errors,
  scopeNote: authenticated.executed
    ? '公共 4 路由 + 认证 4 路由（隔离栈真实登录）× Light/Dark 渲染与 token 断言；认证场景不建像素基线。管理员专属页（Channels / System Settings）与其余认证页未覆盖，如实登记，不得视为已覆盖。'
    : `真实 SPA 路由回归；认证页面未执行（${authenticated.reason}），故不含 Dashboard / Billing / Orders / Refunds 等页面。该限制如实登记，不得视为已覆盖。`,
}
writeJson(join(AUDIT, 'visual-regression.json'), payload)
console.log('[UDS7-REGRESSION] verdict', verdict, 'scenarios', results.length, 'errors', errors.length)
if (errors.length) console.log(errors.join('\n'))
process.exit(verdict === 'PASS' ? 0 : 1)
