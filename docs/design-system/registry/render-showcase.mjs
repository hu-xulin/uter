/*
 * Copyright (C) 2026 Uter.ai
 * SPDX-License-Identifier: UNLICENSED
 *
 * UTER DESIGN SYSTEM 8.0.0 — Showcase 渲染器
 * 单文件 / 零外链 / 无 <img> / 真实 DOM / 所有数值来自 TOKEN-MANIFEST.json
 * 输出到 docs/.../SHOWCASE-8.0.0.html 与 web/public/design-system/8.0.0/index.html
 */

import { runVerification } from './contrast-engine.mjs'
import {
  EXTENSION_CSS, EXTENSION_NAV, renderExtensions, scopedSyntaxVars, scopedTerminalVars, scopedCodeVars,
  colorCell, measuredTokenSet,
} from './showcase-extensions.mjs'

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const cssVal = (t, theme) => {
  const v = t[theme]
  if (typeof v === 'number') return t.unit === 'px' ? `${v}px` : t.unit === 'ms' ? `${v}ms` : String(v)
  return String(v)
}

/* 10+ 种语言的真实代码示例，用统一 --ds-syntax-* 语义 Token 着色 */
const LANG_SAMPLES = [
  {
    lang: 'JavaScript', file: 'client.js',
    rows: [
      [['keyword', 'import '], ['variable', '{ createClient }'], ['keyword', ' from '], ['string', "'@uter/sdk'"]],
      [['keyword', 'const '], ['variable', 'client'], ['operator', ' = '], ['function', 'createClient'], ['punctuation', '('], ['punctuation', '{']],
      [['property', '  apiKey'], ['punctuation', ': '], ['variable', 'process'], ['punctuation', '.'], ['property', 'env'], ['punctuation', '.'], ['constant', 'UTER_KEY'], ['punctuation', ',']],
      [['comment', '  // 使用量以 tokens 计，必须等宽显示'], ['punctuation', '']],
      [['punctuation', '}'], ['punctuation', ')']],
      [['keyword', 'await '], ['variable', 'client'], ['punctuation', '.'], ['function', 'chat'], ['punctuation', '('], ['string', "'gpt-4o'"], ['punctuation', ', '], ['number', '1024'], ['punctuation', ')']],
    ],
  },
  {
    lang: 'TypeScript', file: 'types.ts',
    rows: [
      [['keyword', 'export interface '], ['type', 'UsageRecord'], ['punctuation', ' {']],
      [['property', '  model'], ['punctuation', ': '], ['type', 'string'], ['punctuation', ';']],
      [['property', '  tokens'], ['punctuation', ': '], ['type', 'number'], ['punctuation', ';']],
      [['property', '  stream'], ['punctuation', ': '], ['boolean', 'boolean'], ['punctuation', ';']],
      [['property', '  stop'], ['punctuation', ': '], ['type', 'string'], ['punctuation', ' | '], ['null', 'null'], ['punctuation', ';']],
      [['punctuation', '}']],
    ],
  },
  {
    lang: 'JSON', file: 'request.json',
    rows: [
      [['punctuation', '{']],
      [['property', '  "model"'], ['punctuation', ': '], ['string', '"gpt-4o"'], ['punctuation', ',']],
      [['property', '  "max_tokens"'], ['punctuation', ': '], ['number', '1024'], ['punctuation', ',']],
      [['property', '  "stream"'], ['punctuation', ': '], ['boolean', 'true'], ['punctuation', ',']],
      [['property', '  "stop"'], ['punctuation', ': '], ['null', 'null']],
      [['punctuation', '}']],
    ],
  },
  {
    lang: 'Python', file: 'usage.py',
    rows: [
      [['keyword', 'from '], ['builtin', 'uter'], ['keyword', ' import '], ['type', 'Client']],
      [['comment', '# 余额、Token 用量必须用 tabular-nums 展示']],
      [['variable', 'client'], ['operator', ' = '], ['type', 'Client'], ['punctuation', '('], ['property', 'api_key'], ['operator', '='], ['string', '"sk-..."'], ['punctuation', ')']],
      [['variable', 'usage'], ['operator', ' = '], ['variable', 'client'], ['punctuation', '.'], ['function', 'usage'], ['punctuation', '('], ['number', '7'], ['punctuation', ')']],
      [['builtin', 'print'], ['punctuation', '('], ['function', 'f'], ['punctuation', '('], ['string', '"{usage:,} tokens"'], ['punctuation', ')'], ['punctuation', ')']],
    ],
  },
  {
    lang: 'Go', file: 'billing.go',
    rows: [
      [['keyword', 'package '], ['type', 'billing']],
      [['keyword', 'import '], ['string', '"fmt"']],
      [['keyword', 'func '], ['function', 'FormatAmount'], ['punctuation', '('], ['variable', 'v'], ['type', ' float64'], ['punctuation', ') '], ['type', 'string'], ['punctuation', ' {']],
      [['keyword', '  return '], ['builtin', 'fmt'], ['punctuation', '.'], ['function', 'Sprintf'], ['punctuation', '('], ['string', '"¥ %.2f"'], ['punctuation', ', '], ['variable', 'v'], ['punctuation', ')']],
      [['punctuation', '}']],
    ],
  },
  {
    lang: 'SQL', file: 'usage.sql',
    rows: [
      [['keyword', 'SELECT '], ['property', 'model'], ['punctuation', ', '], ['function', 'SUM'], ['punctuation', '('], ['property', 'tokens'], ['punctuation', ') '], ['keyword', 'AS '], ['property', 'total']],
      [['keyword', 'FROM '], ['type', 'usage_logs']],
      [['keyword', 'WHERE '], ['property', 'created_at'], ['operator', ' >= '], ['string', "'2026-11-01'"]],
      [['keyword', 'GROUP BY '], ['property', 'model'], ['keyword', ' ORDER BY '], ['property', 'total'], ['keyword', ' DESC']],
    ],
  },
  {
    lang: 'YAML', file: 'channel.yaml',
    rows: [
      [['property', 'name'], ['punctuation', ': '], ['string', 'uter-primary']],
      [['property', 'type'], ['punctuation', ': '], ['number', '1']],
      [['property', 'models'], ['punctuation', ':']],
      [['operator', '  - '], ['string', 'gpt-4o']],
      [['property', 'enabled'], ['punctuation', ': '], ['boolean', 'true']],
      [['comment', '# 状态色不得用 chart 色替代']],
    ],
  },
  {
    lang: 'Bash / cURL', file: 'request.sh',
    rows: [
      [['comment', '#!/usr/bin/env bash']],
      [['function', 'curl'], ['operator', ' -X '], ['string', 'POST'], ['operator', ' \\']],
      [['operator', '  -H '], ['string', '"Authorization: Bearer $UTER_KEY"'], ['operator', ' \\']],
      [['operator', '  -d '], ['string', "'{\"model\":\"gpt-4o\"}'"], ['operator', ' \\']],
      [['variable', '  https'], ['punctuation', '://'], ['string', 'api.uter.ai/v1/chat']],
    ],
  },
  {
    lang: 'CSS', file: 'tokens.css',
    rows: [
      [['tag', ':root'], ['punctuation', ' {']],
      [['property', '  --ds-text-sm'], ['punctuation', ': '], ['number', '14px'], ['punctuation', ';']],
      [['property', '  --ds-radius-md'], ['punctuation', ': '], ['number', '5px'], ['punctuation', ';']],
      [['property', '  --ds-color-brand-1'], ['punctuation', ': '], ['string', '#5B5EE6'], ['punctuation', ';']],
      [['punctuation', '}']],
    ],
  },
  {
    lang: 'Dockerfile', file: 'Dockerfile',
    rows: [
      [['keyword', 'FROM '], ['type', 'node:22-alpine']],
      [['keyword', 'WORKDIR '], ['string', '/app']],
      [['keyword', 'COPY '], ['string', 'package.json '], ['string', './']],
      [['keyword', 'RUN '], ['function', 'bun'], ['operator', ' install']],
      [['keyword', 'CMD '], ['punctuation', '['], ['string', '"bun"'], ['punctuation', ', '], ['string', '"run"'], ['punctuation', ', '], ['string', '"start"'], ['punctuation', ']']],
    ],
  },
  {
    lang: 'Diff', file: 'gradient.patch',
    rows: [
      [['deleted', '--- a/tokens/colors.css']],
      [['inserted', '+++ b/tokens/colors.css']],
      [['deleted', '--ds-color-brand-gradient-from: #60a5fa;']],
      [['inserted', '+--ds-color-gradient-light-from: #1D4ED8;']],
      [['comment', '  /* 全区间 ≥4.5:1，E28 例外注销 */']],
    ],
  },
  {
    lang: 'Markdown', file: 'README.md',
    rows: [
      [['keyword', '# '], ['type', 'Uter Design System 8.0.0']],
      [['comment', '<!-- 数值来自 TOKEN-MANIFEST.json -->']],
      [['operator', '- '], ['string', '36 modules']],
      [['operator', '- '], ['string', '20 syntax tokens']],
      [['punctuation', '```json']],
      [['property', '"version"'], ['punctuation', ': '], ['string', '"8.0.0"']],
      [['punctuation', '```']],
    ],
  },
]

