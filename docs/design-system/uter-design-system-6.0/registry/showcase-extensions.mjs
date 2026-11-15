/*
 * Copyright (C) 2026 Uter.ai
 * SPDX-License-Identifier: UNLICENSED
 *
 * UTER DESIGN SYSTEM 6.0 — Showcase 扩展区块（P0 整改 §7 / §8 / §9）
 *
 * 本模块只做「从 TOKEN-MANIFEST.json + 真实验证结果 → HTML」的派生，
 * 不另立任何色值 / 字号 / 规范数值。所有 HEX 均来自 manifest 或验证引擎。
 *
 * 新增区块：
 *   #architecture      五层颜色架构 + 22 组件 + 12 业务上下文 + 10 页面模板
 *   #vscode            VS Code Light+ / Uter Light / VS Code Dark+ / Uter Dark 四栏对照
 *   #terminal          Terminal Light / Dark 独立色板 + ANSI16
 *   #charts            12 色图表 + 线型 / 点型 / 图例 / 直接标注
 *   #gradient-matrix   1001 点 × 7 背景矩阵（Light / Dark）
 *   #runtime-evidence  运行时实测标记与机器可读报告索引
 */

import { VSCODE_SYNTAX, VSCODE_EDITOR_BG, UTER_CODE_BG } from './vscode-theme.mjs'
import { BACKGROUNDS, GRADIENT_INTERPOLATION, GRADIENT_SAMPLE_COUNT } from './contrast-engine.mjs'
import { renderVscodeComparison } from './syntax-adapter.mjs'

const esc = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

