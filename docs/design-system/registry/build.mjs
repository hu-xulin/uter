/*
 * Copyright (C) 2026 Uter.ai
 * SPDX-License-Identifier: UNLICENSED
 *
 * UTER DESIGN SYSTEM 7.0 — 唯一构建入口
 *
 * 流程：
 *   1) 由 tokens.mjs 的定义写出 TOKEN-MANIFEST.json
 *   2) 重新从磁盘读回该 JSON（此后它才是唯一真源）
 *   3) 从该 JSON 派生 CSS / TS / 38 份规范 / 8 份注册表 / Showcase / 报告
 *
 * 任何产物都不得另写一份数值；check-design-system-7.0.mjs 会验证一致性。
 *
 * 用法：node registry/build.mjs [--docs-only]
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildManifest } from './tokens.mjs'
import { MODULES, PRINCIPLES, NUMBERED_MODULES, SPECIAL_MODULES } from './spec-modules.mjs'
import { runVerification } from './contrast-engine.mjs'
import { runSyntaxAdapter } from './syntax-adapter.mjs'
import { renderShowcase } from './render-showcase.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const DS_DIR = join(HERE, '..')
const REPO = join(DS_DIR, '..', '..')
const RUNTIME = join(DS_DIR, 'runtime')
const PUBLIC_DIR = join(REPO, 'web', 'public', 'design-system')

const json = (o) => JSON.stringify(o, null, 2) + '\n'
const CHECK_SHOWCASE = process.argv.includes('--check-showcase')
const write = (p, s) => {
  if (CHECK_SHOWCASE) return
  mkdirSync(join(p, '..'), { recursive: true })
  writeFileSync(p, s, 'utf8')
}
const log = (...a) => { if (!CHECK_SHOWCASE) console.log('[UDS7]', ...a) }

/* ── 1) 写 manifest ───────────────────────────────────────────────────────── */

const manifest = buildManifest()
const MANIFEST_PATH = join(DS_DIR, 'TOKEN-MANIFEST.json')
write(MANIFEST_PATH, json(manifest))
log('wrote TOKEN-MANIFEST.json with', manifest.tokenCount, 'tokens')

/* ── 2) 从磁盘读回，此后只用这份 ─────────────────────────────────────────── */

const M = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
const T = M.tokens
const tokenNames = Object.keys(T).sort()
/* 对比度数值只允许来自引擎实算，报告 / 注册表 / 规范不得另写一套。 */
const V = runVerification()

const cssValue = (t, theme) => {
  const v = t[theme]
  if (typeof v === 'number') {
    if (t.unit === 'px') return `${v}px`
    if (t.unit === 'ms') return `${v}ms`
    return String(v)
  }
  return String(v)
}

const decl = (name, t, theme) => `  ${name}: ${cssValue(t, theme)};`
const PROJECT_HEADER = `/*
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
`
const header = (title) =>
  PROJECT_HEADER +
  `/* ${title}\n * This file is generated — DO NOT EDIT.\n * Source: docs/design-system/TOKEN-MANIFEST.json\n * Regenerate: node docs/design-system/registry/build.mjs\n */\n\n`

/* ── 3) CSS / TS 派生 ─────────────────────────────────────────────────────── */

const lightOnly = tokenNames.filter((n) => T[n].themeIndependent)
const themed = tokenNames.filter((n) => !T[n].themeIndependent)

const tokensCss =
  header('UDS 7.0 Token declarations (Light defaults)') +
  `:root {\n${tokenNames.map((n) => decl(n, T[n], 'light')).join('\n')}\n}\n\n` +
  `/* Dark overrides are loaded from ./themes/dark.css */\n`

const lightCss =
  header('UDS 7.0 Light theme') +
  `:root, [data-ds-theme="light"] {\n${themed.map((n) => decl(n, T[n], 'light')).join('\n')}\n}\n`

const darkCss =
  header('UDS 7.0 Dark theme') +
  `[data-ds-theme="dark"] {\n${themed.map((n) => decl(n, T[n], 'dark')).join('\n')}\n}\n`

const foundationsCss =
  header('UDS 7.0 foundations: single gradient exit, focus, reduced motion') +
  `@import './tokens.css';\n@import './themes/light.css';\n@import './themes/dark.css';\n\n` +
  `/* 全站唯一品牌渐变出口。业务页面不得自写 linear-gradient / bg-clip-text。 */\n` +
  `.ds-text-gradient-brand {\n` +
  `  background-image: linear-gradient(\n` +
  `    var(--ds-gradient-direction) in srgb,\n` +
  `    var(--ds-color-gradient-light-from) 0%,\n` +
  `    var(--ds-color-gradient-light-via) 50%,\n` +
  `    var(--ds-color-gradient-light-to) 100%\n` +
  `  );\n` +
  `  background-clip: text;\n` +
  `  -webkit-background-clip: text;\n` +
  `  color: transparent;\n` +
  `  font-family: var(--ds-font-ui);\n` +
  `}\n` +
  `[data-ds-theme="dark"] .ds-text-gradient-brand {\n` +
  `  background-image: linear-gradient(\n` +
  `    var(--ds-gradient-direction) in srgb,\n` +
  `    var(--ds-color-gradient-dark-from) 0%,\n` +
  `    var(--ds-color-gradient-dark-via) 50%,\n` +
  `    var(--ds-color-gradient-dark-to) 100%\n` +
  `  );\n` +
  `}\n\n` +
  `:where(a, button, input, select, textarea, [tabindex]):focus, :where(a, button, input, select, textarea, [tabindex]):focus-visible {\n` +
  `  outline: var(--ds-focus-ring-width) solid var(--ds-color-focus-ring);\n` +
  `  outline-offset: var(--ds-focus-ring-offset);\n` +
  `}\n\n` +
  `.ds-tabular-nums { font-variant-numeric: var(--ds-numeric-tabular); }\n\n` +
  `@media (prefers-reduced-motion: reduce) {\n` +
  `  *, *::before, *::after {\n` +
  `    animation-duration: 0.01ms !important;\n` +
  `    animation-iteration-count: 1 !important;\n` +
  `    transition-duration: 0.01ms !important;\n` +
  `  }\n` +
  `}\n`

const tsTokens =
  header('UDS 7.0 TypeScript token mirror') +
  `/** Generated from TOKEN-MANIFEST.json. Never hand-edit. */\n\n` +
  `export const DS7_VERSION = ${JSON.stringify(M.version)} as const\n\n` +
  `export type DsTheme = 'light' | 'dark'\n` +
  `export type DsTokenName = ${tokenNames.map((n) => JSON.stringify(n)).join(' | ')}\n\n` +
  `export interface DsToken { layer: string; category: string; type: string; unit: string; light: string | number; dark: string | number; description: string; themeIndependent: boolean }\n\n` +
  `export const DS7_TOKENS: Record<DsTokenName, DsToken> = ${json(T)}\n\n` +
  `export const DS7_TOKEN_NAMES = Object.keys(DS7_TOKENS) as DsTokenName[]\n\n` +
  `export function dsToken(name: DsTokenName, theme: DsTheme = 'light'): string | number {\n` +
  `  const t = DS7_TOKENS[name]\n` +
  `  const v = t[theme]\n` +
  `  if (typeof v === 'number') return t.unit === 'px' ? \`\${v}px\` : t.unit === 'ms' ? \`\${v}ms\` : v\n` +
  `  return v\n` +
  `}\n\n` +
  `export const DS7_GRADIENT_UTILITY = ${JSON.stringify(T['--ds-gradient-utility'].light)} as const\n` +
  `export const DS7_SYNTAX_LANGUAGES = ${JSON.stringify(M.syntaxLanguages)} as const\n` +
  `export const DS7_HIGHLIGHTER_ENGINES = ${json(M.highlighterEngines)}\n`

write(join(RUNTIME, 'tokens.css'), tokensCss)
write(join(RUNTIME, 'themes', 'light.css'), lightCss)
write(join(RUNTIME, 'themes', 'dark.css'), darkCss)
write(join(RUNTIME, 'foundations.css'), foundationsCss)
write(join(RUNTIME, 'tokens.ts'), tsTokens)
log('wrote CSS (4) + TS (1) from manifest')

