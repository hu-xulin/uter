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
 * 生成 UTER DESIGN SYSTEM 5.0 全量 Showcase（`UDS5-S23` §11）。
 *
 * 唯一真源：
 *   - 规范条目 / 组件清单：DESIGN-STANDARD-REGISTRY.yaml + COMPONENT-REGISTRY.yaml
 *     （组件 YAML 的唯一真源是 web/src/design-system/component-registry.json）
 *   - 设计值：web/src/design-system/tokens/*.css 与 web/src/styles/theme.css
 *     （本文件内的色值 / 字号是**派生的内联快照**，不是第二份真源）
 *
 * 产物：docs/design-system/uter-design-system-5.0/SHOWCASE-5.0.html
 *   单文件、零外部依赖、file:// 可直接打开、真实 DOM 渲染（0 个 <img>）。
 *
 * 用法：node scripts/generate-design-showcase-5.0.mjs
 * 校验：node scripts/check-design-showcase-5.0.mjs
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = resolve(SCRIPT_DIR, '..')
const REPO_ROOT = resolve(WEB_ROOT, '..')
const DS_DIR = join(REPO_ROOT, 'docs/design-system/uter-design-system-5.0')
const SPEC_PATH = join(DS_DIR, 'DESIGN-STANDARD-REGISTRY.yaml')
const COMPONENTS_PATH = join(DS_DIR, 'COMPONENT-REGISTRY.yaml')
const OUT_PATH = join(DS_DIR, 'SHOWCASE-5.0.html')

const specRegistry = parse(readFileSync(SPEC_PATH, 'utf8'))
const componentRegistry = parse(readFileSync(COMPONENTS_PATH, 'utf8'))
const standards = specRegistry.standards ?? []
const components = componentRegistry.components ?? []

const esc = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const relDoc = (p) => (p ? `./${String(p).split('/').pop()}` : '#')
const swatch = (label, value, text = '') =>
  `<div class="swatch"><span class="swatch-chip" style="background:${value}"></span><code>${esc(label)}</code><span class="swatch-val">${esc(text || value)}</span></div>`

// ---------------------------------------------------------------------------
// 运行时 Token 全量解析（零遗漏：web/src/**/*.css 中每一个 --变量 声明）
// 只读解析：剥离注释 → 花括号配对定位选择器作用域 → 逐条收集 `--name: value;`
// 本页展示的是「实现现状快照」，不是第二份规范真源；唯一规范值见顶部基线表。
// ---------------------------------------------------------------------------
const walkCss = (dir, out = []) => {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name)
    if (ent.isDirectory()) walkCss(p, out)
    else if (ent.isFile() && ent.name.endsWith('.css')) out.push(p)
  }
  return out
}
const TOKEN_FILES = walkCss(join(REPO_ROOT, 'web/src')).sort()
const DECL_RE = /^\s*(--[a-zA-Z0-9_-]+)\s*:\s*([\s\S]+?)\s*$/
const occurrences = new Map()
for (const abs of TOKEN_FILES) {
  const rel = abs.slice(REPO_ROOT.length + 1)
  const text = readFileSync(abs, 'utf8').replaceAll(/\/\*[\s\S]*?\*\//g, '')
  let buf = ''
  const stack = []
  const pushDecl = () => {
    const m = buf.match(DECL_RE)
    if (m) {
      const name = m[1]
      const value = m[2].trim().replaceAll(/\s+/g, ' ')
      if (!occurrences.has(name)) occurrences.set(name, [])
      occurrences.get(name).push({ value, file: rel, scope: stack.join(' > ') })
    }
    buf = ''
  }
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '{') { stack.push(buf.trim()); buf = ''; continue }
    if (ch === '}') { stack.pop(); buf = ''; continue }
    if (ch === ';') { pushDecl(); continue }
    buf += ch
  }
}

