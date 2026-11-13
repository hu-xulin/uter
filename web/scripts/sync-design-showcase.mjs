#!/usr/bin/env node
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
/**
 * UTER Design System 3.0 · 规范 → 展示页 单一数据链同步器（§28.3 / §28.4）
 *
 * 职责：
 *   1. 从 UTER-DESIGN-SYSTEM-3.0.md §28 的 TOKEN-MANIFEST 提取唯一值声明；
 *   2. 生成 file:// 打开 showcase.html 时使用的离线快照 showcase.tokens.js；
 *   3. 校验「声明真源」与「运行真源」（CSS Token）逐值相等，并抽查投影表。
 *
 * 用法（可在仓库根或 web/ 下执行）：
 *   node web/scripts/sync-design-showcase.mjs           # 生成快照 + 校验
 *   node web/scripts/sync-design-showcase.mjs --check  # 只校验，不写文件
 *
 * 退出码：0 = 全部通过；1 = 存在漂移；2 = 无法读取输入（BLOCKED）。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(WEB_ROOT, '..')
const CHECK_ONLY = process.argv.includes('--check')

const SPEC = path.join(REPO_ROOT, 'docs/design-system/UTER-DESIGN-SYSTEM-3.0.md')
const SNAPSHOT = path.join(REPO_ROOT, 'docs/design-system/showcase.tokens.js')
const SHOWCASE = path.join(REPO_ROOT, 'docs/design-system/showcase.html')
const TYPO = path.join(WEB_ROOT, 'src/design-system/tokens/typography.css')
const PRIMITIVES = path.join(WEB_ROOT, 'src/design-system/tokens/primitives.css')
const SPACING = path.join(WEB_ROOT, 'src/design-system/tokens/spacing.css')
const THEME = path.join(WEB_ROOT, 'src/styles/theme.css')
const BRAND_JSON = path.join(WEB_ROOT, 'src/design-system/source/brand.tokens.json')

const results = []
function record(status, name, detail) {
  results.push({ status, name, detail })
}
function read(file) {
  if (!fs.existsSync(file)) throw new Error(`缺少文件：${path.relative(REPO_ROOT, file)}`)
  return fs.readFileSync(file, 'utf8')
}

/* ── 提取 §28 唯一声明 ─────────────────────────────────────────────── */
function extractManifest(md) {
  const block = md.match(/<!--\s*TOKEN-MANIFEST:BEGIN\s*-->([\s\S]*?)<!--\s*TOKEN-MANIFEST:END\s*-->/)
  if (!block) throw new Error('规范中未找到 TOKEN-MANIFEST 标记块（§28.5）')
  const json = block[1].match(/```json\s*([\s\S]*?)```/)
  if (!json) throw new Error('TOKEN-MANIFEST 块中没有 ```json 代码块')
  const m = JSON.parse(json[1])
  if (!m.spec || !m.version) throw new Error('Manifest 缺少 spec / version 字段')
  return m
}