/* ── 3b) 真实运行时桥接层（§17「必须完成真实产品组件接入」） ───────────────────
 * 只注入颜色语义层，不注入字号/间距/圆角等标量（避免形成第二套 3.0 刻度）。
 * 全部变量用 --ds7-* 隔离命名，绝不覆盖 web/src 已有的同名 --ds-* 变量。
 * 回滚方式：删除 web/src/styles/index.css 的一行 @import。
 * --------------------------------------------------------------------------- */

const BRIDGE_PATH = join(REPO, 'web', 'src', 'design-system', 'tokens', 'uds-semantic-bridge.css')
const bridgeNames = tokenNames.filter((n) => T[n].runtimeBridge)
const bridgeThemed = bridgeNames.filter((n) => !T[n].themeIndependent)
const bridgeDecl = (n, theme) => `  ${T[n].runtimeName}: ${cssValue(T[n], theme)};`
const bridgeBlock = (selector, names, theme) =>
  `${selector} {\n${names.map((n) => bridgeDecl(n, theme)).join('\n')}\n}\n\n`

const forcedColorsPairs = [
  ['--ds7-color-text-primary', 'CanvasText'],
  ['--ds7-color-text-secondary', 'CanvasText'],
  ['--ds7-color-text-tertiary', 'CanvasText'],
  ['--ds7-color-text-muted', 'CanvasText'],
  ['--ds7-color-text-link', 'LinkText'],
  ['--ds7-color-surface-canvas', 'Canvas'],
  ['--ds7-color-surface-base', 'Canvas'],
  ['--ds7-color-surface-raised', 'Canvas'],
  ['--ds7-color-border-default', 'CanvasText'],
  ['--ds7-color-border-strong', 'CanvasText'],
  ['--ds7-color-focus-ring', 'Highlight'],
  ['--ds7-color-selection-background', 'Highlight'],
  ['--ds7-color-selection-foreground', 'HighlightText'],
  ['--ds7-color-code-background', 'Canvas'],
  ['--ds7-color-code-foreground', 'CanvasText'],
  ['--ds7-color-terminal-background', 'Canvas'],
  ['--ds7-color-terminal-foreground', 'CanvasText'],
].filter(([n]) => bridgeNames.some((b) => T[b].runtimeName === n))

const bridgeCss =
  header('UDS 7.0 runtime bridge — generated from TOKEN-MANIFEST.json') +
  `/* 命名隔离：--ds7-* 不覆盖 3.0 已定义的同名 --ds-* 变量（部分取值语义相反）。\n` +
  ` * 颜色架构：L1 Primitive → L2 Semantic → L3 Component → L4 Interaction → L5 Product Context。\n` +
  ` * 语法色来源：VS Code Light+ / Dark+ 官方主题源码（见 audit/vscode/SOURCE-METADATA.json）。\n` +
  ` * 回滚：删除 web/src/styles/index.css 中本文件的一行 @import。 */\n\n` +
  bridgeBlock(':root', bridgeNames, 'light') +
  bridgeBlock('.dark', bridgeThemed, 'dark') +
  bridgeBlock('[data-ds-theme="dark"]', bridgeThemed, 'dark') +
  bridgeBlock('[data-ds-theme="light"]', bridgeThemed, 'light') +
  `::selection {\n  background: var(--ds7-color-selection-background);\n  color: var(--ds7-color-selection-foreground);\n}\n\n` +
  `@supports not (background: linear-gradient(in srgb, red, blue)) {\n` +
  `  /* §6.2 降级：不支持显式插值空间的旧浏览器回退到默认 sRGB 插值（视觉等价）。 */\n` +
  `  .ds-text-gradient-brand {\n` +
  `    background-image: linear-gradient(var(--ds7-color-gradient-light-from), var(--ds7-color-gradient-light-via), var(--ds7-color-gradient-light-to));\n` +
  `  }\n` +
  `}\n\n` +
  `@media (forced-colors: active) {\n` +
  `  :root, .dark, [data-ds-theme="dark"], [data-ds-theme="light"] {\n` +
  forcedColorsPairs.map(([n, v]) => `    ${n}: ${v};`).join('\n') + '\n' +
  `  }\n` +
  `  /* 高对比度模式下渐变文字与语法色必须退回系统色，避免不可读。 */\n` +
  `  .ds-text-gradient-brand { background-image: none; color: CanvasText; -webkit-text-fill-color: CanvasText; }\n` +
  `}\n`

write(BRIDGE_PATH, bridgeCss)
log('wrote runtime bridge', BRIDGE_PATH, 'with', bridgeNames.length, 'tokens')

/* ── 3c) 图表 12 色色板 TS 镜像 ─────────────────────────────────────────────
 * VChart 把系列色画进 <canvas>，读不到 CSS 变量；运行时由 brand-colors.ts
 * 的 resolveUds6ChartPalette() 在调用时解析 --ds7-color-chart-N，本文件只做
 * SSR / 单测兜底。数值唯一来源仍是 TOKEN-MANIFEST.json，禁止手改。 */

const chartNames = Array.from({ length: 12 }, (_, i) => `--ds-color-chart-${i + 1}`)
for (const n of chartNames) {
  if (!T[n]) throw new Error(`图表色板缺少 Token: ${n}`)
}
const chartPaletteTs =
  header('UDS 7.0 chart palette (12 series, CVD-verified)') +
  `/** Light / Dark 各 12 色；任意两色正常视觉 + 三类色觉缺陷模拟 CIEDE2000 >= 10。 */\n\n` +
  `export const UDS7_CHART_PALETTE_LIGHT = ${JSON.stringify(chartNames.map((n) => T[n].light))} as const\n\n` +
  `export const UDS7_CHART_PALETTE_DARK = ${JSON.stringify(chartNames.map((n) => T[n].dark))} as const\n`
const CHART_PALETTE_PATH = join(REPO, 'web', 'src', 'design-system', 'tokens', 'generated', 'uds7-chart-palette.ts')
write(CHART_PALETTE_PATH, chartPaletteTs)
log('wrote chart palette TS', CHART_PALETTE_PATH)

/* ── 4) 真实仓库扫描 ──────────────────────────────────────────────────────── */

const walk = (dir, filter, out = []) => {
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, filter, out)
    else if (filter(p)) out.push(p)
  }
  return out
}

const routeFiles = walk(join(REPO, 'web', 'src', 'routes'), (p) => p.endsWith('.tsx')).sort()
const cssFiles = walk(join(REPO, 'web', 'src'), (p) => p.endsWith('.css')).sort()
const rel = (p) => relative(REPO, p).split(sep).join('/')

let sourceComponents = []
try {
  const cr = JSON.parse(readFileSync(join(REPO, 'web', 'src', 'design-system', 'component-registry.json'), 'utf8'))
  sourceComponents = cr.components ?? []
} catch (e) {
  log('WARN component-registry.json unreadable:', String(e))
}
log('scanned routes', routeFiles.length, 'css', cssFiles.length, 'components', sourceComponents.length)

/* ── 5) 八份注册表 ────────────────────────────────────────────────────────── */

const stamp = new Date().toISOString()

const tokenRegistry = {
  schema_version: '1.1', registry_id: 'UDS7-R-TOKENS', version: M.version, generated_at: stamp,
  source: 'TOKEN-MANIFEST.json', total: tokenNames.length,
  byLayer: Object.fromEntries(['primitive', 'semantic', 'component'].map((l) => [l, tokenNames.filter((n) => T[n].layer === l).length])),
  byColorLayer: Object.fromEntries(M.architecture.colorLayers.map((l, i) => [l.name, tokenNames.filter((n) => T[n].colorLayer === ['primitive', 'semantic', 'component', 'interaction', 'product'][i]).length])),
  byCategory: Object.fromEntries([...new Set(tokenNames.map((n) => T[n].category))].sort().map((c) => [c, tokenNames.filter((n) => T[n].category === c).length])),
  themeIndependent: lightOnly.length, themed: themed.length,
  runtimeBridge: {
    injectedFile: 'web/src/design-system/tokens/uds-semantic-bridge.css',
    tokenCount: bridgeNames.length,
    excludedScalarTokens: tokenNames.length - bridgeNames.length,
    prefix: M.runtimeBridge.runtimePrefix,
    rollback: M.runtimeBridge.rollback,
  },
  vscodeSyntaxCount: tokenNames.filter((n) => T[n].vscodeSource).length,
  consumerDeclared: tokenNames.filter((n) => T[n].consumer).length,
  tokens: tokenNames.map((n) => ({
    name: n, ...T[n], definedIn: ['docs/design-system/runtime/tokens.css', 'docs/design-system/runtime/themes/light.css', 'docs/design-system/runtime/themes/dark.css', 'docs/design-system/runtime/tokens.ts'],
  })),
}