const isDarkScope = (s) => /\.dark\b/.test(s)
const scopeTag = (s) => {
  if (s === ':root') return 'LIGHT'
  if (isDarkScope(s)) return 'DARK'
  if (s.startsWith('@theme')) return 'THEME'
  if (/data-theme-preset/.test(s)) return 'PRESET'
  if (/data-theme-radius/.test(s)) return 'RADIUS'
  return 'OTHER'
}
const allTokens = [...occurrences.entries()]
  .map(([name, occ]) => {
    const light = occ.find((o) => o.scope === ':root') ?? occ.find((o) => !isDarkScope(o.scope)) ?? occ[0]
    const dark = occ.find((o) => isDarkScope(o.scope))
    const seen = new Set()
    const values = occ.filter((o) => {
      const key = `${o.value}|${o.scope}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return {
      name,
      light: light.value,
      dark: dark?.value ?? null,
      values,
      count: occ.length,
      files: new Set(occ.map((o) => o.file)).size,
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name))
const declCount = [...occurrences.values()].reduce((n, list) => n + list.length, 0)
const scopeCount = new Set([...occurrences.values()].flat().map((o) => o.scope)).size

// 仓库 CSS 引用了 Tailwind v4 内置色板（--color-*）等外部变量；从已安装的
// tailwindcss/theme.css 读取官方默认值作为「仅用于解析预览」的兜底，不把它们
// 混进 Uter 自己的 Token 清单，也不写回任何运行时代码。
const FALLBACK_PATH = join(REPO_ROOT, 'web/node_modules/tailwindcss/theme.css')
const fallbackMap = new Map()
if (existsSync(FALLBACK_PATH)) {
  const css = readFileSync(FALLBACK_PATH, 'utf8').replaceAll(/\/\*[\s\S]*?\*\//g, '')
  for (const m of css.matchAll(/(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g))
    {fallbackMap.set(m[1], m[2].trim().replaceAll(/\s+/g, ' '))}
}
const missingRefs = new Set()
for (const list of occurrences.values())
  {for (const o of list)
    {for (const m of o.value.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g))
      {if (!occurrences.has(m[1])) missingRefs.add(m[1])}}}
const externalColors = [...missingRefs]
  .filter((n) => fallbackMap.has(n))
  .sort()
  .map((n) => ({ name: n, value: fallbackMap.get(n) }))
const lightMap = new Map(allTokens.map((t) => [t.name, t.light]))
const darkMap = new Map(allTokens.map((t) => [t.name, t.dark ?? t.light]))
for (const [name, value] of fallbackMap) {
  if (!lightMap.has(name)) lightMap.set(name, value)
  if (!darkMap.has(name)) darkMap.set(name, value)
}
const VAR_RE = /var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,\s*([^()]*))?\)/g
const resolveValue = (value, map, depth = 0) => {
  if (depth > 6 || !value.includes('var(')) return value
  return value.replace(VAR_RE, (whole, name, fallback) => {
    const next = map.get(name)
    if (next !== undefined) return resolveValue(next, map, depth + 1)
    return fallback ? fallback.trim() : whole
  })
}
const BG_START = /^(?:#|rgba?\(|hsla?\(|oklch\(|oklab\(|color-mix\(|linear-gradient\(|radial-gradient\(|transparent\b|currentcolor\b|white\b|black\b)/i
const SHADOW_START = /^(?:inset\s+)?[-\d.]+\s/i
const chipStyle = (raw, map) => {
  const v = resolveValue(raw, map).trim()
  if (BG_START.test(v)) return `background:${esc(v)}`
  if (SHADOW_START.test(v) && /(rgba?\(|hsla?\(|oklch\(|#[0-9a-f]{3,8})/i.test(v))
    {return `box-shadow:${esc(v)}`}
  return ''
}
const isColorToken = (t) =>
  t.values.some((o) => chipStyle(o.value, isDarkScope(o.scope) ? darkMap : lightMap) !== '')
const colorTokens = allTokens.filter(isColorToken)
const otherTokens = allTokens.filter((t) => !isColorToken(t))
const textSteps = allTokens.filter(
  (t) => t.name.startsWith('--text-') && !t.name.includes('--line-height')
)
const weightTokens = allTokens.filter((t) => t.name.startsWith('--font-weight-'))
const fontFamilies = allTokens.filter(
  (t) => t.name.startsWith('--font-') && !t.name.startsWith('--font-weight-')
)
const clip = (s, n) => (s.length > n ? `${s.slice(0, n)}…` : s)

// 每个变量：所有取值逐一列出，颜色类取值逐一给出真实色块 / 阴影预览。
const tokenItem = (t) => {
  const chips = t.values
    .map((o) => {
      const map = isDarkScope(o.scope) ? darkMap : lightMap
      const style = chipStyle(o.value, map)
      if (!style) return ''
      const resolved = resolveValue(o.value, map).trim()
      return `<span class="token-chip" style="${style}" title="${esc(`${scopeTag(o.scope)} · ${resolved} · ${o.file}`)}" aria-label="${esc(`${t.name} ${scopeTag(o.scope)} 预览 ${clip(resolved, 60)}`)}"></span>`
    })
    .filter(Boolean)
    .join('')
  const rows = t.values
    .map(
      (o) => `<div class="tv-row" data-token-value="${esc(t.name)}"><span class="tv-tag tv-${scopeTag(o.scope).toLowerCase()}">${scopeTag(o.scope)}</span><code>${esc(o.value)}</code><span class="tv-src">${esc(o.file.split('/').pop())} · ${esc(clip(o.scope.replaceAll(/\s+/g, ' '), 72))}</span></div>`
    )
    .join('')
  return `<article class="token-item" data-token-name="${esc(t.name)}" data-token-kind="${isColorToken(t) ? 'color' : 'other'}" aria-label="运行时变量 ${esc(t.name)}">
      <header class="token-head"><code>${esc(t.name)}</code><span class="token-meta">${t.count} 处 / ${t.files} 文件 / ${t.values.length} 值</span></header>
      <div class="token-chips">${chips || '<span class="token-chip token-chip-empty" aria-hidden="true"></span>'}</div>
      <div class="token-values">${rows}</div>
    </article>`
}

const fullColorBody = `<div class="token-legend">只读扫描 <strong>${TOKEN_FILES.length}</strong> 份 CSS，得到 <strong>${declCount}</strong> 条声明 / <strong>${allTokens.length}</strong> 个唯一变量 / <strong>${scopeCount}</strong> 类选择器作用域。下方<strong>逐项列出全部 ${allTokens.length} 个变量及其每一个取值</strong>；其中 <strong>${colorTokens.length}</strong> 个颜色 / 阴影 / 渐变类变量按取值逐一渲染真实预览，<code>oklch()</code> / <code>color-mix()</code> 由浏览器按当前色域计算，不宣称与任何 hex 等值。</div>
    <h3 class="token-sub">一 · 颜色 / 阴影 / 渐变变量（${colorTokens.length} 个 · ${colorTokens.reduce((n, t) => n + t.values.length, 0)} 个取值）</h3>
    <div class="token-grid">${colorTokens.map(tokenItem).join('')}</div>
    <h3 class="token-sub">二 · 其它变量（${otherTokens.length} 个 · 字号 / 行高 / 字体族 / 字重 / 间距 / 圆角 / 动效 / 层级 / 控件尺寸）</h3>
    <div class="token-grid">${otherTokens.map(tokenItem).join('')}</div>
    <h3 class="token-sub">三 · 外部依赖色值：Tailwind v4 内置色板（${externalColors.length} 个 · 非 Uter 规范 Token）</h3>
    <div class="token-grid">${externalColors
      .map(
        (x) => `<article class="token-item" data-external-color="${esc(x.name)}" aria-label="外部依赖色值 ${esc(x.name)}"><header class="token-head"><code>${esc(x.name)}</code><span class="token-meta">tailwindcss/theme.css</span></header><div class="token-chips"><span class="token-chip" style="background:${esc(x.value)}"></span></div><div class="token-values"><div class="tv-row"><span class="tv-tag tv-other">EXTERNAL</span><code>${esc(x.value)}</code><span class="tv-src">tailwindcss/theme.css</span></div></div></article>`
      )
      .join('')}</div>
    <p class="note">这是 <code>web/src</code> 的<strong>实现现状快照</strong>（含 <code>tokens/generated/brand.css</code> 的旧 Uter 靛紫与 11 组主题预设覆盖）；仓库 CSS 还引用了 <strong>${missingRefs.size}</strong> 个未在仓库内声明的变量，其中 ${externalColors.length} 个是 Tailwind v4 内置色板（取自已安装的 <code>tailwindcss/theme.css</code>，仅用于解析色块预览，不是 Uter Token），其余为运行时计算值。5.0 的<strong>唯一规范值</strong>只在上文「唯一规范值基线表」；规范与实现的差异统一登记为「待迁移」，本轮不修改任何运行时代码。</p>`

const typeRow = (t) => {
  const lhOcc = occurrences.get(`${t.name}--line-height`) ?? []
  return t.values
    .map((o) => {
      const map = isDarkScope(o.scope) ? darkMap : lightMap
      const lh = (lhOcc.find((x) => x.scope === o.scope) ?? lhOcc[0])?.value ?? 'normal'
      const size = resolveValue(o.value, map).trim()
      const line = resolveValue(lh, map).trim()
      const tag = scopeTag(o.scope)
      return `<div class="type-row" data-type-step="${esc(t.name)}" data-type-scope="${tag.toLowerCase()}">
        <code>${esc(t.name)}</code>
        <span class="type-sample" style="font-size:${esc(size)};line-height:${esc(line)}">${esc(size)} / ${esc(line)} · Uter 优特智能 0123</span>
        <span class="tv-tag tv-${tag.toLowerCase()}">${tag}</span>
      </div>`
    })
    .join('')
}
const fullTypographyBody = `<div class="token-legend"><code>@theme --text-*</code> 全量 <strong>${textSteps.length}</strong> 档，<strong>每一档的每一个取值</strong>都用运行时真实字号 / 行高渲染（含 <code>simple-large</code> 放大档）；另列全部字重、字体族与密度档。</div>
    <div class="type-stack">${textSteps.map(typeRow).join('')}</div>
    <h3 class="token-sub">字重（${weightTokens.length} 档 · G1 上游 400 / 500 / 600 / 700）</h3>
    <div class="demo-row">${weightTokens
      .map((t) => {
        const w = resolveValue(t.light, lightMap).trim()
        return `<span class="weight-demo" data-font-weight="${esc(w)}" style="font-weight:${esc(w)}">${esc(t.name.replace('--font-weight-', ''))} · ${esc(w)} · 优特智能 Uter</span>`
      })
      .join('')}</div>
    <h3 class="token-sub">字体族（${fontFamilies.length} 个变量 · 真实 font-family 渲染）</h3>
    <div class="type-stack">${fontFamilies
      .map((t) => {
        const f = resolveValue(t.light, lightMap).trim()
        return `<div class="type-row" data-font-token="${esc(t.name)}"><code>${esc(t.name)}</code><span class="type-sample" style="font-family:${esc(f)}">优特智能 Uter · 0123456789 · API Key</span><span class="tv-tag tv-theme">LIVE</span></div>`
      })
      .join('')}</div>
    <h3 class="token-sub">G1 上游基准与 G2 密度档</h3>
    <div class="type-stack">
      <div class="type-row" data-font-baseline="g1-fontSize"><code>fontSize</code><span class="type-sample" style="font-size:0.8125rem">0.8125rem (13px) · clerk.com 上游 G1 唯一规范基准</span><span class="tv-tag tv-light">G1</span></div>
      <div class="type-row" data-font-baseline="g1-fontFamily"><code>fontFamily</code><span class="type-sample" style="font-family:inherit">inherit · clerk.com 上游 G1</span><span class="tv-tag tv-light">G1</span></div>
      <div class="type-row" data-font-baseline="g1-fontFamilyButtons"><code>fontFamilyButtons</code><span class="type-sample" style="font-family:inherit">inherit · clerk.com 上游 G1</span><span class="tv-tag tv-light">G1</span></div>
      <div class="type-row" data-font-baseline="g2-min"><code>最小字号</code><span class="type-sample" style="font-size:12px">12px · 全站可见文本下限（T16，G2）</span><span class="tv-tag tv-preset">G2</span></div>
    </div>
    <div class="demo-row" style="margin-top:12px">${['compact', 'default', 'comfortable']
      .map((d) => `<span class="chip" data-density-step="${d}">${d}</span>`)
      .join('')}</div>
    <p class="note">基准字号 <code>0.8125rem</code>(13px) 是 <code>G1</code> 唯一规范值；<code>--text-*</code> ${textSteps.length} 档刻度与最小 12px 属 <code>G2</code>，是<strong>刻度</strong>而非第二个正文基准。<code>@theme --text-*</code> 是 Tailwind v4.3.3 自定义字号注册机制，保留不得删除。</p>`

// ---------------------------------------------------------------------------
// 唯一规范值基线表（UDS5-S01 §4.2 · 2026-11-15 上游对齐裁决）
// G1 = clerk.com 官方已公布值；G2 = 上游未公布 → 取运行时实现现状为唯一值。
// ---------------------------------------------------------------------------
const NORMATIVE_G1 = [
  ['品牌主色 colorPrimary', '#6c47ff', 'clerk.com appearance.variables 官方示例值'],
  ['基准字号 fontSize', '0.8125rem (13px)', 'clerk.com 官方默认值'],
  ['圆角 borderRadius', '0.375rem (6px)', 'clerk.com 官方默认值'],
  ['间距 spacing', '1rem (16px)', 'clerk.com 官方默认值'],
  ['字重 fontWeight', '400 / 500 / 600 / 700', 'clerk.com 官方默认值'],
  ['字体族 fontFamily', 'inherit', 'clerk.com 官方默认值'],
  ['按钮字体 fontFamilyButtons', 'inherit', 'clerk.com 官方默认值'],
  ['等宽字体 fontFamilyMono', '系统 mono 栈', 'clerk.com 官方默认值'],
  ['变量结构', '扁平单层 24 键 --clerk-*', 'clerk.com variables 文档'],
  ['主题切换', 'color-scheme / .dark / [data-theme] / prefers-color-scheme', 'clerk.com 官方'],
  ['预置主题', 'default / simple / shadcn / dark / shadesOfPurple / neobrutalism', 'clerk.com 官方'],
  ['色阶派生', 'color-mix() + 相对颜色语法', 'clerk.com 官方'],
  ['定制分层', 'Themes → variables → BYO CSS → Build your own UI', 'clerk.com 官方'],
  ['时效性事实', 'Elements 已弃用（Core 3）；localization 为 Experimental', 'clerk.com 官方'],
]
const NORMATIVE_G2 = [
  ['Light Hover', '#4F52D1', '上游未公布 → 运行时 DTCG 唯一值'],
  ['Light Active', '#4A4DC5', '上游未公布 → 运行时 DTCG 唯一值'],
  ['Dark Primary', '#A1A3F7', '上游未公布 → 运行时 DTCG 唯一值'],
  ['Dark Hover', '#B1B3FF', '上游未公布 → 运行时 DTCG 唯一值'],
  ['Dark Active', '#9294F7', '上游未公布 → 运行时 DTCG 唯一值'],
  ['字号刻度', `${textSteps.length} 档 @theme --text-*`, '上游未公布完整刻度 → 运行时刻度'],
  ['最小可见字号', '12px', 'T16 强制'],
  ['间距刻度', '4pt 网格 4/8/12/16/24/32/40/48', 'tokens/spacing.css'],
  ['圆角刻度', '6/8/10/12/14/16/18/20 px + full', 'styles/theme.css'],
  ['边框 / 焦点环', '1px / 2px ring-2', 'tokens/semantic.css'],
  ['状态色 / 图表色', `${colorTokens.length} 个颜色类变量`, '上游未公布完整色阶'],
  ['组件 / 元素 / 模板 / 断点', `${components.length} 组件 / ${20} 元素 / 12 模板 / 5 断点`, 'Clerk 官方未提供'],
  ['无障碍目标', 'WCAG 2.2 AA 4.5:1 / 3:1', 'Clerk 官方未提供数值表'],
]
const normativeSection = `<section class="normative" id="normative" data-normative-brand="#6c47ff" aria-label="唯一规范值基线表">
      <h2 class="section-title">零 · 唯一规范值基线表 · 上游 clerk.com 对齐（2026-11-15 裁决）</h2>
      <p class="note">全 5.0 任一设计属性<strong>只有一个规范值</strong>：<code>G1</code> 取 clerk.com 官方已公布值，<code>G2</code>（上游未公布）取运行时实现现状。所有历史建议值 / 蓝图值 / 3.0 值已合并删除，唯一入口为 <code>01-UTER-DESIGN-SYSTEM-5.0.md</code> §4.2。本轮只改规范文本、不改 <code>web/src</code>；运行时代码与 G1 的差异登记为「待迁移」。</p>
      <h3 class="token-sub">G1 · clerk.com 上游已公布（${NORMATIVE_G1.length} 项）</h3>
      <div class="normative-grid">${NORMATIVE_G1.map(
        ([k, v, src]) => `<div class="norm-card" data-normative-key="${esc(k)}"><code>${esc(k)}</code><strong>${esc(v)}</strong><span>${esc(src)}</span></div>`
      ).join('')}</div>
      <h3 class="token-sub">G2 · 上游未公布 → 唯一规范值（${NORMATIVE_G2.length} 项）</h3>
      <div class="normative-grid">${NORMATIVE_G2.map(
        ([k, v, src]) => `<div class="norm-card" data-normative-key="${esc(k)}"><code>${esc(k)}</code><strong>${esc(v)}</strong><span>${esc(src)}</span></div>`
      ).join('')}</div>
      <div class="demo-row" style="margin-top:14px">
        ${swatch('G1 colorPrimary', '#6c47ff')}
        ${swatch('G2 Light Hover', '#4F52D1')}
        ${swatch('G2 Dark Primary', '#A1A3F7')}
      </div>
    </section>`

// ---------------------------------------------------------------------------
// 65 个组件逐一真实视觉样本（专门样本优先，未命中者按分类给默认样本）
// ---------------------------------------------------------------------------
const SAMPLE_OVERRIDES = {
  Button: '<button type="button" class="btn btn-primary">创建 API Key</button><button type="button" class="btn btn-ghost">取消</button>',
  ButtonGroup: '<span class="btn-group"><button type="button" class="btn btn-primary">日</button><button type="button" class="btn btn-ghost">周</button><button type="button" class="btn btn-ghost">月</button></span>',
  Input: '<input type="text" placeholder="name@example.com" aria-label="Input 样本" />',
  Textarea: '<textarea rows="2" placeholder="请输入描述" aria-label="Textarea 样本"></textarea>',
  SecretInput: '<input type="password" value="sk-uter-********" aria-label="SecretInput 样本" /><button type="button" class="btn btn-ghost">显示</button>',
  SecretTextarea: '<textarea rows="2" aria-label="SecretTextarea 样本">-----BEGIN KEY-----</textarea>',
  SecretFileInput: '<label class="sample-label">上传密钥文件<input type="file" aria-label="SecretFileInput 样本" /></label>',
  InputOtp: '<input class="otp" inputmode="numeric" maxlength="6" value="123456" aria-label="InputOtp 样本" />',
  InputGroup: '<span class="input-group"><span>https://</span><input value="api.uter.ai" aria-label="InputGroup 样本" /></span>',
  Checkbox: '<label class="sample-check"><input type="checkbox" checked aria-label="Checkbox 样本" /> 启用模型降级</label>',
  Switch: '<label class="sample-check"><input type="checkbox" role="switch" checked aria-label="Switch 样本" /> 自动重试</label>',
  RadioGroup: '<label class="sample-check"><input type="radio" name="sg-radio" checked /> 按量计费</label><label class="sample-check"><input type="radio" name="sg-radio" /> 包月</label>',
  Toggle: '<button type="button" class="btn btn-primary" aria-pressed="true">已固定</button>',
  ToggleGroup: '<span class="btn-group"><button type="button" class="btn btn-primary">左</button><button type="button" class="btn btn-ghost">中</button><button type="button" class="btn btn-ghost">右</button></span>',
  Slider: '<input type="range" min="0" max="100" value="64" aria-label="Slider 样本" />',
  NativeSelect: '<select aria-label="NativeSelect 样本"><option>默认渠道</option><option>备用渠道</option></select>',
  Select: '<select aria-label="Select 样本"><option>gpt-4o</option><option>claude-3.5</option></select>',
  Combobox: '<input list="sg-models" placeholder="搜索模型…" aria-label="Combobox 样本" /><datalist id="sg-models"><option value="gpt-4o"></option><option value="claude-3.5"></option></datalist>',
  ComboboxInput: '<input placeholder="输入以搜索…" aria-label="ComboboxInput 样本" />',
  Calendar: '<div class="mini-cal"><span>一 二 三 四 五 六 日</span><span>1 2 <b>3</b> 4 5 6 7</span><span>8 9 10 11 12 13 14</span></div>',
  Badge: '<span class="badge badge-ok">运行正常</span><span class="badge badge-warn">余额不足</span><span class="badge badge-bad">请求失败</span>',
  DiscountBadge: '<span class="badge badge-warn">-20%</span>',
  IconBadge: '<span class="icon-badge" aria-label="IconBadge 样本">✦</span>',
  Avatar: '<span class="avatar" aria-label="Avatar 样本">U</span><span class="avatar avatar-alt">AI</span>',
  Kbd: '<kbd class="kbd">⌘ K</kbd><kbd class="kbd">Esc</kbd>',
  Table: '<table class="demo-table"><thead><tr><th>模型</th><th class="num">用量</th></tr></thead><tbody><tr><td>gpt-4o</td><td class="num">1,280,000</td></tr><tr><td>claude-3.5</td><td class="num">860,240</td></tr></tbody></table>',
  Chart: '<div class="mini-chart" aria-label="Chart 样本"><i style="height:38%"></i><i style="height:62%"></i><i style="height:48%"></i><i style="height:84%"></i><i style="height:70%"></i><i style="height:96%"></i></div>',
  Alert: '<div class="notif notif-alert" role="alert">校验失败 · 请检查 API Key</div>',
  AlertDialog: '<div class="mini-dialog"><strong>确认删除？</strong><span>此操作不可撤销</span><span class="btn-group"><button type="button" class="btn btn-primary">确认</button><button type="button" class="btn btn-ghost">取消</button></span></div>',
  Dialog: '<div class="mini-dialog"><strong>创建 API Key</strong><input placeholder="名称" aria-label="Dialog 输入样本" /><button type="button" class="btn btn-primary">保存</button></div>',
  Drawer: '<div class="mini-drawer"><strong>筛选</strong><span>渠道 / 模型 / 状态</span></div>',
  Sheet: '<div class="mini-drawer"><strong>详情面板</strong><span>右侧滑出内容</span></div>',
  Popover: '<div class="mini-pop"><strong>Token 用量</strong><span>本月 12,845,920</span></div>',
  HoverCard: '<div class="mini-pop"><strong>渠道在线</strong><span>成功率 99.8%</span></div>',
  Tooltip: '<span class="mini-tip">▾ 悬停提示：余额充足</span>',
  DropdownMenu: '<div class="mini-menu"><span>编辑</span><span>复制</span><span>删除</span></div>',
  ContextMenu: '<div class="mini-menu"><span>查看</span><span>重命名</span><span>移除</span></div>',
  Progress: '<progress value="64" max="100" aria-label="Progress 样本"></progress><span class="sample-cap">64%</span>',
  Spinner: '<span class="spinner" aria-label="Spinner 样本"></span><span class="sample-cap">加载中…</span>',
  Skeleton: '<span class="skeleton" aria-label="Skeleton 样本"></span>',
  Empty: '<div class="mini-empty">暂无数据 · 创建第一个 API Key</div>',
  Sonner: '<div class="notif notif-toast" role="status">已保存 · 操作成功</div>',
  Accordion: '<details class="mini-acc" open><summary>什么是 Token 中转？</summary><span>面向开发者与企业的模型 API 基础设施。</span></details>',
  Collapsible: '<details class="mini-acc"><summary>展开高级选项</summary><span>超时 / 重试 / 回退策略</span></details>',
  Card: '<div class="mini-card"><strong>今日 Token 消耗</strong><b>12,845,920</b><span>+12.8% 较昨日</span></div>',
  TitledCard: '<div class="mini-card"><strong>渠道健康度</strong><span>在线 18 / 20 · 降级 2</span></div>',
  Separator: '<hr class="sep" />',
  AspectRatio: '<span class="mini-ratio" aria-label="AspectRatio 样本">16 : 9</span>',
  ScrollArea: '<div class="mini-scroll" tabindex="0">滚动区域<br />第二行<br />第三行<br />第四行</div>',
  Resizable: '<div class="mini-resize"><span>左面板</span><span>⋮</span><span>右面板</span></div>',
  Item: '<div class="mini-item"><span class="avatar">U</span><span>uter-workspace</span><span class="badge badge-ok">ACTIVE</span></div>',
  Tabs: '<div class="mini-tabs"><span class="on">概览</span><span>用量</span><span>日志</span></div>',
  Breadcrumb: '<nav class="mini-crumb">控制台 / 模型 / 渠道详情</nav>',
  Pagination: '<div class="mini-tabs"><span>‹</span><span class="on">1</span><span>2</span><span>3</span><span>›</span></div>',
  NavigationMenu: '<nav class="mini-tabs"><span class="on">产品</span><span>定价</span><span>文档</span></nav>',
  Menubar: '<div class="mini-tabs"><span>文件</span><span>编辑</span><span>视图</span></div>',
  Sidebar: '<div class="mini-side"><span>▣ 仪表盘</span><span>▤ 模型</span><span>◇ 渠道</span></div>',
  Command: '<div class="mini-menu"><span>⌘ 搜索命令…</span><span>创建 API Key</span><span>查看余额</span></div>',
  Carousel: '<div class="mini-carousel"><span>‹</span><span>幻灯片 1 / 3</span><span>›</span></div>',
  Field: '<label class="sample-label">模型名称<input value="gpt-4o" aria-label="Field 样本" /></label><span class="field-error">字段级错误就近展示</span>',
  Form: '<form class="form-demo" onsubmit="return false"><label>邮箱</label><input type="email" placeholder="name@example.com" aria-label="Form 样本" /><button type="submit" class="btn btn-primary">提交</button></form>',
  Label: '<label class="sample-label">API Key 名称</label>',
  FormLabelTier: '<label class="sample-label">一级字段标签 <span aria-hidden="true">*</span></label>',
  Markdown: '<div class="mini-md"><strong>标题</strong><p>正文段落与 <code>行内代码</code> 示例。</p></div>',
  Direction: '<span class="chip" dir="ltr">ltr →</span><span class="chip" dir="rtl">← rtl</span>',
}
const SAMPLE_BY_CATEGORY = {
  action: '<button type="button" class="btn btn-primary">主操作</button><button type="button" class="btn btn-ghost">次操作</button>',
  input: '<input type="text" placeholder="输入…" aria-label="分类输入样本" />',
  overlay: '<div class="mini-pop"><strong>浮层</strong><span>内容区域</span></div>',
  feedback: '<div class="notif notif-toast" role="status">状态反馈</div>',
  layout: '<div class="mini-card"><strong>容器</strong><span>表面 + 1px 边框</span></div>',
  'data-display': '<table class="demo-table"><thead><tr><th>列 A</th><th>列 B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>',
  navigation: '<div class="mini-tabs"><span class="on">项一</span><span>项二</span><span>项三</span></div>',
  disclosure: '<details class="mini-acc" open><summary>展开项</summary><span>内容</span></details>',
  form: '<label class="sample-label">字段<input placeholder="值" aria-label="分类表单样本" /></label>',
  utility: '<span class="chip">工具类</span>',
  content: '<p class="sample-cap">富文本内容示例</p>',
}
const componentSample = (c) => {
  const markup = SAMPLE_OVERRIDES[c.name] ?? SAMPLE_BY_CATEGORY[c.category] ?? '<span class="sample-cap">视觉样本</span>'
  return `<div class="cmp-sample" data-component-sample="${esc(c.id)}" aria-label="组件 ${esc(c.name)} 真实视觉样本">${markup}</div>`
}
const sampleOverrideCount = components.filter((c) => SAMPLE_OVERRIDES[c.name] !== undefined).length

const extraCss = `
/* 全量 Token / 字体 / 组件样本样式（由生成器内联，零外部资源） */
.element-banner { background: var(--brand-soft); border: 1px solid var(--brand); border-radius: 8px; padding: 12px 14px; margin: 0 0 18px; font-size: var(--fs-caption); line-height: 1.8; color: var(--fg); }
.token-legend { font-size: var(--fs-caption); color: var(--fg-muted); margin: 0 0 12px; line-height: 1.8; }
.token-sub { font-size: var(--fs-body); font-weight: 600; color: var(--fg); margin: 24px 0 10px; }
.token-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 10px; }
.token-item { border: 1px solid var(--border); border-radius: 8px; padding: 9px 10px; background: var(--surface); min-width: 0; }
.token-head { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; justify-content: space-between; }
.token-head code { font-size: 11px; word-break: break-all; background: none; padding: 0; color: var(--fg); font-weight: 600; }
.token-meta { font-size: 10px; color: var(--fg-muted); white-space: nowrap; }
.token-chips { display: flex; flex-wrap: wrap; gap: 4px; margin: 8px 0; }
.token-chip { width: 20px; height: 20px; border-radius: 4px; border: 1px solid var(--border); display: inline-block; flex: none; background-color: var(--surface-2); }
.token-chip-empty { background: repeating-linear-gradient(45deg, var(--surface-2), var(--surface-2) 4px, var(--surface) 4px, var(--surface) 8px); }
.token-values { display: grid; gap: 2px; }
.tv-row { display: grid; grid-template-columns: 54px minmax(0, 1fr); gap: 2px 6px; align-items: baseline; }
.tv-row code { font-size: 10px; background: none; padding: 0; word-break: break-all; color: var(--fg); }
.tv-src { grid-column: 2; font-size: 10px; color: var(--fg-muted); word-break: break-all; }
.tv-tag { font-size: 9px; font-weight: 600; border-radius: 3px; padding: 1px 4px; text-align: center; background: var(--surface-2); color: var(--fg-muted); }
.tv-light { background: var(--brand-soft); color: var(--brand-deep); }
.tv-dark { background: var(--fg); color: var(--surface); }
.tv-theme { background: var(--success-soft); color: var(--success); }
.tv-preset { background: var(--warning-soft); color: var(--warning); }
.tv-radius { background: var(--info); color: #fff; }
.type-stack { display: flex; flex-direction: column; gap: 6px; }
.type-row { grid-template-columns: 150px minmax(0, 1fr) 64px; align-items: center; gap: 10px; }
.type-sample { min-width: 0; overflow-wrap: anywhere; }
.weight-demo { border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; font-size: var(--fs-body); }
.normative { border: 1px solid var(--brand); border-radius: var(--radius); padding: var(--pad); margin: 20px 0 8px; background: var(--surface); }
.normative h2.section-title { margin-top: 0; }
.normative-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 8px; }
.norm-card { border: 1px solid var(--border); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 4px; }
.norm-card code { background: none; padding: 0; font-size: 11px; color: var(--fg-muted); }
.norm-card strong { font-size: var(--fs-body); color: var(--brand-deep); word-break: break-word; }
.norm-card span { font-size: 11px; color: var(--fg-muted); }
.btn-ghost { background: var(--surface-2); color: var(--fg); border-color: var(--border); }
.btn-group { display: inline-flex; gap: 4px; }
.cmp-sample { margin-top: 10px; padding: 10px; border: 1px dashed var(--border); border-radius: 8px; background: var(--surface-2); min-height: 52px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: var(--fs-caption); }
.cmp-sample input, .cmp-sample select, .cmp-sample textarea { max-width: 210px; font-size: var(--fs-caption); padding: 4px 8px; }
.cmp-sample .demo-table { font-size: 11px; }
.cmp-sample .otp { letter-spacing: .35em; width: 110px; }
.sample-label { display: inline-flex; flex-direction: column; gap: 4px; font-size: 11px; }
.sample-check { display: inline-flex; gap: 6px; align-items: center; font-size: 11px; }
.sample-cap { font-size: 11px; color: var(--fg-muted); }
.badge-bad { background: #fee2e2; color: #b91c1c; }
.icon-badge, .avatar { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 999px; background: var(--brand-soft); color: var(--brand-deep); font-size: 12px; font-weight: 600; }
.avatar-alt { background: var(--success-soft); color: var(--success); }
.kbd { border: 1px solid var(--border); border-bottom-width: 2px; border-radius: 5px; padding: 2px 6px; font: 400 11px ui-monospace, monospace; background: var(--surface); }
.mini-chart { display: inline-flex; align-items: flex-end; gap: 4px; height: 54px; }
.mini-chart i { display: block; width: 14px; background: var(--brand); border-radius: 3px 3px 0 0; }
.mini-dialog, .mini-pop, .mini-drawer, .mini-menu, .mini-card, .mini-acc, .mini-empty, .mini-md { border: 1px solid var(--border); border-radius: 8px; padding: 10px; background: var(--surface); display: flex; flex-direction: column; gap: 6px; font-size: 11px; min-width: 150px; }
.mini-dialog strong, .mini-pop strong, .mini-card strong { color: var(--fg); }
.mini-drawer { border-left: 3px solid var(--brand); }
.mini-menu span, .mini-tabs span, .mini-side span { padding: 3px 8px; border-radius: 5px; }
.mini-menu span:first-child, .mini-tabs .on { background: var(--brand-soft); color: var(--brand-deep); }
.mini-tip { background: var(--fg); color: var(--surface); border-radius: 5px; padding: 5px 9px; font-size: 11px; }
.mini-card b { font-size: var(--fs-h3); font-variant-numeric: tabular-nums; }
.spinner { width: 18px; height: 18px; border: 2px solid var(--border); border-top-color: var(--brand); border-radius: 999px; animation: spin 800ms linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }
.skeleton { display: inline-block; width: 130px; height: 14px; border-radius: 4px; background: linear-gradient(90deg, var(--surface-2), var(--border), var(--surface-2)); }
.sep { width: 100%; border: 0; border-top: 1px solid var(--border); }
.mini-ratio { border: 1px solid var(--border); border-radius: 6px; padding: 16px 26px; }
.mini-scroll { max-height: 56px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px; padding: 6px; font-size: 11px; }
.mini-resize { display: inline-flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
.mini-resize span { padding: 8px 12px; border-right: 1px solid var(--border); }
.mini-item { display: inline-flex; gap: 8px; align-items: center; border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; font-size: 11px; }
.mini-tabs, .mini-side, .mini-crumb, .mini-carousel { display: inline-flex; gap: 4px; align-items: center; font-size: 11px; }
.mini-side { flex-direction: column; align-items: stretch; border: 1px solid var(--border); border-radius: 8px; padding: 6px; }
.mini-crumb { color: var(--fg-muted); }
.mini-cal { display: flex; flex-direction: column; gap: 4px; border: 1px solid var(--border); border-radius: 8px; padding: 8px; font: 400 11px ui-monospace, monospace; }
.mini-cal b { background: var(--brand); color: #fff; border-radius: 3px; padding: 0 3px; }
.input-group { display: inline-flex; align-items: center; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; font-size: 11px; }
.input-group span { background: var(--surface); padding: 5px 8px; }
.input-group input { border: 0; border-radius: 0; }
.cmp-sample .form-demo { display: grid; gap: 6px; max-width: 220px; }
.cmp-sample .form-demo label { font-size: 11px; }
.cmp-sample .form-demo input { min-height: 30px; }
`


// ---------------------------------------------------------------------------
// 基础元素 / 模式分区（20 类，每类都是真实 DOM，不使用截图）
// ---------------------------------------------------------------------------
const ELEMENTS = [
  {
    id: 'color',
    title: '色彩 Color',
    spec: 'UDS5-S03',
    body: fullColorBody,
  },
  {
    id: 'typography',
    title: '字号与排版 Typography',
    spec: 'UDS5-S04',
    body: fullTypographyBody,
  },
  {
    id: 'spacing',
    title: '间距 Spacing',
    spec: 'UDS5-S05',
    body: `<div class="space-row">${[4, 8, 12, 16, 24, 32, 40, 48]
      .map(
        (n) =>
          `<div class="space-item"><span class="space-bar" style="width:${n * 2}px"></span><code>${n}px</code></div>`
      )
      .join('')}</div>
    <p class="note">4pt 基础单位；密度三档由 <code>data-theme-scale</code> 控制且<strong>不缩放</strong> <code>--text-*</code>；容器 1280px / 营销 1800px / 三栏 1440px 唯一声明在 <code>tokens/spacing.css:65-66</code>。T17 禁止任意间距。</p>`,
  },
  {
    id: 'radius',
    title: '圆角 Radius and Shape',
    spec: 'UDS5-S06',
    body: `<div class="radius-row">${[
      ['xs', 6],
      ['sm', 8],
      ['md', 10],
      ['lg', 12],
      ['xl', 14],
      ['2xl', 16],
      ['3xl', 18],
      ['4xl', 20],
      ['full', 9999],
    ]
      .map(
        ([name, px]) =>
          `<div class="radius-item"><span class="radius-box" style="border-radius:${px}px"></span><code>${name} · ${px === 9999 ? 'full' : `${px  }px`}</code></div>`
      )
      .join('')}</div>
    <p class="note"><code>--radius: 0.625rem</code>(10px) × 系数 0.6/0.8/1/1.2/1.4/1.6/1.8/2 = 8 个 calc 命名派生档；<code>rounded-full</code> 为 T10 额外放行的特殊档，合计 9 种合法写法。「圆角七档」是 3.0 早期滞后称谓。以上为运行时实现现状；G1 唯一规范圆角为 <code>0.375rem</code>(6px)，差异登记为待迁移。</p>`,
  },
  {
    id: 'elevation',
    title: '投影与层叠 Elevation',
    spec: 'UDS5-S07',
    body: `<div class="elev-row">${[0, 1, 2, 3, 4, 5]
      .map(
        (n) =>
          `<div class="elev-card elev-${n}"><code>e${n}</code><span>层叠档 ${n}</span></div>`
      )
      .join('')}</div>
    <p class="note">5 个 <code>--ds-elevation-*</code> + 1 个 <code>--ds-glow-online</code> = 6 档；Dark 覆盖 2 档。z-index 目标八档（0/100/…/700）尚未落地，存量 30 处 <code>z-50</code>（其中 ui/ 24 处）与 3 处负 z-index 已登记待迁移。</p>`,
  },
  {
    id: 'border',
    title: '边框与焦点环 Border / Focus',
    spec: 'UDS5-S07 / S13',
    body: `<div class="demo-row"><span class="border-1">1px 边框</span><button type="button" class="focus-demo" aria-label="焦点环 2px 演示">聚焦我（2px ring-2）</button><span class="border-decor">装饰性 ring-1 · 1px</span></div>
    <p class="note">边框恒 1px；焦点环 <strong>2px <code>ring-2</code></strong>（<code>--ds-focus-ring-width: 2px</code>，已裁决、无规范—代码漂移）；装饰性 <code>ring-1</code> 描边 1px 是真实有效值但不承载焦点语义。</p>`,
  },
  {
    id: 'iconography',
    title: '图标 Iconography',
    spec: 'UDS5-S08',
    body: `<div class="demo-row">${[16, 20, 24]
      .map(
        (n) =>
          `<span class="icon-demo" aria-label="图标尺寸 ${n} 像素"><svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v4l3 2"></path></svg><code>${n}px</code></span>`
      )
      .join('')}</div>
    <p class="note">单一来源 <code>lucide-react</code>；描边 1.8px；交互图标必须有可访问名称，纯装饰图标 <code>aria-hidden="true"</code>；由 <code>spec-guards.test.ts</code> 守卫。</p>`,
  },
  {
    id: 'motion',
    title: '动效 Motion',
    spec: 'UDS5-S09',
    body: `<div class="motion-row">${[100, 200, 250, 300, 350, 500]
      .map(
        (n) =>
          `<div class="motion-item"><span class="motion-bar" style="animation-duration:${n}ms"></span><code>${n}ms</code></div>`
      )
      .join('')}</div>
    <p class="note">Dialog 背板 <code>duration-100</code>(100ms)、Sheet 面板 <code>ds-motion-base</code>(200ms)、巨型菜单 <code>ds-motion-slow</code>(350ms)；T11 拦裸 <code>duration-*</code>；<code>prefers-reduced-motion</code> 下全部降级为 0ms。</p>`,
  },
  {
    id: 'theme',
    title: '主题 Theme',
    spec: 'UDS5-S10',
    body: `<div class="demo-row"><span class="theme-chip" data-theme-chip="light">Light</span><span class="theme-chip" data-theme-chip="dark">Dark</span><span class="theme-chip" data-theme-chip="system">System</span></div>
    <p class="note">三维正交：<code>data-theme-preset</code>（调色板）/ <code>data-theme-radius</code> / <code>data-theme-scale</code>。<code>simple-large</code> 属<strong>字号轴</strong>放大档，不改调色板（<code>theme-presets.css:465-467</code> 已排除）。Light/Dark 变量成对校验由 <code>check-design-system-5.0.mjs</code> 守护；本页右上角可实时切换。</p>`,
  },
  {
    id: 'layout',
    title: '布局 Layout',
    spec: 'UDS5-S11',
    body: `<div class="shell-demo"><div class="shell-side">Sidebar<br><code>220px / 44px</code></div><div class="shell-main"><div class="shell-head">Header · <code>48px</code></div><div class="shell-content">Content · 12 栅格 · max-width 1280px</div></div></div>
    <p class="note">App Shell / 容器 / 栅格；Sidebar 220px（折叠 44px / 展开 272px），Header <code>--app-header-height: 3rem</code>；73 个路由源码与 30 个 feature 目录为适配基线。</p>`,
  },
  {
    id: 'responsive',
    title: '响应式 Responsive',
    spec: 'UDS5-S12',
    body: `<div class="demo-row">${[
      ['sm', 640],
      ['md', 768],
      ['lg', 1024],
      ['xl', 1280],
      ['2xl', 1536],
    ]
      .map(([n, px]) => `<span class="bp-chip"><code>${n}</code> ${px}px</span>`)
      .join('')}</div>
    <p class="note">PC Web / H5 双平台；22 页 × 2 视口 = 44 张视觉基线；Android / iOS / HarmonyOS 无实现，一律 <code>NOT_VERIFIED</code>，不得用 Web 结果代替。</p>`,
  },
  {
    id: 'accessibility',
    title: '无障碍 Accessibility',
    spec: 'UDS5-S13',
    body: `<div class="demo-row"><button type="button" class="focus-demo" aria-label="键盘可聚焦按钮">Tab 聚焦</button><span class="hit-target" aria-label="44px 命中区">44px 命中区</span><span class="contrast-chip" aria-label="对比度 4.5 比 1">AA 4.5:1</span></div>
    <p class="note">WCAG 2.2 AA 目标、键盘 / 焦点 / ARIA / 触控命中区 ≥24px（推荐 44px）；E24 两处缺陷（3.76:1 / 3.30:1）待修；E28 品牌渐变为有意例外（浅色 from 2.54 / via 2.72 未达 3:1，to 3.96 达标；深色 7.93 / 7.41 / 5.10 全部达标）；12 个守卫测试与 31 条对比度断言。</p>`,
  },
  {
    id: 'form',
    title: '表单与校验 Form and Validation',
    spec: 'UDS5-S18',
    body: `<form class="form-demo" onsubmit="return false" aria-label="表单元素演示">
      <label for="demo-email">邮箱 <span aria-hidden="true">*</span></label>
      <input id="demo-email" type="email" placeholder="name@example.com" aria-describedby="demo-err" />
      <p id="demo-err" class="field-error" role="alert">请输入有效邮箱地址（字段级错误）</p>
      <label for="demo-otp">一次性验证码</label>
      <input id="demo-otp" class="otp" inputmode="numeric" maxlength="6" placeholder="000000" aria-label="六位验证码" />
      <button type="submit" class="btn btn-primary" aria-label="提交表单（防重复提交）">提交</button>
    </form>
    <p class="note">字段级错误 + 服务端错误优先级 + 未保存提醒 + 防重复提交；错误态需 <code>role="alert"</code> 与 <code>aria-describedby</code>；7 份 locale 文案同步。</p>`,
  },
  {
    id: 'data-display',
    title: '数据展示 Data Display',
    spec: 'UDS5-S19',
    body: `<table class="demo-table" aria-label="数据展示表格演示"><thead><tr><th>模型</th><th>状态</th><th class="num">用量</th><th class="num">金额</th></tr></thead><tbody><tr><td>gpt-4o</td><td><span class="badge badge-ok">正常</span></td><td class="num">1,280,000</td><td class="num">¥ 12.80</td></tr><tr><td>claude-3.5</td><td><span class="badge badge-warn">限流</span></td><td class="num">860,240</td><td class="num">¥ 8.60</td></tr></tbody></table>
    <div class="state-row"><span class="state-chip">空态 Empty</span><span class="state-chip">加载 Loading</span><span class="state-chip">错误 Error</span></div>
    <p class="note">11 项表格能力（排序 / 筛选 / 搜索 / 分页 / 行选 / 批量 / 列可见性 / 响应式 / 空 / 加载 / 错误）；数值 <code>tabular-nums</code>、货币默认 ¥；24 个 <code>data-table/</code> 公开导出；密度档 th 12/500、td 13/400。</p>`,
  },
  {
    id: 'notification',
    title: '通知 Notification',
    spec: 'UDS5-S20',
    body: `<div class="notif-stack">
      <div class="notif notif-toast" role="status">Toast · 操作成功</div>
      <div class="notif notif-snackbar" role="status">Snackbar · 可撤销操作</div>
      <div class="notif notif-alert" role="alert">Alert · 校验失败</div>
      <div class="notif notif-banner" role="status">Banner · 系统公告</div>
      <div class="notif notif-system" role="status">System Notification · 规范保留位</div>
      <div class="notif notif-center" role="status">Notification Center · 通知中心聚合</div>
    </div>
    <p class="note">6 类通知组件（后 2 类含规范保留位）与 5 类反馈分级（成功 / 失败 / 取消 / 加载 / 异常）；<code>role="alert"</code> 仅用于需打断的错误。</p>`,
  },
  {
    id: 'interaction',
    title: '交互 Interaction',
    spec: 'UDS5-S17',
    body: `<div class="matrix" aria-label="交互五态矩阵"><div class="matrix-head"><span>交互类</span><span>成功</span><span>失败</span><span>取消</span><span>加载</span><span>异常</span></div>${[
      '登录',
      '注册',
      '充值',
      '退款',
      '创建密钥',
      '切换组织',
      '保存设置',
      '上传文件',
      '删除资源',
      '批量操作',
      '搜索',
      '分页',
      '导出',
      '邀请成员',
      '二次验证',
    ]
      .map(
        (name) =>
          `<div class="matrix-row"><span>${name}</span>${'<span aria-label="已定义">●</span>'.repeat(5)}</div>`
      )
      .join('')}</div>
    <p class="note">15 类交互 × 五态（过程）；组件八态（default/hover/focus/pressed/disabled/loading/error/success）是<strong>状态存在性</strong>，两者互补不是冲突；展示中心现状 6 态（缺 error/success）已登记。</p>`,
  },
  {
    id: 'page-template',
    title: '页面模板 Page Template',
    spec: 'UDS5-S16',
    body: `<div class="tpl-grid">${[
      '仪表盘',
      '列表页',
      '详情页',
      '表单页',
      '设置页',
      '定价页',
      '认证页',
      '错误页',
      '空状态页',
      '文档页',
      '结算页',
      '个人资料页',
    ]
      .map(
        (name, i) =>
          `<div class="tpl-card"><span class="tpl-thumb" aria-label="${name}模板缩略"></span><code>T${String(i + 1).padStart(2, '0')} ${name}</code></div>`
      )
      .join('')}</div>
    <p class="note">12 类页面模板 / 12 区域；Page Header 尚无独立组件（按 §3+§6 组合，保持 Pending）；RISK 分级按条标注，禁止整节一刀切。</p>`,
  },
  {
    id: 'business-domain',
    title: '业务域 Business Domains',
    spec: 'UDS5-S29 / S30 / S31 / S32 / S22',
    body: `<div class="domain-grid">
      <div class="domain-card"><strong>S29 认证</strong><span>9 路由 / 11 态状态机 / 字段级错误 / 安全边界</span></div>
      <div class="domain-card"><strong>S30 用户与 API Key</strong><span>掩码与明文取回 / 额度用量 / 头像身份</span></div>
      <div class="domain-card"><strong>S31 组织与账单</strong><span>org_role 四级 / 配额与组织钱包 / 订单状态机</span></div>
      <div class="domain-card"><strong>S32 触达与本地化</strong><span>邮件模板 / 短信规范位 / 7 locale / static-keys</span></div>
    </div>
    <div class="chip-row">${[
      'Dashboard',
      '用户管理',
      'API Key',
      '模型',
      '渠道',
      'Token 余额',
      '充值',
      '支付',
      '退款',
      '消费记录',
      '订单',
      '价格管理',
      '统计分析',
      '系统设置',
      '权限管理',
      '管理员功能',
      '其他现有模块',
    ]
      .map((n) => `<span class="chip">${n}</span>`)
      .join('')}</div>
    <p class="note">业务红线唯一清单：<code>org_role</code> / <code>sub_quota_limit</code> / <code>EnforceOrgQuota</code> / <code>ReserveOrgQuota</code> / <code>IncrOrgUsedQuota</code> 零改动（S22 的 17 个模块只做视觉规范映射）。</p>`,
  },
  {
    id: 'component-api',
    title: '组件 API 与八态 Component API',
    spec: 'UDS5-S14 / S15 / S23',
    body: `<div class="state-row">${[
      'default',
      'hover',
      'focus',
      'pressed',
      'disabled',
      'loading',
      'error',
      'success',
    ]
      .map((s) => `<span class="state-chip" aria-label="组件状态 ${s}">${s}</span>`)
      .join('')}</div>
    <p class="note">22 项组件契约 / A–N 14 类清单 / 65 个已注册组件是三个不同维度；Props、受控/非受控、Composition、Slot、Ref、废弃策略以 <code>ui/button.tsx</code> 与 <code>web/AGENTS.md</code> 3.2/3.3 为唯一扩展路径；<code>UTER-CMP-*</code> 注册 ID 为「规范 ↔ 代码 ↔ 展示 ↔ 测试」主键。</p>`,
  },
  {
    id: 'token-layers',
    title: 'Token 三层与真源 Token Layers',
    spec: 'UDS5-S02 / S24',
    body: `<div class="layer-stack">
      <div class="layer"><code>L1 Spec SSOT</code><span>3.0 §28.5 TOKEN-MANIFEST（历史）→ 5.0 注册表 §26 裁决表</span></div>
      <div class="layer"><code>L2 Runtime SSOT</code><span>web/src/design-system/tokens/*.css（8）+ foundations/*.css（6）+ styles/theme.css</span></div>
      <div class="layer"><code>L3 Derived</code><span>docs/design-system/showcase.html（3.0，17 条校验）+ 本页 SHOWCASE-5.0.html</span></div>
    </div>
    <p class="note">运行时只读扫描 <strong>${TOKEN_FILES.length}</strong> 份 CSS / <strong>${declCount}</strong> 条声明 / <strong>${allTokens.length}</strong> 个唯一变量 / <strong>${scopeCount}</strong> 类选择器作用域（<code>:root</code>、<code>.dark</code>、11 组预设、<code>@theme</code>）。本页是<strong>实现现状快照</strong>，唯一规范值见顶部基线表；派生快照禁止手工编辑，漂移即 FAIL。</p>`,
  },
]

// ---------------------------------------------------------------------------
// HTML 组装
// ---------------------------------------------------------------------------
const layerOf = (category) =>
  ({
    governance: '治理 / 审计 / 注册',
    registry: '治理 / 审计 / 注册',
    acceptance: '治理 / 审计 / 注册',
    audit: '治理 / 审计 / 注册',
    foundation: '基础层',
    layout: '布局层',
    component: '组件层',
    pattern: '模式层',
    template: '模板层',
    application: '业务适配',
    reference: '外部参考',
    'business-vertical': '业务域',
  })[category] ?? '其他'

const specSections = standards
  .map(
    (s) => `<section class="spec-card" data-spec-id="${esc(s.id)}" id="spec-${esc(s.id)}" aria-label="规范 ${esc(s.id)}">
      <header class="spec-head"><code class="spec-id">${esc(s.id)}</code><h3>${esc(s.name)}</h3><span class="pill">${esc(s.status)}</span></header>
      <p class="spec-scope">${esc(s.scope ?? '')}</p>
      <dl class="spec-meta"><dt>分类</dt><dd>${esc(layerOf(s.category))} · ${esc(s.category)}</dd><dt>版本</dt><dd>${esc(s.version)}</dd><dt>强制</dt><dd>${s.mandatory ? '是' : '否'}</dd></dl>
      <p class="spec-links"><a href="${relDoc(s.document)}" aria-label="打开 ${esc(s.id)} 规范原文">规范原文</a><span>验证：${esc(s.verification ?? 'NOT_VERIFIED')}</span></p>
    </section>`
  )
  .join('\n')

const groups = new Map()
for (const c of components) {
  const key = c.category ?? 'uncategorized'
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push(c)
}
const componentSections = [...groups.entries()]
  .map(
    ([category, list]) => `<div class="cmp-group" aria-label="组件分类 ${esc(category)}">
      <h3 class="cmp-group-title">${esc(category)} <span>${list.length} 个</span></h3>
      <div class="cmp-grid">${list
        .map(
          (c) => `<article class="cmp-card" data-component-id="${esc(c.id)}" aria-label="组件 ${esc(c.name)}">
            <code class="cmp-id">${esc(c.id)}</code>
            <h4>${esc(c.name)}</h4>
            <p class="cmp-path">${esc(c.implementation_path ?? '')}</p>
            ${componentSample(c)}
            <div class="cmp-foot"><span>${esc(c.status ?? 'ACTIVE')}</span><span>states ${(c.states ?? []).length}</span><span>${esc(layerOf('component'))}</span></div>
          </article>`
        )
        .join('')}</div>
    </div>`
  )
  .join('\n')

const elementSections = ELEMENTS.map(
  (e, i) => `<section class="element" data-element="${esc(e.id)}" id="el-${esc(e.id)}" aria-label="元素分区 ${esc(e.title)}">
    <header class="element-head"><span class="element-no">E${String(i + 1).padStart(2, '0')}</span><h2>${esc(e.title)}</h2><code>${esc(e.spec)}</code></header>
    <div class="element-body">${e.body}</div>
  </section>`
).join('\n')

const navSpecs = standards
  .map(
    (s) =>
      `<a href="#spec-${esc(s.id)}" aria-label="跳转到 ${esc(s.id)}"><code>${esc(s.id)}</code> ${esc(s.name)}</a>`
  )
  .join('\n')
const navElements = ELEMENTS.map(
  (e) => `<a href="#el-${esc(e.id)}" aria-label="跳转到 ${esc(e.title)}">${esc(e.title)}</a>`
).join('\n')

const manifest = JSON.stringify(
  {
    designSystem: 'UTER Design System 5.0',
    version: specRegistry.version ?? '5.0.0',
    effectiveDate: specRegistry.effective_date ?? '2026-11-14',
    normativeBrand: '#6c47ff',
    specIds: standards.length,
    componentIds: components.length,
    elements: ELEMENTS.length,
    controls: 5,
    standards: standards.length,
    tokenNames: allTokens.length,
    colorTokens: colorTokens.length,
    otherTokens: otherTokens.length,
    tokenDeclarations: declCount,
    tokenFiles: TOKEN_FILES.length,
    tokenScopes: scopeCount,
    tokenValues: allTokens.reduce((n, t) => n + t.values.length, 0),
    externalColors: externalColors.length,
    typeSteps: textSteps.length,
    fontFamilies: fontFamilies.length,
    fontWeights: weightTokens.length,
    componentSamples: components.length,
    dedicatedSamples: sampleOverrideCount,
    normativeG1: NORMATIVE_G1.length,
    normativeG2: NORMATIVE_G2.length,
    generatedFrom: [
      'DESIGN-STANDARD-REGISTRY.yaml',
      'COMPONENT-REGISTRY.yaml',
      'web/src/**/*.css（运行时 Token 全量只读解析）',
    ],
  },
  null,
  2
)

const html = `<!DOCTYPE html>
<!-- UTER DESIGN SYSTEM 5.0 · 全量 Showcase · Uter.ai · 由 generate-design-showcase-5.0.mjs 生成，请勿手工编辑 -->
<html lang="zh-CN" data-theme="light" data-density="default">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>UTER Design System 5.0 · 全量 Showcase</title>
<style>
:root {
  --bg: #f8fafc; --surface: #ffffff; --surface-2: #f1f5f9; --fg: #0f172a;
  --fg-muted: #64748b; --border: #e2e8f0; --brand: #6c47ff; --brand-strong: #4f52d1;
  --brand-deep: #4a4dc5; --brand-soft: #f1edff; --success: #16a34a; --warning: #d97706;
  --danger: #dc2626; --info: #2563eb; --success-soft: #dcfce7; --warning-soft: #fef3c7;
  --radius: 10px; --focus: 2px;
  --fs-display: 36px; --fs-h1: 28px; --fs-h2: 22px; --fs-h3: 18px;
  --fs-body: 14px; --fs-caption: 12px; --fs-dense: 13px;
  --shadow-0: none; --shadow-1: 0 1px 2px rgba(15,23,42,.06);
  --shadow-2: 0 2px 6px rgba(15,23,42,.09); --shadow-3: 0 6px 16px rgba(15,23,42,.11);
  --shadow-4: 0 12px 28px rgba(15,23,42,.14); --shadow-5: 0 20px 44px rgba(15,23,42,.18);
  --motion-fast: 100ms; --motion-base: 200ms; --motion-slow: 350ms;
}
html[data-theme="dark"] {
  --bg: #0b1120; --surface: #131c31; --surface-2: #1b2740; --fg: #e2e8f0;
  --fg-muted: #94a3b8; --border: #26324a; --brand: #a1a3f7; --brand-strong: #b1b3ff;
  --brand-deep: #c7c8ff; --brand-soft: #25264a; --success: #4ade80; --warning: #fbbf24;
  --danger: #f87171; --info: #60a5fa; --success-soft: #143524; --warning-soft: #3a2c0d;
  --shadow-1: 0 1px 2px rgba(0,0,0,.4); --shadow-2: 0 2px 6px rgba(0,0,0,.45);
  --shadow-3: 0 6px 16px rgba(0,0,0,.5); --shadow-4: 0 12px 28px rgba(0,0,0,.55);
  --shadow-5: 0 20px 44px rgba(0,0,0,.6);
}
html[data-density="compact"] { --pad: 10px; --gap: 10px; }
html[data-density="default"] { --pad: 16px; --gap: 16px; }
html[data-density="comfortable"] { --pad: 24px; --gap: 24px; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 400 var(--fs-body)/1.6 "Inter Variable", "Noto Sans SC Variable", system-ui, sans-serif; }
a { color: var(--brand); text-decoration: none; }
a:hover { text-decoration: underline; }
code { font: 400 var(--fs-dense)/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--surface-2); padding: 1px 5px; border-radius: 4px; }
:focus-visible { outline: var(--focus) solid var(--brand); outline-offset: 2px; }
.app { display: grid; grid-template-columns: 268px minmax(0, 1fr); min-height: 100vh; }
.sidebar { position: sticky; top: 0; height: 100vh; overflow-y: auto; background: var(--surface); border-right: 1px solid var(--border); padding: var(--pad); }
.sidebar h2 { font-size: var(--fs-caption); font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--fg-muted); margin: 20px 0 8px; }
.sidebar a { display: block; padding: 3px 6px; font-size: var(--fs-caption); border-radius: 6px; color: var(--fg); }
.sidebar a:hover { background: var(--brand-soft); text-decoration: none; }
.sidebar a code { font-size: var(--fs-caption); background: none; padding: 0; color: var(--brand); }
.main { padding: var(--pad) clamp(16px, 3vw, 48px) 64px; max-width: 1440px; width: 100%; }
.topbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
.topbar h1 { font-size: var(--fs-h1); font-weight: 600; line-height: 1.28; margin: 0; }
.topbar p { margin: 4px 0 0; color: var(--fg-muted); font-size: var(--fs-caption); }
.controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.controls label { font-size: var(--fs-caption); color: var(--fg-muted); }
select, input, button { font-family: inherit; font-size: var(--fs-body); color: var(--fg); background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; }
select { min-height: 32px; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 20px 0; }
.stat { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; box-shadow: var(--shadow-1); }
.stat strong { display: block; font-size: var(--fs-h2); font-weight: 600; font-variant-numeric: tabular-nums; }
.stat span { font-size: var(--fs-caption); color: var(--fg-muted); }
h2.section-title { font-size: var(--fs-h2); font-weight: 600; line-height: 1.36; margin: 40px 0 14px; padding-bottom: 8px; border-bottom: 2px solid var(--brand); }
.element { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--pad); margin-bottom: var(--gap); box-shadow: var(--shadow-1); }
.element-head { display: flex; flex-wrap: wrap; gap: 10px; align-items: baseline; border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-bottom: 14px; }
.element-head h2 { font-size: var(--fs-h3); font-weight: 600; margin: 0; }
.element-no { color: var(--brand); font-weight: 600; font-size: var(--fs-caption); }
.note { font-size: var(--fs-caption); color: var(--fg-muted); margin: 14px 0 0; line-height: 1.7; }
.grid-swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.swatch { border: 1px solid var(--border); border-radius: 8px; padding: 8px; display: flex; flex-direction: column; gap: 5px; }
.swatch-chip { height: 34px; border-radius: 6px; border: 1px solid var(--border); }
.swatch-val { font-size: var(--fs-caption); color: var(--fg-muted); }
.type-stack { display: flex; flex-direction: column; gap: 8px; }
.type-row { display: grid; grid-template-columns: 110px 1fr; align-items: baseline; gap: 12px; border-bottom: 1px dashed var(--border); padding-bottom: 6px; }
.t-display { font-size: var(--fs-display); font-weight: 600; line-height: 1.22; }
.t-h1 { font-size: var(--fs-h1); font-weight: 600; line-height: 1.28; }
.t-h2 { font-size: var(--fs-h2); font-weight: 600; line-height: 1.36; }
.t-h3 { font-size: var(--fs-h3); font-weight: 600; line-height: 1.44; }
.t-body { font-size: var(--fs-body); }
.t-caption { font-size: var(--fs-caption); }
.t-dense { font-size: var(--fs-dense); }
.t-mono { font: 400 var(--fs-dense)/1.5 ui-monospace, monospace; }
.space-row, .radius-row, .elev-row, .motion-row { display: flex; flex-wrap: wrap; gap: 14px; }
.space-item, .radius-item, .motion-item { display: flex; flex-direction: column; gap: 6px; align-items: center; font-size: var(--fs-caption); }
.space-bar { height: 14px; background: var(--brand); border-radius: 3px; display: block; min-width: 8px; }
.radius-box { width: 54px; height: 54px; background: var(--brand-soft); border: 2px solid var(--brand); display: block; }
.elev-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 12px; width: 120px; display: flex; flex-direction: column; gap: 4px; font-size: var(--fs-caption); }
.elev-0 { box-shadow: var(--shadow-0); } .elev-1 { box-shadow: var(--shadow-1); }
.elev-2 { box-shadow: var(--shadow-2); } .elev-3 { box-shadow: var(--shadow-3); }
.elev-4 { box-shadow: var(--shadow-4); } .elev-5 { box-shadow: var(--shadow-5); }
.demo-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.border-1 { border: 1px solid var(--border); padding: 8px 12px; border-radius: 8px; }
.border-decor { box-shadow: 0 0 0 1px var(--brand); padding: 8px 12px; border-radius: 8px; }
.focus-demo { border: 1px solid var(--brand); color: var(--brand); cursor: pointer; }
.icon-demo { display: inline-flex; gap: 6px; align-items: center; border: 1px solid var(--border); padding: 8px; border-radius: 8px; }
.motion-bar { width: 70px; height: 12px; background: var(--brand); border-radius: 6px; display: block; animation: pulse 200ms ease-in-out infinite alternate; }
@keyframes pulse { from { opacity: .35; } to { opacity: 1; } }
.theme-chip, .bp-chip, .chip, .state-chip, .contrast-chip, .hit-target { border: 1px solid var(--border); background: var(--surface-2); border-radius: 999px; padding: 5px 12px; font-size: var(--fs-caption); }
.bp-chip code { background: none; padding: 0; color: var(--brand); }
.shell-demo { display: grid; grid-template-columns: 150px 1fr; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; min-height: 130px; }
.shell-side { background: var(--brand-soft); padding: 12px; font-size: var(--fs-caption); border-right: 1px solid var(--border); }
.shell-main { display: flex; flex-direction: column; }
.shell-head { border-bottom: 1px solid var(--border); padding: 8px 12px; font-size: var(--fs-caption); }
.shell-content { padding: 12px; font-size: var(--fs-caption); color: var(--fg-muted); }
.form-demo { display: grid; gap: 8px; max-width: 360px; }
.form-demo label { font-size: var(--fs-caption); font-weight: 600; }
.form-demo input { width: 100%; min-height: 36px; }
.form-demo .otp { letter-spacing: .5em; text-align: center; }
.field-error { color: var(--danger); font-size: var(--fs-caption); margin: 0; }
.btn { cursor: pointer; border-radius: 8px; min-height: 36px; padding: 8px 16px; border: 1px solid transparent; font-weight: 500; }
.btn-primary { background: var(--brand); color: #fff; }
.btn-primary:hover { background: var(--brand-strong); }
.demo-table { width: 100%; border-collapse: collapse; font-size: var(--fs-dense); }
.demo-table th { text-align: left; font-size: var(--fs-caption); font-weight: 500; color: var(--fg-muted); border-bottom: 1px solid var(--border); padding: 8px; }
.demo-table td { padding: 8px; border-bottom: 1px solid var(--border); }
.demo-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.badge { border-radius: 999px; padding: 2px 8px; font-size: var(--fs-caption); }
.badge-ok { background: var(--success-soft); color: var(--success); }
.badge-warn { background: var(--warning-soft); color: var(--warning); }
.state-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.notif-stack { display: grid; gap: 8px; }
.notif { border-radius: 8px; padding: 10px 14px; font-size: var(--fs-caption); border: 1px solid var(--border); }
.notif-toast { background: var(--brand-soft); color: var(--brand-deep); }
.notif-snackbar { background: var(--surface-2); }
.notif-alert { border-color: var(--danger); color: var(--danger); }
.notif-banner { border-color: var(--info); color: var(--info); }
.notif-system { border-style: dashed; color: var(--fg-muted); }
.notif-center { background: var(--surface-2); }
.matrix { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.matrix-head, .matrix-row { display: grid; grid-template-columns: 1.6fr repeat(5, 1fr); font-size: var(--fs-caption); }
.matrix-head { background: var(--surface-2); font-weight: 600; }
.matrix-head span, .matrix-row span { padding: 6px 8px; border-right: 1px solid var(--border); }
.matrix-row { border-top: 1px solid var(--border); }
.matrix-row span:not(:first-child) { text-align: center; color: var(--success); }
.tpl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
.tpl-card { border: 1px solid var(--border); border-radius: 8px; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
.tpl-thumb { height: 48px; background: linear-gradient(160deg, var(--brand-soft), var(--surface-2)); border: 1px solid var(--border); border-radius: 4px; display: block; }
.domain-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
.domain-card { border: 1px solid var(--border); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 6px; font-size: var(--fs-caption); }
.domain-card strong { font-size: var(--fs-body); color: var(--brand); }
.chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.layer-stack { display: grid; gap: 8px; }
.layer { display: grid; grid-template-columns: 170px 1fr; gap: 12px; border: 1px solid var(--border); border-radius: 8px; padding: 10px; font-size: var(--fs-caption); }
.spec-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 12px; }
.spec-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; box-shadow: var(--shadow-1); }
.spec-head { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; }
.spec-head h3 { font-size: var(--fs-h3); font-weight: 600; margin: 0; flex: 1 1 160px; }
.spec-id { color: var(--brand); }
.pill { font-size: var(--fs-caption); background: var(--brand-soft); color: var(--brand-deep); border-radius: 999px; padding: 2px 8px; }
.spec-scope { font-size: var(--fs-caption); color: var(--fg-muted); min-height: 40px; }
.spec-meta { display: grid; grid-template-columns: 48px 1fr; gap: 2px 8px; font-size: var(--fs-caption); margin: 8px 0; }
.spec-meta dt { color: var(--fg-muted); } .spec-meta dd { margin: 0; }
.spec-links { display: flex; flex-wrap: wrap; gap: 10px; font-size: var(--fs-caption); color: var(--fg-muted); margin: 0; }
.cmp-group { margin-bottom: 22px; }
.cmp-group-title { font-size: var(--fs-h3); font-weight: 600; margin: 0 0 10px; }
.cmp-group-title span { font-size: var(--fs-caption); color: var(--fg-muted); font-weight: 400; }
.cmp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
.cmp-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
.cmp-card h4 { font-size: var(--fs-body); font-weight: 600; margin: 6px 0; }
.cmp-id { font-size: var(--fs-caption); color: var(--brand); }
.cmp-path { font: 400 var(--fs-caption)/1.5 ui-monospace, monospace; color: var(--fg-muted); word-break: break-all; margin: 0 0 8px; }
.cmp-foot { display: flex; flex-wrap: wrap; gap: 6px; font-size: var(--fs-caption); color: var(--fg-muted); border-top: 1px dashed var(--border); padding-top: 8px; }
.lab { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--pad); }
.lab-controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.lab-stage { margin-top: 20px; padding: 24px; border: 1px dashed var(--border); border-radius: 8px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
#demo-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 8px; border: 1px solid transparent; font-weight: 500; cursor: pointer; transition: background var(--motion-fast) ease, transform var(--motion-fast) ease; padding: 8px 16px; min-height: 36px; font-size: var(--fs-body); }
#demo-button[data-variant="default"] { background: var(--brand); color: #fff; }
#demo-button[data-variant="outline"] { background: transparent; color: var(--brand); border-color: var(--brand); }
#demo-button[data-variant="secondary"] { background: var(--surface-2); color: var(--fg); }
#demo-button[data-variant="ghost"] { background: transparent; color: var(--fg-muted); }
#demo-button[data-variant="destructive"] { background: var(--danger); color: #fff; }
#demo-button[data-variant="link"] { background: transparent; color: var(--brand); text-decoration: underline; }
#demo-button[data-size="icon-xs"] { min-height: 24px; padding: 4px; font-size: var(--fs-caption); }
#demo-button[data-size="icon-sm"], #demo-button[data-size="sm"] { min-height: 32px; padding: 5px 10px; font-size: var(--fs-caption); }
#demo-button[data-size="lg"] { min-height: 44px; padding: 10px 20px; }
#demo-button[data-size="icon"], #demo-button[data-size="icon-lg"] { min-height: 40px; padding: 8px; }
#demo-button[data-size="inline"] { min-height: 24px; padding: 2px 6px; font-size: var(--fs-caption); }
#demo-button[data-size="wrap"] { max-width: 180px; white-space: normal; text-align: left; }
#demo-button[data-state="hover"] { opacity: .88; }
#demo-button[data-state="focus"] { outline: var(--focus) solid var(--brand); outline-offset: 2px; }
#demo-button[data-state="pressed"] { transform: scale(.97); }
#demo-button[data-state="disabled"] { opacity: .5; pointer-events: none; }
#demo-button[data-state="loading"] { opacity: .8; }
#demo-button[data-state="error"] { border-color: var(--danger); box-shadow: 0 0 0 1px var(--danger); }
#demo-button[data-state="success"] { border-color: var(--success); box-shadow: 0 0 0 1px var(--success); }
footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid var(--border); font-size: var(--fs-caption); color: var(--fg-muted); }
@media (max-width: 900px) { .app { grid-template-columns: 1fr; } .sidebar { position: static; height: auto; max-height: 260px; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0ms !important; transition-duration: 0ms !important; } }
${extraCss}
</style>
</head>
<body>
<div class="app">
  <nav class="sidebar" aria-label="Showcase 分区导航">
    <h2>UTER Design System 5.0</h2>
    <p class="note">全量 Showcase · 规范验收视图 · 真实 DOM 渲染</p>
    <h2>规范基线</h2>
    <a href="#normative" aria-label="跳转到唯一规范值基线表">唯一规范值基线表（G1 / G2）</a>
    <h2>基础元素（${ELEMENTS.length}）</h2>
    ${navElements}
    <h2>交互实验室</h2>
    <a href="#lab">Button × Variant × Size × State</a>
    <h2>规范分册（${standards.length}）</h2>
    ${navSpecs}
    <h2>组件注册表（${components.length}）</h2>
    <a href="#components">全部已注册组件</a>
  </nav>
  <main class="main">
    <header class="topbar">
      <div>
        <h1>UTER Design System 5.0 · 全量 Showcase</h1>
        <p>版本 ${esc(specRegistry.version ?? '5.0.0')} · 生效 ${esc(specRegistry.effective_date ?? '2026-11-14')} · 由注册表与运行时 Token 生成 · 单文件 file:// 可打开</p>
      </div>
      <div class="controls">
        <label for="ctl-theme">主题</label>
        <select id="ctl-theme" data-control="theme" aria-label="切换 Light / Dark 主题">
          <option value="light">Light</option><option value="dark">Dark</option>
        </select>
        <label for="ctl-density">密度</label>
        <select id="ctl-density" data-control="density" aria-label="切换密度档">
          <option value="default">Default</option><option value="compact">Compact</option><option value="comfortable">Comfortable</option>
        </select>
      </div>
    </header>

    <section class="stats" aria-label="覆盖统计">
      <div class="stat"><strong>${standards.length}</strong><span>注册规范条目</span></div>
      <div class="stat"><strong>${new Set(standards.map((s) => s.document)).size}</strong><span>规范分册文档</span></div>
      <div class="stat"><strong>${components.length}</strong><span>已注册组件 · 逐一视觉样本</span></div>
      <div class="stat"><strong>${ELEMENTS.length}</strong><span>基础元素 / 模式分区</span></div>
      <div class="stat"><strong>${allTokens.length}</strong><span>运行时 CSS 变量（零遗漏）</span></div>
      <div class="stat"><strong>${colorTokens.length}</strong><span>颜色 / 阴影 / 渐变变量</span></div>
      <div class="stat"><strong>${textSteps.length}</strong><span>@theme 字号档</span></div>
      <div class="stat"><strong>${TOKEN_FILES.length}</strong><span>扫描的 CSS 文件</span></div>
      <div class="stat"><strong>${declCount}</strong><span>CSS 变量声明总数</span></div>
    </section>

    ${normativeSection}

    <h2 class="section-title" id="elements">一 · 基础元素与模式（${ELEMENTS.length} 类）</h2>
    <p class="element-banner"><strong>口径说明</strong>：本页「基础元素 / 运行时变量 / 组件样本」全部是 <code>web/src</code> 的<strong>实现现状快照</strong>；5.0 的<strong>唯一规范值</strong>只在上文「唯一规范值基线表」（G1 取 clerk.com 官方已公布值，G2 取运行时实现现状）给出。二者不一致处已登记为「待迁移」，本轮不修改任何运行时代码。运行时色块含旧 Uter 靛紫与 11 组主题预设覆盖，均为实现现状，不是第二套规范值。</p>
    ${elementSections}

    <h2 class="section-title" id="lab">二 · 交互实验室：Button 6 variant × 9 size × 8 state</h2>
    <section class="lab" aria-label="Button 交互实验室">
      <div class="lab-controls">
        <label for="ctl-variant">Variant</label>
        <select id="ctl-variant" data-control="variant" aria-label="切换 Button variant">
          ${['default', 'outline', 'secondary', 'ghost', 'destructive', 'link']
            .map((v) => `<option value="${v}">${v}</option>`)
            .join('')}
        </select>
        <label for="ctl-size">Size</label>
        <select id="ctl-size" data-control="size" aria-label="切换 Button size">
          ${['default', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg', 'inline', 'wrap']
            .map((v) => `<option value="${v}">${v}</option>`)
            .join('')}
        </select>
        <label for="ctl-state">State</label>
        <select id="ctl-state" data-control="state" aria-label="切换 Button 状态">
          ${['default', 'hover', 'focus', 'pressed', 'disabled', 'loading', 'error', 'success']
            .map((v) => `<option value="${v}">${v}</option>`)
            .join('')}
        </select>
      </div>
      <div class="lab-stage">
        <button type="button" id="demo-button" data-variant="default" data-size="default" data-state="default" aria-label="Button 交互演示">创建 API Key</button>
        <span class="note" id="demo-readout" aria-live="polite">variant=default · size=default · state=default</span>
      </div>
      <p class="note">状态切换同步显示 <code>data-state</code> 与对应 ARIA 语义（disabled → <code>aria-disabled</code>，loading → <code>aria-busy</code>，error → <code>aria-invalid</code>）；密度档不缩放字号（T16 / §4A）。本演示为规范视图，不是 <code>web/src/components/ui/button.tsx</code> 的 React 实例。</p>
    </section>

    <h2 class="section-title" id="specs">三 · 规范分册与注册条目（${standards.length} 条）</h2>
    <div class="spec-grid">${specSections}</div>

    <h2 class="section-title" id="components">四 · 组件注册表全量（${components.length} 个 · ${groups.size} 类）</h2>
    ${componentSections}

    <footer>
      <p>唯一真源：<code>DESIGN-STANDARD-REGISTRY.yaml</code> / <code>COMPONENT-REGISTRY.yaml</code>（其真源为 <code>web/src/design-system/component-registry.json</code>）/ <code>web/src/design-system/tokens/*.css</code>。本页为派生的规范验收视图，禁止手工编辑；改注册表后需重跑 <code>design:showcase:5:generate</code> 与 <code>design:showcase:5:check</code>。</p>
      <p>覆盖口径与全局计数裁决见 <code>01-UTER-DESIGN-SYSTEM-5.0.md</code> §26；决策 D3 与 12 项能力见 <code>COMPONENT-DOCUMENTATION-AND-PREVIEW-STANDARD.md</code> §11。零外部依赖、0 个静态截图、不引入 Storybook、不改任何业务运行时代码。</p>
    </footer>
  </main>
</div>
<script type="application/json" id="uds5-manifest">${manifest}</script>
<script>
(function () {
  var root = document.documentElement;
  var theme = document.getElementById('ctl-theme');
  var density = document.getElementById('ctl-density');
  var variant = document.getElementById('ctl-variant');
  var size = document.getElementById('ctl-size');
  var state = document.getElementById('ctl-state');
  var button = document.getElementById('demo-button');
  var readout = document.getElementById('demo-readout');
  function syncAria() {
    var s = state.value;
    if (s === 'disabled') { button.setAttribute('aria-disabled', 'true'); } else { button.removeAttribute('aria-disabled'); }
    if (s === 'loading') { button.setAttribute('aria-busy', 'true'); } else { button.removeAttribute('aria-busy'); }
    if (s === 'error') { button.setAttribute('aria-invalid', 'true'); } else { button.removeAttribute('aria-invalid'); }
  }
  function syncDemo() {
    button.dataset.variant = variant.value;
    button.dataset.size = size.value;
    button.dataset.state = state.value;
    readout.textContent = 'variant=' + variant.value + ' · size=' + size.value + ' · state=' + state.value;
    syncAria();
  }
  theme.addEventListener('change', function () { root.dataset.theme = theme.value; });
  density.addEventListener('change', function () { root.dataset.density = density.value; });
  [variant, size, state].forEach(function (el) { el.addEventListener('change', syncDemo); });
  syncDemo();
})();
</script>
</body>
</html>
`

writeFileSync(OUT_PATH, html, 'utf8')
process.stdout.write(
  `${JSON.stringify(
    {
      generated: true,
      output: OUT_PATH,
      bytes: Buffer.byteLength(html, 'utf8'),
      specIds: standards.length,
      componentIds: components.length,
      elements: ELEMENTS.length,
      componentGroups: groups.size,
      tokenNames: allTokens.length,
      colorTokens: colorTokens.length,
      otherTokens: otherTokens.length,
      tokenDeclarations: declCount,
      tokenFiles: TOKEN_FILES.length,
      tokenScopes: scopeCount,
      externalColors: externalColors.length,
      typeSteps: textSteps.length,
      fontFamilies: fontFamilies.length,
      componentSamples: components.length,
      dedicatedSamples: sampleOverrideCount,
    },
    null,
    2
  )}\n`
)