/* ── CSS 声明解析 ──────────────────────────────────────────────────── */
function declMap(cssText) {
  const map = new Map()
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g
  let m
  while ((m = re.exec(cssText))) map.set(m[1], m[2].trim())
  return map
}
function nthDecl(css, name, n) {
  const re = new RegExp(`--${name}\\s*:\\s*([^;]+);`, 'g')
  const vals = []
  let m
  while ((m = re.exec(css))) vals.push(m[1].trim())
  return vals[n] === undefined ? null : vals[n]
}
function remToPx(v) {
  if (v === null) return null
  const n = parseFloat(v)
  if (Number.isNaN(n)) return null
  // 注意：不能用 \brem\b —— 数字与 r 都是 word 字符，两者之间没有词边界。
  return /rem\b/.test(v) ? Math.round(n * 16 * 100) / 100 : n
}
function hex(v) {
  return v === null ? null : String(v).trim().toUpperCase()
}
function isDerived(v) {
  return v !== null && /var\(|color-mix|oklch|calc\(/.test(v)
}

/* ── 逐项校验 ──────────────────────────────────────────────────────── */
function checkTypography(M, specText) {
  const css = read(TYPO)
  const block = css.match(/@theme\s*\{([\s\S]*?)\n\}/)
  if (!block) { record('FAIL', '字号：@theme 块', 'typography.css 中未找到 @theme'); return }
  const decls = declMap(block[1])
  // 主档 + 配套档 + Mono 四档；Mono 的 class 与配套档重叠，按类名去重。
  const all = []
  const seen = new Set()
  for (const t of [...M.typography.mainScale, ...M.typography.companions, ...M.typography.mono]) {
    if (!seen.has(t.class)) { seen.add(t.class); all.push(t) }
  }
  let bad = 0
  for (const t of all) {
    const suffix = t.class.replace(/^text-/, '')
    const size = remToPx(decls.get(`--text-${suffix}`) || null)
    const line = remToPx(decls.get(`--text-${suffix}--line-height`) || null)
    if (size !== t.size || line !== t.line) {
      record('FAIL', `字号 ${t.class}`, `声明=${t.size}/${t.line} / 代码=${size}/${line}`)
      bad++
    }
  }
  record(bad ? 'FAIL' : 'PASS', `字号全档（${all.length} 档，含 Mono）`, bad ? `${bad} 档漂移` : '与 @theme 逐值相等')

  // 投影表抽查：§1.2 表格必须含每个主档的取值行
  const sec12 = specText.slice(specText.indexOf('## 1.2 字号 Token'), specText.indexOf('## 1.3'))
  let missing = []
  for (const t of M.typography.mainScale) {
    if (!sec12.includes(`| \`${t.class}\` | ${t.size}px | ${t.line}px |`)) missing.push(t.class)
  }
  record(missing.length ? 'FAIL' : 'PASS', '投影表 §1.2',
    missing.length ? `缺行：${missing.join(', ')}` : '11 主档取值行齐全')
}

function checkRadius(M, specText) {
  const decls = declMap(read(PRIMITIVES))
  let bad = []
  for (const r of M.radius.scale) {
    const name = r.token.replace(/^radius-/, '')
    const v = remToPx(decls.get(`--primitive-radius-${name}`) || null)
    if (v !== r.value) bad.push(`${r.token}: 声明=${r.value} 代码=${v}`)
  }
  record(bad.length ? 'FAIL' : 'PASS', `圆角档位（${M.radius.scale.length} 档）`,
    bad.length ? bad.join('; ') : '与 primitives.css 逐值相等')

  const sec5 = specText.slice(specText.indexOf('# 5. Radius'), specText.indexOf('# 6. Spacing'))
  const missing = M.radius.scale.filter(r => !sec5.includes(`| \`${r.token}\` | ${r.value}px |`))
    .map(r => r.token)
  record(missing.length ? 'FAIL' : 'PASS', '投影表 §5',
    missing.length ? `缺行：${missing.join(', ')}` : '全部档位已登记')
}

function checkBrand(M) {
  const j = JSON.parse(read(BRAND_JSON))
  const fieldMap = {
    primary: 'primary', hover: 'hover', active: 'active',
    foreground: 'primaryForeground', soft: 'soft',
    softForeground: 'softForeground', border: 'border', subtle: 'subtleSurface'
  }
  let bad = []
  for (const theme of ['light', 'dark']) {
    const src = j.themes[theme].brand
    for (const [key, srcKey] of Object.entries(fieldMap)) {
      const declared = hex(M.colors.brand[theme][key])
      const actual = hex(src[srcKey].$value)
      if (declared !== actual) bad.push(`${theme}.${key}: 声明=${declared} 代码=${actual}`)
    }
  }
  record(bad.length ? 'FAIL' : 'PASS', '品牌色（Light + Dark × 8）',
    bad.length ? bad.join('; ') : '与 brand.tokens.json 逐值相等')
}

function checkTextAndSurface(M) {
  const css = read(THEME)
  const textMap = {
    foreground: 'fg-primary', secondary: 'fg-secondary', tertiary: 'fg-tertiary',
    disabled: 'fg-disabled', inverse: 'fg-inverse', placeholder: 'fg-placeholder',
    link: 'fg-link'
  }
  const surfaceMap = {
    background: 'background', card: 'card', popover: 'popover',
    muted: 'muted', secondary: 'secondary', subtle: 'subtle'
  }
  const borderMap = { border: 'border', borderStrong: 'border-strong', inputBorder: 'input' }
  let bad = [], derived = 0
  for (const [idx, theme] of [[0, 'light'], [1, 'dark']]) {
    for (const [key, cssName] of Object.entries(textMap)) {
      const actualRaw = nthDecl(css, cssName, idx)
      if (isDerived(actualRaw)) { derived++; continue }
      if (hex(actualRaw) !== hex(M.colors.text[theme][key])) {
        bad.push(`text.${theme}.${key}: 声明=${M.colors.text[theme][key]} 代码=${actualRaw}`)
      }
    }
    for (const [key, cssName] of Object.entries(surfaceMap)) {
      const actualRaw = nthDecl(css, cssName, idx)
      if (isDerived(actualRaw)) { derived++; continue }
      if (hex(actualRaw) !== hex(M.colors.surface[theme][key])) {
        bad.push(`surface.${theme}.${key}: 声明=${M.colors.surface[theme][key]} 代码=${actualRaw}`)
      }
    }
    for (const [key, cssName] of Object.entries(borderMap)) {
      const actualRaw = nthDecl(css, cssName, idx)
      if (isDerived(actualRaw)) { derived++; continue }
      if (hex(actualRaw) !== hex(M.colors.border[theme][key])) {
        bad.push(`border.${theme}.${key}: 声明=${M.colors.border[theme][key]} 代码=${actualRaw}`)
      }
    }
  }
  record(bad.length ? 'FAIL' : 'PASS', '文字色 / 表面色 / 边框色（Light + Dark）',
    bad.length ? bad.join('; ') : `纯 HEX 值逐值相等；${derived} 个派生值（var()）跳过静态比对`)
}

const DENSITY_CSS_KEYS = {
  tableRowPaddingY: '--ds-table-row-padding-y',
  tableCellPaddingX: '--ds-table-cell-padding-x',
  controlMd: '--ds-control-height-md',
  controlSm: '--ds-control-height-sm',
  buttonMd: '--ds-button-height-md',
  buttonSm: '--ds-button-height-sm',
  buttonLg: '--ds-button-height-lg',
  navMd: '--ds-nav-height-md',
  navSm: '--ds-nav-height-sm',
  navLg: '--ds-nav-height-lg',
  formFieldGap: '--ds-form-field-gap',
  cardPadding: '--ds-card-padding',
  pageGutter: '--ds-page-gutter'
}

function checkDensity(M, specText) {
  const css = read(SPACING)
  const blocks = {}
  const re = /\[data-theme-scale='(sm|lg|xl)'\]\s*\{([\s\S]*?)\n\}/g
  let m
  while ((m = re.exec(css))) blocks[m[1]] = declMap(m[2])
  const attrFor = { compact: 'sm', default: 'lg', spacious: 'xl' }
  let bad = []
  for (const p of M.density.params) {
    const cssName = DENSITY_CSS_KEYS[p.key]
    for (const [col, attr] of Object.entries(attrFor)) {
      const v = remToPx((blocks[attr] && blocks[attr].get(cssName)) || null)
      if (v !== p[col]) bad.push(`${p.key}.${col}: 声明=${p[col]} 代码=${v}`)
    }
  }
  record(bad.length ? 'FAIL' : 'PASS', `密度参数（${M.density.params.length} 项 × 3 档）`,
    bad.length ? bad.slice(0, 6).join('; ') + (bad.length > 6 ? ` …共 ${bad.length} 项` : '') : '与 spacing.css 逐值相等')

  const sec7 = specText.slice(specText.indexOf('## 7.1 密度参数'), specText.indexOf('## 7.2'))
  const missing = M.density.params.filter(p =>
    !sec7.includes(`| ${p.label} | ${p.compact}px | ${p.default}px | ${p.spacious}px |`))
    .map(p => p.label)
  record(missing.length ? 'FAIL' : 'PASS', '投影表 §7.1',
    missing.length ? `缺行：${missing.join(', ')}` : '13 项取值行齐全')
}

/* ── 声明内部一致性（§28.1 派生索引 + §28.6 Pending） ────────────── */
function checkInternalConsistency(M, specText) {
  const bad = []
  const same = (a, b, label) => { if (a !== b) bad.push(`${label}: ${a} ≠ ${b}`) }
  same(M.meta.focusRingWidth, M.a11y.focusRing.width, 'meta.focusRingWidth ↔ a11y.focusRing.width')
  same(M.meta.focusRingOffset, M.a11y.focusRing.offset, 'meta.focusRingOffset ↔ a11y.focusRing.offset')
  same(M.meta.baseRadius, M.radius.base, 'meta.baseRadius ↔ radius.base')
  same(M.meta.minFontSize, M.typography.mainScale[0].size, 'meta.minFontSize ↔ mainScale[0].size')
  same(M.meta.touchTargetMin, M.a11y.touchTarget.minimum, 'meta.touchTargetMin ↔ a11y.touchTarget.minimum')
  same(M.meta.touchTargetRecommended, M.a11y.touchTarget.recommended, 'meta.touchTargetRecommended ↔ a11y.touchTarget.recommended')
  same(M.meta.contentMax, M.breakpoints.xl, 'meta.contentMax ↔ breakpoints.xl')
  const md = M.radius.scale.find(r => r.factor === 1)
  if (!md) bad.push('radius.scale 缺 factor=1 的基准档')
  else same(M.radius.base, md.value, 'radius.base ↔ radius.scale[factor=1]')

  const ids = new Set()
  M.sections.forEach((s, i) => {
    if (s.no !== i + 1) bad.push(`sections[${i}].no=${s.no} 应为 ${i + 1}`)
    if (!s.id || !s.spec) bad.push(`sections[${i}] 缺 id / spec`)
    if (ids.has(s.id)) bad.push(`sections[${i}].id 重复：${s.id}`)
    ids.add(s.id)
  })
  if (!Array.isArray(M.pending)) bad.push('pending 缺失')
  else M.pending.forEach((p, i) => {
    if (!p.id || !p.scope || !p.reason || !p.exitCondition) bad.push(`pending[${i}] 字段不全`)
    if (p.id && !specText.includes(`| ${p.id} |`)) bad.push(`§28.6 表格缺 ${p.id} 行`)
  })
  const keys = new Set(M.density.params.map(p => p.key))
  for (const [name, key] of Object.entries(M.spacing.semantic.landed)) {
    if (!keys.has(key)) bad.push(`spacing.semantic.landed[${name}] → 不存在的 density key ${key}`)
  }
  record(bad.length ? 'FAIL' : 'PASS', '声明内部一致性（meta ↔ a11y ↔ sections ↔ pending）',
    bad.length ? bad.join('; ') :
      `${M.sections.length} 区 / ${M.pending.length} Pending / ${Object.keys(M.spacing.semantic.landed).length} 语义别名全部自洽`)
}

/* ── 投影表扩展抽查（§6.2 / §10.2 / §11.1 / §14.2） ──────────────── */
function checkProjectionTablesExtra(M, specText) {
  const bad = []
  const has = v => specText.includes(v)
  for (const [name, key] of Object.entries(M.spacing.semantic.landed)) {
    if (!has(`| \`${name}\` | \`${key}\` |`)) bad.push(`§6.2 缺 ${name}`)
  }
  for (const s of M.components.button.sizes) {
    if (s.height !== null && !has(`| \`${s.token}\` | ${s.height}px |`)) bad.push(`§10.2 缺 ${s.token}`)
  }
  for (const s of M.components.control.sizes) {
    if (!has(`| \`${s.token}\` | ${s.height}px |`)) bad.push(`§11.1 缺 ${s.token}`)
  }
  for (const s of M.components.navigation.sizes) {
    if (!has(`| \`${s.token}\` | ${s.height}px |`)) bad.push(`§14.2 缺 ${s.token}`)
  }
  record(bad.length ? 'FAIL' : 'PASS', '投影表 §6.2 / §10.2 / §11.1 / §14.2',
    bad.length ? `缺行：${bad.join(', ')}` : '语义别名 + 按钮 / 控件 / 导航尺寸取值行齐全')
}

/* ── 收集 Manifest 中不允许出现在 showcase :root 的值 ─────────────── */
function collectForbidden(M) {
  const strs = []
  const nums = new Set()
  const walk = v => {
    if (typeof v === 'number') { nums.add(v); return }
    if (typeof v === 'string') { strs.push(v.trim()); return }
    if (Array.isArray(v)) { v.forEach(walk); return }
    if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(M)
  const generic = new Set(['#FFF', '#FFFFFF', '#000', '#000000'])
  const hex = strs.filter(s => /^#[0-9a-f]{3,8}$/i.test(s) && !generic.has(s.toUpperCase()))
  const special = strs.filter(s => /^oklch\(/i.test(s) || /^cubic-bezier\(/i.test(s))
  M.motion.duration.forEach(d => special.push(`${d.ms}ms`))
  return { hex, special, nums }
}

/* ── 声明字段 ↔ 展示覆盖度（§19.1「Token 缺少展示」） ────────────── */
const COVERAGE_PROBES = [
  ['typography', 'M.typography'], ['radius.scale', 'M.radius.scale'],
  ['colors.brand', 'M.colors.brand'], ['colors.status', 'M.colors.status'],
  ['colors.chart', 'M.colors.chart'], ['colors.syntax', 'M.colors.syntax'],
  ['colors.terminal', 'M.colors.terminal'], ['colors.gradient', 'M.colors.gradient'],
  ['density.params', 'M.density.params'], ['breakpoints', 'M.breakpoints'],
  ['components.button', 'M.components.button'], ['spacing.semantic', 'M.spacing.semantic'],
  ['pending', 'M.pending'], ['sections', 'M.sections']
]

function checkShowcase(M) {
  if (!fs.existsSync(SHOWCASE)) {
    record('FAIL', 'showcase.html', '文件不存在')
    return
  }
  const html = fs.readFileSync(SHOWCASE, 'utf8')
  const parsesManifest = html.includes('TOKEN-MANIFEST') && html.includes('extractManifest')
  record(parsesManifest ? 'PASS' : 'FAIL', 'showcase.html 解析 §28 Manifest',
    parsesManifest ? '运行时解析，非硬编码副本' : '未发现 Manifest 解析逻辑')
  // 真正扫描 :root：禁止出现 Manifest 声明过的色值 / 缓动 / 时长 / 尺寸数值。
  // 旧的 --(brand|text|surface|radius) 正则匹配不到 --m-* 前缀，会给出假阴性。
  const rootMatch = html.match(/<style>[\s\S]*?:root\s*\{([\s\S]*?)\}/)
  const rootBlock = rootMatch ? rootMatch[1] : ''
  const f = collectForbidden(M)
  const hits = []
  for (const v of f.hex) if (rootBlock.toLowerCase().includes(v.toLowerCase())) hits.push(v)
  for (const v of f.special) if (rootBlock.includes(v)) hits.push(v)
  const declRe = /--[\w-]+\s*:\s*([^;]+);/g
  let dm
  while ((dm = declRe.exec(rootBlock))) {
    const val = dm[1].trim()
    const n = parseFloat(val)
    if (!Number.isNaN(n) && /(?:rem|px)\b/.test(val)) {
      const px = /rem\b/.test(val) ? Math.round(n * 16 * 100) / 100 : n
      if (f.nums.has(px)) hits.push(val)
    }
  }
  record(hits.length ? 'FAIL' : 'PASS', 'showcase.html 无 Token 副本',
    hits.length ? `:root 含 Manifest 声明值：${[...new Set(hits)].join(', ')}`
      : '仅保留刻意偏离所有刻度的降级占位')
  record(M.sections.length === 24 ? 'PASS' : 'FAIL', '展示区域数量',
    `§28 sections = ${M.sections.length}（期望 24）`)
  const missingRenderers = M.sections.filter(s => {
    const plain = new RegExp(`\\bR\\.${s.id}\\s*=`).test(html)
    const bracketed = html.includes(`R['${s.id}']`) || html.includes(`R["${s.id}"]`)
    return !(plain || bracketed)
  }).map(s => s.id)
  record(missingRenderers.length ? 'FAIL' : 'PASS', '区域 ↔ 渲染器一一对应',
    missingRenderers.length ? `缺渲染器：${missingRenderers.join(', ')}` :
      `${M.sections.length} 个区域均有渲染器`)
  const uncovered = COVERAGE_PROBES.filter(([, expr]) => !html.includes(expr)).map(([k]) => k)
  record(uncovered.length ? 'FAIL' : 'PASS', '声明字段 ↔ 展示覆盖度',
    uncovered.length ? `未在展示页引用：${uncovered.join(', ')}` :
      `${COVERAGE_PROBES.length} 组主要字段均有展示`)
}

function checkSnapshot(M) {
  if (!fs.existsSync(SNAPSHOT)) {
    record(CHECK_ONLY ? 'FAIL' : 'SKIP', '离线快照',
      CHECK_ONLY ? 'showcase.tokens.js 不存在，请先运行同步脚本' : '本次将生成')
    return
  }
  const txt = fs.readFileSync(SNAPSHOT, 'utf8')
  const m = txt.match(/window\.__UTER_TOKEN_MANIFEST__\s*=\s*([\s\S]*?);\s*\nwindow\.__UTER_TOKEN_MANIFEST_META__/)
  if (!m) { record('FAIL', '离线快照', '无法解析快照中的 Manifest'); return }
  let snap
  try { snap = JSON.parse(m[1]) } catch (e) { record('FAIL', '离线快照', `JSON 解析失败：${e.message}`); return }
  const same = JSON.stringify(snap) === JSON.stringify(M)
  record(same ? 'PASS' : 'FAIL', '离线快照与 §28 声明一致', same ? '同值' : '快照已过期，请重新运行同步脚本')
}

function writeSnapshot(M, results) {
  const passes = results.filter(r => r.status === 'PASS').length
  const fails = results.filter(r => r.status === 'FAIL').length
  const meta = {
    source: 'UTER-DESIGN-SYSTEM-3.0.md §28 TOKEN-MANIFEST',
    spec: M.spec,
    version: M.version,
    generatedAt: new Date().toISOString(),
    verification: {
      summary: `${passes} PASS / ${fails} FAIL（写入快照前的 ${results.length} 项校验）`,
      command: 'node web/scripts/sync-design-showcase.mjs --check',
      checkedAt: new Date().toISOString(),
      note: '实时解析模式下以 --check 的实际输出为准（§18.2 第 24 区 / §28.4）'
    },
    warning: '派生产物，禁止手工编辑；改值请改 §28 后重新运行本脚本'
  }
  const out = `/* eslint-disable */\n` +
    `/* 自动生成：${path.relative(REPO_ROOT, SNAPSHOT)} —— 唯一来源是 ${meta.source}。\n` +
    ` * 禁止手工编辑。运行 node web/scripts/sync-design-showcase.mjs 重新生成。 */\n` +
    `window.__UTER_TOKEN_MANIFEST__ = ${JSON.stringify(M, null, 2)};\n` +
    `window.__UTER_TOKEN_MANIFEST_META__ = ${JSON.stringify(meta, null, 2)};\n`
  fs.writeFileSync(SNAPSHOT, out, 'utf8')
}

/* ── 主流程 ────────────────────────────────────────────────────────── */
function main() {
  let specText, M
  try {
    specText = read(SPEC)
    M = extractManifest(specText)
  } catch (e) {
    console.error(`BLOCKED: ${e.message}`)
    process.exit(2)
  }
  console.log(`TOKEN-MANIFEST: spec=${M.spec} version=${M.version} updated=${M.updated}`)
  console.log(`模式：${CHECK_ONLY ? '--check（只校验）' : '生成快照 + 校验'}\n`)

  try {
    checkTypography(M, specText)
    checkRadius(M, specText)
    checkBrand(M)
    checkTextAndSurface(M)
    checkDensity(M, specText)
    checkProjectionTablesExtra(M, specText)
    checkInternalConsistency(M, specText)
    checkShowcase(M)
  } catch (e) {
    record('FAIL', '运行真源读取', e.message)
  }

  const runtimeFails = results.filter(r => r.status === 'FAIL').length
  if (!CHECK_ONLY && runtimeFails === 0) {
    writeSnapshot(M, results)
    console.log(`已生成 ${path.relative(REPO_ROOT, SNAPSHOT)}\n`)
  } else if (!CHECK_ONLY) {
    console.log(`存在 ${runtimeFails} 项漂移，跳过快照生成（避免用过期声明覆盖离线数据）。\n`)
  }
  checkSnapshot(M)

  for (const r of results) {
    const tag = r.status === 'PASS' ? 'PASS' : r.status === 'SKIP' ? 'SKIP' : 'FAIL'
    console.log(`[${tag}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`)
  }
  const fails = results.filter(r => r.status === 'FAIL').length
  const passes = results.filter(r => r.status === 'PASS').length
  console.log(`\n汇总：${passes} PASS / ${fails} FAIL / ${results.length - passes - fails} SKIP`)
  process.exit(fails ? 1 : 0)
}

main()