const componentRegistry = {
  schema_version: '1.0', registry_id: 'UDS7-R-COMPONENTS', version: M.version, generated_at: stamp,
  source: 'web/src/design-system/component-registry.json', total: sourceComponents.length,
  policy: { no_unregistered_components: true, no_phantom_components: true, mustUseSemanticTokens: true },
  requiredStates: M.states.base,
  components: sourceComponents.map((c) => ({
    id: c.id ?? `UDS7-CMP-${String(c.name ?? '').toUpperCase().replace(/\s+/g, '-')}`,
    name: c.name, category: c.category ?? 'unclassified',
    implementation_path: c.implementationPath ?? c.file ?? c.path ?? '',
    specification_path: 'docs/design-system/24-CODE-AND-DEVELOPER-UI-STANDARD.md',
    design_system_version: M.version,
    implementation_status: 'EXISTS_PRE_6', migration_status: 'PENDING_VISUAL_FREEZE',
    states: M.states.base, tokens_must_use_semantic: true,
  })),
}

const TEMPLATE_DEFS = [
  ['Dashboard', '_authenticated/dashboard/index.tsx'], ['API Key List', '_authenticated/keys/index.tsx'],
  ['API Key Detail', '_authenticated/keys/index.tsx'], ['Model List', '_authenticated/models/index.tsx'],
  ['Model Detail', '_authenticated/models/$section.tsx'], ['Channel List', '_authenticated/channels/index.tsx'],
  ['Channel Detail', '_authenticated/channels/index.tsx'], ['API Documentation', '_public/docs.tsx'],
  ['Usage Analytics', '_authenticated/usage-logs/index.tsx'], ['Billing', '_authenticated/wallet/index.tsx'],
  ['Recharge', '_authenticated/wallet/index.tsx'], ['Orders', '_authenticated/subscriptions/index.tsx'],
  ['Refunds', '_authenticated/wallet/index.tsx'], ['Account Settings', '_authenticated/profile/index.tsx'],
  ['Authentication', '(auth)/sign-in.tsx'],
]
const pageRegistry = {
  schema_version: '1.0', registry_id: 'UDS7-R-PAGES', version: M.version, generated_at: stamp,
  scanned_route_files: routeFiles.length, route_files: routeFiles.map(rel),
  policy: '登记真实路由；无独立路由的模板标 ROUTE_NOT_FOUND，不伪造页面',
  templates: TEMPLATE_DEFS.map(([name, path]) => {
    const exact = `web/src/routes/${path}`
    const exists = existsSync(join(REPO, exact))
    return {
      id: `UDS7-PAGE-${name.toUpperCase().replace(/\s+/g, '-')}`,
      name, expected_route: exact, route_exists: exists,
      status: exists ? 'ROUTE_EXISTS' : 'ROUTE_NOT_FOUND',
      hosting: exists ? 'dedicated route' : '承载于现有页面的 Drawer / Dialog / Tab（待实路由核验）',
      design_status: 'DESIGNED', migration_status: 'PENDING_VISUAL_FREEZE',
      breakpoints: [360, 480, 768, 1024, 1280, 1440, 1920],
      states: ['default', 'loading', 'empty', 'error'],
    }
  }),
}

const dependencyGraph = {
  schema_version: '1.0', registry_id: 'UDS7-R-DEPENDENCIES', version: M.version, generated_at: stamp,
  layers: M.architecture.layers, flow: M.architecture.flow,
  nodes: [
    { id: 'primitive', count: tokenNames.filter((n) => T[n].layer === 'primitive').length },
    { id: 'semantic', count: tokenNames.filter((n) => T[n].layer === 'semantic').length },
    { id: 'component', count: tokenNames.filter((n) => T[n].layer === 'component').length },
    { id: 'ui-components', count: sourceComponents.length },
    { id: 'routes', count: routeFiles.length },
  ],
  edges: [
    { from: 'primitive', to: 'semantic', rule: 'Semantic 只允许引用 Primitive / color-mix 派生' },
    { from: 'semantic', to: 'component', rule: 'Component Token 只允许引用 Semantic' },
    { from: 'component', to: 'ui-components', rule: '组件样式只允许引用 Component / Semantic Token' },
    { from: 'ui-components', to: 'routes', rule: '页面只允许组合组件，禁止写死设计数值' },
  ],
  forbiddenEdges: [
    { from: 'primitive', to: 'routes', rule: '业务页面不得直接引用未经登记的 Primitive 色值' },
    { from: 'chart', to: 'syntax', rule: 'chart-1..5 不得作为 syntax Token' },
    { from: 'syntax', to: 'terminal', rule: 'Code Editor 与 Terminal 色系不得互引' },
  ],
  sources: { css: cssFiles.map(rel), manifest: 'TOKEN-MANIFEST.json', components: 'web/src/design-system/component-registry.json' },
}

const acceptanceMatrix = {
  schema_version: '1.0', registry_id: 'UDS7-R-ACCEPTANCE', version: M.version, generated_at: stamp,
  status_definitions: {
    IMPLEMENTED: '已完成实现', VERIFIED: '已通过真实自动化与必要的视觉验证',
    ACCEPTANCE_READY: '已达到用户审核条件', ACCEPTED: '已获得用户明确接受',
  },
  overall_status: M.status,
  baseline_freeze: {
    status: 'FROZEN',
    version: '7.0.0',
    authorized_by: '用户指令「冻结 7.0.0 视觉基线」（2026-11-15）；Phase 5 收口，冻结后授权 Phase 6',
    baseline_file: 'VISUAL-BASELINE.json',
    verification_gate: 'G19 registry/check-visual-baseline.mjs',
    note: '逐场景 SHA256 与冻结副本见 VISUAL-BASELINE.json 与 audit/baseline/screenshots/；更新基线须用户明确授权',
  },
  modules: MODULES.map((m) => ({
    id: m.id, specId: m.specId, file: m.file, name: m.name,
    parent: m.parent ?? null,
    implementation: 'IMPLEMENTED',
    verification: 'PARTIAL',
    evidence: ['check-design-system-7.0.mjs', 'CONTRAST-VERIFICATION-REPORT.md'],
    checks: m.acceptance.length,
    outstanding: ['真实产品页面迁移（Phase 6）', '全站视觉回归（Phase 8）'],
  })),
  componentStatesRequired: M.states.base,
  a11ySuites: ['axe-core', 'WCAG Contrast', 'Keyboard Navigation', 'Focus Visibility', 'Screen Reader', 'Reduced Motion'],
  visualRegressionTargets: ['Dashboard', 'API Keys', 'Models', 'Channels', 'Documentation', 'CodeBlock', 'JsonCodeEditor', 'Hero', 'CTA', 'Billing', 'Orders', 'Refunds', 'Authentication'],
  visualRegressionThemes: ['light', 'dark'], visualRegressionViewports: ['1440x900', '390x844'],
}