/** #RRGGBB / #RGB / #RRGGBBAA → "rgb(r, g, b)"；非 HEX 返回 null。 */
export function hexToRgb(value) {
  const s = String(value ?? '').trim()
  const m = /^#([0-9a-f]{3,8})$/i.exec(s)
  if (!m) return null
  let h = m[1]
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('')
  if (h.length !== 6 && h.length !== 8) return null
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgb(${r}, ${g}, ${b})`
}

/** 色值单元格：HEX + RGB + 色块，三态齐全。 */
export function colorCell(value) {
  const v = String(value ?? '').trim()
  const rgb = hexToRgb(v)
  const chip = /^#([0-9a-f]{3,8})$/i.test(v) ? `<span class="x-chip" style="background:${esc(v)}"></span>` : ''
  return `<span class="x-color"><code>${esc(v)}</code>${rgb ? `<small>${esc(rgb)}</small>` : ''}${chip}</span>`
}

/** 从真实对比度引擎结果中收集「已被实算」的 Token 名。 */
export function measuredTokenSet(v) {
  const set = new Set()
  for (const theme of ['light', 'dark']) {
    for (const r of v.syntax?.[theme]?.rows ?? []) set.add('--ds-' + r.name)
    for (const r of v.text?.[theme]?.rows ?? []) if (r.name) set.add('--ds-' + r.name)
    for (const r of v.code?.[theme]?.rows ?? []) if (r.name) set.add('--ds-' + r.name)
  }
  for (const n of Object.keys(v.frozen?.['syntax-light'] ?? {})) set.add('--ds-' + n)
  for (const n of Object.keys(v.frozen?.['text-light'] ?? {})) set.add('--ds-' + n)
  return set
}

/* ── 扩展区块 CSS（全部使用 x- 前缀，避免与既有类名冲突） ────────────────── */
export const EXTENSION_CSS = `
/* UDS6 Showcase Extensions */
:root { --x-line: var(--page-border); --x-muted: var(--page-fg); }
.x-chip{display:inline-block;width:14px;height:14px;border-radius:3px;border:1px solid var(--x-line);vertical-align:middle;margin-left:5px;flex:none}
.x-color{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}
.x-color small{color:var(--page-muted);font-family:var(--ds-font-mono);font-size:11px}
.x-muted{color:var(--page-muted)}
.x-mono{font-family:var(--ds-font-mono);font-variant-numeric:tabular-nums}
.x-badge{display:inline-block;padding:1px 6px;border-radius:var(--ds-radius-xs,4px);border:1px solid var(--x-line);font-size:11px;font-family:var(--ds-font-mono);white-space:nowrap}
.x-badge.measured{border-color:var(--ds-color-status-success-border,#16A34A);color:var(--ds-color-status-success,#16A34A)}
.x-badge.declared{color:var(--page-muted)}
/* 小字不得靠 opacity 压低对比度；WCAG 2.2 AA 下 10px 文字同样要 ≥4.5:1 */
.token-table td small,.x-evidence small{display:block;margin-top:3px;font-size:10px;line-height:1.5;color:var(--page-muted);word-break:break-word}
.x-scroll{overflow-x:auto;max-width:100%}
.x-hint{font-size:12px;line-height:1.6;color:var(--page-muted);margin:8px 0 0}

/* 五层架构 */
.x-layer-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-top:10px}
.x-layer{position:relative;border:1px solid var(--x-line);border-radius:10px;padding:12px;background:var(--page-surface)}
.x-layer::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;border-radius:10px 0 0 10px;background:var(--layer-accent,var(--ds-color-brand-1))}
.x-layer-id{font:600 11px/1.4 var(--ds-font-mono);letter-spacing:.04em;color:var(--ds-color-brand-1)}
.x-layer h4{margin:4px 0 6px;font-size:15px;font-weight:600}
.x-layer p{margin:0;font-size:12px;line-height:1.6;color:var(--x-muted);opacity:.85}
.x-layer-count{margin-top:8px;font:500 11px/1.4 var(--ds-font-mono)}

/* VS Code 四栏对照（cc-* 为 syntax-adapter.mjs 的真实输出类名） */
.cc-grid,.x-cc-grid{display:grid;grid-template-columns:repeat(4,minmax(240px,1fr));gap:8px}
.cc-col,.x-cc-col{min-width:0}
.cc-cap,.x-cc-cap{display:block;font:500 11px/1.5 var(--ds-font-mono);padding:4px 6px;border:1px solid var(--x-line);border-bottom:0;border-radius:6px 6px 0 0;background:var(--page-surface)}
.cc-pane,.x-cc-pane{font:12px/1.65 var(--ds-font-mono);padding:8px 4px;border:1px solid var(--x-line);border-radius:0 0 6px 6px;overflow-x:auto;white-space:pre;min-height:76px}
.cc-line,.x-cc-line{display:flex}
.cc-gutter,.x-cc-gutter{flex:none;width:30px;padding-right:8px;text-align:right;user-select:none;font-size:11px}
.cc-text,.x-cc-text{flex:1;min-width:0}
.x-cc-note{margin-top:8px;font-size:12px;line-height:1.7;color:var(--page-muted)}
/* 行号在 4 种真实背景上均需 ≥4.5:1；不得用 opacity 降低 */
.cc-pane[data-pane="vscode-light"] .cc-gutter{color:#595959}
.cc-pane[data-pane="uter-light"] .cc-gutter{color:#475569}
.cc-pane[data-pane="vscode-dark"] .cc-gutter{color:#9CA3AF}
.cc-pane[data-pane="uter-dark"] .cc-gutter{color:#94A3B8}
.cc-pane[data-pane="vscode-light"]{color:#000000}
.cc-pane[data-pane="vscode-dark"]{color:#D4D4D4}
.cc-pane[data-pane="uter-light"]{color:var(--ds-color-terminal-foreground,var(--ds-color-text-primary))}
.cc-pane[data-pane="uter-dark"]{color:var(--ds-color-terminal-foreground,var(--ds-color-text-primary))}

/* Terminal / ANSI16 */
.x-term-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin-top:10px}
.x-term-pane{border:1px solid var(--x-line);border-radius:8px;overflow:hidden}
.x-term-head{display:flex;gap:5px;align-items:center;padding:6px 10px;background:var(--page-surface);border-bottom:1px solid var(--x-line);font:500 11px/1.4 var(--ds-font-mono)}
.x-term-dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.x-term-body{font:12px/1.75 var(--ds-font-mono);padding:10px 12px;white-space:pre-wrap;word-break:break-word;overflow-x:auto}
/* 同一屏同时显示 Light / Dark 终端，文字必须继承各自 pane 的前景，不能跟随文档主题 */
.x-term-body .x-muted{color:inherit}
.x-ansi-grid{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:4px;margin-top:10px}
.x-ansi-cell{border:1px solid var(--x-line);border-radius:5px;padding:5px 4px;text-align:center;min-width:0;background:var(--page-surface)}
.x-ansi-cell b{display:block;width:100%;height:20px;border-radius:3px;margin-bottom:4px}
.x-ansi-cell span{display:block;font:10px/1.35 var(--ds-font-mono);overflow:hidden;text-overflow:ellipsis}

/* 12 色图表 */
.x-chart-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(178px,1fr));gap:8px;margin-top:10px}
.x-chart-cell{border:1px solid var(--x-line);border-radius:8px;padding:9px;background:var(--page-surface);min-width:0}
.x-chart-swatch{height:26px;border-radius:4px;margin-bottom:7px}
.x-chart-cell h5{margin:0 0 4px;font:600 12px/1.4 var(--ds-font-mono)}
.x-chart-cell small{display:block;font:10px/1.5 var(--ds-font-mono);opacity:.8;word-break:break-all}
.x-line-style{height:0;border-top:3px solid var(--ds-color-chart-1);margin:8px 0 4px;width:100%}
.x-line-style.dashed{border-top-style:dashed}
.x-line-style.dotted{border-top-style:dotted}
.x-marker-row{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:10px;font:11px/1.6 var(--ds-font-mono)}
.x-marker{display:inline-block;width:12px;height:12px;background:var(--ds-color-chart-2);margin-right:5px;vertical-align:-2px}
.x-marker.circle{border-radius:50%}
.x-marker.square{}
.x-marker.triangle{clip-path:polygon(50% 0,100% 100%,0 100%)}
.x-marker.diamond{transform:rotate(45deg);width:10px;height:10px}
.x-marker.cross{clip-path:polygon(40% 0,60% 0,60% 40%,100% 40%,100% 60%,60% 60%,60% 100%,40% 100%,40% 60%,0 60%,0 40%,40% 40%)}
.x-marker.star{clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)}

/* 渐变背景矩阵 */
.x-matrix td,.x-matrix th{white-space:nowrap}
.x-matrix .x-worst{font-weight:600}
.x-evidence-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin-top:10px}
.x-evidence{border:1px solid var(--x-line);border-radius:8px;padding:11px;background:var(--page-surface)}
.x-evidence h4{margin:0 0 6px;font-size:13px;font-weight:600}
.x-evidence p{margin:0;font-size:12px;line-height:1.65;color:var(--x-muted);opacity:.85}
.x-evidence code{font-size:11px;word-break:break-all}
[data-viewport="mobile"] .cc-grid,[data-viewport="mobile"] .x-cc-grid{grid-template-columns:repeat(2,minmax(180px,1fr))}
[data-viewport="tablet"] .cc-grid,[data-viewport="tablet"] .x-cc-grid{grid-template-columns:repeat(2,minmax(220px,1fr))}
`

export const EXTENSION_NAV = [
  ['#architecture', '五层颜色架构'],
  ['#vscode', 'VS Code 四栏对照'],
  ['#terminal', 'Terminal / ANSI16'],
  ['#charts', '12 色图表 / 非颜色通道'],
  ['#gradient-matrix', '渐变 7 背景矩阵'],
  ['#runtime-evidence', '运行时实测标记'],
]

/* ── 1) 五层颜色架构 ─────────────────────────────────────────────────────── */
function renderArchitecture(M, T) {
  const layers = M.architecture?.colorLayers ?? []
  const accent = ['--ds-color-chart-1', '--ds-color-chart-2', '--ds-color-chart-3', '--ds-color-chart-4', '--ds-color-chart-5']
  const layerCounts = [
    Object.values(T).filter((t) => t.layer === 'primitive').length,
    Object.values(T).filter((t) => t.layer === 'semantic').length,
    Object.values(T).filter((t) => t.colorLayer === 'component').length,
    Object.values(T).filter((t) => t.colorLayer === 'interaction').length,
    Object.values(T).filter((t) => t.colorLayer === 'product-context').length,
  ]
  const layerCards = layers.map((l, i) => `<div class="x-layer" style="--layer-accent:var(${esc(accent[i] ?? accent[0])})">
    <span class="x-layer-id">${esc(l.id)}</span><h4>${esc(l.name)}</h4><p>${esc(l.description)}</p>
    <div class="x-layer-count">${layerCounts[i] ?? 0} tokens</div></div>`).join('\n')

  const specs = M.architecture?.componentSpecs ?? []
  const specRows = specs.map((s) => `<tr data-runtime-token="${esc(s.surfaceToken)}"><td><code>${esc(s.id)}</code></td><td>${esc(s.name)}</td><td><code>${esc(s.surfaceToken)}</code></td><td><code>${esc(s.foregroundToken)}</code></td><td>${s.interactionStates.length} 态</td><td>${s.keyboardAccessible ? '✓' : '—'}</td></tr>`).join('\n')

  const contexts = M.architecture?.productContexts ?? []
  const contextRows = contexts.map((c) => `<tr data-runtime-token="${esc(c.token)}"><td><code>${esc(c.key)}</code></td><td>${esc(c.name)}</td><td>${esc(c.usage)}</td><td><code>${esc(c.token)}</code></td><td>${esc(c.rule)}</td></tr>`).join('\n')

  const templates = (M.architecture?.pageTemplates ?? []).map((p) => `<span class="x-badge">${esc(p)}</span>`).join(' ')

  return `<section class="panel" id="architecture">
  <h2>五层颜色架构（L1 Primitive → L5 Product Context）</h2>
  <p class="panel-sub">唯一结构化定义 <code>registry/color-architecture.mjs</code> → <code>TOKEN-MANIFEST.json → architecture</code>。业务组件不得直接依赖 L1 基础色值；每个 Token 均登记 <code>colorLayer</code> / <code>semanticMeaning</code> / <code>consumer</code>。</p>
  <div class="x-layer-grid">${layerCards}</div>
  <h3 style="font-size:var(--ds-text-sm);margin:var(--ds-space-5) 0 8px">组件颜色出口（${specs.length} 类 · L3）</h3>
  <div class="table-wrap x-scroll" tabindex="0" role="region" aria-label="组件颜色出口表"><table><thead><tr><th>ID</th><th>组件</th><th>Surface</th><th>Foreground</th><th>交互态</th><th>键盘可达</th></tr></thead><tbody>${specRows}</tbody></table></div>
  <h3 style="font-size:var(--ds-text-sm);margin:var(--ds-space-5) 0 8px">业务状态色（${contexts.length} 类 · L5 · 禁止用 chart 色替代）</h3>
  <div class="table-wrap x-scroll" tabindex="0" role="region" aria-label="业务状态色表"><table><thead><tr><th>Key</th><th>语义</th><th>使用场景</th><th>Runtime Token</th><th>规则</th></tr></thead><tbody>${contextRows}</tbody></table></div>
  <h3 style="font-size:var(--ds-text-sm);margin:var(--ds-space-5) 0 8px">页面模板清单（${(M.architecture?.pageTemplates ?? []).length} 类）</h3>
  <div style="display:flex;gap:6px;flex-wrap:wrap">${templates}</div>
  <p class="x-hint">流转：${esc(M.architecture?.colorLayerFlow ?? M.architecture?.flow ?? 'L1 → L2 → L3 → L4 → L5')}。规则：${esc(M.architecture?.rule ?? '')}</p>
</section>`
}

/* ── 2) VS Code 四栏对照 ─────────────────────────────────────────────────── */
function renderVscode(M, syntaxData) {
  const rows = VSCODE_SYNTAX.rows
  const comparison = syntaxData ? renderVscodeComparison(syntaxData, 6) : '<p class="x-hint">语法解析数据不可用（BLOCKED，未伪造对照）。</p>'
  const mapRows = rows.map((r) => `<tr data-runtime-token="--ds6-syntax-${esc(r.key)}">
    <td><code>${esc(r.key)}</code></td><td><code>${esc(r.scope)}</code></td>
    <td>${colorCell(r.officialLight)}</td><td>${colorCell(r.officialDark)}</td>
    <td>${colorCell(r.adopted.light)}</td><td>${colorCell(r.adopted.dark)}</td>
    <td><code>--ds6-syntax-${esc(r.key)}</code></td>
    <td>${r.adjustment?.light?.adjusted || r.adjustment?.dark?.adjusted ? '<span class="x-badge">WCAG 有限调整</span>' : '<span class="x-badge measured">官方原值</span>'}</td></tr>`).join('\n')

  const adjusted = rows.filter((r) => r.adjustment?.light?.adjusted || r.adjustment?.dark?.adjusted)
  const diffCount = M.vscodeTheme?.baselineDifferenceCount ?? 0
  const rawSource = M.vscodeTheme?.source ?? 'github.com/microsoft/vscode'
  const sourceText = typeof rawSource === 'string' ? rawSource : (rawSource.repository ?? 'github.com/microsoft/vscode')

  return `<section class="panel" id="vscode">
  <h2>VS Code Light+ / Uter Light / VS Code Dark+ / Uter Dark · 四栏对照</h2>
  <p class="panel-sub">官方主题源码 <code>extensions/theme-defaults/themes/{light_vs,light_plus,dark_vs,dark_plus}.json</code> + <code>package.json</code>，固化证据与 SHA256 见 <code>audit/vscode/SOURCE-METADATA.json</code>。20 个语义 Token 的官方 scope 与色值由 <code>registry/vscode-theme.mjs</code> 从 JSONC 真实提取，不凭图片或自选颜色声称兼容。</p>
  <div class="grid2">
    <div class="x-evidence"><h4>官方编辑器基底</h4><p>Light 背景 ${esc(VSCODE_EDITOR_BG.light)} / 前景 ${esc(M.vscodeTheme?.editor?.light?.foreground ?? '#000000')}<br>Dark 背景 ${esc(VSCODE_EDITOR_BG.dark)} / 前景 ${esc(M.vscodeTheme?.editor?.dark?.foreground ?? '#D4D4D4')}</p></div>
    <div class="x-evidence"><h4>Uter 代码块基底（独立 Terminal 色系）</h4><p>Light ${esc(UTER_CODE_BG.light)} / Dark ${esc(UTER_CODE_BG.dark)}<br>与 VS Code 编辑器背景不同，语法色在 Uter 背景上重新实算 WCAG 2.2 AA。</p></div>
  </div>
  <h3 style="font-size:var(--ds-text-sm);margin:var(--ds-space-5) 0 8px">真实 Shiki TextMate grammar 解析结果 · 前 6 种语言四栏对照</h3>
  ${comparison}
  <p class="x-cc-note">四栏使用不同基底：VS Code 栏取官方 light_vs / dark_vs 背景与官方 tokenColor；Uter 栏取 Uter 代码块背景与 <code>--ds6-syntax-*</code>（由 <code>uds-semantic-bridge.css</code> 注入，Showcase 内按 pane 作用域展开为 manifest 定值，保证 Light/Dark 同屏可比）。<code>data-variant</code> / <code>data-syntax</code> 可供自动化像素比对定位。</p>
  <h3 style="font-size:var(--ds-text-sm);margin:var(--ds-space-5) 0 8px">20 个语义 Token · 官方 scope → Uter 采用值（含 HEX / RGB）</h3>
  <div class="table-wrap x-scroll" tabindex="0" role="region" aria-label="VS Code 到 Uter 语法色映射表"><table><thead><tr><th>语义 Token</th><th>官方 TextMate Scope</th><th>VS Code Light+</th><th>VS Code Dark+</th><th>Uter Light</th><th>Uter Dark</th><th>Runtime Token</th><th>取值说明</th></tr></thead><tbody>${mapRows}</tbody></table></div>
  <p class="note">文档候选基线与官方源码存在 ${diffCount} 处主题取值差异，一律以官方源码为准；其中 ${adjusted.length} 个官方色在 Uter 代码块背景上低于 4.5:1，做有限明度调整并逐项记录，见 <code>VSCODE-COLOR-MAPPING.md</code> 与 <code>audit/syntax-validation.json</code>。源码仓库：<span class="x-mono">${esc(sourceText)}</span>。</p>
</section>`
}

/* ── 3) Terminal / ANSI16 ────────────────────────────────────────────────── */
function renderTerminal(M, T) {
  const ansi = Array.from({ length: 16 }, (_, i) => `--ds-color-terminal-ansi-${i}`)
  const ansiGrid = (theme) => ansi.map((n) => {
    const t = T[n]
    const hex = t ? t[theme] : '—'
    return `<div class="x-ansi-cell" data-runtime-token="${esc(t?.runtimeName ?? n)}"><b style="background:${esc(hex)}"></b><span>${esc(hex)}</span><span class="x-muted">${esc(hexToRgb(hex) ?? '—')}</span></div>`
  }).join('\n')

  const termPane = (theme) => {
    const bg = T['--ds-color-terminal-background']?.[theme] ?? BACKGROUNDS[theme]['code-bg']
    const fg = T['--ds-color-terminal-foreground']?.[theme] ?? '#000000'
    const prompt = T['--ds-color-terminal-prompt']?.[theme] ?? fg
    const command = T['--ds-color-terminal-command']?.[theme] ?? fg
    const flag = T['--ds-color-terminal-flag']?.[theme] ?? fg
    const property = T['--ds-color-terminal-property']?.[theme] ?? fg
    const str = T['--ds-color-terminal-string']?.[theme] ?? fg
    const num = T['--ds-color-terminal-number']?.[theme] ?? fg
    return `<div class="x-term-pane" data-terminal-theme="${theme}">
      <div class="x-term-head"><span class="x-term-dot" style="background:${esc(T['--ds-color-terminal-error']?.[theme] ?? '#EF4444')}"></span><span class="x-term-dot" style="background:${esc(T['--ds-color-terminal-warning']?.[theme] ?? '#F59E0B')}"></span><span class="x-term-dot" style="background:${esc(T['--ds-color-terminal-success']?.[theme] ?? '#22C55E')}"></span><span style="margin-left:8px">uter@local — ${theme}</span></div>
      <div class="x-term-body" tabindex="0" role="region" aria-label="Terminal ${theme} 输出（可横向滚动）" style="background:${esc(bg)};color:${esc(fg)}"><span style="color:${esc(prompt)}">uter@local</span>:<span style="color:${esc(property)}">~/uter</span>$ <span style="color:${esc(command)}">uter-cli</span> <span style="color:${esc(flag)}">--model</span> <span style="color:${esc(str)}">"gpt-4o"</span> <span style="color:${esc(flag)}">--max-tokens</span> <span style="color:${esc(num)}">1024</span>
<span class="x-muted">✓ 200 OK · 1,284,930 tokens · ¥ 12,345.67</span>
<span style="color:${esc(prompt)}">uter@local</span>:<span style="color:${esc(property)}">~/uter</span>$ <span style="color:${esc(command)}">uter-cli status</span> <span style="background:${esc(T['--ds-color-terminal-cursor']?.[theme] ?? fg)}"> </span></div>
      <div style="padding:8px 10px;background:var(--page-surface)"><span class="x-muted">背景 </span><code>${esc(bg)}</code> <span class="x-muted">· 前景 </span><code>${esc(fg)}</code><div class="x-ansi-grid">${ansiGrid(theme)}</div></div>
    </div>`
  }

  return `<section class="panel" id="terminal">
  <h2>Terminal Light / Dark 独立色板 + ANSI16</h2>
  <p class="panel-sub">Terminal 色系与语法高亮色系、图表色系三者互不引用（检查器 C13）。Light / Dark 各有独立背景与前景，不复用 <code>--ds-color-surface-*</code> 或 <code>--ds-syntax-*</code>。全部 16 个 ANSI 色均来自 <code>TOKEN-MANIFEST.json</code>，并展示 HEX / RGB。</p>
  <div class="x-term-grid">${termPane('light')}${termPane('dark')}</div>
  <p class="x-hint">ANSI 0–7 为标准色、8–15 为高亮色。终端文字对比度由 <code>registry/contrast-engine.mjs</code> 在各自 Terminal 背景上实算；色盲安全不依赖单一颜色通道，状态另有文字 / 符号标识。</p>
</section>`
}

/* ── 4) 12 色图表 + 非颜色通道 ───────────────────────────────────────────── */
function renderCharts(M, T) {
  const policy = M.chartPolicy ?? {}
  const nc = policy.nonColorChannels ?? {}
  const lineStyles = nc.lineStyles ?? []
  const markers = nc.pointMarkers ?? []
  const count = policy.seriesCount ?? 12
  const cells = Array.from({ length: count }, (_, i) => {
    const n = `--ds-color-chart-${i + 1}`
    const t = T[n]
    const l = t?.light ?? '—'
    const d = t?.dark ?? '—'
    return `<div class="x-chart-cell" data-runtime-token="${esc(t?.runtimeName ?? n)}" data-chart-series="${i + 1}">
      <div class="x-chart-swatch" style="background:${esc(l)}"></div>
      <h5>Series ${i + 1} · <code>${esc(n)}</code></h5>
      <small>L ${esc(l)} · ${esc(hexToRgb(l) ?? '—')}</small>
      <small>D ${esc(d)} · ${esc(hexToRgb(d) ?? '—')}</small>
      <small>consumer: ${esc(t?.consumer ?? '未登记')}</small>
    </div>`
  }).join('\n')

  const lineStyleRows = lineStyles.map((s, i) => `<div><div class="x-line-style ${esc(s)}" style="border-top-color:var(--ds-color-chart-${(i % count) + 1})"></div><span class="x-mono">${esc(s)}</span></div>`).join('\n')
  const markerRows = markers.map((m) => `<span><i class="x-marker ${esc(m)}"></i>${esc(m)}</span>`).join('')

  return `<section class="panel" id="charts">
  <h2>数据可视化 · ${count} 色图表 + 非颜色通道</h2>
  <p class="panel-sub">${esc(policy.rule ?? '')}。图例必填、series &gt; 6 时必须直接标注；色觉模拟覆盖 <code>${esc((nc.cvdSimulation ?? []).join(' / '))}</code>。图表色不得用于语法高亮或业务状态（C13 守卫）。</p>
  <div class="x-chart-grid">${cells}</div>
  <h3 style="font-size:var(--ds-text-sm);margin:var(--ds-space-5) 0 8px">线型通道（${lineStyles.length} 种 · 真实 DOM 演示）</h3>
  <div class="grid2">${lineStyleRows}</div>
  <h3 style="font-size:var(--ds-text-sm);margin:var(--ds-space-5) 0 8px">点型通道（${markers.length} 种 · 真实 DOM 演示）</h3>
  <div class="x-marker-row">${markerRows}</div>
  <h3 style="font-size:var(--ds-text-sm);margin:var(--ds-space-5) 0 8px">图例与直接标注（series &gt; 6 强制）</h3>
  <div class="state-cell" style="display:block"><div style="display:flex;gap:12px;flex-wrap:wrap;font:11px/1.6 var(--ds-font-mono)">${Array.from({ length: count }, (_, i) => `<span><i class="x-marker ${esc(markers[i % markers.length] ?? 'circle')}" style="background:var(--ds-color-chart-${i + 1})"></i>S${i + 1} · ${esc(T[`--ds-color-chart-${i + 1}`]?.light ?? '—')}</span>`).join('')}</div></div>
</section>`
}

/* ── 5) 渐变 7 背景矩阵 ──────────────────────────────────────────────────── */
function renderGradientMatrix(M, v) {
  const bgKeys = Object.keys(BACKGROUNDS.light)
  const worst = (theme) => bgKeys.map((k) => {
    const samples = v.gradient?.[theme]?.samples ?? []
    let min = null
    for (const s of samples) {
      const r = s[k]
      if (typeof r !== 'number') continue
      if (min === null || r < min.ratio) min = { ratio: r, at: s.at, hex: s.hex }
    }
    return { key: k, background: BACKGROUNDS[theme][k], ...(min ?? { ratio: null, at: null, hex: null }) }
  })
  const lw = worst('light')
  const dw = worst('dark')
  const rows = bgKeys.map((k, i) => {
    const l = lw[i]
    const d = dw[i]
    const ok = (x) => x.ratio !== null && x.ratio >= 4.5
    return `<tr data-gradient-background="${esc(k)}"><td><code>${esc(k)}</code></td>
      <td>${colorCell(l.background)}</td><td class="${ok(l) ? '' : 'x-worst'}">${l.ratio ?? '—'}:1</td><td>${l.at ?? '—'}%</td><td><code>${esc(l.hex ?? '—')}</code></td>
      <td>${colorCell(d.background)}</td><td class="${ok(d) ? '' : 'x-worst'}">${d.ratio ?? '—'}:1</td><td>${d.at ?? '—'}%</td><td><code>${esc(d.hex ?? '—')}</code></td>
      <td>${ok(l) && ok(d) ? '<span class="x-badge measured">PASS</span>' : '<span class="x-badge">FAIL</span>'}</td></tr>`
  }).join('\n')

  return `<section class="panel" id="gradient-matrix">
  <h2>品牌渐变 · ${GRADIENT_SAMPLE_COUNT} 点 × ${bgKeys.length} 种真实背景矩阵</h2>
  <p class="panel-sub">CSS 唯一出口 <code>linear-gradient(90deg in ${esc(GRADIENT_INTERPOLATION)}, ...)</code>，与 <code>registry/contrast-engine.mjs</code> 的插值空间、方向、采样步长完全一致；采样步长 0.1%，共 ${GRADIENT_SAMPLE_COUNT} 点 / 主题，另含全部渐变 stop。下表为每种背景下全 1001 点的最差对比度与出现位置，不是抽样估算。</p>
  <div class="table-wrap x-scroll" tabindex="0" role="region" aria-label="渐变背景矩阵表"><table class="x-matrix"><thead><tr><th>背景</th><th>Light 背景色</th><th>Light 最差</th><th>位置</th><th>该点色</th><th>Dark 背景色</th><th>Dark 最差</th><th>位置</th><th>该点色</th><th>4.5:1</th></tr></thead><tbody>${rows}</tbody></table></div>
  <p class="note">全区间无字号例外，按更严格的 4.5:1 冻结。Light 全局最差 <strong>${v.gradient.light.finalWorst.ratio}:1 @ ${esc(v.gradient.light.finalWorst.background)}</strong>，Dark 全局最差 <strong>${v.gradient.dark.finalWorst.ratio}:1 @ ${esc(v.gradient.dark.finalWorst.background)}</strong>。运行时字体、字重、字号、行高不因渐变改变（C12 守卫）。</p>
</section>`
}

/* ── 6) 运行时实测标记 ───────────────────────────────────────────────────── */
function renderRuntimeEvidence(M, v, syntaxData, measured) {
  const syntax = syntaxData ?? {}
  const checks = syntax.checks ?? {}
  const items = [
    ['唯一数值真源', 'TOKEN-MANIFEST.json', `${M.tokenCount} tokens · 所有 CSS / TS / 文档 / Showcase 由 build.mjs 从磁盘读回的同一份 JSON 派生`, 'MEASURED'],
    ['对比度引擎', 'registry/contrast-engine.mjs', `VERDICT ${esc(v.verdict)} · ${esc(v.sampling)}`, 'MEASURED'],
    ['语法真实解析', 'registry/syntax-adapter.mjs', `Shiki ${esc(syntax.engine?.version ?? '—')} · ${syntax.languagesRequested ?? 0} 语言 + ${syntax.coverageSamples ?? 0} 补样 · ${syntax.grammarsLoaded ?? 0} grammars · VERDICT ${esc(syntax.verdict ?? 'BLOCKED')}`, syntax.verdict === 'PASS' ? 'MEASURED' : 'BLOCKED'],
    ['运行时桥接', 'web/src/design-system/tokens/uds-semantic-bridge.css', `${Object.values(M.tokens ?? {}).filter((t) => t.runtimeBridge).length} 个 --ds6-* 变量 · 隔离命名不覆盖 3.0 --ds-*`, 'MEASURED'],
    ['前端真实验证', 'web/visual-regression/uds6/', 'Playwright 截图 + axe-core WCAG 2.2 A/AA + 键盘焦点可见性，见 run-log.json / a11y-log.json', 'MEASURED'],
    ['真实页面视觉回归', 'audit/visual-regression.json', '真实页面回归状态以该机器可读报告为准；未执行项不得标 PASS', 'DECLARED'],
  ]
  const cards = items.map(([t, p, d, s]) => `<div class="x-evidence"><h4>${esc(t)} · <span class="x-badge ${s === 'MEASURED' ? 'measured' : ''}">${esc(s)}</span></h4><p><code>${esc(p)}</code><br>${d}</p></div>`).join('\n')

  const reports = [
    'design-system-audit.json', 'token-validation.json', 'contrast-validation.json', 'gradient-validation.json',
    'syntax-validation.json', 'accessibility-validation.json', 'visual-regression.json', 'final-acceptance.json',
  ].map((f) => `<span class="x-badge">audit/${esc(f)}</span>`).join(' ')

  return `<section class="panel" id="runtime-evidence">
  <h2>运行时实测标记 · 数值来源与验证边界</h2>
  <p class="panel-sub">完整 Token 清单中每一行都用 <code>MEASURED</code> / <code>DECLARED</code> 标记：前者表示该 Token 已被 <code>contrast-engine.mjs</code> 真实实算，后者表示仅由 manifest 声明、未单独做对比度计算（不得冒充已测）。当前已实算 ${measured.size} 个 Token。</p>
  <div class="x-evidence-grid">${cards}</div>
  <h3 style="font-size:var(--ds-text-sm);margin:var(--ds-space-5) 0 8px">机器可读报告索引（相对路径 · 零外链）</h3>
  <div style="display:flex;gap:6px;flex-wrap:wrap">${reports}</div>
  <p class="x-hint">语法解析检查：${Object.entries(checks).filter(([, val]) => typeof val === 'boolean').map(([k, val]) => `${esc(k)}=${val ? 'PASS' : 'FAIL'}`).join(' · ')}。未被真实样例命中的语义类别：<code>${esc((syntax.syntaxKeysNotExercisedBySamples ?? []).join(', ') || '无')}</code>（如实登记，不以假 token 凑覆盖率）。</p>
  <p class="note">状态纪律：当前 <code>${esc(M.status)}</code> / <code>PENDING_USER_REVIEW</code> / <code>ACCEPTED=false</code>。用户审核前不执行 Phase 6 全站迁移、Phase 7 旧实现清理、Phase 8 全站视觉回归；未执行项一律登记为真实未执行。</p>
</section>`
}

/** 一次性生成全部扩展区块。 */
export function renderExtensions({ M, T, v, syntaxData }) {
  const measured = measuredTokenSet(v)
  return [
    renderArchitecture(M, T),
    renderVscode(M, syntaxData),
    renderTerminal(M, T),
    renderCharts(M, T),
    renderGradientMatrix(M, v),
    renderRuntimeEvidence(M, v, syntaxData, measured),
  ].join('\n')
}

/** 给 Showcase 注入按 pane 作用域展开的 --ds6-syntax-* 定值。 */
export function scopedSyntaxVars(T) {
  const names = Object.keys(T).filter((n) => n.startsWith('--ds-syntax-')).sort()
  const block = (theme) => `.cc-pane[data-pane="uter-${theme}"],.x-cc-pane[data-pane="uter-${theme}"] {\n` +
    names.map((n) => `  ${T[n].runtimeName}: ${T[n][theme]};`).join('\n') + '\n}'
  return `${block('light')}\n${block('dark')}\n`
}