const SYNTAX_CLASS = (sem) => `syn syn-${sem}`

export function renderShowcase({ M, T, MODULES, PRINCIPLES, routeFiles, sourceComponents, registries, syntaxData }) {
  const v = runVerification()
  const names = Object.keys(T).sort()
  const measured = measuredTokenSet(v)
  const extensionNav = EXTENSION_NAV.map(([href, label]) => `<a class="nav-item" href="${esc(href)}"><span class="nav-num">••</span><span>${esc(label)}</span></a>`).join('\n')
  const extensionSections = renderExtensions({ M, T, v, syntaxData })
  const extensionCss = `${EXTENSION_CSS}\n${scopedSyntaxVars(T)}\n${scopedTerminalVars(T)}\n${scopedCodeVars(T)}`
  const tokenRows = names.map((n) => {
    const t = T[n]
    const isMeasured = measured.has(n)
    const layerTag = t.layer === 'primitive' ? '<span class="tag tag-prim">P</span>' : t.layer === 'semantic' ? '<span class="tag tag-sem">S</span>' : '<span class="tag tag-cmp">C</span>'
    return `<tr data-token="${esc(n)}" data-token-layer="${esc(t.layer)}" data-runtime-name="${esc(t.runtimeName ?? '')}" data-runtime-measured="${isMeasured ? 'MEASURED' : 'DECLARED'}">
      <td><code>${esc(n)}</code><small class="x-mono">${esc(t.runtimeName ?? '—')}</small></td>
      <td>${layerTag} ${esc(t.category)}<small class="x-mono">${esc(t.colorLayer ?? '—')}</small></td>
      <td>${colorCell(cssVal(t, 'light'))}</td>
      <td>${colorCell(t.themeIndependent ? '—' : cssVal(t, 'dark'))}</td>
      <td>${esc(t.unit)}</td>
      <td class="desc">${esc(t.description)}<small class="x-mono">${esc(t.semanticMeaning ?? '')}</small></td>
      <td class="desc">${esc(t.consumer ?? '未登记')}</td>
      <td><span class="x-badge ${isMeasured ? 'measured' : 'declared'}">${isMeasured ? 'MEASURED' : 'DECLARED'}</span><small class="x-mono">${esc(t.contrastRequirement ?? '—')}</small></td></tr>`
  }).join('\n')

  // 生成 CSS 变量（页面自身使用，全部来自 manifest）
  const rootVars = names.map((n) => `  ${n}: ${cssVal(T[n], 'light')};`).join('\n')
  const darkVars = names.filter((n) => !T[n].themeIndependent).map((n) => `  ${n}: ${cssVal(T[n], 'dark')};`).join('\n')

  const moduleNav = MODULES.map((m) => `<a href="#mod-${esc(m.id)}" class="nav-item${m.id.endsWith('-S') ? ' nav-special' : ''}" data-nav="${esc(m.id)}"><span class="nav-num">${esc(m.id)}</span><span>${esc(m.name.replace(' (专项)', ''))}</span>${m.id.endsWith('-S') ? '<span class="nav-badge">S</span>' : ''}</a>`).join('\n')

  const moduleSections = MODULES.map((m) => {
    const tk = m.tokens.map((n) => {
      const t = T[n]
      return `<tr data-token="${esc(n)}"><td><code>${esc(n)}</code></td><td><code>${esc(cssVal(t, 'light'))}</code></td><td><code>${t.themeIndependent ? '—' : esc(cssVal(t, 'dark'))}</code></td><td>${esc(t.description)}</td></tr>`
    }).join('\n')
    return `<section class="module" id="mod-${esc(m.id)}" data-module-id="${esc(m.id)}" data-spec-id="${esc(m.specId)}">
      <div class="module-head">
        <div><span class="module-id">${esc(m.id)}</span><h2>${esc(m.name)}</h2><p class="module-meta">${esc(m.specId)} · <a href="./${esc(m.file)}">${esc(m.file)}</a> · ${esc(m.principle.join(' / '))}</p></div>
        <span class="status-pill">${esc(M.status)}</span>
      </div>
      <div class="mod-grid">
        <div class="mod-block" data-section="Overview"><h3>1 · Overview</h3><p>${esc(m.summary)}</p><p class="note">UDS 8.0.0 是唯一现行设计系统，不作为视觉设计依据。</p></div>
        <div class="mod-block" data-section="Rules"><h3>2 · Rules</h3><ol>${m.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ol></div>
        <div class="mod-block wide" data-section="Tokens"><h3>3 · Tokens <small>${m.tokens.length} 项 · 来自 TOKEN-MANIFEST.json</small></h3><div class="table-wrap" tabindex="0" role="region" aria-label="可滚动数据表"><table class="token-table"><thead><tr><th>Token</th><th>Light</th><th>Dark</th><th>说明</th></tr></thead><tbody>${tk}</tbody></table></div></div>
        <div class="mod-block" data-section="Visual Preview"><h3>4 · Visual Preview</h3>${visualPreview(m.id)}</div>
        <div class="mod-block" data-section="Interactive Preview"><h3>5 · Interactive Preview</h3>${interactivePreview(m.id)}<p class="note">覆盖状态：${m.states.map((s) => `<code>${esc(s)}</code>`).join(' ')}</p></div>
        <div class="mod-block wide" data-section="Usage"><h3>6 · Usage</h3><pre class="code" tabindex="0" role="region" aria-label="代码示例（可横向滚动）"><code>${esc(m.example.join('\n'))}</code></pre></div>
        <div class="mod-block" data-section="Do"><h3>7 · Do</h3><ul class="do">${m.do.map((d) => `<li>${esc(d)}</li>`).join('')}</ul></div>
        <div class="mod-block" data-section="Don't"><h3>8 · Don't</h3><ul class="dont">${m.dont.map((d) => `<li>${esc(d)}</li>`).join('')}</ul></div>
        <div class="mod-block" data-section="Accessibility"><h3>9 · Accessibility</h3><ul>${m.a11y.map((a) => `<li>${esc(a)}</li>`).join('')}</ul><p class="note">阈值 4.5:1 / 3:1 / 3:1 · 例外见 EXCEPTION-REGISTRY.json</p></div>
        <div class="mod-block" data-section="Responsive"><h3>10 · Responsive</h3><ul>${m.responsive.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>
        <div class="mod-block wide" data-section="Acceptance"><h3>11 · Acceptance</h3><ol>${m.acceptance.map((a) => `<li>${esc(a)}</li>`).join('')}</ol><p class="note">视觉审核：<strong>PENDING_USER_REVIEW</strong> · 未通过用户审核前不得标记 ACCEPTED。</p></div>
      </div>
    </section>`
  }).join('\n')

  const syntaxSwatches = Object.keys(v.frozen['syntax-light']).map((n) => `<div class="syn-sw" data-token="${esc('--ds-' + n)}"><span class="syn-dot" style="background:var(--ds-${esc(n)})"></span><code>--ds-${esc(n)}</code><span class="syn-ratio">L ${v.syntax.light.rows.find((r) => r.name === n)?.ratio}:1 / D ${v.syntax.dark.rows.find((r) => r.name === n)?.ratio}:1</span></div>`).join('\n')

  const langBlocks = LANG_SAMPLES.map((s) => `<div class="lang-block" data-language="${esc(s.lang)}"><div class="lang-head"><span class="lang-name">${esc(s.lang)}</span><span class="lang-file">${esc(s.file)}</span><button class="copy-btn" data-copy="code-${esc(s.lang.replace(/[^a-z0-9]/gi, '-'))}" aria-label="复制 ${esc(s.lang)} 示例">复制</button></div><pre class="code code-lines" tabindex="0" role="region" aria-label="语言代码示例（可横向滚动）" id="code-${esc(s.lang.replace(/[^a-z0-9]/gi, '-'))}"><code>${s.rows.map((row, i) => `<span class="ln">${String(i + 1).padStart(2, '0')}</span>${row.map(([sem, text]) => `<span class="${SYNTAX_CLASS(sem)}">${esc(text)}</span>`).join('')}`).join('\n')}</code></pre></div>`).join('\n')

  const gradientSampleTable = v.gradient.light.samples.filter((s) => s.at % 10 === 0).map((s, i) => {
    const d = v.gradient.dark.samples.filter((x) => x.at % 10 === 0)[i]
    return `<tr><td>${s.at}%</td><td><span class="chip" style="background:${s.hex}"></span><code>${s.hex}</code></td><td>${s.canvas}:1</td><td>${s.surface}:1</td><td>${s['code-bg']}:1</td><td><span class="chip" style="background:${d.hex}"></span><code>${d.hex}</code></td><td>${d.canvas}:1</td><td>${d.surface}:1</td><td>${d['code-bg']}:1</td></tr>`
  }).join('\n')

  const typeSteps = ['2xs', 'xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'].map((k) => {
    const n = `--ds-text-${k}`
    return `<div class="type-row" data-token="${n}"><span class="type-label"><code>${n}</code> · ${esc(cssVal(T[n], 'light'))}</span><span class="type-sample" style="font-size:var(${n});line-height:1.35">Uter AI Token 中转站 · 1,284,930 tokens</span></div>`
  }).join('\n')

  const pageCards = [
    ['Dashboard', '余额 / Token 用量 / 请求数 / 错误率 4 张 Metric Card'],
    ['API Keys', 'Key 列表、脱敏展示、配额与用量、复制按钮'],
    ['Models', 'Model Card、Provider Badge、价格表'],
    ['Channels', 'Channel Card、健康度、延迟、状态 Badge'],
    ['Documentation', '三栏文档布局 + cURL / Python / TS / Go 示例'],
    ['Usage', '趋势折线、Request Logs、Request ID 等宽'],
    ['Billing', '金额等宽右对齐、Balance 卡片、Invoice'],
    ['Orders', '订单状态、订单号等宽、分页'],
    ['Refunds', '危险操作二次确认、金额与不可逆后果'],
    ['Account Settings', '二级导航、表单分组、权限矩阵'],
  ].map(([name, desc]) => `<article class="page-card"><div class="page-frame" role="img" aria-label="${esc(name)} 页面结构预览"><div class="pf-head"><span class="pf-logo"></span><span class="pf-nav"></span><span class="pf-nav"></span><span class="pf-avatar"></span></div><div class="pf-body"><span class="pf-side"></span><div class="pf-main"><span class="pf-title"></span><div class="pf-cards"><i></i><i></i><i></i><i></i></div><span class="pf-chart"></span><span class="pf-table"></span></div></div></div><h4>${esc(name)}</h4><p>${esc(desc)}</p><span class="page-state">STATIC_STRUCTURE_PREVIEW</span></article>`).join('\n')

  const manifestMini = {
    version: M.version, status: M.status, tokenCount: M.tokenCount,
    modules: MODULES.length, numberedModules: MODULES.filter((m) => !m.id.endsWith('-S')).length,
    specialModules: MODULES.filter((m) => m.id.endsWith('-S')).length,
    components: sourceComponents.length, routes: routeFiles.length,
    contrast: M.contrast, principles: PRINCIPLES.map((p) => p[0]),
    syntaxLanguages: M.syntaxLanguages, engines: M.highlighterEngines.map((e) => e.name),
    gradientUtility: T['--ds-gradient-utility'].light,
    pendingUserReview: true, accepted: false,
  }

  return `<!doctype html>
<html lang="zh-CN" data-ds-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>UTER DESIGN SYSTEM 8.0.0 · Design Showcase</title>
<style>
:root {
${rootVars}
  --page-bg: var(--ds-color-surface-canvas);
  --page-surface: var(--ds-color-surface-base);
  --page-fg: var(--ds-color-text-primary);
  --page-muted: var(--ds-color-text-secondary);
  --page-border: var(--ds-color-border-default);
}
[data-ds-theme="dark"] {
${darkVars}
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin:0; background:var(--page-bg); color:var(--page-fg); font-family:var(--ds-font-ui); font-size:var(--ds-text-sm); line-height:var(--ds-leading-body); }
code, pre, .mono { font-family:var(--ds-font-mono); }
small { font-size:var(--ds-text-2xs); }
a { color:var(--ds-color-text-link); text-decoration:underline; text-underline-offset:2px; }
a:hover { text-decoration:underline; }
h1,h2,h3,h4 { margin:0; font-weight:var(--ds-weight-semibold); }
.topbar { position:fixed; inset:0 0 auto 0; height:var(--ds-layout-header-height); display:flex; align-items:center; gap:var(--ds-space-4); padding:0 var(--ds-space-6); background:var(--page-surface); border-bottom:1px solid var(--page-border); z-index:100; }
.topbar .brand { font-size:var(--ds-text-lg); font-weight:var(--ds-weight-semibold); white-space:nowrap; }
.topbar .brand em { font-style:normal; color:var(--ds-color-brand-1); }
.topbar .spacer { flex:1; }
.topbar button, .topbar select { font:inherit; font-size:var(--ds-text-xs); padding:6px 10px; border:1px solid var(--page-border); border-radius:var(--ds-radius-md); background:var(--page-surface); color:var(--page-fg); cursor:pointer; white-space:nowrap; }
.btn-label-short { display:none; }
.topbar button:hover { background:var(--ds-color-surface-sunken); }
.topbar .review-pill { font-size:var(--ds-text-2xs); padding:4px 10px; border-radius:var(--ds-radius-full); background:var(--ds-color-status-warning-soft); color:var(--ds-color-status-warning-on); border:1px solid var(--ds-color-status-warning-border); white-space:nowrap; }
.sidebar { position:fixed; top:var(--ds-layout-header-height); bottom:0; left:0; width:var(--ds-layout-sidebar-width); overflow-y:auto; background:var(--page-surface); border-right:1px solid var(--page-border); padding:var(--ds-space-4) var(--ds-space-3); }
.sidebar h4 { font-size:var(--ds-text-2xs); letter-spacing:.08em; text-transform:uppercase; color:var(--page-muted); margin:var(--ds-space-4) var(--ds-space-2) var(--ds-space-2); }
.nav-item { display:flex; align-items:center; gap:var(--ds-space-2); padding:6px 8px; border-radius:var(--ds-radius-md); font-size:var(--ds-text-xs); color:var(--page-fg); line-height:1.35; text-decoration:none; }
.nav-item:hover { background:var(--ds-color-surface-sunken); text-decoration:none; }
.nav-item.active { background:var(--ds-color-surface-sunken); color:var(--ds-color-brand-1); font-weight:var(--ds-weight-medium); }
.nav-num { font-family:var(--ds-font-mono); font-size:var(--ds-text-2xs); color:var(--page-muted); min-width:26px; }
.nav-badge { margin-left:auto; font-size:var(--ds-text-2xs); border:1px solid var(--page-border); border-radius:var(--ds-radius-full); padding:0 5px; }
.nav-special { border-left:2px solid var(--ds-color-brand-1); }
.main { margin-left:var(--ds-layout-sidebar-width); padding:calc(var(--ds-layout-header-height) + var(--ds-space-6)) var(--ds-space-8) var(--ds-space-24); max-width:min(var(--ds-layout-max-width), calc(100vw - var(--ds-layout-sidebar-width))); }
.hero { padding:var(--ds-space-8) 0 var(--ds-space-6); }
.hero h1 { font-size:var(--ds-text-4xl); line-height:var(--ds-leading-display); font-weight:var(--ds-weight-semibold); }
.hero p { color:var(--page-muted); max-width:70ch; margin:var(--ds-space-3) 0 0; }
.stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:var(--ds-space-3); margin:var(--ds-space-6) 0; }
.stat { background:var(--page-surface); border:1px solid var(--page-border); border-radius:var(--ds-radius-lg); padding:var(--ds-space-4); }
.stat b { display:block; font-size:var(--ds-text-3xl); line-height:var(--ds-leading-h2); font-variant-numeric:var(--ds-numeric-tabular); }
.stat span { font-size:var(--ds-text-2xs); color:var(--page-muted); }
section.panel { background:var(--page-surface); border:1px solid var(--page-border); border-radius:var(--ds-radius-xl); padding:var(--ds-space-6); margin-bottom:var(--ds-space-6); scroll-margin-top:calc(var(--ds-layout-header-height) + 12px); overflow-x:auto; }
section.panel > h2 { font-size:var(--ds-text-2xl); line-height:1.4; margin-bottom:var(--ds-space-2); }
.panel-sub { color:var(--page-muted); margin:0 0 var(--ds-space-5); }
.note { font-size:var(--ds-text-2xs); color:var(--page-muted); margin:var(--ds-space-2) 0 0; }
.banner { border:1px solid var(--ds-color-status-warning-border); background:var(--ds-color-status-warning-soft); color:var(--ds-color-status-warning-on); padding:var(--ds-space-3) var(--ds-space-4); border-radius:var(--ds-radius-md); margin-bottom:var(--ds-space-5); font-size:var(--ds-text-xs); }
.grid2 { display:grid; grid-template-columns:1fr 1fr; gap:var(--ds-space-5); }
.grid3 { display:grid; grid-template-columns:repeat(3,1fr); gap:var(--ds-space-4); }
.gradient-box { border:1px solid var(--page-border); border-radius:var(--ds-radius-lg); padding:var(--ds-space-5); background:var(--page-surface); margin-bottom:var(--ds-space-3); }
.gradient-box h4 { font-size:var(--ds-text-xs); color:var(--page-muted); margin-bottom:var(--ds-space-3); }
.g-new { background-image:linear-gradient(var(--ds-gradient-direction),var(--ds-color-gradient-light-from) 0%,var(--ds-color-gradient-light-via) 50%,var(--ds-color-gradient-light-to) 100%); background-clip:text; -webkit-background-clip:text; color:transparent; font-family:var(--ds-font-ui); }
[data-ds-theme="dark"] .g-new { background-image:linear-gradient(var(--ds-gradient-direction),var(--ds-color-gradient-dark-from) 0%,var(--ds-color-gradient-dark-via) 50%,var(--ds-color-gradient-dark-to) 100%); }
.g-old { background-image:linear-gradient(90deg,#60A5FA 0%,#A78BFA 50%,#A855F7 100%); background-clip:text; -webkit-background-clip:text; color:transparent; font-family:var(--ds-font-ui); }
@media (forced-colors: active) { .g-new, .g-old { background-image:none; color:CanvasText; -webkit-text-fill-color:CanvasText; } }
.g-hero { font-size:var(--ds-text-4xl); line-height:var(--ds-leading-display); font-weight:var(--ds-weight-semibold); }
.g-cta { font-size:var(--ds-text-3xl); line-height:var(--ds-leading-h2); font-weight:var(--ds-weight-semibold); }
.g-body { font-size:var(--ds-text-base); line-height:var(--ds-leading-long); font-weight:var(--ds-weight-medium); }
.syn-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:var(--ds-space-2); }
.syn-sw { display:flex; align-items:center; gap:var(--ds-space-2); padding:6px 8px; border:1px solid var(--page-border); border-radius:var(--ds-radius-sm); font-size:var(--ds-text-2xs); }
.syn-dot { width:16px; height:16px; border-radius:var(--ds-radius-sm); border:1px solid var(--page-border); flex:none; }
.syn-ratio { margin-left:auto; color:var(--page-muted); font-variant-numeric:var(--ds-numeric-tabular); }
.lang-block { margin-bottom:var(--ds-space-4); border:1px solid var(--page-border); border-radius:var(--ds-radius-code); overflow:hidden; }
.lang-head { display:flex; align-items:center; gap:var(--ds-space-3); padding:6px 10px; background:var(--ds-color-surface-sunken); border-bottom:1px solid var(--page-border); font-size:var(--ds-text-2xs); }
.lang-name { font-weight:var(--ds-weight-semibold); }
.lang-file { color:var(--page-muted); font-family:var(--ds-font-mono); }
.copy-btn { margin-left:auto; font:inherit; font-size:var(--ds-text-2xs); padding:2px 8px; border:1px solid var(--page-border); border-radius:var(--ds-radius-sm); background:var(--page-surface); color:var(--page-fg); cursor:pointer; }
pre.code { margin:0; padding:var(--ds-space-3) var(--ds-space-4); background:var(--ds-color-code-background); color:var(--ds-color-code-foreground); font-size:var(--ds-text-xs); line-height:var(--ds-leading-code); overflow-x:auto; white-space:pre; }
.code-lines .ln { display:inline-block; width:28px; color:var(--ds-color-code-gutter); user-select:none; }
.syn { font-family:var(--ds-font-mono); }
.syn-keyword,.syn-boolean,.syn-null { color:var(--ds-syntax-keyword); font-weight:var(--ds-weight-semibold); }
.syn-string,.syn-attribute,.syn-inserted { color:var(--ds-syntax-string); }
.syn-number,.syn-constant,.syn-regexp { color:var(--ds-syntax-number); }
.syn-function,.syn-builtin,.syn-tag { color:var(--ds-syntax-function); }
.syn-property,.syn-type { color:var(--ds-syntax-property); }
.syn-variable { color:var(--ds-syntax-variable); }
.syn-operator,.syn-punctuation { color:var(--ds-syntax-operator); }
.syn-comment { color:var(--ds-syntax-comment); font-style:italic; }
.syn-deleted,.syn-invalid { color:var(--ds-syntax-deleted); text-decoration:underline wavy; }
.syn-inserted::before { content:'+ '; color:var(--ds-syntax-inserted); }
.syn-deleted::before { content:'- '; color:var(--ds-syntax-deleted); }
.table-wrap { overflow-x:auto; border:1px solid var(--page-border); border-radius:var(--ds-radius-md); }
table { border-collapse:collapse; width:100%; font-size:var(--ds-text-xs); }
th { text-align:left; font-size:var(--ds-text-2xs); font-weight:var(--ds-weight-medium); color:var(--page-muted); background:var(--ds-color-surface-sunken); padding:8px 10px; border-bottom:1px solid var(--page-border); position:sticky; top:0; }
td { padding:6px 10px; border-bottom:1px solid var(--ds-color-border-divider); vertical-align:top; }
tr[data-token] { cursor:pointer; }
tr[data-token]:hover { background:var(--ds-color-surface-sunken); }
td code { font-size:var(--ds-text-2xs); }
td.desc { color:var(--page-muted); }
.chip { display:inline-block; width:12px; height:12px; border-radius:2px; border:1px solid var(--page-border); margin-left:6px; vertical-align:middle; }
.tag { font-size:var(--ds-text-2xs); padding:1px 5px; border-radius:var(--ds-radius-full); border:1px solid var(--page-border); }
.tag-prim { background:var(--ds-color-surface-sunken); }
.tag-sem { background:var(--ds-color-status-info-soft); }
.tag-cmp { background:var(--ds-color-status-success-soft); }
.type-row { display:flex; align-items:baseline; gap:var(--ds-space-4); padding:var(--ds-space-2) 0; border-bottom:1px solid var(--ds-color-border-divider); }
.type-label { min-width:230px; font-size:var(--ds-text-2xs); color:var(--page-muted); }
.type-sample { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; height:var(--ds-control-md); padding:0 var(--ds-space-4); border-radius:var(--ds-radius-button); font-size:var(--ds-text-sm); font-weight:var(--ds-weight-medium); border:1px solid transparent; cursor:pointer; font-family:var(--ds-font-ui); }
.btn-primary { background:var(--ds-color-brand-solid); color:var(--ds-color-text-on-brand); }
.btn-primary:hover { background:var(--ds-color-brand-solid-hover); }
.btn-primary:active { background:var(--ds-color-brand-solid-active); }
.btn-outline { border-color:var(--ds-color-border-input); background:transparent; color:var(--page-fg); }
.btn-ghost { background:transparent; color:var(--ds-color-text-secondary); }
.btn-destructive { background:var(--ds-color-status-danger-solid); color:#fff; }
:where(a, button, input, select, textarea, [tabindex]):focus, :where(a, button, input, select, textarea, [tabindex]):focus-visible { outline:var(--ds-focus-ring-width) solid var(--ds-color-focus-ring); outline-offset:var(--ds-focus-ring-offset); }
.btn:disabled { opacity:.5; cursor:not-allowed; }
.btn-sm { height:var(--ds-control-sm); font-size:var(--ds-text-2xs); }
.btn-lg { height:var(--ds-control-lg); }
.btn-touch { height:var(--ds-control-touch); }
.inp { height:var(--ds-control-md); padding:0 var(--ds-space-3); border:1px solid var(--ds-color-border-input); border-radius:var(--ds-radius-input); background:var(--page-surface); color:var(--page-fg); font-size:var(--ds-text-sm); font-family:var(--ds-font-ui); }
.inp-error { border-color:var(--ds-color-border-danger); }
.state-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:var(--ds-space-3); }
.state-cell { border:1px solid var(--page-border); border-radius:var(--ds-radius-md); padding:var(--ds-space-3); display:flex; flex-direction:column; gap:8px; align-items:flex-start; }
.state-cell > span { font-size:var(--ds-text-2xs); color:var(--page-muted); font-family:var(--ds-font-mono); }
.spinner { width:14px; height:14px; border:2px solid var(--ds-color-border-default); border-top-color:var(--ds-color-brand-1); border-radius:50%; animation:spin 1s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
.contrast-row { display:flex; gap:var(--ds-space-3); align-items:center; flex-wrap:wrap; margin-bottom:var(--ds-space-3); }
.contrast-row input[type=color] { width:44px; height:32px; border:1px solid var(--page-border); border-radius:var(--ds-radius-sm); padding:2px; background:var(--page-surface); }
.contrast-result { padding:var(--ds-space-3) var(--ds-space-4); border-radius:var(--ds-radius-md); border:1px solid var(--page-border); font-variant-numeric:var(--ds-numeric-tabular); }
.contrast-result.pass { background:var(--ds-color-status-success-soft); border-color:var(--ds-color-status-success-border); }
.contrast-result.fail { background:var(--ds-color-status-danger-soft); border-color:var(--ds-color-status-danger-border); }
.page-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:var(--ds-space-4); }
.page-card { border:1px solid var(--page-border); border-radius:var(--ds-radius-lg); padding:var(--ds-space-3); }
.page-card h4 { font-size:var(--ds-text-sm); margin:var(--ds-space-3) 0 4px; }
.page-card p { font-size:var(--ds-text-2xs); color:var(--page-muted); margin:0 0 8px; }
.page-state { font-size:var(--ds-text-2xs); font-family:var(--ds-font-mono); color:var(--ds-color-status-warning); }
.page-frame { height:150px; border:1px solid var(--page-border); border-radius:var(--ds-radius-sm); background:var(--ds-color-surface-canvas); overflow:hidden; }
.pf-head { height:20px; background:var(--page-surface); border-bottom:1px solid var(--page-border); display:flex; align-items:center; gap:6px; padding:0 8px; }
.pf-logo { width:26px; height:6px; background:var(--ds-color-brand-1); border-radius:3px; }
.pf-nav { width:20px; height:4px; background:var(--ds-color-border-strong); border-radius:2px; }
.pf-avatar { margin-left:auto; width:10px; height:10px; border-radius:50%; background:var(--ds-color-border-strong); }
.pf-body { display:flex; height:calc(100% - 20px); }
.pf-side { width:36px; background:var(--page-surface); border-right:1px solid var(--page-border); }
.pf-main { flex:1; padding:8px; display:flex; flex-direction:column; gap:6px; }
.pf-title { width:40%; height:6px; background:var(--ds-color-border-strong); border-radius:3px; }
.pf-cards { display:grid; grid-template-columns:repeat(4,1fr); gap:4px; }
.pf-cards i { height:20px; background:var(--page-surface); border:1px solid var(--page-border); border-radius:2px; }
.pf-chart { height:34px; background:linear-gradient(90deg,var(--ds-color-chart-1-soft,#dbeafe),var(--ds-color-chart-1)); opacity:.35; border-radius:2px; }
.pf-table { height:22px; background:var(--page-surface); border:1px solid var(--page-border); border-radius:2px; }
.module { scroll-margin-top:calc(var(--ds-layout-header-height) + 12px); margin-bottom:var(--ds-space-10); }
.module-head { display:flex; justify-content:space-between; align-items:flex-start; gap:var(--ds-space-4); padding-bottom:var(--ds-space-3); border-bottom:2px solid var(--ds-color-brand-1); }
.module-id { font-family:var(--ds-font-mono); font-size:var(--ds-text-2xs); color:var(--ds-color-brand-1); }
.module-head h2 { font-size:var(--ds-text-2xl); line-height:1.4; }
.module-meta { font-size:var(--ds-text-2xs); color:var(--page-muted); margin:4px 0 0; }
.status-pill { font-size:var(--ds-text-2xs); font-family:var(--ds-font-mono); padding:4px 8px; border-radius:var(--ds-radius-full); border:1px solid var(--ds-color-status-warning-border); background:var(--ds-color-status-warning-soft); white-space:nowrap; }
.mod-grid { display:grid; grid-template-columns:1fr 1fr; gap:var(--ds-space-4); margin-top:var(--ds-space-4); }
.mod-block { border:1px solid var(--page-border); border-radius:var(--ds-radius-lg); padding:var(--ds-space-4); background:var(--page-surface); min-width:0; overflow-wrap:anywhere; }
.mod-block.wide { grid-column:1 / -1; }
.mod-block h3 { font-size:var(--ds-text-sm); margin-bottom:var(--ds-space-3); }
.mod-block h3 small { font-weight:var(--ds-weight-regular); color:var(--page-muted); }
.mod-block ol, .mod-block ul { margin:0; padding-left:1.3em; }
.mod-block li { margin-bottom:6px; }
.mod-block ul.do li::marker { color:var(--ds-color-status-success); }
.mod-block ul.dont li::marker { color:var(--ds-color-status-danger); }
#inspector { position:fixed; right:16px; bottom:16px; width:340px; max-height:60vh; overflow:auto; background:var(--page-surface); border:1px solid var(--page-border); border-radius:var(--ds-radius-xl); box-shadow:var(--ds-elevation-3); padding:var(--ds-space-4); z-index:200; display:none; }
#inspector.open { display:block; }
#inspector h4 { font-size:var(--ds-text-sm); margin-bottom:var(--ds-space-2); }
#inspector .ins-close { float:right; cursor:pointer; border:0; background:transparent; color:var(--page-muted); font-size:16px; }
#inspector dl { display:grid; grid-template-columns:80px 1fr; gap:6px 8px; font-size:var(--ds-text-xs); margin:0; }
#inspector dt { color:var(--page-muted); }
#inspector dd { margin:0; word-break:break-all; font-family:var(--ds-font-mono); font-size:var(--ds-text-2xs); }
#inspector button.copy-token { margin-top:var(--ds-space-3); width:100%; }
.footer { border-top:1px solid var(--page-border); padding:var(--ds-space-6) 0; color:var(--page-muted); font-size:var(--ds-text-2xs); }
[data-viewport="mobile"] .main { margin-left:0; padding:calc(var(--ds-layout-header-height) + var(--ds-space-4)) var(--ds-space-3) var(--ds-space-12); }
[data-viewport="mobile"] .sidebar { display:none; }
[data-viewport="mobile"] .review-pill { display:none; }
[data-viewport="mobile"] .topbar .brand em { display:none; }
[data-viewport="mobile"] .topbar .btn-label { display:none; }
[data-viewport="mobile"] .topbar .btn-label-short { display:inline; }
[data-viewport="mobile"] .hero h1 { font-size:var(--ds-text-4xl); line-height:var(--ds-leading-h1); }
[data-viewport="mobile"] .mod-grid, [data-viewport="mobile"] .grid2, [data-viewport="mobile"] .grid3 { grid-template-columns:1fr; }
@media (max-width: 480px) {
  .topbar { padding:0 var(--ds-space-3); gap:var(--ds-space-2); }
  .topbar .brand { font-size:var(--ds-text-sm); }
  .topbar .brand em { display:none; }
  .topbar .review-pill { display:none; }
  .topbar button, .topbar select { font-size:var(--ds-text-2xs); padding:4px 6px; }
  .topbar .btn-label { display:none; }
  .topbar .btn-label-short { display:inline; }
  .sidebar { display:none; }
  .main { margin-left:0; max-width:100vw; padding:calc(var(--ds-layout-header-height) + var(--ds-space-4)) var(--ds-space-3) var(--ds-space-12); }
  .hero h1 { font-size:var(--ds-text-4xl); line-height:var(--ds-leading-h1); }
  .mod-grid, .grid2, .grid3 { grid-template-columns:1fr; }
  .type-row { flex-direction:column; gap:2px; }
  .module-head { flex-wrap:wrap; }
  .status-pill { white-space:normal; overflow-wrap:anywhere; }
  #inspector { left:12px; right:12px; width:auto; }
}
[data-viewport="tablet"] .sidebar { width:var(--ds-layout-sidebar-collapsed); }
[data-viewport="tablet"] .main { margin-left:var(--ds-layout-sidebar-collapsed); padding-inline:var(--ds-space-4); }
[data-viewport="tablet"] .nav-item span:not(.nav-num):not(.nav-badge) { display:none; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration:.01ms !important; transition-duration:.01ms !important; scroll-behavior:auto !important; } }
${extensionCss}
</style>
</head>
<body data-viewport="desktop">
<header class="topbar">
  <div class="brand">UTER <em>DESIGN SYSTEM 8.0.0</em></div>
  <span class="review-pill">PENDING_USER_REVIEW · 未经用户审核，不得标记 ACCEPTED</span>
  <span class="spacer"></span>
  <button id="theme-toggle" aria-label="切换 Light / Dark 主题"><span class="btn-emoji">🌗</span><span class="btn-label">Light / Dark</span></button>
  <select id="viewport-select" aria-label="响应式视口预览"><option value="desktop">Desktop 1440</option><option value="tablet">Tablet 768</option><option value="mobile">Mobile 390</option></select>
  <button id="inspector-toggle" aria-label="打开 Token Inspector"><span class="btn-label">Token Inspector</span><span class="btn-label-short">Inspector</span></button>
</header>
<aside class="sidebar" aria-label="36 个规范模块导航">
  <h4>全局工具</h4>
  <a class="nav-item" href="#overview"><span class="nav-num">••</span><span>Overview / 统计</span></a>
  <a class="nav-item" href="#tools"><span class="nav-num">••</span><span>全局功能</span></a>
  <a class="nav-item" href="#gradient"><span class="nav-num">••</span><span>渐变新旧对比</span></a>
  <a class="nav-item" href="#syntax"><span class="nav-num">••</span><span>语法高亮预览</span></a>
  <a class="nav-item" href="#pages"><span class="nav-num">••</span><span>真实产品页面</span></a>
${extensionNav}
  <h4>36 个正式规范模块 + 2 专项</h4>
${moduleNav}
</aside>
<main class="main">
  <div class="hero" id="overview">
    <h1>UTER DESIGN SYSTEM <span class="g-new">8.0.0</span></h1>
    <p>完整重建的设计系统：36 个正式规范模块、2 个专项规范、统一 Token Manifest、完整 Light / Dark 主题、代码语法高亮与品牌渐变专项。本页是视觉审核入口；<strong>用户审核前状态为 PENDING_USER_REVIEW</strong>。</p>
    <div class="stats">
      <div class="stat"><b>${manifestMini.numberedModules}</b><span>正式规范模块</span></div>
      <div class="stat"><b>${manifestMini.specialModules}</b><span>专项规范（登记于 01/24）</span></div>
      <div class="stat"><b>${M.tokenCount}</b><span>唯一 Token</span></div>
      <div class="stat"><b>${sourceComponents.length}</b><span>已登记组件</span></div>
      <div class="stat"><b>${routeFiles.length}</b><span>真实路由文件</span></div>
      <div class="stat"><b>20×2</b><span>Syntax Token 色值</span></div>
      <div class="stat"><b>${v.sampleCount}×2</b><span>渐变采样点</span></div>
      <div class="stat"><b>${v.verdict}</b><span>对比度引擎判定</span></div>
    </div>
    <div class="banner"><strong>口径说明：</strong>本页所有数值来自 <code>TOKEN-MANIFEST.json</code> 单一真源；UDS 8.0.0 规范值已冻结并通过对比度实算，<code>web/src</code> 运行时执行同一套 Token。页面预览为结构示意，不等同于真实运行的 React 组件。</div>
  </div>

  <section class="panel" id="tools">
    <h2>全局功能 · Token Inspector / Playground / 对比度 / 字体 / 状态</h2>
    <p class="panel-sub">点击任意带 <code>data-token</code> 的行或色块可打开 Token Inspector 并复制 Token。</p>
    <div class="grid2">
      <div>
        <h3 style="font-size:var(--ds-text-sm);margin-bottom:8px">Component State Preview（8 个基础状态）</h3>
        <div class="state-grid">
          <div class="state-cell"><span>default</span><button class="btn btn-primary">创建 API Key</button></div>
          <div class="state-cell"><span>hover</span><button class="btn btn-primary" style="background:var(--ds-color-brand-solid-hover)">创建 API Key</button></div>
          <div class="state-cell"><span>focus</span><button class="btn btn-primary" style="outline:2px solid var(--ds-color-focus-ring);outline-offset:2px">创建 API Key</button></div>
          <div class="state-cell"><span>active</span><button class="btn btn-primary" style="background:var(--ds-color-brand-solid-active)">创建 API Key</button></div>
          <div class="state-cell"><span>disabled</span><button class="btn btn-primary" disabled>创建 API Key</button></div>
          <div class="state-cell"><span>loading</span><button class="btn btn-primary" aria-busy="true"><span class="spinner"></span>创建 API Key</button></div>
          <div class="state-cell"><span>error</span><input class="inp inp-error" value="名称不能为空" aria-invalid="true" aria-label="错误状态输入框示例" /></div>
          <div class="state-cell"><span>success</span><span style="color:var(--ds-color-status-success);font-size:var(--ds-text-xs)">✓ 创建成功</span></div>
        </div>
        <h3 style="font-size:var(--ds-text-sm);margin:16px 0 8px">Component Playground（尺寸 / 变体）</h3>
        <div class="state-cell" style="display:block"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><button class="btn btn-primary btn-sm">Small 32</button><button class="btn btn-primary">Medium 36</button><button class="btn btn-primary btn-lg">Large 40</button><button class="btn btn-primary btn-touch">Touch 44</button></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-outline">Outline</button><button class="btn btn-ghost">Ghost</button><button class="btn btn-destructive">Destructive</button></div></div>
      </div>
      <div>
        <h3 style="font-size:var(--ds-text-sm);margin-bottom:8px">Color Contrast Checker（真实 WCAG 计算）</h3>
        <div class="contrast-row"><label>前景 <input type="color" id="cc-fg" value="#0F172A" /></label><label>背景 <input type="color" id="cc-bg" value="#FFFFFF" /></label><span class="mono" id="cc-hex"></span></div>
        <div class="contrast-result" id="cc-result" role="status">—</div>
        <h3 style="font-size:var(--ds-text-sm);margin:16px 0 8px">Font Preview（10 档字号 · 真实渲染）</h3>
        <div>${typeSteps}</div>
        <h3 style="font-size:var(--ds-text-sm);margin:16px 0 8px">字重 / 等宽数字</h3>
        <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:var(--ds-text-base)"><span style="font-weight:400">400 ¥ 12,345.67</span><span style="font-weight:500">500 ¥ 12,345.67</span><span style="font-weight:600">600 ¥ 12,345.67</span><span style="font-weight:700">700 ¥ 12,345.67</span></div>
        <div style="margin-top:8px;font-family:var(--ds-font-mono);font-variant-numeric:var(--ds-numeric-tabular)">1,284,930 tokens · sk-****abcd · req_01HX8Z</div>
      </div>
    </div>
    <h3 style="font-size:var(--ds-text-sm);margin:var(--ds-space-5) 0 8px">Design Principles（10 项）</h3>
    <div class="grid3">${PRINCIPLES.map(([en, zh, desc]) => `<div class="state-cell"><span>${esc(en)}</span><strong style="font-size:var(--ds-text-sm)">${esc(zh)}</strong><span style="color:var(--page-fg)">${esc(desc)}</span></div>`).join('')}</div>
  </section>

  <section class="panel" id="gradient">
    <h2>Gradient Typography · 新旧对比（专项 01-S）</h2>
    <p class="panel-sub">UDS 8.0.0 渐变 Light 最差 <strong>${v.gradient.light.finalWorst.ratio}:1</strong> / Dark <strong>${v.gradient.dark.finalWorst.ratio}:1</strong>（${v.sampleCount} 点采样 · ${esc(v.interpolation)} 插值），E28 例外注销。7 种真实背景的最差值见「渐变 7 背景矩阵」。</p>
    <div class="grid2">
      <div>
        <div class="gradient-box"><h4>当前实现（历史基线 · #60A5FA → #A78BFA → #A855F7）</h4><div class="g-old g-hero">Uter · AI Token 中转站</div><div class="g-old g-cta">Build with confidence</div><div class="g-old g-body">为开发者而生的专业技术服务平台</div></div>
        <div class="gradient-box"><h4>UDS 8.0.0 设计（唯一出口 ds-text-gradient-brand · Token 自动切换 Light/Dark）</h4><div class="g-new g-hero">Uter · AI Token 中转站</div><div class="g-new g-cta">Build with confidence</div><div class="g-new g-body">为开发者而生的专业技术服务平台</div></div>
      </div>
      <div>
        <div class="gradient-box"><h4>不同字号 / 字重 / 多行 / 中英混排</h4>
          <div class="g-new" style="font-size:var(--ds-text-5xl);line-height:var(--ds-leading-display);font-weight:600">48px / 56px semibold</div>
          <div class="g-new" style="font-size:var(--ds-text-4xl);line-height:var(--ds-leading-h1);font-weight:700">36px Hero 主标题</div>
          <div class="g-new" style="font-size:var(--ds-text-3xl);line-height:var(--ds-leading-h2);font-weight:500">30px CTA 标题 Build for Developers</div>
          <div class="g-new" style="font-size:var(--ds-text-base);line-height:var(--ds-leading-long);font-weight:400">14px 品牌展示文字 Uter AI Token 中转站 · 多行标题第二行验证行高与渐变覆盖</div>
        </div>
        <div class="gradient-box"><h4>使用边界</h4><p class="note">允许：Hero 主标题、CTA 标题、经批准的品牌展示标题。<br>禁止：普通正文、表格文字、表单标签、错误 / 成功提示、支付状态、余额数字、API Key、代码示例、关键业务数据。</p><p class="note">唯一出口 <code>${esc(T['--ds-gradient-utility'].light)}</code>；业务页面不得自写 <code>linear-gradient</code> / <code>bg-clip-text</code> / <code>text-transparent</code>。</p></div>
      </div>
    </div>
    <h3 style="font-size:var(--ds-text-sm);margin:var(--ds-space-5) 0 8px">渐变插值采样对比度（每 10% 摘录，完整 ${v.sampleCount} 点见 CONTRAST-VERIFICATION-REPORT.md 与渐变 7 背景矩阵）</h3>
    <div class="table-wrap" tabindex="0" role="region" aria-label="可滚动数据表"><table><thead><tr><th>位置</th><th>Light 色</th><th>canvas</th><th>surface</th><th>code-bg</th><th>Dark 色</th><th>canvas</th><th>surface</th><th>code-bg</th></tr></thead><tbody>${gradientSampleTable}</tbody></table></div>
    <p class="note">阈值：普通文字 ≥4.5:1、大号文字 ≥3:1。本方案按更严格的 4.5:1 冻结，无字号例外。方向 <code>${esc(cssVal(T['--ds-gradient-direction'], 'light'))}</code> · 字体 <code>var(--ds-font-ui)</code>（不得改变字体 / 字重 / 字号 / 行高）。</p>
  </section>

  <section class="panel" id="syntax">
    <h2>Syntax Highlighting Preview（专项 24-S）</h2>
    <p class="panel-sub">20 个语义 Token × Light / Dark，全部在真实代码背景上实测：Light 最低 ${v.syntax.light.minRatio}:1、Dark 最低 ${v.syntax.dark.minRatio}:1。${LANG_SAMPLES.length} 种静态语言示例统一走 <code>--ds-syntax-*</code>；<a href="#vscode">VS Code 四栏对照</a> 使用 Shiki 真实 TextMate grammar 解析的 15 种语言，<a href="#terminal">Terminal / ANSI16</a> 使用独立终端色系。</p>
    <h3 style="font-size:var(--ds-text-sm);margin-bottom:8px">全部语法色板</h3>
    <div class="syn-grid">${syntaxSwatches}</div>
    <h3 style="font-size:var(--ds-text-sm);margin:var(--ds-space-5) 0 8px">语言示例（${LANG_SAMPLES.length} 种 · 行号 / 选区 / 语言标签 / 复制）</h3>
    <div class="grid2">${langBlocks}</div>
    <h3 style="font-size:var(--ds-text-sm);margin:var(--ds-space-5) 0 8px">引擎统一映射（5 个真实存在的引擎）</h3>
    <div class="table-wrap" tabindex="0" role="region" aria-label="可滚动数据表"><table><thead><tr><th>引擎</th><th>版本 / 位置</th><th>Adapter</th><th>Renderer</th></tr></thead><tbody>${M.highlighterEngines.map((e) => `<tr><td>${esc(e.name)}</td><td>${esc(e.version)}</td><td>${esc(e.adapter)}</td><td><code>${esc(e.renderer)}</code></td></tr>`).join('')}</tbody></table></div>
    <p class="note">JSON 编辑器（Yace）禁止使用 chart-1..5；映射 property / string / number / boolean / null / punctuation 到对应 <code>--ds-syntax-*</code>。inserted / deleted / invalid 除颜色外另有 <code>+ / - / 波浪下划线</code> 标识。不支持语言降级 Plain Text 并显示 <code>text</code> 标签。</p>
  </section>

  <section class="panel" id="pages">
    <h2>真实产品页面预览（结构示意）</h2>
    <p class="panel-sub">基于 <code>web/src/routes/</code> 扫描到的 ${routeFiles.length} 个真实路由文件与 ${sourceComponents.length} 个已登记组件。**结构示意不等于真实运行的 React 组件**；Phase 6 全站迁移完成后需替换为真实组件预览并做视觉回归。</p>
    <div class="page-grid">${pageCards}</div>
    <p class="note">状态 <code>STATIC_STRUCTURE_PREVIEW</code> · 不宣称 VERIFIED。真实产品内页面入口：<code>/design-system/8.0.0/index.html</code>（由 <code>web/public/</code> 托管，构建时复制进 <code>dist/</code>）。</p>
  </section>

${extensionSections}

  <section class="panel" id="tokens">
    <h2>完整 Token 清单（${M.tokenCount} 个 · 零遗漏）</h2>
    <p class="panel-sub">P = Primitive / S = Semantic / C = Component。每行同时给出 <strong>HEX + RGB</strong>、运行时 Token 名（<code>--ds8-*</code>）、真实消费者、对比度要求与 <code>MEASURED / DECLARED</code> 实测标记。点击任意行打开 Token Inspector。所有数值与 <code>runtime/tokens.css</code>、<code>runtime/tokens.ts</code> 一致，由检查器校验。</p>
    <div class="table-wrap x-scroll" tabindex="0" role="region" aria-label="完整 Token 清单（可滚动）" style="max-height:640px;overflow:auto"><table class="token-table"><thead><tr><th>Token / Runtime</th><th>层 / 类别 / 颜色层</th><th>Light HEX+RGB</th><th>Dark HEX+RGB</th><th>单位</th><th>语义说明</th><th>真实消费者</th><th>实测标记 / 对比度要求</th></tr></thead><tbody>${tokenRows}</tbody></table></div>
  </section>

  <h2 style="font-size:var(--ds-text-3xl);margin:var(--ds-space-10) 0 var(--ds-space-2)">36 个规范模块 + 2 个专项规范</h2>
  <p class="panel-sub">每个模块包含 Overview / Rules / Tokens / Visual Preview / Interactive Preview / Usage / Do / Don't / Accessibility / Responsive / Acceptance 共 11 个小节，并提供规范文件链接。</p>
${moduleSections}

  <footer class="footer">
    UTER DESIGN SYSTEM ${esc(M.version)} · 状态 <strong>${esc(M.status)}</strong> · 视觉审核 <strong>PENDING_USER_REVIEW</strong> · ACCEPTED = false<br>
    单一数值来源 <code>TOKEN-MANIFEST.json</code> · 生成器 <code>registry/build.mjs</code> · 检查器 <code>web/scripts/check-design-system-8.0.0.mjs</code><br>
    本页零外链、0 个 &lt;img&gt;、可 <code>file://</code> 打开。参考产品成熟设计原则，不复制其品牌标识或专有实现。
  </footer>
</main>

<div id="inspector" role="dialog" aria-label="Token Inspector">
  <button class="ins-close" id="ins-close" aria-label="关闭 Token Inspector">×</button>
  <h4>Token Inspector</h4>
  <dl id="ins-body"></dl>
  <button class="btn btn-outline copy-token" id="ins-copy">复制 Token 名</button>
</div>

<script id="uds8-manifest" type="application/json">${JSON.stringify(manifestMini).replace(/</g, '\\u003c')}</script>
<script>
(function () {
  var doc = document.documentElement, body = document.body;
  var THEME_KEY = 'uds8-theme';
  function setTheme(t) { doc.setAttribute('data-ds-theme', t); try { localStorage.setItem(THEME_KEY, t); } catch (e) {} }
  try { var saved = localStorage.getItem(THEME_KEY); if (saved) setTheme(saved); } catch (e) {}
  document.getElementById('theme-toggle').addEventListener('click', function () {
    setTheme(doc.getAttribute('data-ds-theme') === 'dark' ? 'light' : 'dark');
  });
  document.getElementById('viewport-select').addEventListener('change', function (e) { body.setAttribute('data-viewport', e.target.value); });

  // Token Inspector
  var ins = document.getElementById('ins'), insBody = document.getElementById('ins-body'), currentToken = null;
  var TOKENS = ${JSON.stringify(Object.fromEntries(names.map((n) => [n, { light: cssVal(T[n], 'light'), dark: cssVal(T[n], 'dark'), unit: T[n].unit, layer: T[n].layer, description: T[n].description, themeIndependent: T[n].themeIndependent }]))).replace(/</g, '\\u003c')};
  function openInspector(name) {
    var t = TOKENS[name]; if (!t) return;
    currentToken = name;
    insBody.innerHTML = '<dt>Token</dt><dd>' + name + '</dd>' +
      '<dt>Layer</dt><dd>' + t.layer + '</dd>' +
      '<dt>Unit</dt><dd>' + t.unit + '</dd>' +
      '<dt>Light</dt><dd>' + t.light + '</dd>' +
      '<dt>Dark</dt><dd>' + (t.themeIndependent ? '—（主题无关）' : t.dark) + '</dd>' +
      '<dt>说明</dt><dd>' + t.description + '</dd>';
    ins.classList.add('open');
  }
  document.addEventListener('click', function (e) {
    var row = e.target.closest('[data-token]');
    if (row) { openInspector(row.getAttribute('data-token')); }
  });
  document.getElementById('ins-close').addEventListener('click', function () { ins.classList.remove('open'); });
  document.getElementById('inspector-toggle').addEventListener('click', function () { openInspector('--ds-color-brand-1'); });
  document.getElementById('ins-copy').addEventListener('click', function () {
    if (!currentToken) return;
    var btn = document.getElementById('ins-copy');
    function done(ok) { btn.textContent = ok ? '✓ 已复制' : '复制失败'; setTimeout(function () { btn.textContent = '复制 Token 名'; }, 1200); }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(currentToken).then(function () { done(true); }, function () { done(false); }); }
    else { done(false); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') ins.classList.remove('open'); });

  // 复制代码示例
  document.querySelectorAll('.copy-btn').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var pre = document.getElementById(b.getAttribute('data-copy'));
      if (!pre) return;
      var txt = pre.innerText;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(function () { b.textContent = '✓ 已复制'; setTimeout(function () { b.textContent = '复制'; }, 1200); });
      }
    });
  });

  // WCAG 对比度检查器（与 contrast-engine.mjs 同一公式）
  function lum(hex) {
    var h = hex.replace('#', '');
    var rgb = [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16) / 255; });
    var lin = rgb.map(function (s) { return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  }
  function ratio(a, b) { var x = lum(a), y = lum(b), hi = Math.max(x, y), lo = Math.min(x, y); return (hi + 0.05) / (lo + 0.05); }
  var fg = document.getElementById('cc-fg'), bg = document.getElementById('cc-bg');
  function updateContrast() {
    var r = ratio(fg.value, bg.value), pass45 = r >= 4.5, pass30 = r >= 3;
    document.getElementById('cc-hex').textContent = fg.value.toUpperCase() + ' / ' + bg.value.toUpperCase();
    var out = document.getElementById('cc-result');
    out.className = 'contrast-result ' + (pass45 ? 'pass' : 'fail');
    out.innerHTML = '<strong>' + (Math.round(r * 100) / 100) + ':1</strong> · 普通文字 4.5:1 <strong>' + (pass45 ? 'PASS' : 'FAIL') + '</strong> · 大号文字 3:1 <strong>' + (pass30 ? 'PASS' : 'FAIL') + '</strong> · 非文本 3:1 <strong>' + (pass30 ? 'PASS' : 'FAIL') + '</strong>';
  }
  fg.addEventListener('input', updateContrast); bg.addEventListener('input', updateContrast); updateContrast();

  // 当前模块导航高亮
  var navs = Array.prototype.slice.call(document.querySelectorAll('.nav-item[data-nav]'));
  var secs = Array.prototype.slice.call(document.querySelectorAll('.module'));
  function onScroll() {
    var y = window.scrollY + 140, active = null;
    secs.forEach(function (s) { if (s.offsetTop <= y) active = s.getAttribute('data-module-id'); });
    navs.forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-nav') === active); });
  }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
})();
</script>
</body>
</html>
`
}