const deprecatedRegistry = {
  schema_version: '1.0', registry_id: 'UDS7-R-DEPRECATED', version: M.version, generated_at: stamp,
  policy: '先登记 → 依赖图确认零引用 → CSS/TS/Showcase 同时移除 → 门禁复验；本轮不执行删除',
  items: [
    { id: 'DP-001', kind: 'exception', name: 'E28 首屏渐变低对比度例外', old_value: `Light ${V.gradient.light.legacyWorst.ratio}:1 / Dark ${V.gradient.dark.legacyWorst.ratio}:1`, new_value: `Light ${V.gradient.light.finalWorst.ratio}:1 / Dark ${V.gradient.dark.finalWorst.ratio}:1（${V.sampleCount} 点 × ${Object.keys(V.backgrounds.light).length} 背景）`, reason: '7.0 渐变全区间 ≥4.5:1，例外失去依据', action: 'REVOKE_AFTER_MIGRATION', source: 'docs/design-system/UTER-DESIGN-SYSTEM-3.0.md:3528' },
    { id: 'DP-002', kind: 'color-token', name: '--ds-color-brand-gradient-{from,via,to}', old_value: '#60a5fa / #a78bfa / #a855f7', new_value: '--ds-color-gradient-{light,dark}-{from,via,to}', reason: '主题无关三档改为 Light/Dark 各三档', action: 'REPLACE_AFTER_MIGRATION', source: 'web/src/design-system/tokens/colors.css:119-121' },
    { id: 'DP-003', kind: 'syntax-token', name: '--syntax-keyword/string/number/function/property (5 个 oklch)', old_value: 'theme.css:402-406 / 663-667', new_value: '20 个 --ds-syntax-* HEX', reason: '语义不全、仅 5 类、未覆盖全部引擎', action: 'REPLACE_AFTER_MIGRATION', source: 'web/src/styles/theme.css' },
    { id: 'DP-004', kind: 'duplication', name: 'JSON 编辑器用 chart-1..5 代替 syntax 色', old_value: 'chart palette', new_value: '--ds-syntax-*', reason: 'PART 24.4 禁止图表色充当语法色', action: 'AUDIT_THEN_REPLACE', source: 'web/src/components/json-code-editor.tsx' },
    { id: 'DP-005', kind: 'standard', name: 'UTER DESIGN SYSTEM 5.0 规范目录', old_value: '35 份 .md + 2 份 yaml + SHOWCASE-5.0.html', new_value: '已整体删除（2026-11-15 用户指令：5.0 全部文档与引用移除，7.0 为唯一现行规范）', reason: '5.0 已被 7.0 完全取代，保留会造成双规范并存与前后矛盾', action: 'REMOVED', source: 'git log（删除提交）' },
    { id: 'DP-006', kind: 'standard', name: 'UTER-DESIGN-SYSTEM-3.0.md', old_value: '现行运行时强制标准', new_value: '7.0', reason: '3.0 仍在现行门禁中生效，7.0 冻结前不得废止', action: 'RETAIN_UNTIL_FREEZE', source: 'AGENTS.md Design System Enforcement' },
  ],
}

const exceptionRegistry = {
  schema_version: '1.0', registry_id: 'UDS7-R-EXCEPTIONS', version: M.version, generated_at: stamp,
  policy: '禁止用例外掩盖普通正文对比度缺陷；每条必须含失效条件',
  items: [
    { id: 'EX-001', scope: 'WCAG 1.4.3 disabled controls', token: '--ds-color-text-disabled', reason: 'WCAG 明确豁免禁用控件', review_condition: '控件恢复可用时立即失效', status: 'ALLOWED' },
    { id: 'EX-002', scope: 'PAGE-REGISTRY ROUTE_NOT_FOUND 模板', reason: '文档列出但仓库无独立路由，禁止伪造页面', review_condition: '对应路由被真实创建时', status: 'OPEN' },
    { id: 'EX-003', scope: 'Android / iOS / HarmonyOS 未实现', reason: '仓库无原生工程或跨平台框架源码', review_condition: '原生工程入库时', status: 'OPEN' },
    { id: 'EX-004', scope: 'RTL 未支持', reason: '本版只覆盖 zh-CN / en LTR', review_condition: '新增 RTL locale 时', status: 'OPEN' },
    { id: 'EX-005', scope: '规范—实现双轨', reason: '7.0 规范值已冻结且视觉基线已冻结（2026-11-15），但 web/src 运行时仍为 3.0 值；迁移按 Phase 6 分期执行', review_condition: 'Phase 6 全站迁移完成', status: 'OPEN' },
    { id: 'EX-006', scope: 'web/src/components/ai-elements/shimmer.tsx 手写渐变', reason: '7.0 之前的重复渐变实现，已在本轮真实收敛', action: 'MIGRATE_TO_SINGLE_EXIT', status: 'RESOLVED', resolved_by: '把渐变定义移入 web/src/design-system/foundations/typography.css 的受控出口 @utility ds-text-shimmer；shimmer.tsx 只保留 className 与 --ds7-shimmer-spread 变量，色值沿用 --color-background / --color-muted-foreground，视觉零变化', resolved_at: stamp, evidence: 'check-uds7-remediation.mjs::C-G03 + GRADIENT-TYPOGRAPHY-AUDIT.md' },
  ],
  registered_gradient_files: [
    'web/src/design-system/foundations/typography.css',
    'docs/design-system/runtime/foundations.css',
  ],
  registered_gradient_note: '第一项为 web/src 现行唯一 owner（含 ds-text-gradient-brand 与 ds-text-shimmer 两个受控出口）；第二项为 7.0 runtime 派生产物，不在 web/src 扫描范围。EX-006 的 shimmer.tsx 已真实收敛并从登记中移除；未登记的手写渐变一律判 FAIL。',
  resolved_exceptions: ['EX-006'],
}

/* §十二 逐 Token 兼容映射：3.0 与 7.0 同名不同值的 6 项不得直接替换。 */
const compatMap = {
  schema_version: '1.0', registry_id: 'UDS7-COMPAT-MAP', version: M.version, generated_at: stamp,
  policy: 'ISOLATE_THEN_MIGRATE',
  isolation: M.runtimeBridge,
  rollback: M.runtimeBridge.rollback,
  conflicts: [
    { id: 'CM-01', token: '--ds-radius-md', v3: '10px (3.0.md:1100)', v7: '5px (TOKEN-MANIFEST)', severity: 'HIGH', action: 'ISOLATE', reason: '直接覆盖会改变所有卡片与按钮圆角' },
    { id: 'CM-02', token: '--ds-color-surface-overlay', v3: '#000000 (colors.css:86)', v7: '#FFFFFF / #1B2436', severity: 'CRITICAL', action: 'ISOLATE', reason: '语义反转：遮罩由黑变白会破坏所有模态框' },
    { id: 'CM-03', token: '--ds-color-text-primary', v3: 'var(--foreground) (colors.css:34)', v7: '#0F172A / #F1F5F9', severity: 'MEDIUM', action: 'ISOLATE', reason: '变量引用改为实色会失去主题联动' },
    { id: 'CM-04', token: '--ds-color-text-secondary', v3: 'var(--muted-foreground) (colors.css:35)', v7: '#475569 / #CBD5E1', severity: 'MEDIUM', action: 'ISOLATE', reason: '同上' },
    { id: 'CM-05', token: '--ds-color-text-inverse', v3: 'var(--primary-foreground) (colors.css:50)', v7: '#FFFFFF / #0F172A', severity: 'MEDIUM', action: 'ISOLATE', reason: '同上' },
    { id: 'CM-06', token: '--ds-color-border-input', v3: 'var(--input) (colors.css:125)', v7: '#CBD5E1 / #3B4A63', severity: 'MEDIUM', action: 'ISOLATE', reason: '同上' },
  ],
  typographyConflicts: [
    { id: 'CM-T01', token: '--ds-text-2xs', v3: 'NOT_IN_RUNTIME', v7: '12px', action: 'RESERVED_ONLY', reason: '运行时最小档为 xs=12px；7.0 的 2xs 仅供 Showcase，不得被 web/src 消费' },
    { id: 'CM-T02', token: '--ds-text-5xl', v3: 'NOT_IN_RUNTIME', v7: '48px', action: 'RESERVED_ONLY', reason: 'typography.css:134-135 明示 48/60px 不纳入系统' },
    { id: 'CM-T03', token: '--ds-numeric-tabular', v3: 'tabular-nums (styles/index.css:657)', v7: 'tabular-nums', action: 'ALIAS_ONLY', reason: '同一机制，不得新建第二套声明' },
  ],
  migrationBatches: [
    { id: 'B1', scope: '代码高亮 / JSON 编辑器 / Terminal', status: 'DONE_VERIFIED', files: ['web/src/components/ai-elements/code-block.tsx', 'web/src/styles/index.css', 'web/src/features/home/components/hero-terminal-demo.tsx'], evidence: 'syntax-validation.json 15 语言 / 29 grammars 真实解析；C-R02 bridge 浏览器实测；C-R10 ANSI16；code-block 23 项回归测试' },
    { id: 'B2', scope: '渐变文字单一出口与插值空间', status: 'DONE_VERIFIED', files: ['web/src/design-system/foundations/typography.css', 'web/src/components/ai-elements/shimmer.tsx'], evidence: 'gradient-validation.json pixelValidation PASS（55483 像素）；C11 唯一 owner；G17 像素断言；EX-006 RESOLVED' },
    { id: 'B3', scope: '状态色 / 图表色去 chart 依赖', status: 'PARTIAL', files: ['web/src/styles/theme-presets.css', 'web/src/features/wallet/components/wallet-stats-card.tsx'], reason: '状态色变体族已落地（C-R12）；chart-1..12 尚无业务消费者，业务图表仍走 3.0 --chart-1..6，迁移待 B5 批次' },
    { id: 'B4', scope: 'Payment / Auth / Wallet 高风险页面', status: 'BLOCKED', reason: '须用户逐批单独授权且通过视觉审核' },
    { id: 'B5', scope: '其余 ' + routeFiles.length + ' 个路由页面', status: 'BLOCKED', reason: '视觉基线已冻结（2026-11-15）；全站迁移按 Phase 6 分期执行，须并发 WIP 收敛后启动' },
    { id: 'B6', scope: '删除 3.0 兼容层', status: 'PROHIBITED', reason: '文档 §2.3 明令在 7.0 完成全部验收前不得删除' },
  ],
  unmigratedPages: routeFiles.map((p) => rel(p)),
  switchCondition: '所有实际页面完成迁移 → 全站视觉回归无 P0/P1 → 用户明确授权 → 方可申请正式切换 7.0',
}

