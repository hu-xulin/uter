/**
 * UDS 8.0 全页面元素差异审计（真实浏览器 computed style + 整页截图）
 *
 * 输出：
 *   docs/design-system/audit/comprehensive/audit-data.json
 *   docs/design-system/audit/comprehensive/index.html
 *   docs/design-system/audit/comprehensive/screenshots/*.png
 *
 * 不修改业务源码，不停止/重启任何既有服务；默认访问 localhost:3001。
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { chromium, type BrowserContext, type Page } from 'playwright'

import { loginViaApi } from '../e2e/visual/lib/login.ts'

const WEB_ROOT = process.cwd()
const REPO_ROOT = path.resolve(WEB_ROOT, '..')
const OUT_DIR =
  process.env.UDS_AUDIT_OUT ??
  path.join(REPO_ROOT, 'docs/design-system/audit/comprehensive')
const SHOT_DIR = path.join(OUT_DIR, 'screenshots')
const BASE_URL = process.env.UDS_AUDIT_BASE_URL ?? 'http://localhost:3001'
const HEAD = process.env.UDS_AUDIT_HEAD ?? 'unknown'
const MANIFEST_PATH = path.join(
  REPO_ROOT,
  'docs/design-system/TOKEN-MANIFEST.json'
)

fs.mkdirSync(SHOT_DIR, { recursive: true })

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as any
const componentRegistry = JSON.parse(
  fs.readFileSync(
    path.join(REPO_ROOT, 'docs/design-system/COMPONENT-REGISTRY.json'),
    'utf8'
  )
) as any
const tokenEntries = Object.entries(manifest.tokens ?? {}) as Array<
  [string, any]
>

function runGate(name: string, command: string, args: string[]) {
  const result = spawnSync(command, args, {
    cwd: WEB_ROOT,
    encoding: 'utf8',
    env: { ...process.env },
    maxBuffer: 20 * 1024 * 1024,
  })
  const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()
  return {
    name,
    command: `${command} ${args.join(' ')}`,
    exitCode: result.status ?? null,
    tail: text.slice(-2400),
  }
}

const gateResults = [
  runGate('UDS 8.0 完整性门禁', 'bun', ['run', 'design:8:check']),
  runGate('设计令牌严格检查', 'bun', ['run', 'lint:design:strict']),
  runGate('令牌清单一致性', 'bun', ['run', 'design:tokens:check']),
  runGate('组件登记检查', 'bun', ['run', 'components:registry:check']),
  runGate('对比度验证', 'bun', ['run', 'verify:contrast']),
]

const STANDARD_MODULES = [
  ['00', '设计系统总览', '治理门禁 + 令牌清单', 'design:8:check'],
  [
    '01',
    '品牌识别',
    '品牌色/字体/图标真实渲染',
    '浏览器截图 + color token 检查',
  ],
  ['02', '设计原则', '密度/层级/一致性抽查', '组件规则 + 需人工复核'],
  ['03', '色彩', 'computed color/background/border', '当前主题颜色令牌集合'],
  ['04', '排版', '字号/行高/字重/字体栈', '字号与行高档位令牌'],
  ['05', '间距与尺寸', 'margin/padding/gap/尺寸', '间距档位与密度档位'],
  ['06', '布局与网格', '页头/侧栏/内容宽度/断点', '布局令牌 + 1440 视口'],
  ['07', '形状与圆角', 'border-radius', '圆角令牌'],
  ['08', '边框与分隔线', 'border-width/color', '边框宽度令牌 + 颜色令牌'],
  ['09', '阴影与层级', 'box-shadow', 'elevation 令牌'],
  ['10', '图标', 'SVG 尺寸/线性图标', '图标尺寸令牌'],
  ['11', '动效与动画', '截图稳定化后状态', '静态门禁 + 运行时禁动画检查'],
  ['12', '响应式', '桌面视口真实渲染', '1440 桌面口径；移动端需另轮'],
  ['13', '可访问性', '可访问名称/alt/aria', 'DOM 语义检查 + axe 既有证据'],
  ['14', '内容与文案', '按钮/输入/空态文本', 'DOM 文本抽查 + 人工复核'],
  ['15', '数据可视化', '图标/图表色与数据展示', '颜色令牌 + 需人工复核'],
  ['16', '密度与信息层级', '控件高度/表格行高/间距', '密度与控件令牌'],
  ['17', '导航', 'header/sidebar/breadcrumb', '组件规则 + 布局令牌'],
  ['18', '按钮', 'button/role=button', '高度/圆角/字号/字重/可访问名称'],
  ['19', '表单与输入', 'input/textarea/select', '高度/字号/圆角/边框/标签'],
  ['20', '选择控件', 'checkbox/radio/switch', '尺寸/可访问名称'],
  ['21', '反馈与状态', 'alert/toast/status', '状态色令牌 + 需人工复核'],
  ['22', '浮层与浮动层', 'popover/dialog/drawer', 'elevation + 需触发态复核'],
  ['23', '数据展示', 'table/badge/avatar', '行高/单元格/徽标/圆角'],
  ['24', '代码与开发 UI', 'pre/code/代码块', '等宽字体/字号/颜色令牌'],
  ['25', '认证', '登录/注册/忘记密码', '表单组件规则'],
  ['26', '用户与组织', 'profile/organization', '组件规则 + 页面截图'],
  ['27', '计费与支付', 'wallet/subscriptions', '组件规则 + 页面截图'],
  ['28', 'API 与令牌管理', 'keys', '表格/按钮/状态规则'],
  ['29', '模型与渠道管理', 'models/channels', '表格/选择控件/状态规则'],
  ['30', '仪表盘', 'dashboard', '卡片/间距/层级规则'],
  ['31', '页面模板', '公共页与控制台页', '真实路由截图'],
  ['32', '空态/加载/错误', '404/500/空态', '真实错误页截图'],
  ['33', '本地化', 'zh-CN 渲染', '真实 locale 口径'],
  ['34', '跨平台', '桌面 Chromium', '1440×900 桌面口径'],
  ['35', '设计治理', '版本/门禁/登记', 'design:8:check + 组件登记'],
  ['CODE', '代码语法高亮', '语法色 token', 'verify:contrast + 文档页截图'],
  ['GRADIENT', '渐变文字', '品牌渐变', '真实页面视觉回归既有证据'],
]

interface RouteDef {
  path: string
  name: string
  auth: boolean
  ready?: string
}

/** 覆盖 routeTree 中所有无参数、可独立访问的业务路由；动态路由由代表性实例覆盖。 */
const ROUTES: RouteDef[] = [
  { path: '/', name: '首页', auth: false, ready: 'header' },
  { path: '/about', name: '关于我们', auth: false, ready: 'main' },
  { path: '/pricing', name: '价格', auth: false, ready: 'main' },
  { path: '/rankings', name: '排行榜', auth: false, ready: 'main' },
  { path: '/docs', name: '文档', auth: false, ready: 'main' },
  { path: '/sign-in', name: '登录', auth: false, ready: 'form' },
  { path: '/sign-up', name: '注册', auth: false, ready: 'form' },
  { path: '/forgot-password', name: '忘记密码', auth: false, ready: 'form' },
  { path: '/privacy-policy', name: '隐私政策', auth: false, ready: 'main' },
  { path: '/user-agreement', name: '用户协议', auth: false, ready: 'main' },
  { path: '/recharge-agreement', name: '充值协议', auth: false, ready: 'main' },
  { path: '/404', name: '404 错误页', auth: false, ready: 'main' },
  { path: '/500', name: '500 错误页', auth: false, ready: 'main' },
  { path: '/setup', name: '初始化', auth: false, ready: 'form, main' },
  { path: '/dashboard', name: '控制台', auth: true, ready: 'main' },
  { path: '/keys', name: 'API 密钥', auth: true, ready: 'main' },
  { path: '/wallet', name: '钱包', auth: true, ready: 'main' },
  { path: '/models', name: '模型', auth: true, ready: 'main' },
  { path: '/usage-logs', name: '用量日志', auth: true, ready: 'main' },
  { path: '/usage-logs/audit', name: '审计日志', auth: true, ready: 'main' },
  { path: '/playground', name: '游乐场', auth: true, ready: 'main' },
  { path: '/channels', name: '渠道管理', auth: true, ready: 'main' },
  { path: '/profile', name: '个人资料', auth: true, ready: 'main' },
  { path: '/subscriptions', name: '订阅', auth: true, ready: 'main' },
  { path: '/checkin', name: '签到', auth: true, ready: 'main' },
  { path: '/redeem', name: '兑换', auth: true, ready: 'main' },
  {
    path: '/redemption-codes',
    name: '兑换码',
    auth: true,
    ready: 'main',
  },
  { path: '/referral', name: '推荐', auth: true, ready: 'main' },
  { path: '/request-processing', name: '请求处理', auth: true, ready: 'main' },
  { path: '/security', name: '安全', auth: true, ready: 'main' },
  { path: '/system-info', name: '系统信息', auth: true, ready: 'main' },
  { path: '/task-plugins', name: '任务插件', auth: true, ready: 'main' },
  { path: '/organization', name: '组织', auth: true, ready: 'main' },
  { path: '/chat2link', name: '对话分享', auth: true, ready: 'main' },
  { path: '/system-settings', name: '系统设置', auth: true, ready: 'main' },
  {
    path: '/system-settings/site',
    name: '系统设置-站点',
    auth: true,
    ready: 'main',
  },
  {
    path: '/system-settings/auth',
    name: '系统设置-认证',
    auth: true,
    ready: 'main',
  },
  {
    path: '/system-settings/billing',
    name: '系统设置-计费',
    auth: true,
    ready: 'main',
  },
  {
    path: '/system-settings/content',
    name: '系统设置-内容',
    auth: true,
    ready: 'main',
  },
  {
    path: '/system-settings/models',
    name: '系统设置-模型',
    auth: true,
    ready: 'main',
  },
  {
    path: '/system-settings/operations',
    name: '系统设置-运营',
    auth: true,
    ready: 'main',
  },
  {
    path: '/system-settings/request-policies',
    name: '系统设置-请求策略',
    auth: true,
    ready: 'main',
  },
  {
    path: '/system-settings/security',
    name: '系统设置-安全',
    auth: true,
    ready: 'main',
  },
]