/* 模块专属 Visual / Interactive 预览 */
function visualPreview(id) {
  if (id === '03') return `<div class="syn-grid">${['surface-canvas', 'surface-base', 'text-primary', 'text-secondary', 'border-default', 'status-success', 'status-warning', 'status-danger', 'status-info', 'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'focus-ring', 'selection-background'].map((n) => `<div class="syn-sw" data-token="--ds-color-${n}"><span class="syn-dot" style="background:var(--ds-color-${n})"></span><code>--ds-color-${n}</code></div>`).join('')}</div>`
  if (id === '04' || id === '33') return `<div style="font-size:var(--ds-text-2xl);font-weight:600">Uter 字体体系 36px</div><div style="font-size:var(--ds-text-sm)">正文 14px / 22px · 中英混排 AI Token 中转站</div><div style="font-family:var(--ds-font-mono);font-size:var(--ds-text-xs)">sk-****abcd · 1,284,930 tokens</div>`
  if (id === '01' || id === '01-S') return `<div class="g-new g-cta">Uter · AI Token 中转站</div><p class="note">唯一出口 <code>ds-text-gradient-brand</code>，Token 自动切换 Light / Dark。</p>`
  if (id === '24' || id === '24-S') return `<pre class="code"><code><span class="syn syn-keyword">const</span> <span class="syn syn-variable">client</span> <span class="syn syn-operator">=</span> <span class="syn syn-function">createClient</span>(<span class="syn syn-string">'sk-...'</span>)</code></pre>`
  if (id === '18') return `<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary">Primary</button><button class="btn btn-outline">Outline</button><button class="btn btn-ghost">Ghost</button><button class="btn btn-destructive">Destructive</button></div>`
  if (id === '19' || id === '20') return `<div style="display:flex;gap:8px;flex-wrap:wrap"><input class="inp" placeholder="API Key 名称" aria-label="API Key 名称输入框示例" /><input class="inp inp-error" value="错误状态" aria-label="错误状态输入框示例" /><input class="inp" value="禁用" disabled aria-label="禁用状态输入框示例" /></div>`
  if (id === '21') return `<div style="display:flex;gap:8px;flex-wrap:wrap"><span class="status-pill">success</span><span class="status-pill" style="background:var(--ds-color-status-danger-soft);border-color:var(--ds-color-status-danger-border)">danger</span><span class="status-pill" style="background:var(--ds-color-status-info-soft);border-color:var(--ds-color-status-info-border)">info</span></div>`
  if (id === '27' || id === '23' || id === '30') return `<div style="font-family:var(--ds-font-mono);font-variant-numeric:var(--ds-numeric-tabular);font-size:var(--ds-text-3xl);font-weight:600;text-align:right">¥ 12,345.67</div><p class="note">金额 / Token 强制等宽数字右对齐</p>`
  if (id === '09') return `<div style="display:flex;gap:12px;flex-wrap:wrap">${[1, 2, 3, 4].map((i) => `<div data-token="--ds-elevation-${i}" style="width:80px;height:56px;border:1px solid var(--page-border);border-radius:8px;box-shadow:var(--ds-elevation-${i});background:var(--page-surface)"></div>`).join('')}</div>`
  if (id === '07') return `<div style="display:flex;gap:10px;flex-wrap:wrap">${['none', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full'].map((k) => `<div data-token="--ds-radius-${k}" style="width:64px;height:48px;border:1px solid var(--page-border);border-radius:var(--ds-radius-${k});background:var(--ds-color-surface-sunken);display:grid;place-items:center;font-size:var(--ds-text-2xs)">${k}</div>`).join('')}</div>`
  if (id === '05') return `<div style="display:flex;align-items:flex-end;gap:4px">${[1, 2, 3, 4, 5, 6, 8, 10].map((k) => `<div data-token="--ds-space-${k}" style="width:20px;height:var(--ds-space-${k});background:var(--ds-color-brand-1);border-radius:2px"></div>`).join('')}</div>`
  return `<div style="display:flex;gap:8px;flex-wrap:wrap"><span class="chip" style="width:32px;height:32px;background:var(--ds-color-brand-1)"></span><span class="chip" style="width:32px;height:32px;background:var(--ds-color-surface-sunken)"></span><span class="chip" style="width:32px;height:32px;background:var(--ds-color-border-strong)"></span></div><p class="note">真实 DOM 预览 · 切换主题查看 Dark 值</p>`
}