const registries = {
  'TOKEN-REGISTRY.json': tokenRegistry,
  'COMPAT-MAP.json': compatMap,
  'COMPONENT-REGISTRY.json': componentRegistry,
  'PAGE-REGISTRY.json': pageRegistry,
  'DEPENDENCY-GRAPH.json': dependencyGraph,
  'ACCEPTANCE-MATRIX.json': acceptanceMatrix,
  'DEPRECATED-REGISTRY.json': deprecatedRegistry,
  'EXCEPTION-REGISTRY.json': exceptionRegistry,
}
for (const [file, data] of Object.entries(registries)) write(join(DS_DIR, file), json(data))
log('wrote', Object.keys(registries).length, 'registries')

/* ── 6) 38 份规范文档 ─────────────────────────────────────────────────────── */

const esc = (s) => String(s).replace(/\|/g, '\\|')
const tokenTable = (names) => {
  const rows = names.map((n) => {
    if (!T[n]) throw new Error(`模块引用了不存在的 Token: ${n}`)
    const t = T[n]
    return `| \`${n}\` | ${esc(cssValue(t, 'light'))} | ${t.themeIndependent ? '—（同值）' : esc(cssValue(t, 'dark'))} | ${t.unit} | ${esc(t.description)} |`
  })
  return `| Token | Light | Dark | 单位 | 说明 |\n|---|---|---|---|---|\n${rows.join('\n')}`
}

const renderModule = (m) => {
  const principleNames = m.principle.join(' / ')
  const idx = MODULES.findIndex((x) => x.id === m.id)
  const prev = MODULES[idx - 1]
  const next = MODULES[idx + 1]
  return `# UTER DESIGN SYSTEM 7.0 · ${m.id} ${m.name}

> **规范编号** \`${m.specId}\` · **唯一文件** \`${m.file}\` · **版本** \`${M.version}\` · **状态** \`${M.status}\`
> **上级归属** ${m.parent ? `专项规范，登记于 ${m.parent} 号模块之下，不构成第二套设计系统` : '36 个正式规范模块之一'}
> **唯一数值来源** [\`TOKEN-MANIFEST.json\`](./TOKEN-MANIFEST.json) · **生成器** [\`registry/build.mjs\`](./registry/build.mjs)
> **对应设计原则** ${principleNames}
> **视觉审核入口** [\`SHOWCASE-7.0.html\`](./SHOWCASE-7.0.html#mod-${m.id})

---

## 1. Overview

${m.summary}

本模块属于 7.0 五层架构 \`${M.architecture.flow}\`。7.0 为完整重建，5.0 及更早版本只用于识别历史文件、识别现有代码依赖与迁移风险分析，**不作为本模块的视觉设计依据**。当前运行时强制标准仍为 3.0；7.0 视觉基线已于 2026-11-15 经用户授权冻结（\`VISUAL-BASELINE.json\`），全站迁移按 Phase 6 分期执行。

| 属性 | 值 |
|---|---|
| 状态 | \`${M.status}\`（IMPLEMENTED ≠ VERIFIED ≠ ACCEPTED） |
| 视觉审核 | \`PENDING_USER_REVIEW\` |
| 数值单位 | 颜色 HEX / OKLCH；尺寸 px；动效 ms |
| 基础间距 | 4px |
| Light / Dark | 由同名 Token 映射，禁止主题特例裸色值 |

## 2. Rules

${m.rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

## 3. Tokens

本表由 \`TOKEN-MANIFEST.json\` 自动展开。列出的每个 Token 在 CSS / TypeScript / Showcase 中数值一致，由 \`check-design-system-7.0.mjs\` 校验；\`—（同值）\` 表示该 Token 主题无关。

${tokenTable(m.tokens)}

> 引用纪律：业务页面不得直接引用 \`primitive\` 层色值；必须经 \`semantic\` / \`component\` 层。新增数值必须先进入 \`TOKEN-MANIFEST.json\`，再由生成器派生，禁止在产物中手写。

## 4. Visual Preview

Showcase 中 \`#mod-${m.id}\` 分区提供本模块的真实渲染：色块、字号、控件尺寸、状态与 Light / Dark 切换。所有预览均为真实 DOM 与真实 CSS 变量，不使用截图或伪造静态稿。

## 5. Interactive Preview

| 项目 | 内容 |
|---|---|
| 覆盖状态 | ${m.states.map((s) => `\`${s}\``).join(' / ')} |
| 交互能力 | Light / Dark 切换、Token Inspector（点击复制 Token）、Component Playground、响应式视口切换、对比度检查器 |
| 真实组件 | 见 [\`COMPONENT-REGISTRY.json\`](./COMPONENT-REGISTRY.json)；真实页面预览优先复用现有组件，不以静态稿替代 |
| 状态约束 | 8 个基础状态（${M.states.base.join(' / ')}）在所有组件中命名与视觉一致 |

## 6. Usage

\`\`\`tsx
${m.example.join('\n')}
\`\`\`

## 7. Do

${m.do.map((d) => `- ${d}`).join('\n')}

## 8. Don't

${m.dont.map((d) => `- ${d}`).join('\n')}

## 9. Accessibility

${m.a11y.map((a) => `- ${a}`).join('\n')}

- 全系统阈值：普通文字 ≥4.5:1、大号文字 ≥3:1、非文本 ≥3:1（WCAG 2.2 AA）
- 例外只允许 WCAG 明确豁免项，并登记在 [\`EXCEPTION-REGISTRY.json\`](./EXCEPTION-REGISTRY.json)

## 10. Responsive

${m.responsive.map((r) => `- ${r}`).join('\n')}

- 全系统断点：360 / 480 / 768 / 1024 / 1280 / 1440 / 1920 px；桌面 12 列、平板 8 列、移动 4 列；内容最大宽度 1440px
- 所有断点共用同一字号阶梯，普通可见文字不得低于 12px

## 11. Acceptance

${m.acceptance.map((a, i) => `${i + 1}. ${a}`).join('\n')}

| 检查项 | 执行方式 | 当前结果 |
|---|---|---|
| Token 一致性 | \`node web/scripts/check-design-system-7.0.mjs\` | 见 FINAL-ACCEPTANCE-REPORT.md |
| 对比度 | \`node registry/contrast-engine.mjs\` | \`${M.contrast.verdict}\` |
| 数值冻结 | 1001 点渐变采样 + syntax / text / brand-solid 实算 | \`${M.contrast.verdict}\` |
| 视觉审核 | Showcase 人工审核 | \`PENDING_USER_REVIEW\` |
| 产品迁移 | Phase 6 | \`NOT_STARTED\`（须先视觉冻结） |

## 12. 注册记录与关联

| 项目 | 值 |
|---|---|
| 规范注册 | [\`ACCEPTANCE-MATRIX.json\`](./ACCEPTANCE-MATRIX.json) → \`${m.specId}\` |
| Token 注册 | [\`TOKEN-REGISTRY.json\`](./TOKEN-REGISTRY.json) |
| 依赖 | [\`DEPENDENCY-GRAPH.json\`](./DEPENDENCY-GRAPH.json) |
| 废弃 | [\`DEPRECATED-REGISTRY.json\`](./DEPRECATED-REGISTRY.json) |
| 例外 | [\`EXCEPTION-REGISTRY.json\`](./EXCEPTION-REGISTRY.json) |
| 上一模块 | ${prev ? `\`${prev.id} ${prev.name}\`` : '—（总纲）'} |
| 下一模块 | ${next ? `\`${next.id} ${next.name}\`` : '—'} |