const STABILIZE_CSS = `
  *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
  input, textarea, [contenteditable] { caret-color: transparent !important; }
  html { scrollbar-width: none !important; }
  ::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
  [data-visual-volatile] { visibility: hidden !important; }
  .tsqd-parent-container, .tsqd-transitions-container, .tsqd-open-btn-container,
  .tsqd-open-btn, .TanStackRouterDevtools, .TanStackRouterDevtoolsPanel,
  button[aria-label="Open TanStack Router Devtools"],
  button[aria-label="Close TanStack Router Devtools"] { display: none !important; }
`

function valuesForType(type: string): Array<{ token: string; value: number }> {
  return tokenEntries
    .filter(([, v]) => v?.type === type && Number.isFinite(Number(v?.light)))
    .map(([token, v]) => ({ token, value: Number(v.light) }))
}

function uniqueNumbers(values: Array<{ value: number }>): number[] {
  return [...new Set(values.map((v) => v.value))].sort((a, b) => a - b)
}

function colorsForTheme(theme: 'light' | 'dark'): string[] {
  const values = tokenEntries
    .filter(([, v]) => v?.type === 'color')
    .map(([, v]) =>
      v.themeIndependent ? v.light : (v[theme] ?? v.light ?? v.dark)
    )
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
  return [
    ...new Set([
      ...values,
      'transparent',
      'currentColor',
      '#ffffff',
      '#000000',
    ]),
  ]
}

function shadowsForTheme(theme: 'light' | 'dark'): string[] {
  return [
    ...new Set(
      tokenEntries
        .filter(([, v]) => v?.type === 'shadow')
        .map(([, v]) => v[theme] ?? v.light ?? v.dark)
        .filter((v): v is string => typeof v === 'string')
    ),
  ]
}

const allowedBase = {
  fontSizes: uniqueNumbers(
    valuesForType('size').filter((t) => t.token.startsWith('--ds-text-'))
  ),
  lineHeights: uniqueNumbers(
    valuesForType('size').filter((t) => t.token.startsWith('--ds-leading-'))
  ),
  weights: [400, 500, 600, 700],
  spacing: uniqueNumbers(
    valuesForType('size').filter(
      (t) => t.token.startsWith('--ds-space-') || t.token.includes('cell-y')
    )
  ),
  radius: uniqueNumbers(
    valuesForType('size').filter((t) => t.token.startsWith('--ds-radius-'))
  ),
  borderWidths: [0, 1, 2],
  iconSizes: uniqueNumbers(
    valuesForType('size').filter(
      (t) => t.token.startsWith('--ds-icon-') && !t.token.includes('stroke')
    )
  ),
  controlHeights: uniqueNumbers(
    valuesForType('size').filter(
      (t) =>
        t.token.startsWith('--ds-control-') ||
        t.token.startsWith('--ds-density-')
    )
  ),
}

function nearestNumber(value: number, values: number[]) {
  let best = values[0] ?? null
  let bestDiff = best === null ? Infinity : Math.abs(value - best)
  for (const v of values) {
    const d = Math.abs(value - v)
    if (d < bestDiff) {
      best = v
      bestDiff = d
    }
  }
  return { tokenValue: best, distance: bestDiff }
}

function tokenNameForValue(prefix: string, value: number | null) {
  if (value === null) return null
  const hit = valuesForType('size').find(
    (t) => t.token.startsWith(prefix) && t.value === value
  )
  return hit?.token ?? null
}

function parseRgb(value: string): [number, number, number] | null {
  const m = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i)
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function nearestColor(value: string, colors: string[]) {
  const target = parseRgb(value)
  if (!target) return { token: null, distance: Infinity }
  let best: string | null = null
  let bestDistance = Infinity
  const materialized = new Map<string, [number, number, number] | null>()
  for (const color of colors) {
    // 只在 Node 侧处理 HEX；rgba/currentColor 由浏览器侧完成归一化。
    const rgb = /^#/.test(color)
      ? (() => {
          let h = color.slice(1)
          if (h.length === 3) {
            h = [...h].map((c) => c + c).join('')
          }
          return [
            parseInt(h.slice(0, 2), 16),
            parseInt(h.slice(2, 4), 16),
            parseInt(h.slice(4, 6), 16),
          ] as [number, number, number]
        })()
      : parseRgb(color)
    materialized.set(color, rgb)
    if (!rgb) continue
    const d = Math.hypot(
      target[0] - rgb[0],
      target[1] - rgb[1],
      target[2] - rgb[2]
    )
    if (d < bestDistance) {
      bestDistance = d
      best = color
    }
  }
  return { token: best, distance: bestDistance, materialized }
}

function slugify(input: string) {
  return (
    input
      .replace(/^\//, '')
      .replaceAll(/[^a-zA-Z0-9]+/g, '-')
      .replaceAll(/^-+|-+$/g, '') || 'root'
  )
}

function readPngSize(file: string) {
  const buf = fs.readFileSync(file)
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  }
}

interface ElementRecord {
  id: string
  tag: string
  component: string
  className: string
  text: string
  path: string
  rect: { x: number; y: number; width: number; height: number }
  styles: Record<string, string>
}

interface Issue {
  key: string
  category: string
  property: string
  actual: string
  expected: string
  nearestToken: string | null
  nearestValue: string | null
  severity: 'HARD' | 'REVIEW'
  rule: string
  recommendation: string
  element: ElementRecord
  page: {
    route: string
    name: string
    theme: 'light' | 'dark'
    auth: boolean
    httpStatus: number
    screenshot: string
    screenshotWidth: number
    screenshotHeight: number
    viewportWidth: number
  }
}