function interactivePreview(id) {
  if (id === '11') return `<button class="btn btn-outline" id="motion-demo">试一下 100ms Hover / Focus 过渡</button><style>#motion-demo{transition:background var(--ds-motion-fast) var(--ds-easing-standard),transform var(--ds-motion-normal) var(--ds-easing-standard)}#motion-demo:hover{transform:translateY(-2px)}</style>`
  if (id === '13') return `<button class="btn btn-outline" onclick="this.focus();this.style.outline='var(--ds-focus-ring-width) solid var(--ds-color-focus-ring)';this.style.outlineOffset='var(--ds-focus-ring-offset)'">触发 Focus Visible</button>`
  if (id === '22') return `<button class="btn btn-outline" onclick="document.getElementById('inspector').classList.add('open')">打开浮层示例（Token Inspector）</button>`
  if (id === '15') return `<div style="display:flex;gap:4px;align-items:flex-end;height:90px">${[45, 72, 58, 88, 64].map((h, i) => `<div data-token="--ds-color-chart-${i + 1}" style="width:36px;height:${h}%;background:var(--ds-color-chart-${i + 1});border-radius:3px 3px 0 0"></div>`).join('')}</div>`
  return `<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary btn-sm">默认</button><button class="btn btn-outline btn-sm">悬停 / 聚焦可试</button><button class="btn btn-outline btn-sm" disabled>禁用</button></div>`
}