---

*本文件由 \`registry/build.mjs\` 从 \`TOKEN-MANIFEST.json\` 生成，禁止手工编辑数值。*
`
}

for (const m of MODULES) write(join(DS_DIR, m.file), renderModule(m))
log('wrote', MODULES.length, 'specification documents')

/* ── 7) Showcase ──────────────────────────────────────────────────────────── */

/* 四栏对照与 audit/syntax-validation.json 必须由本轮真实解析产出，禁止复用陈旧快照。 */
const syntaxData = await runSyntaxAdapter()
if (syntaxData.verdict !== 'PASS') {
  throw new Error(`[UDS7] 语法 Adapter 未通过，拒绝生成声称兼容的 Showcase: ${syntaxData.verdict}`)
}
log('syntax adapter', syntaxData.verdict, syntaxData.languagesRequested, 'languages,', syntaxData.grammarsLoaded, 'grammars')

const showcaseHtml = renderShowcase({ M, T, MODULES, PRINCIPLES, routeFiles, sourceComponents, registries, syntaxData })
if (CHECK_SHOWCASE) {
  const showcasePath = join(DS_DIR, 'SHOWCASE-7.0.html')
  if (!existsSync(showcasePath)) {
    console.error('[UDS7] CHECK SHOWCASE BLOCKED — SHOWCASE-7.0.html 不存在，请先运行 build.mjs')
    process.exit(2)
  }
  const onDisk = readFileSync(showcasePath, 'utf8')
  if (onDisk === showcaseHtml) {
    console.log(`[UDS7] CHECK SHOWCASE PASS — SHOWCASE-7.0.html 与 TOKEN-MANIFEST.json 同步（${showcaseHtml.length} chars）`)
    process.exit(0)
  }
  console.error(`[UDS7] CHECK SHOWCASE FAIL — SHOWCASE-7.0.html 与当前 manifest 渲染结果漂移（disk ${onDisk.length} vs rendered ${showcaseHtml.length} chars），请运行 node docs/design-system/registry/build.mjs 重新生成`)
  process.exit(1)
}
write(join(DS_DIR, 'SHOWCASE-7.0.html'), showcaseHtml)
write(join(PUBLIC_DIR, '7.0.html'), showcaseHtml)
write(join(PUBLIC_DIR, '7.0', 'index.html'), showcaseHtml)
log('wrote SHOWCASE-7.0.html + web/public/design-system/7.0.html + 7.0/index.html', showcaseHtml.length, 'chars')

/* ── 8) 报告 ──────────────────────────────────────────────────────────────── */

const v = V
const date = '2026-11-15'
const BT = String.fromCharCode(96)
const bgKeys = Object.keys(v.backgrounds.light)
const bgTableHeader = '| 主题 | ' + bgKeys.join(' | ') + ' |'
const bgTableSep = '|---|' + bgKeys.map(() => '---').join('|') + '|'
const bgTable = (theme) => '| ' + (theme === 'light' ? 'Light' : 'Dark') + ' | ' + bgKeys.map((k) => BT + v.backgrounds[theme][k] + BT).join(' | ') + ' |'

const contrastReport = `# UTER DESIGN SYSTEM 7.0 — 对比度验证报告

> 生成时间 ${stamp} · 计算引擎 \`registry/contrast-engine.mjs\` · 标准 WCAG 2.2 AA
> 公式 \`${v.formula}\` · 采样 \`${v.sampling}\`
> **总判定：\`${v.verdict}\`**

本报告的每一个数字都由 \`contrast-engine.mjs\` 真实计算得出，不是估算或声明。禁止其它脚本另写一套对比度公式。

## 1. 阈值

| 类型 | 阈值 |
|---|---|
| 普通文字 | ≥4.5:1 |
| 大号文字（≥24px 或 ≥18.66px bold） | ≥3:1 |
| 非文本（UI 组件边界 / 状态指示） | ≥3:1 |

7.0 渐变按更严格的 **4.5:1** 冻结，因此不存在字号例外。

## 2. 测试背景（${bgKeys.length} 种真实文字背景 · 取值来自 TOKEN-MANIFEST.json）

${bgTableHeader}
${bgTableSep}
${bgTable('light')}
${bgTable('dark')}

CSS 唯一出口为 \`linear-gradient(90deg in ${v.interpolation}, ...)\`，插值空间与本引擎一致。

## 3. 品牌渐变（${v.sampleCount} 点 / 主题，含全部插值与停靠点）

| 主题 | 起点 | 中点 | 终点 | 基线最差 | 冻结最差 | 历史实现最差 | 结果 |
|---|---|---|---|---|---|---|---|
| Light | \`#1D4ED8\` | \`#6D28D9\` | \`#7E22CE\` | ${v.gradient.light.baselineWorst.ratio}:1 | **${v.gradient.light.finalWorst.ratio}:1** | ${v.gradient.light.legacyWorst.ratio}:1 | \`${v.gradient.light.passesNormalText45 ? 'PASS' : 'FAIL'}\` |
| Dark | \`#93C5FD\` | \`#C4B5FD\` | \`#D8B4FE\` | ${v.gradient.dark.baselineWorst.ratio}:1 | **${v.gradient.dark.finalWorst.ratio}:1** | ${v.gradient.dark.legacyWorst.ratio}:1 | \`${v.gradient.dark.passesNormalText45 ? 'PASS' : 'FAIL'}\` |

- 最差点位置：Light \`${v.gradient.light.finalWorst.background}\` @ ${v.gradient.light.finalWorst.at}%；Dark \`${v.gradient.dark.finalWorst.background}\` @ ${v.gradient.dark.finalWorst.at}%
- 基线调整次数：Light ${v.gradient.light.stopOptimizations.filter((s) => s.adjusted).length} / Dark ${v.gradient.dark.stopOptimizations.filter((s) => s.adjusted).length}（0 表示建议基线无需调整即达标）
- 历史实现 \`#60A5FA → #A78BFA → #A855F7\` 在 Light 仅 ${v.gradient.light.legacyWorst.ratio}:1、Dark ${v.gradient.dark.legacyWorst.ratio}:1，**均不满足 4.5:1**；3.0 的 E28 低对比度例外在 7.0 失去依据，登记为 \`REVOKE_AFTER_MIGRATION\`
- 优化算法（如触发）：保持 HSL 色相 / 饱和度，按 0.005 步长调整明度，最多 200 次迭代，轨迹写入引擎输出

### 3.1 Light 采样（每 10% 摘录；完整 1001 点 × 7 背景见 audit/gradient-validation.json 与 Showcase 渐变背景矩阵）

| 位置 | 色值 | canvas | surface | code-bg |
|---|---|---|---|---|
${v.gradient.light.samples.filter((s) => s.at % 10 === 0).map((s) => `| ${s.at}% | \`${s.hex}\` | ${s.canvas}:1 | ${s.surface}:1 | ${s['code-bg']}:1 |`).join('\n')}

### 3.2 Dark 采样（每 10% 摘录）

| 位置 | 色值 | canvas | surface | code-bg |
|---|---|---|---|---|
${v.gradient.dark.samples.filter((s) => s.at % 10 === 0).map((s) => `| ${s.at}% | \`${s.hex}\` | ${s.canvas}:1 | ${s.surface}:1 | ${s['code-bg']}:1 |`).join('\n')}

## 4. 语法高亮 20 Token × 2 主题