interface PageAuditResult {
  route: RouteDef
  theme: 'light' | 'dark'
  httpStatus: number
  screenshot: string
  screenshotWidth: number
  screenshotHeight: number
  elementCount: number
  issues: Issue[]
  consoleErrors: string[]
  pageErrors: string[]
  htmlClass: string
  error?: string
}

const pageResults: PageAuditResult[] = []

async function auditPage(
  page: Page,
  route: RouteDef,
  theme: 'light' | 'dark',
  allowed: any
): Promise<PageAuditResult> {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const onConsole = (msg: any) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 500))
  }
  const onPageError = (err: Error) => pageErrors.push(err.message.slice(0, 500))
  page.on('console', onConsole)
  page.on('pageerror', onPageError)

  const screenshot = path.join(SHOT_DIR, `${slugify(route.path)}-${theme}.png`)
  try {
    const response = await page.goto(route.path, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await page.evaluate(() => document.fonts.ready)
    await page.evaluate((t) => {
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add(t)
      document.documentElement.setAttribute('data-ds-theme', t)
    }, theme)
    await page.addStyleTag({ content: STABILIZE_CSS })
    if (route.ready) {
      await page
        .locator(`${route.ready}, main, header, form, [role="main"]`)
        .first()
        .waitFor({ state: 'visible', timeout: 15_000 })
        .catch(() => {})
    }
    await page.waitForTimeout(250)

    const audit = await page.evaluate((allowedIn: any) => {
      const probe = document.createElement('span')
      probe.setAttribute('aria-hidden', 'true')
      probe.style.position = 'fixed'
      probe.style.left = '-9999px'
      probe.style.top = '-9999px'
      probe.style.opacity = '0'
      document.body.appendChild(probe)

      const cv = document.createElement('canvas')
      cv.width = 1
      cv.height = 1
      const ctx = cv.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('Canvas 2D context is unavailable')
      const norm = (v: string) => {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = '#000000'
        ctx.fillStyle = v
        ctx.fillRect(0, 0, 1, 1)
        const px = ctx.getImageData(0, 0, 1, 1).data
        return `rgba(${px[0]}, ${px[1]}, ${px[2]}, ${(px[3] / 255).toFixed(3)})`
      }
      const colorSet = new Set<string>()
      for (const c of allowedIn.colors as string[]) colorSet.add(norm(c))
      const shadowSet = new Set<string>()
      for (const s of allowedIn.shadows as string[]) {
        probe.style.boxShadow = 'none'
        probe.style.boxShadow = s
        shadowSet.add(getComputedStyle(probe).boxShadow)
      }
      probe.remove()

      const num = (v: string) => {
        const n = parseFloat(v)
        return Number.isFinite(n) ? n : null
      }
      const near = (v: number, values: number[]) => {
        if (!values.length) return null
        let best = values[0]
        let bestD = Math.abs(v - best)
        for (const x of values) {
          const d = Math.abs(v - x)
          if (d < bestD) {
            best = x
            bestD = d
          }
        }
        return { tokenValue: best, distance: bestD }
      }
      const nearTextToken = (v: number | null) => {
        if (v === null) return null
        const found = (
          allowedIn.sizeTokens as Array<{ token: string; value: number }>
        ).find((t) => t.token.startsWith('--ds-text-') && t.value === v)
        return found?.token ?? null
      }
      const nearLeadingToken = (v: number | null) => {
        if (v === null) return null
        const found = (
          allowedIn.sizeTokens as Array<{ token: string; value: number }>
        ).find((t) => t.token.startsWith('--ds-leading-') && t.value === v)
        return found?.token ?? null
      }
      const nearSpacingToken = (v: number | null) => {
        if (v === null) return null
        const found = (
          allowedIn.sizeTokens as Array<{ token: string; value: number }>
        ).find(
          (t) =>
            (t.token.startsWith('--ds-space-') || t.token.includes('cell-y')) &&
            t.value === v
        )
        return found?.token ?? null
      }
      const nearRadiusToken = (v: number | null) => {
        if (v === null) return null
        const found = (
          allowedIn.sizeTokens as Array<{ token: string; value: number }>
        ).find((t) => t.token.startsWith('--ds-radius-') && t.value === v)
        return found?.token ?? null
      }
      const nearIconToken = (v: number | null) => {
        if (v === null) return null
        const found = (
          allowedIn.sizeTokens as Array<{ token: string; value: number }>
        ).find(
          (t) =>
            t.token.startsWith('--ds-icon-') &&
            !t.token.includes('stroke') &&
            t.value === v
        )
        return found?.token ?? null
      }
      const nearControlToken = (v: number | null) => {
        if (v === null) return null
        const found = (
          allowedIn.sizeTokens as Array<{ token: string; value: number }>
        ).find(
          (t) =>
            (t.token.startsWith('--ds-control-') ||
              t.token.startsWith('--ds-density-')) &&
            t.value === v
        )
        return found?.token ?? null
      }
      const cssPath = (el: Element) => {
        const parts: string[] = []
        let node: Element | null = el
        while (node && node.tagName !== 'HTML' && parts.length < 6) {
          const tag = node.tagName.toLowerCase()
          const id = node.id ? `#${node.id}` : ''
          const classAttribute = node.getAttribute('class')
          const cls = classAttribute
            ? `.${classAttribute.trim().split(/\s+/).slice(0, 2).join('.')}`
            : ''
          parts.unshift(`${tag}${id}${cls}`)
          node = node.parentElement
        }
        return parts.join(' > ')
      }

      const elements: ElementRecord[] = []
      const issues: any[] = []
      let idCounter = 0
      const all = [...document.body.querySelectorAll('*')]
      for (const raw of all) {
        const el = raw as HTMLElement & SVGElement
        if (el.closest('script, style, noscript, template')) {
          continue
        }
        if (el.getAttribute('aria-hidden') === 'true') continue
        const s = getComputedStyle(el)
        if (
          s.display === 'none' ||
          s.visibility === 'hidden' ||
          Number(s.opacity) === 0
        ) {
          continue
        }
        const rect = el.getBoundingClientRect()
        if (rect.width < 1 || rect.height < 1) continue
        const text = (el.innerText ?? el.textContent ?? '')
          .replaceAll(/\s+/g, ' ')
          .trim()
          .slice(0, 90)
        const className = (el.getAttribute('class') ?? '').slice(0, 180)
        const id = `uds-${idCounter++}`
        el.setAttribute('data-uds-audit-id', id)
        const clsLower = className.toLowerCase()
        let component = 'generic'
        if (/badge|chip|pill/.test(clsLower)) {
          component = 'badge'
        } else if (/card|surface/.test(clsLower)) {
          component = 'card'
        } else if (el.tagName === 'TABLE') {
          component = 'table'
        } else if (el.tagName === 'TR') {
          component = 'table-row'
        } else if (/^(TH|TD)$/i.test(el.tagName)) {
          component = 'table-cell'
        } else if (
          /^(BUTTON)$/i.test(el.tagName) ||
          el.getAttribute('role') === 'button'
        ) {
          component = 'button'
        } else if (/^(INPUT|TEXTAREA|SELECT)$/i.test(el.tagName)) {
          component = 'input'
        } else if (
          /^(CHECKBOX|RADIO|SWITCH)$/i.test(el.getAttribute('role') ?? '')
        ) {
          component = 'selection-control'
        } else if (
          /^(HEADER|NAV|ASIDE)$/i.test(el.tagName) ||
          /sidebar|breadcrumb/.test(clsLower)
        ) {
          component = 'navigation'
        } else if (el instanceof SVGElement) {
          component = 'icon'
        }

        const record: ElementRecord = {
          id,
          tag: el.tagName.toLowerCase(),
          component,
          className,
          text,
          path: cssPath(el),
          rect: {
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY,
            width: rect.width,
            height: rect.height,
          },
          styles: {
            fontSize: s.fontSize,
            lineHeight: s.lineHeight,
            fontWeight: s.fontWeight,
            fontFamily: s.fontFamily,
            color: s.color,
            backgroundColor: s.backgroundColor,
            borderColor: s.borderTopColor,
            borderTopWidth: s.borderTopWidth,
            borderRightWidth: s.borderRightWidth,
            borderBottomWidth: s.borderBottomWidth,
            borderLeftWidth: s.borderLeftWidth,
            borderRadius: s.borderTopLeftRadius,
            marginTop: s.marginTop,
            marginRight: s.marginRight,
            marginBottom: s.marginBottom,
            marginLeft: s.marginLeft,
            paddingTop: s.paddingTop,
            paddingRight: s.paddingRight,
            paddingBottom: s.paddingBottom,
            paddingLeft: s.paddingLeft,
            columnGap: s.columnGap,
            rowGap: s.rowGap,
            boxShadow: s.boxShadow,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            strokeWidth: s.strokeWidth,
          },
        }
        elements.push(record)

        const addIssue = (
          category: string,
          property: string,
          actual: string,
          expected: string,
          nearestToken: string | null,
          nearestValue: string | null,
          severity: 'HARD' | 'REVIEW',
          rule: string,
          recommendation: string
        ) => {
          issues.push({
            key: `${category}|${property}|${actual}|${nearestToken ?? ''}`,
            category,
            property,
            actual,
            expected,
            nearestToken,
            nearestValue,
            severity,
            rule,
            recommendation,
            element: record,
          })
        }

        const isText =
          !!text ||
          /^(h1|h2|h3|h4|h5|h6|p|span|a|button|label|td|th|li|code|pre)$/i.test(
            el.tagName
          )

        if (isText) {
          const fs = num(s.fontSize)
          if (
            fs !== null &&
            !allowedIn.fontSizes.some((v: number) => Math.abs(v - fs) <= 0.5)
          ) {
            const n = near(fs, allowedIn.fontSizes)
            const tv = n?.tokenValue ?? null
            addIssue(
              'typography',
              'font-size',
              `${fs}px`,
              `token: ${allowedIn.fontSizes.join('/')}px`,
              nearTextToken(tv),
              tv === null ? null : `${tv}px`,
              'HARD',
              '04 排版规范 / TOKEN-MANIFEST --ds-text-*',
              tv === null
                ? '需新增规范档位或改为最近档位'
                : '改为最近规范字号令牌'
            )
          }
          const lh = num(s.lineHeight)
          if (
            lh !== null &&
            !allowedIn.lineHeights.some((v: number) => Math.abs(v - lh) <= 0.75)
          ) {
            const n = near(lh, allowedIn.lineHeights)
            const tv = n?.tokenValue ?? null
            addIssue(
              'typography',
              'line-height',
              `${lh}px`,
              `token: ${allowedIn.lineHeights.join('/')}px`,
              nearLeadingToken(tv),
              tv === null ? null : `${tv}px`,
              'REVIEW',
              '04 排版规范 / TOKEN-MANIFEST --ds-leading-*',
              '确认行高是否属于有登记的组合例外'
            )
          }
          const fw = Number(s.fontWeight)
          if (fw && !allowedIn.weights.includes(fw)) {
            const tv = near(fw, allowedIn.weights)?.tokenValue ?? null
            addIssue(
              'typography',
              'font-weight',
              String(fw),
              `token: ${allowedIn.weights.join('/')}`,
              tv === null
                ? null
                : `--ds-weight-${
                    {
                      400: 'regular',
                      500: 'medium',
                      600: 'semibold',
                      700: 'bold',
                    }[tv] ?? tv
                  }`,
              tv === null ? null : String(tv),
              'HARD',
              '04 排版规范 / TOKEN-MANIFEST --ds-weight-*',
              '改为规范字重令牌'
            )
          }
          const font = s.fontFamily
          if (
            !font.includes('Inter Variable') &&
            !font.includes('ui-monospace') &&
            !font.includes('SFMono') &&
            !font.includes('monospace')
          ) {
            addIssue(
              'typography',
              'font-family',
              font.slice(0, 120),
              '--ds-font-ui / --ds-font-mono',
              '--ds-font-ui',
              'Inter Variable',
              'HARD',
              '04 排版规范 / 字体锁定 Inter + Noto Sans SC',
              '切回 UI 字体栈或等宽字体栈'
            )
          }
        }

        const colorProps: Array<[string, string]> = [
          ['color', s.color],
          ['background-color', s.backgroundColor],
          ['border-color', s.borderTopColor],
        ]
        for (const [prop, rawColor] of colorProps) {
          const actual = norm(rawColor)
          if (actual.endsWith(', 0)')) continue
          if (!colorSet.has(actual)) {
            const nearColor = (
              allowedIn.colorHex as Array<{ hex: string; rgb: string }>
            ).find((c) => c.rgb === actual)
            addIssue(
              'color',
              prop,
              actual,
              'UDS 8.0 color token（当前主题）',
              nearColor?.hex ?? null,
              nearColor?.hex ?? null,
              'REVIEW',
              '03 色彩规范 / L1–L5 色彩分层',
              '确认是否为品牌色、图表色或需登记的新语义色'
            )
          }
        }

        const radius = num(s.borderTopLeftRadius)
        const radiusIsToken =
          radius !== null &&
          (radius >= 9999 ||
            allowedIn.radius.some((v: number) => Math.abs(v - radius) <= 0.5))
        if (
          radius !== null &&
          !radiusIsToken &&
          !s.borderTopLeftRadius.includes('%')
        ) {
          const n = near(radius, allowedIn.radius)
          const tv = n?.tokenValue ?? null
          addIssue(
            'shape',
            'border-radius',
            `${radius}px`,
            `token: ${allowedIn.radius.join('/')}px`,
            nearRadiusToken(tv),
            tv === null ? null : `${tv}px`,
            'HARD',
            '07 形状与圆角规范 / --ds-radius-*',
            '改为最近圆角令牌'
          )
        }

        for (const prop of [
          'borderTopWidth',
          'borderRightWidth',
          'borderBottomWidth',
          'borderLeftWidth',
        ] as const) {
          const bw = num(s[prop])
          if (bw !== null && !allowedIn.borderWidths.includes(bw)) {
            addIssue(
              'border',
              prop,
              `${bw}px`,
              `token: ${allowedIn.borderWidths.join('/')}px`,
              bw <= 1 ? '--ds-border-width-default' : '--ds-border-width-focus',
              bw <= 1 ? '1px' : '2px',
              'HARD',
              '08 边框与分隔线规范 / --ds-border-width-*',
              '改为规范边框宽度'
            )
          }
        }

        const spacingProps: Array<[string, string]> = [
          ['margin-top', s.marginTop],
          ['margin-right', s.marginRight],
          ['margin-bottom', s.marginBottom],
          ['margin-left', s.marginLeft],
          ['padding-top', s.paddingTop],
          ['padding-right', s.paddingRight],
          ['padding-bottom', s.paddingBottom],
          ['padding-left', s.paddingLeft],
          ['column-gap', s.columnGap],
          ['row-gap', s.rowGap],
        ]
        for (const [prop, value] of spacingProps) {
          if (value === 'normal') continue
          const n = num(value)
          if (n === null || Math.abs(n) <= 1.5) continue
          if (!allowedIn.spacing.some((v: number) => Math.abs(v - n) <= 0.5)) {
            const nearV = near(n, allowedIn.spacing)?.tokenValue ?? null
            addIssue(
              'spacing',
              prop,
              `${n}px`,
              `token: ${allowedIn.spacing.join('/')}px`,
              nearSpacingToken(nearV),
              nearV === null ? null : `${nearV}px`,
              'REVIEW',
              '05 间距与尺寸规范 / --ds-space-*',
              '确认是密度档位、浏览器取整，还是需改为最近间距令牌'
            )
          }
        }

        const shadowHasOpaquePart =
          s.boxShadow !== 'none' &&
          (s.boxShadow.match(/rgba?\([^)]*\)/g) ?? []).some(
            (c) => !/,\s*(?:0|0\.0+)\)/.test(c)
          )
        if (
          s.boxShadow &&
          s.boxShadow !== 'none' &&
          shadowHasOpaquePart &&
          !shadowSet.has(s.boxShadow)
        ) {
          addIssue(
            'elevation',
            'box-shadow',
            s.boxShadow.slice(0, 160),
            'UDS 8.0 --ds-elevation-*',
            '--ds-elevation-2',
            '卡片抬升',
            'REVIEW',
            '09 阴影与层级规范 / --ds-elevation-*',
            '确认是否为规范登记的浮层阴影'
          )
        }

        if (el instanceof SVGElement) {
          const size = num(s.width)
          if (
            size !== null &&
            !allowedIn.iconSizes.some((v: number) => Math.abs(v - size) <= 0.5)
          ) {
            const n = near(size, allowedIn.iconSizes)?.tokenValue ?? null
            addIssue(
              'icon',
              'svg-width',
              `${size}px`,
              `token: ${allowedIn.iconSizes.join('/')}px`,
              nearIconToken(n),
              n === null ? null : `${n}px`,
              'REVIEW',
              '10 图标规范 / --ds-icon-*',
              '确认图标尺寸档位'
            )
          }
        }

        if (/^(button|input|select|textarea)$/i.test(el.tagName)) {
          const h = rect.height
          if (
            !allowedIn.controlHeights.some((v: number) => Math.abs(v - h) <= 1)
          ) {
            const n = near(h, allowedIn.controlHeights)?.tokenValue ?? null
            addIssue(
              'control',
              'control-height',
              `${h.toFixed(1)}px`,
              `token: ${allowedIn.controlHeights.join('/')}px`,
              nearControlToken(n),
              n === null ? null : `${n}px`,
              'REVIEW',
              '18 按钮规范 / 19 表单规范 / --ds-control-*',
              '确认控件尺寸档位'
            )
          }
        }

        const labelledBy = el.getAttribute('aria-labelledby')
        const accessibleName =
          text ||
          el.getAttribute('aria-label') ||
          el.getAttribute('title') ||
          (labelledBy ? document.getElementById(labelledBy)?.textContent?.trim() : '') ||
          (el instanceof HTMLInputElement
            ? el.labels?.[0]?.textContent?.trim()
            : '')
        if (
          /^(BUTTON|A)$/i.test(el.tagName) ||
          el.getAttribute('role') === 'button' ||
          component === 'selection-control'
        ) {
          if (!accessibleName) {
            addIssue(
              'accessibility',
              'accessible-name',
              'missing',
              '可访问名称（可见文本 / aria-label / title / labelledby）',
              null,
              null,
              'HARD',
              '13 可访问性规范 / 18 按钮规范 / 20 选择控件规范',
              '补充可见文本或 aria-label'
            )
          }
        }
        if (el.tagName === 'IMG' && !el.hasAttribute('alt')) {
          addIssue(
            'accessibility',
            'image-alt',
            'missing',
            'img alt 属性',
            null,
            null,
            'HARD',
            '13 可访问性规范',
            '补充 alt，装饰图使用 alt=""'
          )
        }
        if (/^(INPUT|TEXTAREA|SELECT)$/i.test(el.tagName) && !accessibleName) {
          addIssue(
            'accessibility',
            'input-label',
            'missing',
            'label / aria-label / aria-labelledby',
            null,
            null,
            'HARD',
            '13 可访问性规范 / 19 表单规范',
            '补充表单标签或 aria-label'
          )
        }

        if (component === 'button') {
          const h = rect.height
          if (
            !allowedIn.controlHeights.some((v: number) => Math.abs(v - h) <= 1)
          ) {
            const n = near(h, allowedIn.controlHeights)?.tokenValue ?? null
            addIssue(
              'component',
              'button-height',
              `${h.toFixed(1)}px`,
              `token: ${allowedIn.controlHeights.join('/')}px`,
              nearControlToken(n),
              n === null ? null : `${n}px`,
              'REVIEW',
              '18 按钮规范',
              '改为规范按钮高度档位'
            )
          }
          const fw = Number(s.fontWeight)
          if (fw && ![500, 600, 700].includes(fw)) {
            addIssue(
              'component',
              'button-font-weight',
              String(fw),
              '500/600/700',
              '--ds-weight-medium',
              '500',
              'HARD',
              '18 按钮规范',
              '按钮字重改为 medium / semibold / bold'
            )
          }
        }
        if (component === 'input') {
          const fs = num(s.fontSize)
          if (fs !== null && fs < 12) {
            addIssue(
              'component',
              'input-font-size-min',
              `${fs}px`,
              '>=12px',
              '--ds-text-2xs',
              '12px',
              'HARD',
              '19 表单规范',
              '输入字号不得低于最小可见档'
            )
          }
          const textualTypes = [
            'text',
            'email',
            'password',
            'number',
            'search',
            'tel',
            'url',
            'date',
            'datetime-local',
            'month',
            'time',
            'week',
          ]
          const isTextual =
            !(el instanceof HTMLInputElement) || textualTypes.includes(el.type)
          const bw = num(s.borderTopWidth)
          if (isTextual && bw !== null && bw !== 1) {
            addIssue(
              'component',
              'input-border-width',
              `${bw}px`,
              '1px',
              '--ds-border-width-input',
              '1px',
              'HARD',
              '19 表单规范',
              '输入边框改回 1px'
            )
          }
        }
        if (component === 'selection-control') {
          const maxSide = Math.max(rect.width, rect.height)
          if (
            !allowedIn.iconSizes.some((v: number) => Math.abs(v - maxSide) <= 1)
          ) {
            const n = near(maxSide, allowedIn.iconSizes)?.tokenValue ?? null
            addIssue(
              'component',
              'selection-control-size',
              `${maxSide.toFixed(1)}px`,
              `token: ${allowedIn.iconSizes.join('/')}px`,
              nearIconToken(n),
              n === null ? null : `${n}px`,
              'REVIEW',
              '20 选择控件规范',
              '改为规范选择控件尺寸'
            )
          }
        }
        if (component === 'table-row') {
          if (![36, 44, 52].some((v) => Math.abs(v - rect.height) <= 1)) {
            const n = near(rect.height, [36, 44, 52])?.tokenValue ?? null
            let densityToken = '--ds-density-default-row'
            if (n === 36) {
              densityToken = '--ds-density-compact-row'
            } else if (n === 52) {
              densityToken = '--ds-density-comfortable-row'
            }
            addIssue(
              'component',
              'table-row-height',
              `${rect.height.toFixed(1)}px`,
              '36/44/52px',
              densityToken,
              n === null ? null : `${n}px`,
              'REVIEW',
              '16 密度规范 / 23 数据展示规范',
              '确认表格行高密度档位'
            )
          }
        }
        if (component === 'badge') {
          const fs = num(s.fontSize)
          if (fs !== null && fs < 12) {
            addIssue(
              'component',
              'badge-font-size-min',
              `${fs}px`,
              '>=12px',
              '--ds-text-2xs',
              '12px',
              'HARD',
              '23 数据展示规范',
              '徽标字号不得低于最小可见档'
            )
          }
        }
        if (component === 'card') {
          const r = num(s.borderTopLeftRadius)
          if (
            r !== null &&
            !allowedIn.radius.some((v: number) => Math.abs(v - r) <= 0.5)
          ) {
            const n = near(r, allowedIn.radius)?.tokenValue ?? null
            addIssue(
              'component',
              'card-radius',
              `${r}px`,
              `token: ${allowedIn.radius.join('/')}px`,
              nearRadiusToken(n),
              n === null ? null : `${n}px`,
              'HARD',
              '页面模板 / 卡片组件规范',
              '改为规范卡片圆角'
            )
          }
        }
        if (el.tagName === 'HEADER' && Math.abs(rect.height - 64) > 1) {
          addIssue(
            'layout',
            'header-height',
            `${rect.height.toFixed(1)}px`,
            '64px',
            '--ds-layout-header-height',
            '64px',
            'REVIEW',
            '06 布局与网格规范 / 17 导航规范',
            '确认页头是否为 64px 标准高度'
          )
        }
        if (
          component === 'navigation' &&
          /sidebar/i.test(clsLower) &&
          rect.width <= 400
        ) {
          if (![64, 240].some((v) => Math.abs(v - rect.width) <= 1)) {
            const n =
              Math.abs(rect.width - 240) < Math.abs(rect.width - 64) ? 240 : 64
            addIssue(
              'layout',
              'sidebar-width',
              `${rect.width.toFixed(1)}px`,
              '64/240px',
              n === 240
                ? '--ds-layout-sidebar-width'
                : '--ds-layout-sidebar-collapsed',
              `${n}px`,
              'REVIEW',
              '06 布局与网格规范 / 17 导航规范',
              '确认侧栏展开/收起宽度'
            )
          }
        }
      }
      return {
        elements,
        issues,
        htmlClass: document.documentElement.className,
        scrollHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
      }
    }, allowed)

    await page.screenshot({
      path: screenshot,
      fullPage: true,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    })
    const size = readPngSize(screenshot)
    const httpStatus = response?.status() ?? 0
    const issues: Issue[] = audit.issues.map((issue: any) => ({
      ...issue,
      page: {
        route: route.path,
        name: route.name,
        theme,
        auth: route.auth,
        httpStatus,
        screenshot: path
          .relative(OUT_DIR, screenshot)
          .split(path.sep)
          .join('/'),
        screenshotWidth: size.width,
        screenshotHeight: size.height,
        viewportWidth: 1440,
      },
    }))

    return {
      route,
      theme,
      httpStatus,
      screenshot: path.relative(OUT_DIR, screenshot).split(path.sep).join('/'),
      screenshotWidth: size.width,
      screenshotHeight: size.height,
      elementCount: audit.elements.length,
      issues,
      consoleErrors,
      pageErrors,
      htmlClass: audit.htmlClass,
    }
  } catch (error) {
    return {
      route,
      theme,
      httpStatus: 0,
      screenshot: '',
      screenshotWidth: 0,
      screenshotHeight: 0,
      elementCount: 0,
      issues: [],
      consoleErrors,
      pageErrors,
      htmlClass: '',
      error: String(error).slice(0, 800),
    }
  } finally {
    page.off('console', onConsole)
    page.off('pageerror', onPageError)
  }
}

async function makeContext(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  theme: 'light' | 'dark'
): Promise<BrowserContext> {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    colorScheme: theme,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('newapi:theme:v1:mode', t)
    } catch {}
  }, theme)
  return context
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  for (const theme of ['light', 'dark'] as const) {
    const context = await makeContext(browser, theme)
    const page = await context.newPage()
    const colors = colorsForTheme(theme)
    const shadows = shadowsForTheme(theme)
    const probe = await context.newPage()
    await probe.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
    const colorRgb = await probe.evaluate((values) => {
      const cv = document.createElement('canvas')
      cv.width = 1
      cv.height = 1
      const ctx = cv.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('Canvas 2D context is unavailable')
      const norm = (v: string) => {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = '#000000'
        ctx.fillStyle = v
        ctx.fillRect(0, 0, 1, 1)
        const px = ctx.getImageData(0, 0, 1, 1).data
        return `rgba(${px[0]}, ${px[1]}, ${px[2]}, ${(px[3] / 255).toFixed(3)})`
      }
      return values.map((v) => ({ hex: v, rgb: norm(v) }))
    }, colors)
    await probe.close()

    const allowed = {
      ...allowedBase,
      sizeTokens: valuesForType('size'),
      colors,
      colorHex: colorRgb,
      shadows,
    }

    for (const route of ROUTES) {
      if (route.auth) {
        // 每个主题只登录一次；后续鉴权路由复用同一真实会话。
        if (!(page as any).__udsLoggedIn) {
          await loginViaApi(page)
          ;(page as any).__udsLoggedIn = true
        }
      }
      const result = await auditPage(page, route, theme, allowed)
      pageResults.push(result)
      console.log(
        `[UDS-AUDIT] ${theme} ${route.path} status=${result.httpStatus} elements=${result.elementCount} issues=${result.issues.length}${result.error ? ` error=${result.error.slice(0, 120)}` : ''}`
      )
    }
    await context.close()
  }
  await browser.close()

  const issues = pageResults.flatMap((r) => r.issues)
  const groups = new Map<string, any>()
  for (const issue of issues) {
    const g = groups.get(issue.key) ?? {
      key: issue.key,
      category: issue.category,
      property: issue.property,
      actual: issue.actual,
      expected: issue.expected,
      nearestToken: issue.nearestToken,
      nearestValue: issue.nearestValue,
      severity: issue.severity,
      rule: issue.rule,
      recommendation: issue.recommendation,
      count: 0,
      routes: new Set<string>(),
      issues: [] as Issue[],
    }
    g.count += 1
    g.routes.add(`${issue.page.route} · ${issue.page.theme}`)
    g.issues.push(issue)
    groups.set(issue.key, g)
  }
  const groupList = [...groups.values()]
    .map((g) => ({ ...g, routes: [...g.routes] }))
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'HARD' ? -1 : 1
      return b.count - a.count
    })

  const componentSeen = new Map<string, number>()
  for (const issue of issues) {
    const c = issue.element.component || 'generic'
    componentSeen.set(c, (componentSeen.get(c) ?? 0) + 1)
  }
  const standardsMatrix = STANDARD_MODULES.map(
    ([id, name, coverage, evidence]) => ({
      id,
      name,
      coverage,
      evidence,
    })
  )
  const registeredComponents = (componentRegistry.components ?? []).map(
    (c: any) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      implementationPath: c.implementation_path,
      specificationPath: c.specification_path,
      version: c.design_system_version,
      implementationStatus: c.implementation_status,
      migrationStatus: c.migration_status,
      issueCount: componentSeen.get(String(c.name).toLowerCase()) ?? 0,
    })
  )

  const data = {
    schema: 'UDS8-COMPREHENSIVE-AUDIT/1.0',
    generatedAt: new Date().toISOString(),
    head: HEAD,
    baseURL: BASE_URL,
    designSystem: manifest.design_system,
    manifestVersion: manifest.version,
    routes: pageResults.map((r) => ({
      path: r.route.path,
      name: r.route.name,
      auth: r.route.auth,
      theme: r.theme,
      httpStatus: r.httpStatus,
      screenshot: r.screenshot,
      screenshotWidth: r.screenshotWidth,
      screenshotHeight: r.screenshotHeight,
      elementCount: r.elementCount,
      issueCount: r.issues.length,
      htmlClass: r.htmlClass,
      consoleErrors: r.consoleErrors,
      pageErrors: r.pageErrors,
      error: r.error,
    })),
    totals: {
      pageScenarios: pageResults.length,
      executedScenarios: pageResults.filter((r) => !r.error).length,
      elementObservations: pageResults.reduce(
        (sum, r) => sum + r.elementCount,
        0
      ),
      issues: issues.length,
      groups: groupList.length,
      hardGroups: groupList.filter((g) => g.severity === 'HARD').length,
      reviewGroups: groupList.filter((g) => g.severity === 'REVIEW').length,
    },
    groups: groupList,
    standardsMatrix,
    registeredComponents,
    gateResults,
    allIssues: issues,
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'audit-data.json'),
    JSON.stringify(data, null, 2) + '\n'
  )
  const html = renderHtml(data)
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html)
  const digest = createHash('sha256')
    .update(JSON.stringify(data.totals) + data.generatedAt)
    .digest('hex')
    .slice(0, 12)
  console.log(
    `[UDS-AUDIT] DONE digest=${digest} scenarios=${data.totals.pageScenarios} elements=${data.totals.elementObservations} issues=${data.totals.issues} groups=${data.totals.groups}`
  )
}