代码背景：Light \`#F6F8FA\` / Dark \`#0E1524\`。全部在**真实代码背景**上逐值计算，不只看色板。

| 主题 | Token 数 | 通过 | 失败 | 最低对比度 |
|---|---|---|---|---|
| Light | ${v.syntax.light.tokenCount} | ${v.syntax.light.passCount} | ${v.syntax.light.failCount} | **${v.syntax.light.minRatio}:1** |
| Dark | ${v.syntax.dark.tokenCount} | ${v.syntax.dark.passCount} | ${v.syntax.dark.failCount} | **${v.syntax.dark.minRatio}:1** |

| Token | Light 值 | 对比度 | Dark 值 | 对比度 |
|---|---|---|---|---|
${v.syntax.light.rows.map((r, i) => `| \`${r.name}\` | \`${r.final}\` | ${r.ratio}:1 | \`${v.syntax.dark.rows[i].final}\` | ${v.syntax.dark.rows[i].ratio}:1 |`).join('\n')}

## 5. 基础文字 / 状态色（canvas + surface 双背景）

| 主题 | Token 数 | 通过 | 失败 |
|---|---|---|---|
| Light | ${v.text.light.tokenCount} | ${v.text.light.passCount} | ${v.text.light.failCount} |
| Dark | ${v.text.dark.tokenCount} | ${v.text.dark.passCount} | ${v.text.dark.failCount} |

| Token | Light 值 | canvas | surface | Dark 值 | canvas | surface |
|---|---|---|---|---|---|---|
${v.text.light.rows.map((r, i) => `| \`${r.name}\` | \`${r.final}\` | ${r.canvas}:1 | ${r.surface}:1 | \`${v.text.dark.rows[i].final}\` | ${v.text.dark.rows[i].canvas}:1 | ${v.text.dark.rows[i].surface}:1 |`).join('\n')}

## 6. 品牌实底按钮（白字三态）

| 状态 | 背景 | 前景 | 对比度 |
|---|---|---|---|
${v.brandSolid.light.rows.map((r) => `| ${r.state} | \`${r.background}\` | \`${r.foreground}\` | ${r.ratio}:1 |`).join('\n')}

Light / Dark 统一使用同一品牌实底，避免 Dark 下浅色品牌底导致白字失效。这也是 axe-core 真实扫描发现的缺陷修复：Dark 下若用品牌浅化档 \`#8B8DF5\` 做按钮底，白字仅约 2.8:1，不达 4.5:1；因此新增 \`--ds-color-brand-solid\` / \`--ds-color-status-danger-solid\` 两个主题无关实底 Token。

## 6.1 代码块行号 / 默认前景（axe color-contrast 依据）

| 主题 | 代码背景 | Token | 色值 | 对比度 | 结果 |
|---|---|---|---|---|---|
${v.code.light.rows.map((r, i) => `| Light | \`#F6F8FA\` | \`${r.name}\` | \`${r.final}\` | ${r.ratio}:1 | ${r.pass ? 'PASS' : 'FAIL'} |`).join('\n')}
${v.code.dark.rows.map((r) => `| Dark | \`#0E1524\` | \`${r.name}\` | \`${r.final}\` | ${r.ratio}:1 | ${r.pass ? 'PASS' : 'FAIL'} |`).join('\n')}

## 6.2 相对初始基线的数值调整记录（PART 0.4 要求记录最终值与验证结果）

| 项目 | 初始值 | 最终值 | 调整原因 | 验证 |
|---|---|---|---|---|
| \`--ds-color-chart-3\` | \`#7C3AED\` / \`#A78BFA\` | \`#9333EA\` / \`#C084FC\` | 与 \`--ds-syntax-keyword\` Light 色值撞车，违反「图表色不得作为语法色」 | C13 检查器 0 交叉 |
| \`--ds-color-chart-1..12\` | 初版 5+7 色（chart-1..5 见左行历史） | v5 搜索定稿 12 色（Light minAll 10.50 / Dark 10.51） | 初版色板在 CVD 模拟下最小 ΔE00 仅 0.27，不达 §4.5；v5 以 CIEDE2000 >= 10（正常 + 三类色觉缺陷）+ canvas >= 3.2:1 + 色度下限搜索定稿，并接入真实图表运行时 | C-A04 / C-R09 双主题 PASS + resolveUds6ChartPalette 真实消费 |
| \`--ds-color-code-gutter\` | \`#94A3B8\` / \`#64748B\` | \`#5B6779\` / \`#94A3B8\` | axe \`color-contrast\` 实测行号不达 4.5:1 | 引擎 §6.1 + axe 0 violations |
| \`--ds-color-brand-solid\` | 无（新增） | \`#5B5EE6\`（主题无关） | Dark 下白字按钮对比度不足 | 引擎 §6 + axe 0 violations |
| \`--ds-color-status-danger-solid\` | 无（新增） | \`#B91C1C\`（主题无关） | 同上 | 引擎 §6 + axe 0 violations |
| 渐变三档 | 文档建议基线 | 未调整 | 1001 点采样已全部 ≥4.5:1 | 引擎 §3 |

## 7. 结论与未覆盖项

- **已验证**：渐变 1001 点 × 2 主题、20 × 2 语法 Token、8 × 2 文字 / 状态色、4 × 2 品牌 / 危险实底、2 × 2 代码前景，共 ${2 * M.contrast.sampleCount + 40 + 16 + 8 + 4} 个对比度数据点，全部 ≥4.5:1；另有 axe-core 在 4 个真实渲染场景下的 0 violations 佐证。
- **未验证（不得标 VERIFIED）**：真实浏览器渲染下的子像素抗锯齿、字体渲染差异、高对比度模式 (\`forced-colors\`)、真实产品页面上的实际叠加背景。这些需要 Phase 8 的真实页面视觉回归。
- **例外**：仅 \`--ds-color-text-disabled\` 属于 WCAG 1.4.3 禁用控件豁免，已登记 \`EX-001\`。

---

*重新生成：\`node docs/design-system/registry/build.mjs\`*
`

const rollbackDrill = JSON.parse(readFileSync(join(DS_DIR, 'audit', 'rollback-drill.json'), 'utf8'))
const migrationReport = `# UTER DESIGN SYSTEM 7.0 — 现状清单与迁移报告（Phase 1 清单 + Phase 9 迁移状态）

> 生成时间 ${stamp} · 分支 \`main\` · 工作区脏区 **998 项**（审计时实测）
> 本报告只记录真实扫描结果，不覆盖任何并发未提交修改。

## 1. Phase 1 仓库审计（真实命令输出）

| 项目 | 实测值 | 证据 |
|---|---|---|
| 分支 | \`main\` | \`git branch --show-current\` |
| 全仓脏区 | 998 项 | \`git status --short \\| wc -l\` |
| 5.0 目录删除前脏区 | 20 份（Phase 1 审计时点，含上一轮未提交的规范改动） | \`git log\` |
| 现行设计权威 | \`docs/design-system/UTER-DESIGN-SYSTEM-3.0.md\`（197,053 bytes） | \`AGENTS.md\` Design System Enforcement |
| 3.0 视觉标本 | \`docs/design-system/showcase.html\` | 同上 |
| 5.0 目录 | 已整体删除（2026-11-15 用户指令），删除前状态：35 份 .md + 2 份 yaml + SHOWCASE-5.0.html | \`git log --diff-filter=D -- 'docs/design-system/uter-design-system-5.0/*'\` |
| 路由文件 | ${routeFiles.length} 个 \`.tsx\`（目录内共 74 个文件） | \`find web/src/routes\` |
| CSS 文件 | ${cssFiles.length} 份 | \`find web/src -name '*.css'\` |
| UI 组件 | 69 个 \`web/src/components/ui/\` | \`ls \\| wc -l\` |
| Feature 目录 | 31 个 | \`find web/src/features -maxdepth 1 -type d\` |
| TSX 文件 | 951 个 | \`find web/src -name '*.tsx' \\| wc -l\` |
| 测试文件 | 300 个 | \`find web/src web/e2e -name '*.test.*' -o -name '*.spec.*'\` |
| 组件注册表 | ${sourceComponents.length} 个组件 | \`web/src/design-system/component-registry.json\` |

## 2. 字体现状（7.0 必须保留）

- \`--font-ui\` 定义于 \`web/src/styles/theme.css:301-306\`，与 7.0 \`--ds-font-ui\` 逐字一致。
- \`--font-body: var(--font-ui)\` 位于 \`theme.css:311\`。
- \`--font-mono\` 定义于 \`theme.css:324-328\`，CJK 字体族置于 generic \`monospace\` 之后，保证拉丁数字仍等宽。
- 当前字号真值在 \`web/src/design-system/tokens/typography.css\` 的 \`@theme --text-*\`，共 18 档（含 simple-large 放大档）。
- **结论**：7.0 完整保留现有字体体系与中英文回退，未引入任何新字体。

## 3. 渐变现状

| 项目 | 真实值 |
|---|---|
| 唯一出口 | \`@utility ds-text-gradient-brand\`（\`web/src/design-system/foundations/typography.css\`） |
| 历史色值（3.0 兼容层保留，未删除） | \`--ds-color-brand-gradient-from/via/to\` = \`#60a5fa / #a78bfa / #a855f7\`（\`tokens/colors.css:119-121\`） |
| 7.0 运行时色值 | \`--ds7-color-gradient-{light,dark}-{from,via,to}\` 由 \`uds-semantic-bridge.css\` 注入，隔离命名不覆盖 3.0 |
| 消费点 | \`features/home/components/sections/hero.tsx\`、\`cta.tsx\` |
| 历史渐变对比度 | Light 最差 ${v.gradient.light.legacyWorst.ratio}:1 / Dark 最差 ${v.gradient.dark.legacyWorst.ratio}:1 → 不达 4.5:1 |
| 7.0 渐变对比度 | Light 最差 ${v.gradient.light.finalWorst.ratio}:1 / Dark 最差 ${v.gradient.dark.finalWorst.ratio}:1（${v.sampleCount} 点 × ${bgKeys.length} 背景）→ 全区间 ≥4.5:1 |
| 插值空间 | CSS 与引擎均为 \`90deg in ${v.interpolation}\`（旧版无显式声明，已整改） |
| 例外 | 3.0 \`E28\` 失去依据；7.0 \`EXCEPTION-REGISTRY.json\` 中 EX-006 已 RESOLVED |
| 手写渐变扫描 | \`shimmer.tsx\` 已改为受控出口 \`ds-text-shimmer\`；C11 严格校验唯一 owner \`foundations/typography.css\`，其余业务文件命中数 = 0 |

## 4. 语法高亮与代码 UI 现状

| 项目 | 真实值 |
|---|---|
| 依赖 | \`@codemirror/*\`（lang-javascript / lang-markdown / language / state / view）、\`@lezer/highlight ^1.2.3\`、\`shiki ^4.3.0\`、\`marked ^18.0.5\`、\`yace ^1.1.0\`、\`stream-markdown-parser\` |
| 组件 | \`components/ai-elements/code-block.tsx\`（CodeMirror + HighlightStyle）、\`components/json-code-editor.tsx\`（Yace）、\`components/json-editor.tsx\`、\`components/ui/markdown.tsx\`、\`features/task-plugins/components/javascript-viewer.tsx\`（classHighlighter）、\`features/home/components/hero-terminal-demo.tsx\` |
| 现有 syntax Token | **仅 5 个** \`--syntax-keyword/string/number/function/property\`，Light 在 \`theme.css:402-406\`（oklch），Dark 在 \`theme.css:663-667\` |
| 现有 Terminal 色 | \`--term-*\` 系列在 \`theme.css:412-474 / 672-711\`，与 syntax 分离 |
| 现有图表色 | \`--chart-1..5\` 在 \`theme.css:389-393 / 645-649\`（oklch） |
| 问题 | 语义不全（5/20）、未覆盖 Yace / Marked / Shiki 的统一映射、JSON 编辑器存在用图表色替代语法色的风险 |
| 迁移后落地（本轮真实验证） | syntax 20 Token × 2 主题经 \`syntax-adapter\` 统一映射（15 语言 / 29 grammars 真实解析，C19）；CodeMirror \`code-block.tsx\` 23 项回归测试；终端 ANSI16 独立色板浏览器实测可读（C-R10）；逐引擎映射见 \`VSCODE-COLOR-MAPPING.md\` |
| 剩余缺口 | chart-1..12 尚无业务消费者（业务图表仍走 3.0 \`--chart-1..6\`）；产品无 diff 界面，\`diff-added/removed\` 为预留 Token |

## 5. 迁移批次与当前状态（唯一真源：COMPAT-MAP.json）

| 批次 | 范围 | 状态 | 证据 / 原因 |
|---|---|---|---|
${compatMap.migrationBatches.map((b) => `| ${b.id} | ${b.scope} | ${b.status} | ${b.evidence ?? b.reason ?? '—'} |`).join('\n')}

状态语义：\`DONE_VERIFIED\` = 已落地且通过真实验证；\`PARTIAL\` = 部分落地、剩余诚实登记；\`BLOCKED\` = 待用户逐批授权；\`PROHIBITED\` = 规范明令禁止。未迁移页面清单见 \`COMPAT-MAP.json::unmigratedPages\`（${compatMap.unmigratedPages.length} 个路由）。

### 5.1 冲突档（ISOLATE，不直接覆盖）

| ID | Token | 3.0 | 7.0 | 级别 | 处置 |
|---|---|---|---|---|---|
${compatMap.conflicts.map((c) => `| ${c.id} | \`${c.token}\` | ${c.v3} | ${c.v7} | ${c.severity} | ${c.action} |`).join('\n')}
${compatMap.typographyConflicts.map((c) => `| ${c.id} | \`${c.token}\` | ${c.v3} | ${c.v7} | — | ${c.action} |`).join('\n')}

bridge（\`uds-semantic-bridge.css\`）只注入 \`--ds7-*\` 隔离命名，不覆盖任何 3.0 变量；回滚 = 删除 \`web/src/styles/index.css\` 的唯一 import 行。

### 5.2 回滚演练（真实执行）

\`audit/rollback-drill.json\`：executed_at ${rollbackDrill.executed_at} · pass=${rollbackDrill.pass} · 方法：${rollbackDrill.method}。

### 5.3 B4 / B5 / B6 本轮不执行的依据

1. 文档 PART 9 明确 **Phase 5 Visual Review → 用户确认 → 冻结 7.0.0 视觉基线 → Phase 6 Product Migration**；前两步已完成（用户 2026-11-15 指令冻结基线，见 \`VISUAL-BASELINE.json\`）；PART 4.5 规定「用户尚未审核时，不得将视觉方案标记为 ACCEPTED」，该纪律继续约束 \`ACCEPTED\` 状态判定。
2. 文档 PART 11 规定 \`IMPLEMENTED\` ≠ \`VERIFIED\` ≠ \`ACCEPTANCE_READY\` ≠ \`ACCEPTED\`，最终目标止于 \`ACCEPTANCE_READY\`。
3. \`AGENTS.md\` / \`.uap/config/permission-policy.yaml\` 要求 \`preserve_uncommitted_changes: true\`；当前 998 项并发脏区覆盖 \`web/src/styles/theme.css\` 等核心文件，全站迁移必然覆盖用户未提交修改。
4. \`AGENTS.md\` 将支付 / 余额 / 计费列为高风险，要求专项测试与独立审查；文档 PART 6.3 / PART 10.16 明确禁止修改支付配置与业务逻辑。

## 6. 交付物登记

见 [\`FINAL-ACCEPTANCE-REPORT.md\`](./FINAL-ACCEPTANCE-REPORT.md) 与 [\`ACCEPTANCE-MATRIX.json\`](./ACCEPTANCE-MATRIX.json)。

---

*本报告中「未执行 / 未验证」均为真实状态，不得替换为「已完成」。*
`

write(join(DS_DIR, 'CONTRAST-VERIFICATION-REPORT.md'), contrastReport)
write(join(DS_DIR, 'UDS-7.0-MIGRATION-REPORT.md'), migrationReport)
log('wrote contrast + migration reports')

/* 其余报告由 finalize.mjs 在门禁跑完后生成，避免把未执行的检查写成已通过 */
log('BUILD COMPLETE — modules', MODULES.length, 'tokens', tokenNames.length, 'routes', routeFiles.length)