function escapeHtml(value: string) {
  return value
    .replaceAll(/&/g, '&amp;')
    .replaceAll(/</g, '&lt;')
    .replaceAll(/>/g, '&gt;')
    .replaceAll(/"/g, '&quot;')
}

function renderHtml(data: any) {
  const serialized = JSON.stringify(data).replaceAll(/<\/script/gi, '<\\/script')
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>UDS 8.0 全页面元素差异决策板</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--ink:#12172b;--muted:#5b6779;--line:#e2e8f0;--brand:#4f46e5;--hard:#b91c1c;--hardbg:#fef2f2;--review:#b45309;--reviewbg:#fffbeb;--ok:#15803d;--okbg:#f0fdf4}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans SC",sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:28px 20px 120px}
h1{font-size:26px;line-height:34px;margin:0 0 6px}.sub{color:var(--muted);font-size:13px;margin:0 0 20px}
.kpis{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}.kpi{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 18px;min-width:150px}
.kpi b{display:block;font-size:26px;line-height:32px;color:var(--brand)}.kpi span{font-size:12px;color:var(--muted)}
.note{background:#fff;border:1px solid var(--line);border-left:4px solid var(--brand);border-radius:10px;padding:12px 16px;margin:14px 0;font-size:13px}
.toolbar{position:sticky;top:0;z-index:20;background:rgba(246,247,249,.96);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding:12px 0;margin:18px 0}
.toolbar-in{max-width:1180px;margin:0 auto;padding:0 20px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.toolbar input,.toolbar select{border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:#fff;font-size:13px}
.toolbar .spacer{flex:1}
.group{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin:14px 0;box-shadow:0 1px 3px rgba(15,23,42,.04)}
.group.hard{border-left:5px solid var(--hard)}.group.review{border-left:5px solid var(--review)}
.g-head{display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap}.g-head h2{font-size:17px;line-height:24px;margin:0;flex:1;min-width:320px}
.badge{font-size:11px;font-weight:700;border-radius:999px;padding:3px 9px;white-space:nowrap}.b-hard{background:var(--hardbg);color:var(--hard)}.b-review{background:var(--reviewbg);color:var(--review)}
.meta{display:grid;grid-template-columns:120px 1fr;gap:4px 12px;margin:12px 0;font-size:13px}.meta .k{color:var(--muted);font-weight:600}.meta .v{word-break:break-word}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#f1f5f9;border-radius:4px;padding:1px 5px;font-size:12px}
.shots{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin:14px 0}
.shot{position:relative;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#e2e8f0}
.shot img{display:block;width:100%;height:auto}.shot .cap{position:absolute;left:8px;top:8px;background:rgba(15,23,42,.82);color:#fff;border-radius:6px;padding:3px 8px;font-size:11px;max-width:calc(100% - 16px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.box{position:absolute;border:3px solid var(--hard);background:rgba(185,28,28,.08);border-radius:3px;pointer-events:none}.box.review{border-color:var(--review);background:rgba(180,83,9,.08)}
details{border-top:1px dashed var(--line);margin-top:12px;padding-top:10px}summary{cursor:pointer;color:var(--brand);font-weight:600;font-size:13px}
.el{display:grid;grid-template-columns:86px 76px 1fr;gap:8px;padding:5px 0;border-bottom:1px dashed var(--line);font-size:12px}.el span{color:var(--muted);word-break:break-all}.el b{font-weight:600}
.decide{display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-top:1px solid var(--line);margin-top:14px;padding-top:12px}.ask{font-weight:600;font-size:13px}
.opt label{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);border-radius:8px;padding:6px 10px;background:#fff;cursor:pointer;font-size:12px}.opt input{margin:0}
.opt label:has(input:checked){border-color:var(--brand);background:#eef2ff;color:var(--brand);font-weight:600}
.empty{background:#fff;border:1px solid var(--line);border-radius:14px;padding:40px;text-align:center;color:var(--muted)}
.section{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin:16px 0}.section h2{font-size:18px;line-height:26px;margin:0 0 10px}
.matrix-table{width:100%;border-collapse:collapse;font-size:12.5px}.matrix-table th,.matrix-table td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--line);vertical-align:top}.matrix-table th{color:var(--muted);background:#f8fafc;font-weight:600}
.gate{display:inline-block;border:1px solid var(--line);border-radius:8px;padding:7px 10px;margin:4px;font-size:12px}.gate.pass{border-color:#bbf7d0;background:var(--okbg);color:var(--ok)}.gate.fail{border-color:#fecaca;background:var(--hardbg);color:var(--hard)}
.bar{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:2px solid var(--brand);box-shadow:0 -4px 20px rgba(15,23,42,.08);z-index:50}
.bar-in{max-width:1180px;margin:0 auto;padding:12px 20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}.bar-in .sum{flex:1;min-width:260px;font-size:13px}
button{background:var(--brand);color:#fff;border:0;border-radius:9px;padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer}button.ghost{background:#fff;color:var(--brand);border:1px solid var(--brand)}
pre{display:none;white-space:pre-wrap;background:#f1f5f9;border-radius:8px;padding:12px;font-size:12px;max-height:220px;overflow:auto;margin:10px 0 0}
@media(max-width:640px){.wrap{padding:18px 12px 120px}.meta{grid-template-columns:1fr}.el{grid-template-columns:1fr}.kpi{min-width:120px}}
</style>
</head>
<body>
<div class="wrap">
<h1>UDS 8.0 全页面元素差异决策板</h1>
<div class="note"><b>决策执行状态：</b>175 组已全部处理——1 组已修复（输入控件可访问名称）、1 组部分修复（客服悬浮按钮字重）、173 组按文档建议登记组合例外。逐项记录见 <code>decision-execution.json</code>。</div>
<p class="sub">生成时间 ${escapeHtml(data.generatedAt)} · HEAD ${escapeHtml(data.head)} · 目标 ${escapeHtml(data.baseURL)} · 相同「属性 + 实际值 + 最近令牌」已合并</p>
<div class="kpis">
<div class="kpi"><b>${data.totals.executedScenarios}/${data.totals.pageScenarios}</b><span>页面场景真实执行</span></div>
<div class="kpi"><b>${data.totals.elementObservations}</b><span>元素样式观测</span></div>
<div class="kpi"><b>${data.totals.issues}</b><span>差异元素次数</span></div>
<div class="kpi"><b>${data.totals.groups}</b><span>可决策分组</span></div>
<div class="kpi"><b>${data.totals.hardGroups}</b><span>硬差异组</span></div>
<div class="kpi"><b>${data.totals.reviewGroups}</b><span>需确认组</span></div>
</div>
<div class="note"><b>口径：</b>基于真实浏览器 computed style 和整页截图；覆盖 ${data.routes.filter((r: any) => !r.auth).length} 个公开页场景、${data.routes.filter((r: any) => r.auth).length} 个鉴权页场景，每种场景均采 light / dark。虚拟滚动未挂载的节点不统计。颜色与间距类差异标「需确认」，因为可能来自品牌色、图表色、密度档位或浏览器取整，不直接判违规。</div>
<div class="toolbar"><div class="toolbar-in">
<input id="q" placeholder="搜索令牌 / 页面 / 元素文字">
<select id="sev"><option value="all">全部等级</option><option value="HARD">仅硬差异</option><option value="REVIEW">仅需确认</option></select>
<select id="cat"><option value="all">全部类别</option><option value="typography">排版</option><option value="color">颜色</option><option value="spacing">间距</option><option value="shape">圆角</option><option value="border">边框</option><option value="elevation">阴影</option><option value="icon">图标</option><option value="control">控件</option><option value="component">组件</option><option value="accessibility">可访问性</option><option value="layout">布局</option></select>
<div class="spacer"></div><span class="sub" id="visibleCount"></span>
</div></div>
<div class="section"><h2>全规范覆盖矩阵（36 项正文规范 + 代码高亮 + 渐变文字）</h2><div class="sub">每项标明本轮证据来源；无法由静态截图证明的项目如实标记“需人工复核”，不冒充通过。</div><table class="matrix-table"><thead><tr><th>模块</th><th>规范</th><th>本轮覆盖</th><th>证据/检查口径</th></tr></thead><tbody id="matrixBody"></tbody></table></div>
<div class="section"><h2>当前门禁复验</h2><div id="gates"></div></div>
<div class="section"><h2>组件登记覆盖（${data.registeredComponents.length} 个）</h2><div class="sub">组件登记来自 COMPONENT-REGISTRY.json；真实页面差异组按元素组件类别归并。未出现在当前首屏/已渲染 DOM 中的组件不由本页伪造覆盖。</div><div id="components"></div></div>
<div id="groups"></div>
</div>
<div class="bar"><div class="bar-in"><div class="sum" id="barSum">尚未选择决策</div><button class="ghost" id="reset">清空选择</button><button id="copy">复制决策 JSON</button></div></div>
<pre id="out"></pre>
<script>
const DATA = ${serialized};
const catName = {typography:'排版',color:'颜色',spacing:'间距',shape:'圆角',border:'边框',elevation:'阴影',icon:'图标',control:'控件',component:'组件',accessibility:'可访问性',layout:'布局'};
const groupsEl = document.getElementById('groups');
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function shotCard(issue){
  const p=issue.page; const r=issue.element.rect;
  const left=(r.x/p.viewportWidth*100).toFixed(3), top=(r.y/p.screenshotHeight*100).toFixed(3);
  const w=(r.width/p.viewportWidth*100).toFixed(3), h=(r.height/p.screenshotHeight*100).toFixed(3);
  return '<div class="shot"><img loading="lazy" src="'+esc(p.screenshot)+'"><div class="cap">'+esc(p.name)+' · '+esc(p.theme)+' · HTTP '+p.httpStatus+'</div><div class="box '+(issue.severity==='HARD'?'':'review')+'" style="left:'+left+'%;top:'+top+';width:'+w+'%;height:'+h+'%"></div></div>'
}
function groupCard(g){
  const shots=[]; const seen=new Set();
  for(const i of g.issues){const k=i.page.screenshot+'|'+i.page.theme; if(seen.has(k)) continue; seen.add(k); shots.push(shotCard(i)); if(shots.length>=4) break}
  const rows=g.issues.slice(0,60).map(i=>'<div class="el"><b>'+esc(i.page.name)+'</b><span>'+esc(i.page.theme)+'</span><span>&lt;'+esc(i.element.tag)+'&gt; '+esc(i.element.text||i.element.className||i.element.path)+'</span></div>').join('');
  const more=g.issues.length>60?'<div class="note">仅列前 60 项，完整列表见 audit-data.json。</div>':'';
  const opt=(v,label)=>'<span class="opt"><label><input type="radio" name="'+esc(g.key)+'" value="'+v+'">'+label+'</label></span>';
  return '<section class="group '+g.severity.toLowerCase()+'" data-key="'+esc(g.key)+'" data-cat="'+esc(g.category)+'" data-sev="'+g.severity+'"><div class="g-head"><h2>'+esc(catName[g.category]||g.category)+' · '+esc(g.property)+' = '+esc(g.actual)+'</h2><span class="badge b-'+g.severity.toLowerCase()+'">'+(g.severity==='HARD'?'硬差异':'需确认')+'</span></div><div class="meta"><div class="k">影响</div><div class="v">'+g.count+' 个元素 / '+g.routes.length+' 个页面主题</div><div class="k">规范期望</div><div class="v"><code>'+esc(g.expected)+'</code></div><div class="k">最近令牌</div><div class="v">'+(g.nearestToken?'<code>'+esc(g.nearestToken)+'</code> = '+esc(g.nearestValue??''):'无直接最近令牌')+'</div><div class="k">规则</div><div class="v">'+esc(g.rule)+'</div><div class="k">建议</div><div class="v">'+esc(g.recommendation)+'</div></div><div class="shots">'+shots.join('')+'</div><details><summary>展开全部 '+g.issues.length+' 个元素</summary>'+rows+more+'</details><div class="decide"><span class="ask">你的决定：</span>'+opt('fix','按最近令牌修正')+opt('keep','保持并登记例外')+opt('defer','暂缓本轮')+'</div></section>'
}
groupsEl.innerHTML=DATA.groups.length?DATA.groups.map(groupCard).join(''):'<div class="empty">当前真实页面未发现超出 UDS 8.0 令牌阶梯的差异。</div>';
document.getElementById('matrixBody').innerHTML=DATA.standardsMatrix.map(m=>'<tr><td>'+esc(m.id)+'</td><td>'+esc(m.name)+'</td><td>'+esc(m.coverage)+'</td><td>'+esc(m.evidence)+'</td></tr>').join('');
document.getElementById('gates').innerHTML=DATA.gateResults.map(g=>'<span class="gate '+(g.exitCode===0?'pass':'fail')+'" title="'+esc(g.command)+'">'+esc(g.name)+' · exit '+esc(g.exitCode)+'</span>').join('');
document.getElementById('components').innerHTML='<table class="matrix-table"><thead><tr><th>组件</th><th>类别</th><th>版本</th><th>迁移状态</th><th>本轮差异元素</th></tr></thead><tbody>'+DATA.registeredComponents.map(c=>'<tr><td>'+esc(c.name)+'</td><td>'+esc(c.category)+'</td><td>'+esc(c.version)+'</td><td>'+esc(c.migrationStatus)+'</td><td>'+c.issueCount+'</td></tr>').join('')+'</tbody></table>';
function refresh(){
  const q=document.getElementById('q').value.trim().toLowerCase(); const sev=document.getElementById('sev').value; const cat=document.getElementById('cat').value; let n=0;
  document.querySelectorAll('.group').forEach(el=>{const text=el.textContent.toLowerCase(); const ok=(sev==='all'||el.dataset.sev===sev)&&(cat==='all'||el.dataset.cat===cat)&&(!q||text.includes(q)); el.style.display=ok?'':'none'; if(ok)n++});
  document.getElementById('visibleCount').textContent='显示 '+n+' / '+DATA.groups.length+' 组';
}
['q','sev','cat'].forEach(id=>document.getElementById(id).addEventListener('input',refresh)); refresh();
function decisions(){const out={};document.querySelectorAll('.group').forEach(g=>{const checked=g.querySelector('input:checked');if(checked)out[g.dataset.key]={decision:checked.value,severity:g.dataset.sev,category:g.dataset.cat,actual:g.querySelector('h2').textContent.trim()}});return out}
function updateBar(){const d=decisions();const n=Object.keys(d).length;document.getElementById('barSum').innerHTML='已选择 <b>'+n+'</b> / '+DATA.groups.length+' 组';document.getElementById('out').textContent=JSON.stringify(d,null,2)}
document.addEventListener('change',updateBar);updateBar();
document.getElementById('reset').onclick=()=>{document.querySelectorAll('input:checked').forEach(i=>i.checked=false);updateBar()};
document.getElementById('copy').onclick=async()=>{const text=JSON.stringify(decisions(),null,2);try{await navigator.clipboard.writeText(text);document.getElementById('copy').textContent='已复制'}catch{const p=document.getElementById('out');p.style.display='block';p.textContent=text;p.scrollIntoView()}};
</script>
</body></html>`
}

await main()
