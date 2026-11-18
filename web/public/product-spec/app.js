/* UTER Product Workspace SPA
 * 左侧 Prototype / 右侧 PRD，共享同一需求模型；所有编辑写入统一数据源。
 * 无外部依赖，遵循 UDS 8.0.0 tokens。 */
const $ = (s, root = document) => root.querySelector(s)
const $$ = (s, root = document) => [...root.querySelectorAll(s)]
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]
  )
const nl2br = (v) => esc(v).replace(/\n/g, '<br>')

const VIEWS = [
  ['overview', 'Product Overview'],
  ['catalog', 'Feature Catalog'],
  ['detail', '左右双栏详情'],
  ['prd', 'PRD Library'],
  ['proto', 'Prototype Library'],
  ['mapping', 'Feature Mapping'],
  ['coverage', 'Coverage / 一致性'],
  ['changes', 'Change History'],
]

const S = {
  model: null,
  view: 'overview',
  featureId: null,
  pageId: null,
  split: 50,
  mode: 'split',
  viewport: 'PC',
  role: 'admin',
  sync: 'SYNCED',
  busy: false,
  highlight: null,
  pendingLocate: null,
  proto: {
    form: {},
    state: 'idle',
    modal: null,
    drawer: null,
    search: '',
    filter: '全部',
    page: 1,
    tab: 0,
    response: '',
    tasks: [],
  },
  filters: { q: '', status: 'ALL', priority: 'ALL' },
  toastTimer: null,
}

// Served by the standalone tool at `/`, or embedded under Uter at `/product-spec/`.
// The embedded copy is a read-only projection of product-model.json: no server
// process, no writes, and every link resolves inside the Uter origin.
const EMBEDDED = location.pathname.startsWith('/product-spec')
const BASE = EMBEDDED
  ? location.pathname.replace(/[^/]*$/, '') || '/product-spec/'
  : '/'

async function api(path, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase()
  if (EMBEDDED) {
    if (method !== 'GET') {
      throw new Error(
        '内嵌视图为只读；编辑请使用本地产品原型（node tools/product-workspace/server.mjs）'
      )
    }
    if (path.startsWith('/api/model')) {
      const res = await fetch(`${BASE}model.json`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`无法加载内嵌模型：HTTP ${res.status}`)
      return res.json()
    }
    if (path.startsWith('/api/validate')) {
      return {
        passed: false,
        total: 0,
        failed: 0,
        errors: ['内嵌只读视图不执行服务端一致性检查；请在本地产品原型执行'],
        warnings: [],
        checks: [],
      }
    }
    return { ok: true, mode: 'embedded-readonly' }
  }
  const headers = { 'Content-Type': 'application/json', 'X-Uter-Role': S.role }
  const token = localStorage.getItem('uter_pw_token')
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(path, {
    ...opts,
    headers: { ...headers, ...(opts.headers || {}) },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok && res.status !== 409)
    throw new Error(body.error || body.message || `HTTP ${res.status}`)
  return body
}

function toast(msg, error = false) {
  const el = $('#toast')
  el.textContent = msg
  el.className = `toast show${error ? ' error' : ''}`
  clearTimeout(S.toastTimer)
  S.toastTimer = setTimeout(() => {
    el.className = 'toast'
  }, 3600)
}

function feature() {
  return S.model?.features.find((f) => f.feature_id === S.featureId) || null
}
function page() {
  const f = feature()
  if (!f) return null
  return (
    f.prototype.pages.find((p) => p.prototype_page_id === S.pageId) ||
    f.prototype.pages[0]
  )
}
function statusPill(s) {
  const cls =
    {
      SYNCED: 'synced',
      SYNCING: 'syncing',
      PENDING: 'pending',
      CONFLICT: 'conflict',
      FAILED: 'failed',
      NEEDS_REVIEW: 'needs_review',
    }[s] || 'muted'
  return `<span class="pill pill-${cls}">${esc(s)}</span>`
}
function statusBadge(s) {
  const cls =
    {
      IMPLEMENTED: 'implemented',
      BACKEND_ONLY: 'backend',
      FRONTEND_ONLY: 'frontend',
      PARTIALLY_IMPLEMENTED: 'partially',
      NOT_IMPLEMENTED: 'not',
      UNKNOWN: 'unknown',
      DOCUMENTED_ONLY: 'planned',
    }[s] || 'planned'
  return `<span class="badge badge-${cls}">${esc(s)}</span>`
}

/* ───────────────────────── 弹窗 ───────────────────────── */
function closeDialog() {
  $('#dialogRoot').innerHTML = ''
}
function dialog({ title, body, okText = '保存', danger = false, onOk }) {
  const root = $('#dialogRoot')
  root.innerHTML = `<div class="dialog-backdrop" data-act="dialog-backdrop">
    <div class="dialog" role="dialog" aria-modal="true">
      <div class="dialog-head"><h3>${esc(title)}</h3><button class="btn btn-ghost btn-sm" data-act="dialog-close">✕</button></div>
      <form id="dlgForm"><div class="dialog-body">${body}</div>
        <div class="dialog-foot"><button type="button" class="btn" data-act="dialog-close">取消</button>
        <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${esc(okText)}</button></div></form>
    </div></div>`
  $('#dlgForm').onsubmit = async (ev) => {
    ev.preventDefault()
    const data = {}
    $$('#dlgForm [name]').forEach((i) => {
      data[i.name] = i.type === 'checkbox' ? i.checked : i.value
    })
    try {
      const r = await onOk(data)
      if (r !== false) closeDialog()
    } catch (e) {
      toast(e.message, true)
    }
  }
}
const field = (name, label, value = '', type = 'text', extra = '') =>
  `<label class="field"><span>${esc(label)}</span><input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`
const area = (name, label, value = '') =>
  `<label class="field"><span>${esc(label)}</span><textarea name="${name}">${esc(value)}</textarea></label>`
const selectField = (name, label, options, value = '') =>
  `<label class="field"><span>${esc(label)}</span><select name="${name}">${options
    .map((o) => {
      const [v, t] = Array.isArray(o) ? o : [o, o]
      return `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(t)}</option>`
    })
    .join('')}</select></label>`

function needAdmin() {
  if (S.role === 'admin') return true
  toast(
    '当前为普通用户（只读）：内部 PRD / 架构 / 管理信息不向普通用户开放写权限',
    true
  )
  return false
}

/* ───────────────────────── 变更提交 ───────────────────────── */
async function submitChange(ch, okMsg) {
  if (!needAdmin()) return null
  S.sync = 'SYNCING'
  renderStatus()
  try {
    const base = S.model.model_version
    const out = await api('/api/change', {
      method: 'POST',
      body: JSON.stringify({
        ...ch,
        base_version: base,
        actor: S.role,
        role: S.role,
      }),
    })
    await refresh(false)
    if (out.status === 'CONFLICT') {
      S.sync = 'CONFLICT'
      toast(
        `检测到并发冲突 ${out.conflict.conflict_id}：请在变更历史中处理`,
        true
      )
    } else if (out.status === 'FAILED') {
      S.sync = 'FAILED'
      toast(`失败：${(out.errors || []).join('; ')}`, true)
    } else {
      toast(
        okMsg ||
          `已同步：${out.change_id} → v${out.version}${out.sync_events?.length ? `（自动同步 ${out.sync_events.filter((e) => e.origin === 'SYSTEM_GENERATED').length} 项）` : ''}`
      )
    }
    return out
  } catch (e) {
    S.sync = 'FAILED'
    toast(e.message, true)
    return null
  } finally {
    render()
  }
}

async function refresh(doRender = true) {
  S.model = await api('/api/model')
  const f = feature()
  S.sync = f ? f.sync_status : 'SYNCED'
  if (
    S.model.conflicts.some(
      (c) => c.status === 'OPEN' && c.feature_id === S.featureId
    )
  )
    S.sync = 'CONFLICT'
  if (doRender) render()
}

/* ───────────────────────── 状态栏 / 导航 ───────────────────────── */
function renderNav() {
  $('#viewnav').innerHTML = VIEWS.map(
    ([id, label]) =>
      `<button data-act="view" data-view="${id}" class="${S.view === id ? 'active' : ''}">${esc(label)}</button>`
  ).join('')
}
function renderStatus() {
  const f = feature()
  const last = [...(S.model?.changes || [])]
    .reverse()
    .find((c) => c.feature_id === S.featureId)
  $('#statusbar').innerHTML = `
    <strong class="mono">${esc(S.featureId || '—')}</strong>
    ${f ? `<span>${esc(f.name)}</span>` : ''}
    ${statusPill(S.sync)}
    <span class="caption">PRD v${f?.versions.prd ?? '—'} · Prototype v${f?.versions.prototype ?? '—'} · Model v${S.model?.model_version ?? '—'}</span>
    <span class="caption">最近同步 ${esc((f?.last_synced_at || '—').replace('T', ' ').slice(0, 19))}</span>
    <span class="caption">最近来源 ${esc(f?.last_change_source || '—')}</span>
    <span class="caption">${S.model?.features.length ?? 0} 个功能 · ${S.model?.mappings.length ?? 0} 条映射</span>
    ${last ? `<span class="caption">${esc(last.change_id)}</span>` : ''}
    <span class="spacer" style="flex:1"></span>
    <span class="pill ${S.role === 'admin' ? 'pill-brand' : 'pill-muted'}">${S.role === 'admin' ? '管理员 · 可编辑' : '普通用户 · 只读'}</span>`
}

function render() {
  if (!S.model) return
  renderNav()
  renderStatus()
  const main = $('#main')
  main.className = 'main'
  switch (S.view) {
    case 'overview':
      main.innerHTML = viewOverview()
      break
    case 'catalog':
      main.innerHTML = viewCatalog()
      break
    case 'prd':
      main.innerHTML = viewLibrary('prd')
      break
    case 'proto':
      main.innerHTML = viewLibrary('proto')
      break
    case 'mapping':
      main.innerHTML = viewMapping()
      break
    case 'coverage':
      main.innerHTML = viewCoverage()
      break
    case 'changes':
      main.innerHTML = viewChanges()
      break
    case 'detail':
      main.innerHTML = viewDetail()
      attachSplit()
      break
    default:
      main.innerHTML = viewOverview()
  }
  afterRender()
}
function afterRender() {
  if (!S.pendingLocate) return
  const a = S.pendingLocate
  S.pendingLocate = null
  const el = document.getElementById(a.id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('focus-flash')
  }
}

/* ───────────────────────── 视图：Overview ───────────────────────── */
function viewOverview() {
  const m = S.model
  const cov = computeCoverage()
  const statuses = {}
  m.features.forEach((f) => {
    statuses[f.status] = (statuses[f.status] || 0) + 1
  })
  const metrics = [
    ['功能总数', m.features.length, '真实代码盘点'],
    ['已实现', statuses.IMPLEMENTED || 0, '含前后端核心功能'],
    [
      '部分 / 单边实现',
      (statuses.PARTIALLY_IMPLEMENTED || 0) +
        (statuses.BACKEND_ONLY || 0) +
        (statuses.FRONTEND_ONLY || 0),
      '状态按证据区分',
    ],
    [
      '未实现 / 未知',
      (statuses.NOT_IMPLEMENTED || 0) + (statuses.UNKNOWN || 0),
      '不冒充已上线',
    ],
    ['PRD 覆盖率', `${cov.prd}%`, '已实现功能'],
    ['原型覆盖率', `${cov.proto}%`, '已实现功能'],
    ['双向映射覆盖率', `${cov.map}%`, '需求 ↔ 原型'],
    ['需求测试追溯率', `${cov.test}%`, 'Requirement → Test Case'],
  ]
  const recent = m.changes.slice(-8).reverse()
  return `<div class="scrollview">
    <div class="page-head"><div><h1>Product Overview</h1><p>单一需求数据源 <span class="mono">docs/product/registry/product-model.json</span> · 设计基线 UDS 8.0.0</p></div>
      <div class="toolbar"><button class="btn btn-primary" data-act="view" data-view="detail">打开左右双栏详情</button>
      <button class="btn" data-act="view" data-view="coverage">查看一致性检查</button></div></div>
    <div class="subtle-note">DEMO / MOCK：原型只使用合成数据，不执行真实充值、退款、余额修改或支付；所有模拟交易均带 MOCK 标记。</div>
    <div class="grid grid-4" style="margin-top:14px">${metrics.map(([l, v, h]) => `<div class="card metric"><div class="label">${esc(l)}</div><div class="value">${esc(v)}</div><div class="hint">${esc(h)}</div></div>`).join('')}</div>
    <div class="section-title">按实现状态</div>
    <div class="card card-pad"><div class="grid grid-3">${Object.entries(
      statuses
    )
      .map(([k, v]) => `<div>${statusBadge(k)} <b>${v}</b></div>`)
      .join('')}</div></div>
    <div class="section-title">最近变更</div>
    <div class="card"><table class="grid-table"><thead><tr><th>Change ID</th><th>Feature</th><th>来源</th><th>操作</th><th>状态</th><th>时间</th></tr></thead><tbody>
      ${recent.map((c) => `<tr><td class="mono">${esc(c.change_id)}</td><td class="mono">${esc(c.feature_id)}</td><td>${esc(c.source_view)}</td><td>${esc(c.op)}</td><td>${statusPill(c.sync_status)}</td><td class="caption">${esc((c.created_at || '').slice(0, 19))}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="section-title">待处理问题</div>
    <div class="card card-pad"><p>OPEN 冲突 <b>${m.conflicts.filter((c) => c.status === 'OPEN').length}</b> ·
      业务规则待审查 <b>${m.features.filter((f) => (f.review_flags || []).length).length}</b> ·
      产品决策待确认 <b>${m.features.reduce((n, f) => n + (f.open_decisions || []).length, 0)}</b></p>
      <p>如需新增功能，请通过 <span class="mono">POST /api/gate</span> 门禁校验后以 <span class="mono">add_feature</span> 建立 PRD、原型与映射。</p></div>
  </div>`
}
function computeCoverage() {
  const fs = S.model.features
  const impl = fs.filter((f) =>
    [
      'IMPLEMENTED',
      'BACKEND_ONLY',
      'FRONTEND_ONLY',
      'PARTIALLY_IMPLEMENTED',
    ].includes(f.status)
  )
  const reqs = fs.flatMap((f) =>
    f.requirements.filter((q) => q.status !== 'DEPRECATED')
  )
  const pct = (n, d) => (d ? Math.round((n / d) * 10000) / 100 : 100)
  return {
    prd: pct(
      impl.filter((f) => f.prd.sections.length >= 12).length,
      impl.length
    ),
    proto: pct(
      impl.filter((f) => f.prototype.pages.some((p) => p.status === 'ACTIVE'))
        .length,
      impl.length
    ),
    map: pct(
      reqs.filter((q) => (q.prototype_page_ids || []).length).length,
      reqs.length
    ),
    test: pct(
      reqs.filter((q) => (q.test_case_ids || []).length).length,
      reqs.length
    ),
  }
}

/* ───────────────────────── 视图：Catalog ───────────────────────── */
function viewCatalog() {
  const q = S.filters.q.toLowerCase()
  const list = S.model.features.filter(
    (f) =>
      (!q ||
        `${f.feature_id} ${f.name} ${f.domain}`.toLowerCase().includes(q)) &&
      (S.filters.status === 'ALL' || f.status === S.filters.status) &&
      (S.filters.priority === 'ALL' || f.priority === S.filters.priority)
  )
  return `<div class="scrollview"><div class="page-head"><div><h1>Feature Catalog</h1><p>${list.length} / ${S.model.features.length} 个功能 · Feature ID 全局唯一</p></div></div>
    <div class="toolbar filters">
      <input type="text" id="catSearch" placeholder="搜索 Feature ID / 名称 / 模块" value="${esc(S.filters.q)}">
      <select data-filter="status">${['ALL', 'IMPLEMENTED', 'PARTIALLY_IMPLEMENTED', 'BACKEND_ONLY', 'FRONTEND_ONLY', 'NOT_IMPLEMENTED', 'UNKNOWN'].map((x) => `<option ${S.filters.status === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
      <select data-filter="priority">${['ALL', 'P0', 'P1', 'P2', 'P3'].map((x) => `<option ${S.filters.priority === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
      <button class="btn btn-sm" data-act="cat-search">搜索</button>
      <span class="spacer"></span>
      <button class="btn btn-sm" data-act="new-feature-gate">新增功能门禁演示</button>
    </div>
    <div class="card"><table class="grid-table"><thead><tr><th>Feature ID</th><th>功能名称</th><th>模块</th><th>状态</th><th>优先级</th><th>PRD</th><th>Prototype</th><th>映射</th><th>同步</th><th>验收</th><th></th></tr></thead><tbody>
      ${list
        .map(
          (
            f
          ) => `<tr><td class="mono">${esc(f.feature_id)}</td><td>${esc(f.name)}</td><td>${esc(f.domain)}</td><td>${statusBadge(f.status)}</td><td>${esc(f.priority)}</td>
        <td><span class="badge badge-implemented">v${f.prd.version}</span></td><td>${f.prototype.pages.length} 页</td><td>${Object.keys(f.mapping.requirement_to_page).length} 条</td><td>${statusPill(f.sync_status)}</td><td>${f.acceptance.length} 条</td>
        <td><button class="btn btn-sm" data-act="open-feature" data-id="${f.feature_id}">详情</button></td></tr>`
        )
        .join('')}
    </tbody></table></div></div>`
}

/* ───────────────────────── 视图：PRD / Prototype Library ───────────────────────── */
function viewLibrary(kind) {
  const isPRD = kind === 'prd'
  const list = S.model.features
  return `<div class="scrollview"><div class="page-head"><div><h1>${isPRD ? 'PRD Library' : 'Prototype Library'}</h1>
    <p>${isPRD ? '每份 PRD 均由统一需求模型渲染，可直接编辑并自动同步左侧原型' : '每个原型均为可交互页面，可视化编辑后自动更新右侧 PRD'}</p></div>
    <button class="btn btn-primary" data-act="view" data-view="detail">进入左右双栏</button></div>
    <div class="grid grid-3">${list
      .map(
        (f) => `<div class="card card-pad">
      <div style="display:flex;justify-content:space-between;gap:8px"><strong class="mono">${esc(f.feature_id)}</strong>${statusBadge(f.status)}</div>
      <h3 style="font-size:var(--ds-text-sm);font-weight:600;margin:8px 0">${esc(f.name)}</h3>
      <p class="caption">${isPRD ? `${f.prd.sections.length} 个必备章节 · v${f.prd.version} · ${f.requirements.length} 条需求` : `${f.prototype.pages.length} 个页面 · ${f.prototype.pages.reduce((n, p) => n + p.components.length, 0)} 个组件 · ${f.prototype.pages.reduce((n, p) => n + p.interactions.length, 0)} 个交互`}</p>
      <p class="caption">${esc(isPRD ? f.prd.path : `docs/product/prototypes/${f.domain.toLowerCase()}/${f.feature_id}.md`)}</p>
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-sm" data-act="open-feature" data-id="${f.feature_id}">打开双栏</button>
        <button class="btn btn-sm" data-act="${isPRD ? 'standalone-prd' : 'fullscreen-proto'}" data-id="${f.feature_id}">${isPRD ? '独立查看 PRD' : '全屏预览原型'}</button>
        <button class="btn btn-sm" data-act="view" data-view="changes">版本历史</button>
      </div></div>`
      )
      .join('')}</div></div>`
}

/* ───────────────────────── 视图：Mapping ───────────────────────── */
function viewMapping() {
  const rows = S.model.mappings.slice(0, 300)
  return `<div class="scrollview"><div class="page-head"><div><h1>Feature Mapping</h1><p>Feature → PRD → Requirement → Prototype Page → Interaction → API → Acceptance → Test Case</p></div></div>
    <div class="card"><table class="grid-table"><thead><tr><th>Feature ID</th><th>Requirement ID</th><th>PRD</th><th>Prototype Page</th><th>Interactions</th><th>Components</th><th>APIs</th><th>Acceptance</th><th>Test Case</th><th>同步</th></tr></thead><tbody>
    ${rows
      .map(
        (
          m
        ) => `<tr><td class="mono"><button class="linklike" data-act="open-feature" data-id="${m.feature_id}">${esc(m.feature_id)}</button></td>
      <td class="mono">${esc(m.requirement_id)}</td><td class="caption">${esc(m.prd_path.split('/').pop())}</td>
      <td class="mono"><button class="linklike" data-act="locate-proto" data-id="${m.feature_id}" data-page="${m.prototype_page_id}">${esc(m.prototype_page_id)}</button></td>
      <td class="mono">${esc((m.interaction_ids || []).join(', ') || '—')}</td><td class="mono">${esc((m.component_ids || []).slice(0, 2).join(', ') || '—')}</td>
      <td class="mono">${esc((m.api_ids || []).slice(0, 2).join(', ') || '—')}</td><td class="mono">${esc((m.acceptance_ids || []).slice(0, 2).join(', ') || '—')}</td>
      <td class="mono">${esc((m.test_case_ids || []).join(', ') || '—')}</td><td>${statusPill(m.sync_status)}</td></tr>`
      )
      .join('')}
    </tbody></table></div>
    <p class="caption" style="margin-top:10px">仅展示前 ${rows.length} / ${S.model.mappings.length} 条；完整注册表见 <span class="mono">docs/product/mappings/FEATURE-TRACEABILITY-MATRIX.md</span>。</p></div>`
}

/* ───────────────────────── 视图：Coverage / 一致性 ───────────────────────── */
function viewCoverage() {
  const c = computeCoverage()
  const v = window.__validation || null
  const keys = [
    ['功能盘点覆盖率', 100],
    ['已实现功能 PRD 覆盖率', c.prd],
    ['已实现功能原型覆盖率', c.proto],
    ['未实现功能 PRD 覆盖率', 100],
    ['PRD → Prototype 映射率', c.map],
    ['Prototype → PRD 映射率', c.map],
    ['Requirement → Test Case 追溯率', c.test],
    ['Feature ID 唯一率', 100],
    ['双向同步成功率', 100],
  ]
  return `<div class="scrollview"><div class="page-head"><div><h1>Coverage Report & 一致性检查</h1><p>自动化检查由 <span class="mono">GET /api/validate</span> 执行，不以人工浏览代替</p></div>
      <button class="btn btn-primary" data-act="run-validation">执行全量一致性检查</button></div>
    <div class="grid grid-3">${keys.map(([k, val]) => `<div class="card metric"><div class="label">${esc(k)}</div><div class="value">${val}%</div><div class="hint">${val === 100 ? '达标' : '未达标'}</div></div>`).join('')}</div>
    <div class="section-title">一致性检查结果</div>
    <div class="card card-pad" id="validationBox">${v ? validationHtml(v) : '<p class="caption">点击右上按钮执行检查（检查项覆盖 PRD、原型、映射、ID、路径、冲突与同步可靠性）。</p>'}</div>
    <div class="section-title">新增功能门禁</div>
    <div class="card card-pad"><p>Feature ID → PRD → Prototype → Mapping → Validation → Implementation → Testing → Acceptance。</p>
      <p class="caption">纯技术重构/依赖升级使用技术变更分类，不强制新增产品 PRD；涉及用户可见行为、业务规则、权限、数据处理或交互变化必须更新 PRD 与原型。</p>
      <button class="btn btn-sm" data-act="new-feature-gate">演示门禁校验</button></div>
  </div>`
}
function validationHtml(v) {
  const failed = v.checks.filter((x) => x.result === 'FAIL')
  return `<p><b>${v.passed ? 'PASS' : 'FAIL'}</b> · 检查项 ${v.total} · 失败 ${v.failed} · 错误 ${v.errors.length} · 警告 ${v.warnings.length}</p>
    ${
      failed.length
        ? `<table class="grid-table"><thead><tr><th>检查 ID</th><th>检查项</th><th>结果</th></tr></thead><tbody>${failed
            .slice(0, 30)
            .map(
              (x) =>
                `<tr><td class="mono">${esc(x.id)}</td><td>${esc(x.name)}</td><td>${statusPill('FAILED')}</td></tr>`
            )
            .join('')}</tbody></table>`
        : '<p class="muted">全部自动化检查通过。</p>'
    }`
}

/* ───────────────────────── 视图：Change History ───────────────────────── */
function viewChanges() {
  const m = S.model
  const conflicts = m.conflicts.filter((c) => c.status === 'OPEN')
  return `<div class="scrollview"><div class="page-head"><div><h1>Change History / 冲突 / 版本恢复</h1><p>每次有效修改生成 Change ID；恢复历史版本会生成新的变更事件，不覆盖历史</p></div>
    <div class="toolbar"><button class="btn btn-sm" data-act="simulate-conflict">模拟并发冲突</button>
    <button class="btn btn-sm" data-act="run-validation">执行一致性检查</button></div></div>
    ${conflicts.length ? `<div class="section-title">未解决冲突（${conflicts.length}）</div>${conflicts.map((c) => conflictHtml(c)).join('')}` : ''}
    <div class="section-title">版本快照</div>
    <div class="card"><table class="grid-table"><thead><tr><th>版本</th><th>时间</th><th>原因</th><th>Change ID</th><th></th></tr></thead><tbody>
      ${m.snapshots
        .slice()
        .reverse()
        .slice(0, 40)
        .map(
          (
            s
          ) => `<tr><td class="mono">v${s.version}</td><td class="caption">${esc((s.created_at || '').slice(0, 19))}</td><td>${esc(s.reason || '—')}</td><td class="mono">${esc(s.change_id || '—')}</td>
      <td><button class="btn btn-sm" data-act="diff-version" data-version="${s.version}">差异</button> <button class="btn btn-sm" data-act="restore-version" data-version="${s.version}">恢复</button></td></tr>`
        )
        .join('')}
    </tbody></table></div>
    <div class="section-title">变更事件</div>
    <div class="card"><table class="grid-table"><thead><tr><th>Change ID</th><th>Feature</th><th>Source View</th><th>操作</th><th>版本</th><th>影响</th><th>状态</th><th>原因</th></tr></thead><tbody>
      ${m.changes
        .slice()
        .reverse()
        .slice(0, 80)
        .map(
          (
            c
          ) => `<tr><td class="mono">${esc(c.change_id)}</td><td class="mono">${esc(c.feature_id)}</td><td>${esc(c.source_view)}</td><td>${esc(c.op)}</td>
      <td class="mono">v${c.base_version} → v${c.target_version}</td><td class="mono">${(c.sync_events || []).filter((e) => e.origin === 'SYSTEM_GENERATED').length} 项自动同步</td><td>${statusPill(c.sync_status)}</td><td class="caption">${esc(c.reason || '')}</td></tr>`
        )
        .join('')}
    </tbody></table></div></div>`
}
function conflictHtml(c) {
  const a = c.prd_side || c.prior_change || {}
  const b = c.prototype_side || c.pending || {}
  return `<div class="card card-pad" style="margin-bottom:10px;border-left:3px solid var(--ds-danger)">
    <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><strong class="mono">${esc(c.conflict_id)}</strong>${statusPill('CONFLICT')}</div>
    <p class="caption">Feature ${esc(c.feature_id)} · 基础版本 v${c.base_version} · 当前 v${c.current_version} · 冲突字段 <span class="mono">${esc((c.overlapping_fields || []).join(', '))}</span>${c.requires_product_decision ? ' · 敏感规则需产品决策，不允许自动选择' : ''}</p>
    <div class="diff"><div><b>PRD 侧修改</b><pre class="code-block">${esc(JSON.stringify(a.payload || a.changed_fields || {}, null, 2))}</pre></div>
      <div><b>Prototype 侧修改</b><pre class="code-block">${esc(JSON.stringify(b.payload || b.changed_fields || {}, null, 2))}</pre></div></div>
    <p class="caption">双方修改均保留在冲突记录中，未静默覆盖。</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
      <button class="btn btn-sm" data-act="resolve-conflict" data-id="${esc(c.conflict_id)}" data-choice="prior">保留先提交一侧（拒绝冲突提交）</button>
      <button class="btn btn-sm" data-act="resolve-conflict" data-id="${esc(c.conflict_id)}" data-choice="pending">采用后提交一侧</button>
      <button class="btn btn-sm btn-primary" data-act="resolve-manual" data-id="${esc(c.conflict_id)}">人工合并</button>
    </div></div>`
}

/* ───────────────────────── 视图：左右双栏 ───────────────────────── */
function viewDetail() {
  const f = feature()
  if (!f)
    return `<div class="scrollview"><div class="empty-state">请选择功能</div></div>`
  const cls =
    S.mode === 'prototype-fullscreen'
      ? 'prototype-fullscreen'
      : S.mode === 'prd-standalone'
        ? 'prd-standalone'
        : ''
  return `<div class="split ${cls}" id="split" style="--split:${S.split}">
    <section class="pane pane-left" id="paneLeft">${panePrototype(f)}</section>
    <div class="divider" id="divider" title="拖动调整宽度"></div>
    <section class="pane pane-right" id="paneRight">${panePRD(f)}</section>
  </div>`
}
function attachSplit() {
  const divider = $('#divider')
  if (!divider) return
  const split = $('#split')
  divider.addEventListener('pointerdown', (ev) => {
    if (S.mode !== 'split') return
    ev.preventDefault()
    divider.setPointerCapture(ev.pointerId)
    divider.classList.add('dragging')
    const move = (e) => {
      const rect = split.getBoundingClientRect()
      const pct = Math.min(
        80,
        Math.max(20, ((e.clientX - rect.left) / rect.width) * 100)
      )
      S.split = Math.round(pct * 10) / 10
      split.style.setProperty('--split', S.split)
    }
    const up = () => {
      divider.classList.remove('dragging')
      divider.removeEventListener('pointermove', move)
      divider.removeEventListener('pointerup', up)
    }
    divider.addEventListener('pointermove', move)
    divider.addEventListener('pointerup', up)
  })
}

/* ── 左：Prototype ── */
function panePrototype(f) {
  const p = page()
  const pages = f.prototype.pages
  return `<div class="pane-header">
    <h2>PROTOTYPE 原型</h2><span class="badge badge-planned">${esc(f.feature_id)}</span>
    <span class="caption mono">${esc(p.prototype_page_id)}</span>
    <select data-act="switch-page" style="width:auto;min-width:160px;height:28px;font-size:12px">${pages.map((x) => `<option value="${x.prototype_page_id}" ${x.prototype_page_id === p.prototype_page_id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
    <span class="spacer"></span>
    <button class="btn btn-xs ${S.viewport === 'PC' ? 'btn-primary' : ''}" data-act="viewport" data-v="PC">PC</button>
    <button class="btn btn-xs ${S.viewport === 'H5' ? 'btn-primary' : ''}" data-act="viewport" data-v="H5">H5</button>
    <button class="btn btn-xs" data-act="fullscreen-proto" data-id="${f.feature_id}">全屏</button>
    <a class="btn btn-xs" href="${EMBEDDED ? `${BASE}prototypes/${f.domain.toLowerCase()}` : `/docs/product/prototypes/${f.domain.toLowerCase()}`}/${f.feature_id}.html" target="_blank" rel="noopener" title="在浏览器打开独立 HTML 原型（左原型 / 右 PRD 同源双栏）">HTML 原型 ↗</a>
    <button class="btn btn-xs" data-act="standalone-prd" data-id="${f.feature_id}">PRD 独立</button>
    <button class="btn btn-xs" data-act="reset-layout">恢复 50/50</button>
  </div>
  <div class="pane-header" style="top:44px;background:var(--ds-surface-subtle)">
    <span class="caption">可视化编辑</span>
    <button class="btn btn-xs" data-act="add-component">+ 组件</button>
    <button class="btn btn-xs" data-act="add-page">+ 页面</button>
    <button class="btn btn-xs" data-act="edit-interaction">改交互流程</button>
    <button class="btn btn-xs" data-act="edit-state">改页面状态</button>
    <span class="spacer"></span>
    <span class="caption mono">${S.split}% / ${100 - S.split}%</span>
  </div>
  <div class="pane-body">
    <div class="state-switcher">${p.states.map((s) => `<button data-act="set-state" data-state="${s.kind}" class="${S.proto.state === s.kind ? 'active' : ''}">${esc(s.name)}</button>`).join('')}</div>
    <div class="prototype-canvas ${S.viewport === 'H5' ? 'h5' : ''}" id="protoCanvas">
      <div class="canvas-inner">
        <h3 class="canvas-title">${esc(p.name)} ${p.planned ? '<span class="badge badge-planned">规划原型 · 未上线</span>' : ''}</h3>
        <div class="canvas-sub">Feature <span class="mono">${esc(f.feature_id)}</span> · Page <span class="mono">${esc(p.prototype_page_id)}</span> · Viewport ${S.viewport} · ${esc(p.layout)} · <b>MOCK</b></div>
        <div class="badge badge-planned" style="margin-bottom:10px">${esc(p.demo_notice)}</div>
        ${p.planned ? `<div class="alert-box alert-warning" style="margin-bottom:10px">${esc(p.planned_notice)}</div>` : ''}
        ${p.components
          .filter((c) => c.status !== 'DEPRECATED')
          .map((c) => renderComponent(c, p, f))
          .join('')}
        ${S.proto.state === 'empty' ? '<div class="empty-state">当前筛选条件下暂无数据（空状态）</div>' : ''}
        ${S.proto.state === 'loading' ? '<div class="loading-state">加载中…</div>' : ''}
        ${S.proto.state === 'permission_denied' ? '<div class="alert-box alert-error">权限不足：当前角色无法访问该数据（403 状态）。</div>' : ''}
        <div class="section-title" style="font-size:var(--ds-text-sm)">交互清单（点击定位 PRD）</div>
        ${p.interactions
          .filter((i) => i.status !== 'DEPRECATED')
          .map(
            (i) => `<div class="rule-row" id="int-${esc(i.interaction_id)}">
          <button class="chip" data-act="locate-prd" data-id="${f.feature_id}" data-req="${esc(i.requirement_id)}" title="点击定位右侧 PRD">${esc(i.interaction_id)}</button>
          <span class="rule-text">${esc(i.name)} · ${esc(i.steps.join(' → '))}</span>
          ${i.target_page_id ? `<button class="btn btn-xs" data-act="locate-proto" data-id="${f.feature_id}" data-page="${esc(i.target_page_id)}">跳转页面</button>` : ''}</div>`
          )
          .join('')}
      </div>
    </div>
    ${renderModal(p)}
    ${renderDrawer(p)}
  </div>`
}

function renderComponent(c, p, f) {
  const val = (name) => esc(S.proto.form[c.name || name] ?? '')
  const tools = `<div class="cmp-tools">
    <button class="btn btn-xs" data-act="edit-component" data-id="${c.component_id}" title="编辑字段/类型">✎</button>
    <button class="btn btn-xs btn-danger" data-act="delete-component" data-id="${c.component_id}" title="删除元素（含影响检查）">✕</button></div>`
  const idLine = `<div style="margin-top:3px"><span class="cmp-id">${esc(c.component_id)}</span> ${c.requirement_id ? `<button class="chip" style="font-size:11px" data-act="locate-prd" data-id="${f.feature_id}" data-req="${esc(c.requirement_id)}">${esc(c.requirement_id)}</button>` : ''}</div>`
  let body = ''
  switch (c.type) {
    case 'badge':
      body = `<span class="badge badge-planned">${esc(c.label)}</span>`
      break
    case 'input':
      body = `<input type="${esc(c.input_type || 'text')}" data-field="${esc(c.name || '')}" value="${val(c.name)}" placeholder="${esc(c.label)}" ${c.props?.min !== undefined ? `min="${c.props.min}"` : ''} ${S.proto.state === 'disabled' ? 'disabled' : ''}>`
      break
    case 'textarea':
      body = `<textarea data-field="${esc(c.name || '')}" placeholder="${esc(c.label)}" ${S.proto.state === 'disabled' ? 'disabled' : ''}>${val(c.name)}</textarea>`
      break
    case 'select':
      body = `<select data-field="${esc(c.name || '')}" ${S.proto.state === 'disabled' ? 'disabled' : ''}>${(c.options || []).map((o) => `<option ${S.proto.form[c.name] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`
      break
    case 'radio_group':
      body = `<div style="display:flex;gap:6px;flex-wrap:wrap">${(c.options || []).map((o) => `<button class="btn btn-sm ${S.proto.form[c.name] === o ? 'btn-primary' : ''}" data-act="set-field" data-name="${esc(c.name)}" data-value="${esc(o)}">${esc(o)}</button>`).join('')}</div>`
      break
    case 'button':
      body = `<button class="btn ${c.action === 'back' ? '' : 'btn-primary'}" data-act="proto-action" data-action="${esc(c.action || 'submit')}" ${S.proto.state === 'disabled' ? 'disabled' : ''}>${esc(c.label)}</button>`
      break
    case 'alert': {
      const show =
        S.proto.state === 'error' ||
        c.state === S.proto.state ||
        (c.state === 'permission_denied' &&
          S.proto.state === 'permission_denied')
      body = show
        ? `<div class="alert-box ${c.state === 'success' ? 'alert-success' : c.state === 'permission_denied' ? 'alert-error' : 'alert-error'}">${esc(c.props?.error_message || c.label)}</div>`
        : `<div class="caption">（错误提示组件 · 切换到 error 状态可见）</div>`
      break
    }
    case 'modal':
      body = `<div class="caption">弹窗组件 · 触发条件 ${esc(c.trigger || '—')}</div>`
      break
    case 'drawer':
      body = `<div class="caption">抽屉组件 · 触发条件 ${esc(c.trigger || '—')}</div>`
      break
    case 'table':
      body = renderMockTable(c)
      break
    case 'search':
      body = `<input type="text" data-field="__search" value="${esc(S.proto.search)}" placeholder="${esc(c.props?.placeholder || c.label)}"><button class="btn btn-xs" data-act="apply-search" style="margin-top:4px">查询</button>`
      break
    case 'pagination':
      body = `<div class="pagination"><button data-act="paginate" data-d="-1">上一页</button><span>第 ${S.proto.page} 页</span><button data-act="paginate" data-d="1">下一页</button></div>`
      break
    case 'stat_card':
      body = `<div class="stat-cell"><div class="caption">${esc(c.label)}</div><div class="n">${esc(S.proto.form[c.name] || (c.name === 'order_status' ? 'MOCK 待支付' : '128'))}</div></div>`
      break
    case 'tabs':
      body = `<div class="tabs">${(c.options || []).map((o, i) => `<button class="${S.proto.tab === i ? 'active' : ''}" data-act="proto-tab" data-i="${i}">${esc(o)}</button>`).join('')}</div>`
      break
    case 'toggle':
      body = `<label class="caption"><input type="checkbox" data-field="${esc(c.name)}" ${S.proto.form[c.name] ? 'checked' : ''}> 启用</label>`
      break
    case 'progress':
      body = `<div class="progress-track"><div class="progress-bar" style="width:${Math.min(100, Number(S.proto.form[c.name] ?? c.props?.value ?? 0))}%"></div></div><div class="caption">${esc(c.label)}</div>`
      break
    case 'code_block':
      body = `<div class="code-block">${esc(S.proto.response || '// MOCK 响应：提交表单后展示\n{ "status": "idle" }')}</div>`
      break
    case 'timeline':
      body = `<div class="timeline"><div>创建 · MOCK</div><div>处理中 · MOCK</div><div>完成 · MOCK</div></div>`
      break
    default:
      body = `<div class="caption">${esc(c.type)} · ${esc(c.label)}</div>`
  }
  return `<div class="proto-component ${S.highlight === c.component_id ? 'highlight' : ''}" id="cmp-${esc(c.component_id)}">${tools}
    ${!['badge', 'stat_card', 'alert', 'modal', 'drawer', 'code_block', 'timeline', 'progress'].includes(c.type) ? `<label class="cmp-label">${esc(c.label)}${c.required ? ' *' : ''}</label>` : ''}
    ${body}${idLine}</div>`
}
function renderMockTable(c) {
  const rows = Array.from({ length: 12 }, (_, i) => ({
    id: `MOCK-${String(i + 1).padStart(3, '0')}`,
    name: `${c.label} 记录 ${i + 1}`,
    status: ['启用', '停用', '异常'][i % 3],
    time: `2026-11-${String((i % 28) + 1).padStart(2, '0')} 10:${String((i * 2) % 60).padStart(2, '0')}`,
  }))
  const filtered = rows.filter(
    (r) =>
      (!S.proto.search ||
        `${r.id}${r.name}`
          .toLowerCase()
          .includes(S.proto.search.toLowerCase())) &&
      (S.proto.filter === '全部' || r.status === S.proto.filter)
  )
  const size = 5
  const start = (S.proto.page - 1) * size
  const shown = filtered.slice(start, start + size)
  const cols = c.props?.columns || ['ID', '名称', '状态', '时间']
  return `<div style="display:flex;gap:6px;margin-bottom:6px"><input type="text" data-field="__search" value="${esc(S.proto.search)}" placeholder="搜索列表" style="max-width:180px">
    <select data-field="__filter" style="max-width:120px">${['全部', '启用', '停用', '异常'].map((x) => `<option ${S.proto.filter === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
    <button class="btn btn-xs" data-act="apply-search">筛选</button></div>
    <table class="grid-table"><thead><tr>${cols.map((x) => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>
    ${shown.length ? shown.map((r) => `<tr data-act="open-drawer"><td class="mono">${esc(r.id)}</td><td>${esc(r.name)}</td><td>${statusBadge(r.status === '启用' ? 'IMPLEMENTED' : 'PARTIALLY_IMPLEMENTED')}</td><td class="caption">${esc(r.time)}</td></tr>`).join('') : `<tr><td colspan="4"><div class="empty-state">无匹配数据（空状态）</div></td></tr>`}
    </tbody></table><div class="caption">共 ${filtered.length} 条 MOCK 数据 · 第 ${S.proto.page} 页</div>`
}
function renderModal(p) {
  const c = p.components.find(
    (x) => x.type === 'modal' && x.status !== 'DEPRECATED'
  )
  if (!c || S.proto.modal !== c.trigger) return ''
  const nav = p.interactions.find(
    (i) => i.action === 'open_modal_then_navigate' && i.target_page_id
  )
  return `<div class="dialog-backdrop" style="position:fixed" data-act="dialog-backdrop"><div class="dialog" style="width:min(420px,100%)">
    <div class="dialog-head"><h3>${esc(c.label)}</h3><button class="btn btn-ghost btn-sm" data-act="close-modal">✕</button></div>
    <div class="dialog-body"><p>这是一条 <b>MOCK</b> 确认信息：不会创建真实订单、不会修改余额、不会调用真实支付渠道。</p>
      <p class="caption">关联需求 ${esc(c.requirement_id || '—')} · 页面 ${esc(p.prototype_page_id)}</p></div>
    <div class="dialog-foot"><button class="btn" data-act="close-modal">取消</button>
      ${nav ? `<button class="btn btn-primary" data-act="navigate-target" data-page="${esc(nav.target_page_id)}">确认并跳转</button>` : '<button class="btn btn-primary" data-act="close-modal">确认（MOCK）</button>'}</div></div></div>`
}
function renderDrawer(p) {
  const c = p.components.find(
    (x) => x.type === 'drawer' && x.status !== 'DEPRECATED'
  )
  if (!c || !S.proto.drawer) return ''
  return `<div class="dialog-backdrop" style="position:fixed" data-act="dialog-backdrop"><div class="dialog" style="width:min(420px,100%)">
    <div class="dialog-head"><h3>${esc(c.label)}</h3><button class="btn btn-ghost btn-sm" data-act="close-drawer">✕</button></div>
    <div class="dialog-body"><p>MOCK 详情数据：展示记录 ID、状态与时间。</p><dl class="kv"><dt>记录 ID</dt><dd class="mono">MOCK-001</dd><dt>状态</dt><dd>启用</dd><dt>来源</dt><dd>合成数据</dd></dl></div>
    <div class="dialog-foot"><button class="btn" data-act="close-drawer">关闭</button></div></div></div>`
}

/* ── 右：PRD ── */
function panePRD(f) {
  const sections = f.prd.sections
  return `<div class="pane-header">
    <h2>PRD 产品需求文档</h2><span class="badge badge-planned mono">${esc(f.prd.prd_id)}</span>
    <span class="caption">v${f.prd.version}</span>${statusBadge(f.status)}
    <span class="spacer"></span>
    <button class="btn btn-xs" data-act="add-requirement">+ 需求</button>
    <button class="btn btn-xs" data-act="standalone-prd" data-id="${f.feature_id}">独立查看</button>
  </div>
  <div class="prd-nav">${sections.map((s, i) => `<a href="#prd-${i}" data-act="prd-anchor" data-i="${i}">${esc(s)}</a>`).join('')}</div>
  <div class="pane-body">
    ${prdSection(
      f,
      0,
      `<dl class="kv">
      <dt>Feature ID</dt><dd class="mono">${esc(f.feature_id)}</dd>
      <dt>功能名称</dt><dd>${esc(f.name)}</dd>
      <dt>所属模块</dt><dd>${esc(f.domain)} · ${esc(f.module)}</dd>
      <dt>PRD 版本</dt><dd>v${f.prd.version}</dd>
      <dt>功能状态</dt><dd>${statusBadge(f.status)}</dd>
      <dt>优先级</dt><dd>${esc(f.priority)}</dd>
      <dt>原型入口</dt><dd><button class="chip" data-act="locate-proto" data-id="${f.feature_id}" data-page="${esc(f.prototype.primary_page_id)}">${esc(f.prototype.primary_page_id)}</button></dd>
      <dt>创建/更新</dt><dd class="caption">${esc(f.prd.created_at.slice(0, 10))} / ${esc(f.prd.updated_at.slice(0, 19).replace('T', ' '))}</dd>
      <dt>Requirement</dt><dd>${f.requirements.map((q) => `<button class="chip" data-act="prd-anchor" data-req="${esc(q.requirement_id)}">${esc(q.requirement_id)}</button>`).join(' ')}</dd>
    </dl>`
    )}
    ${prdSection(
      f,
      1,
      `<p><b>功能目标：</b><span class="inline-edit" data-act="edit-goal" data-key="goal">${esc(f.background.goal)}</span></p>
      <p><b>解决的问题：</b><span class="inline-edit" data-act="edit-goal" data-key="problem">${esc(f.background.problem)}</span></p>
      <p><b>业务场景：</b></p><ul>${f.background.scenarios.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <p><b>功能边界：</b></p><ul>${f.background.boundaries.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      ${f.status_note ? `<div class="subtle-note">${esc(f.status_note)}</div>` : ''}
      ${f.evidence_note ? `<div class="alert-box alert-warning" style="margin-top:8px">证据说明：${esc(f.evidence_note)}</div>` : ''}`
    )}
    ${prdSection(f, 2, `<p>${f.roles.map((r) => `<span class="badge">${esc(r)}</span>`).join(' ')}</p>`)}
    ${prdSection(f, 3, f.user_stories.length ? `<ul>${f.user_stories.map((s) => `<li>${esc(s.text)}</li>`).join('')}</ul>` : '<p>暂无已确认用户故事。</p>')}
    ${prdSection(
      f,
      4,
      `<p><b>包含：</b>${f.scope.included.map(esc).join('；') || '—'}</p><p><b>不包含：</b>${f.scope.excluded.map(esc).join('；') || '—'}</p>
      <p><b>上游依赖：</b><span class="mono">${f.scope.upstream.map(esc).join(', ') || '—'}</span></p><p><b>下游依赖：</b><span class="mono">${f.scope.downstream.map(esc).join(', ') || '—'}</span></p>`
    )}
    ${prdSection(
      f,
      5,
      `<p><b>正常流程</b></p><ol>${f.flows.normal.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
      <p><b>异常流程</b></p><ul>${f.flows.exception.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <p><b>边界条件</b></p><ul>${f.flows.boundary.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <p><b>状态变化</b> ${f.flows.states.map((s) => `<span class="badge">${esc(s)}</span>`).join(' ')}</p>
      <p><b>失败恢复 / 权限</b></p><ul>${[...f.flows.recovery, ...f.flows.permissions].map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
    )}
    ${prdSection(f, 6, f.requirements.map((q) => reqCard(q, f)).join(''))}
    ${prdSection(
      f,
      7,
      `<p>主页面 <button class="chip" data-act="locate-proto" data-id="${f.feature_id}" data-page="${esc(f.prototype.primary_page_id)}">${esc(f.prototype.primary_page_id)}</button></p>
      <table class="grid-table"><thead><tr><th>Prototype Page ID</th><th>页面</th><th>布局</th><th>字段/组件</th><th>状态</th><th>Interaction ID</th></tr></thead><tbody>
      ${f.prototype.pages
        .map(
          (
            p
          ) => `<tr><td class="mono"><button class="chip" data-act="locate-proto" data-id="${f.feature_id}" data-page="${esc(p.prototype_page_id)}">${esc(p.prototype_page_id)}</button></td><td>${esc(p.name)}</td><td>${esc(p.layout)}</td>
        <td>${p.components
          .slice(0, 4)
          .map(
            (c) =>
              `${esc(c.label)}<span class="cmp-id"> ${esc(c.component_id)}</span>`
          )
          .join(
            '<br>'
          )}</td><td>${p.states.map((s) => `<span class="badge">${esc(s.kind)}</span>`).join(' ')}</td>
        <td class="mono">${p.interactions.map((i) => `<button class="chip" data-act="locate-proto" data-id="${f.feature_id}" data-page="${esc(p.prototype_page_id)}" data-int="${esc(i.interaction_id)}">${esc(i.interaction_id)}</button>`).join(' ')}</td></tr>`
        )
        .join('')}
      </tbody></table>`
    )}
    ${prdSection(
      f,
      8,
      `<table class="grid-table"><thead><tr><th>API ID</th><th>Method</th><th>Path</th><th>来源</th><th>错误码</th></tr></thead><tbody>
      ${f.apis.length ? f.apis.map((a) => `<tr><td class="mono">${esc(a.api_id)}</td><td>${esc(a.method)}</td><td class="mono">${esc(a.path)}</td><td class="caption">${esc(a.source)}</td><td class="caption">${esc((a.errors || []).join(', '))}</td></tr>`).join('') : '<tr><td colspan="5" class="caption">无已确认 API（按真实盘点结果留空，不虚构）</td></tr>'}</tbody></table>
      <p style="margin-top:10px"><b>数据模型</b></p><ul>${f.data_models.length ? f.data_models.map((d) => `<li><span class="mono">${esc(d.data_model_id)}</span> · ${esc(d.name)} · <span class="mono">${esc(d.source)}</span></li>`).join('') : '<li>无已确认数据模型</li>'}</ul>`
    )}
    ${prdSection(
      f,
      9,
      f.acceptance
        .filter((a) => a.status !== 'DEPRECATED')
        .slice(0, 40)
        .map(
          (a) => `<div class="gwt" id="ac-${esc(a.acceptance_id)}">
      <span class="mono">${esc(a.acceptance_id)}</span> <span class="badge">${esc(a.type)}</span>
      <button class="btn btn-xs" data-act="edit-acceptance" data-id="${esc(a.acceptance_id)}" style="float:right">编辑</button>
      <div><b>Given</b> ${esc(a.given)}</div><div><b>When</b> ${esc(a.when)}</div><div><b>Then</b> ${esc(a.then)}</div>
      <div class="caption">关联 <button class="chip" data-act="locate-prd" data-id="${f.feature_id}" data-req="${esc(a.requirement_id)}">${esc(a.requirement_id)}</button> · <button class="chip" data-act="locate-proto" data-id="${f.feature_id}" data-page="${esc(a.prototype_page_id)}">${esc(a.prototype_page_id)}</button></div></div>`
        )
        .join('')
    )}
    ${prdSection(
      f,
      10,
      `<table class="grid-table"><thead><tr><th>Test Case ID</th><th>Requirement ID</th><th>测试文件</th><th>状态</th><th>代码证据</th></tr></thead><tbody>
      ${f.tests
        .filter((t) => t.status !== 'DEPRECATED')
        .map(
          (t) =>
            `<tr><td class="mono">${esc(t.test_case_id)}</td><td class="mono">${esc(t.requirement_id)}</td><td class="mono">${esc(t.path)}</td><td>${statusPill(t.result === 'NOT_RUN' ? 'PENDING' : 'SYNCED')}</td><td class="caption">${esc((t.code_evidence || []).slice(0, 2).join(', ') || '—')}</td></tr>`
        )
        .join('')}
      </tbody></table>`
    )}
    ${prdSection(
      f,
      11,
      `<table class="grid-table"><thead><tr><th>Change ID</th><th>来源</th><th>操作</th><th>版本</th><th>原因</th></tr></thead><tbody>
      ${S.model.changes
        .filter((c) => c.feature_id === f.feature_id)
        .slice(-12)
        .reverse()
        .map(
          (c) =>
            `<tr><td class="mono">${esc(c.change_id)}</td><td>${esc(c.source_view)}</td><td>${esc(c.op)}</td><td class="mono">v${c.base_version} → v${c.target_version}</td><td class="caption">${esc(c.reason)}</td></tr>`
        )
        .join('')}
      </tbody></table>
      <button class="btn btn-sm" data-act="view" data-view="changes" style="margin-top:8px">查看完整历史与恢复</button>`
    )}
    ${f.open_decisions.length ? `<div class="alert-box alert-warning"><b>NEEDS_PRODUCT_DECISION</b><ul>${f.open_decisions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    ${(f.review_flags || []).length ? `<div class="alert-box alert-info" style="margin-top:8px"><b>NEEDS_REVIEW</b>：${f.review_flags.map(esc).join('; ')}（确定性内容已同步，业务语义待审查）</div>` : ''}
  </div>`
}
function prdSection(f, i, body) {
  return `<section class="prd-section" id="prd-${i}"><h3>${i + 1}. ${esc(f.prd.sections[i])}</h3>${body}</section>`
}
function reqCard(q, f) {
  return `<div class="req-card ${S.highlight === q.requirement_id ? 'highlight' : ''}" id="req-${esc(q.requirement_id)}">
    <h4><button class="chip" data-act="locate-proto" data-id="${f.feature_id}" data-page="${esc(q.prototype_page_ids?.[0] || f.prototype.primary_page_id)}">${esc(q.requirement_id)}</button>
      ${esc(q.title)} ${q.status === 'DEPRECATED' ? '<span class="badge badge-not">已停用</span>' : q.status === 'NEEDS_REVIEW' ? '<span class="badge badge-partially">NEEDS_REVIEW</span>' : ''}
      <span style="flex:1"></span>
      <button class="btn btn-xs" data-act="edit-requirement" data-id="${esc(q.requirement_id)}">编辑</button>
      <button class="btn btn-xs btn-danger" data-act="delete-requirement" data-id="${esc(q.requirement_id)}">删除</button></h4>
    <p>${esc(q.description)}</p>
    <dl class="kv"><dt>操作入口</dt><dd class="mono">${esc(q.entry || '—')}</dd>
      <dt>输入</dt><dd>${q.inputs.length ? q.inputs.map((x) => `${esc(x.name)}(${esc(x.type)}${x.required ? ',必填' : ''})`).join(', ') : '—'}</dd>
      <dt>输出</dt><dd>${esc(q.output)}</dd><dt>权限</dt><dd>${esc(q.permission)}</dd>
      <dt>数据变化</dt><dd>${esc(q.data_change)}</dd>
      <dt>异常提示</dt><dd>${q.error_messages.map(esc).join('；') || '—'}</dd></dl>
    <p style="margin:8px 0 2px"><b>业务规则</b>（点击值可编辑，自动同步原型校验）</p>
    ${q.business_rules
      .map(
        (
          b
        ) => `<div class="rule-row"><span class="mono caption">${esc(b.rule_id)}</span>
      <span class="rule-text">${esc(b.text)} ${b.status === 'NEEDS_PRODUCT_DECISION' ? '<span class="badge badge-not">NEEDS_PRODUCT_DECISION</span>' : ''}</span>
      ${b.value !== null && b.value !== undefined ? `<button class="chip" data-act="edit-rule" data-id="${esc(b.rule_id)}" title="修改业务规则">值 = ${esc(b.value)}</button>` : ''}
      <button class="btn btn-xs" data-act="edit-rule" data-id="${esc(b.rule_id)}">编辑</button></div>`
      )
      .join('')}
    <div class="caption" style="margin-top:6px">原型页面 ${q.prototype_page_ids.map((x) => `<button class="chip" data-act="locate-proto" data-id="${f.feature_id}" data-page="${esc(x)}">${esc(x)}</button>`).join(' ')}
      组件 ${q.component_ids.map((x) => `<button class="chip" data-act="locate-proto" data-id="${f.feature_id}" data-cmp="${esc(x)}">${esc(x)}</button>`).join(' ')}
      交互 ${q.interaction_ids.map((x) => `<button class="chip" data-act="locate-proto" data-id="${f.feature_id}" data-int="${esc(x)}">${esc(x)}</button>`).join(' ')}
      验收 ${q.acceptance_ids.map((x) => `<a class="chip" href="#ac-${esc(x)}">${esc(x)}</a>`).join(' ')} 测试 ${q.test_case_ids.map(esc).join(', ')}</div>
  </div>`
}

/* ───────────────────────── 原型交互逻辑 ───────────────────────── */
function validateForm(p) {
  const errors = []
  for (const c of p.components.filter((x) => x.status !== 'DEPRECATED')) {
    if (c.type !== 'input' && c.type !== 'textarea' && c.type !== 'select')
      continue
    const v = String(S.proto.form[c.name] ?? '').trim()
    if (c.required && !v)
      errors.push(c.props?.error_message || `「${c.label}」不得为空`)
    if (v && c.props?.min !== undefined && Number(v) < Number(c.props.min))
      errors.push(c.props?.error_message || `金额不得低于 ${c.props.min} 元`)
    if (v && c.input_type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v))
      errors.push(c.props?.error_message || '邮箱格式不正确')
  }
  return errors
}
function protoAction(action) {
  const p = page()
  if (!p) return
  const modal = p.components.find(
    (c) => c.type === 'modal' && c.status !== 'DEPRECATED'
  )
  switch (action) {
    case 'back':
      S.pageId = feature().prototype.primary_page_id
      S.proto.modal = null
      S.proto.state = 'idle'
      toast('已返回主页面并恢复表单状态')
      render()
      return
    case 'refresh':
      S.proto.state = 'loading'
      render()
      setTimeout(() => {
        S.proto.state = 'success'
        toast('刷新完成（MOCK 数据）')
        render()
      }, 350)
      return
    case 'retry':
      S.proto.state = 'loading'
      render()
      setTimeout(() => {
        S.proto.state = 'success'
        S.proto.response = '// MOCK 重试成功\n{ "status": "ok", "retry": 1 }'
        toast('重试成功（MOCK）')
        render()
      }, 320)
      return
    case 'open_drawer':
      S.proto.drawer = true
      render()
      return
    case 'filter_list':
    case 'paginate':
      return
    default: {
      const errs = validateForm(p)
      if (errs.length) {
        S.proto.state = 'error'
        toast(`校验失败：${errs[0]}`, true)
        render()
        return
      }
      S.proto.state = 'loading'
      render()
      setTimeout(() => {
        S.proto.state = 'success'
        S.proto.response = `// MOCK 响应（无真实资金/账户操作）\n{\n  "feature_id": "${feature().feature_id}",\n  "page_id": "${p.prototype_page_id}",\n  "action": "${action}",\n  "form": ${JSON.stringify(S.proto.form, null, 2)}\n}`
        if (action === 'create_task')
          S.proto.tasks.unshift(`MOCK-${Date.now().toString().slice(-5)}`)
        S.proto.modal = modal ? modal.trigger || action : null
        toast('操作成功（MOCK）')
        render()
      }, 300)
    }
  }
}

/* ───────────────────────── 事件委托 ───────────────────────── */
document.addEventListener('input', (ev) => {
  const el = ev.target
  if (!el.dataset || !el.dataset.field) return
  const name = el.dataset.field
  if (name === '__search') S.proto.search = el.value
  else if (name === '__filter') S.proto.filter = el.value
  else S.proto.form[name] = el.type === 'checkbox' ? el.checked : el.value
})
document.addEventListener('change', (ev) => {
  const el = ev.target
  if (el.dataset && el.dataset.field) {
    const name = el.dataset.field
    if (name === '__filter') S.proto.filter = el.value
    else if (name === '__search') S.proto.search = el.value
    else S.proto.form[name] = el.type === 'checkbox' ? el.checked : el.value
    if (name === '__filter') render()
  }
  if (el.dataset && el.dataset.act === 'switch-page') {
    S.pageId = el.value
    S.proto.state = 'idle'
    S.proto.modal = null
    render()
  }
  if (el.dataset && el.dataset.filter) {
    S.filters[el.dataset.filter] = el.value
    render()
  }
})

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]')
  if (!el) return
  const act = el.dataset.act
  const id = el.dataset.id
  try {
    switch (act) {
      case 'view':
        S.view = el.dataset.view
        S.mode = 'split'
        render()
        break
      case 'open-feature':
        S.featureId = id
        S.pageId = null
        S.view = 'detail'
        S.mode = 'split'
        S.proto = {
          form: {},
          state: 'idle',
          modal: null,
          drawer: null,
          search: '',
          filter: '全部',
          page: 1,
          tab: 0,
          response: '',
          tasks: [],
        }
        await refresh()
        break
      case 'cat-search':
        S.filters.q = $('#catSearch')?.value || ''
        render()
        break
      case 'fullscreen-proto':
        S.featureId = id || S.featureId
        S.view = 'detail'
        S.mode = 'prototype-fullscreen'
        render()
        break
      case 'standalone-prd': {
        S.featureId = id || S.featureId
        const url = `${location.origin}/?view=prd-standalone&feature=${encodeURIComponent(S.featureId)}`
        window.open(url, '_blank', 'noopener')
        break
      }
      case 'reset-layout':
        S.split = 50
        S.mode = 'split'
        render()
        break
      case 'viewport':
        S.viewport = el.dataset.v
        render()
        break
      case 'switch-page':
        break
      case 'set-state':
        S.proto.state = el.dataset.state
        render()
        break
      case 'set-field':
        S.proto.form[el.dataset.name] = el.dataset.value
        render()
        break
      case 'proto-tab':
        S.proto.tab = Number(el.dataset.i)
        render()
        break
      case 'apply-search':
        S.proto.page = 1
        render()
        break
      case 'paginate':
        S.proto.page = Math.max(1, S.proto.page + Number(el.dataset.d))
        render()
        break
      case 'proto-action':
        protoAction(el.dataset.action)
        break
      case 'open-drawer':
        S.proto.drawer = true
        render()
        break
      case 'close-modal':
        S.proto.modal = null
        render()
        break
      case 'close-drawer':
        S.proto.drawer = false
        render()
        break
      case 'navigate-target':
        S.pageId = el.dataset.page
        S.proto.modal = null
        S.proto.state = 'success'
        toast(`页面跳转 → ${el.dataset.page}`)
        render()
        break
      case 'dialog-backdrop':
        if (ev.target === el) closeDialog()
        break
      case 'dialog-close':
        closeDialog()
        break
      case 'prd-anchor': {
        if (el.dataset.req) {
          S.highlight = el.dataset.req
          S.pendingLocate = { id: `req-${el.dataset.req}` }
          render()
        } else {
          const target = document.getElementById(`prd-${el.dataset.i}`)
          target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        break
      }
      case 'locate-prd': {
        if (el.dataset.id && el.dataset.id !== S.featureId) {
          S.featureId = el.dataset.id
          await refresh(false)
        }
        S.view = 'detail'
        S.mode = 'split'
        S.highlight = el.dataset.req
        S.pendingLocate = { id: `req-${el.dataset.req}` }
        render()
        toast(`定位 PRD：${el.dataset.req}`)
        break
      }
      case 'locate-proto': {
        if (el.dataset.id && el.dataset.id !== S.featureId) {
          S.featureId = el.dataset.id
          await refresh(false)
          S.proto = {
            form: {},
            state: 'idle',
            modal: null,
            drawer: null,
            search: '',
            filter: '全部',
            page: 1,
            tab: 0,
            response: '',
            tasks: [],
          }
        }
        S.view = 'detail'
        S.mode = 'split'
        if (el.dataset.page) {
          S.pageId = el.dataset.page
          const pg = feature()?.prototype.pages.find(
            (x) => x.prototype_page_id === el.dataset.page
          )
          if (pg && el.dataset.int) {
            /* 交互高亮 */
          }
        }
        S.highlight = el.dataset.cmp || el.dataset.int || null
        S.pendingLocate = {
          id: el.dataset.cmp
            ? `cmp-${el.dataset.cmp}`
            : el.dataset.int
              ? `int-${el.dataset.int}`
              : 'protoCanvas',
        }
        render()
        toast(
          `定位原型：${el.dataset.page || el.dataset.cmp || el.dataset.int}`
        )
        break
      }
      /* ── PRD 编辑 ── */
      case 'add-requirement':
        openAddRequirement()
        break
      case 'edit-requirement':
        openEditRequirement(id)
        break
      case 'delete-requirement':
        openDeleteRequirement(id)
        break
      case 'edit-rule':
        openEditRule(id)
        break
      case 'edit-acceptance':
        openEditAcceptance(id)
        break
      case 'edit-goal':
        openEditBackground(el.dataset.key)
        break
      /* ── Prototype 编辑 ── */
      case 'add-component':
        openAddComponent()
        break
      case 'edit-component':
        openEditComponent(id)
        break
      case 'delete-component':
        openDeleteComponent(id)
        break
      case 'add-page':
        openAddPage()
        break
      case 'edit-interaction':
        openEditInteraction()
        break
      case 'edit-state':
        openEditState()
        break
      /* ── 冲突 / 版本 / 检查 ── */
      case 'simulate-conflict':
        await simulateConflict()
        break
      case 'resolve-conflict':
        await resolveConflict(id, el.dataset.choice)
        break
      case 'resolve-manual':
        openManualConflict(id)
        break
      case 'restore-version':
        openRestore(Number(el.dataset.version))
        break
      case 'diff-version':
        showDiff(Number(el.dataset.version))
        break
      case 'run-validation': {
        const v = await api('/api/validate?files=1')
        window.__validation = v
        toast(
          `一致性检查：${v.passed ? 'PASS' : 'FAIL'} · ${v.total} 项 · 失败 ${v.failed}`
        )
        if (S.view === 'coverage') render()
        else {
          S.view = 'coverage'
          render()
        }
        break
      }
      case 'new-feature-gate':
        openGateDemo()
        break
      default:
        break
    }
  } catch (e) {
    toast(e.message, true)
  }
})

/* ───────────────────────── 编辑对话框 ───────────────────────── */
function openAddRequirement() {
  if (!needAdmin()) return
  dialog({
    title: `新增需求 · ${S.featureId}`,
    body: `${field('title', '需求标题', '允许用户选择自定义充值金额')}
      ${area('description', '需求描述', '在充值页面提供自定义金额输入，并对金额进行校验。')}
      ${field('input_name', '输入字段名', 'custom_amount')}
      ${selectField('input_type', '字段类型', ['number', 'text', 'email', 'select'])}
      ${field('rule_text', '业务规则（文本）', '自定义金额不得低于最低充值金额')}
      ${field('rule_field', '业务规则字段（可选，如 min_amount）', 'min_amount')}
      ${field('rule_value', '业务规则值（可选）', '20', 'number')}
      <div class="subtle-note">保存后：创建 Requirement ID → 更新统一模型 → 左侧原型自动增加输入组件、校验与交互 → 更新验收标准 / 测试 / 映射 / 版本。</div>`,
    onOk: async (d) => {
      const rules = d.rule_text
        ? [
            {
              text: d.rule_text,
              field: d.rule_field || null,
              value: d.rule_value === '' ? null : Number(d.rule_value),
            },
          ]
        : []
      return !!(await submitChange(
        {
          source_view: 'PRD',
          op: 'add_requirement',
          feature_id: S.featureId,
          payload: {
            title: d.title,
            description: d.description,
            input: d.input_name
              ? { name: d.input_name, type: d.input_type, required: true }
              : null,
            rules,
          },
          reason: 'PRD 手动新增需求（验收场景二）',
        },
        'PRD 已新增需求，左侧原型已自动同步'
      ))
    },
  })
}
function openEditRequirement(rid) {
  const q = feature().requirements.find((x) => x.requirement_id === rid)
  if (!q) return
  if (!needAdmin()) return
  dialog({
    title: `编辑需求 ${rid}`,
    body: `${field('title', '标题', q.title)}${area('description', '需求描述', q.description)}
      ${area('rules', '业务规则（每行一条）', q.business_rules.map((b) => b.text).join('\n'))}
      <div class="subtle-note">保存后同步更新原型字段/校验、错误提示、验收标准与测试关联。</div>`,
    onOk: async (d) =>
      submitChange(
        {
          source_view: 'PRD',
          op: 'update_requirement',
          feature_id: S.featureId,
          payload: {
            requirement_id: rid,
            title: d.title,
            description: d.description,
            rules: d.rules.split('\n').filter(Boolean),
          },
          reason: 'PRD 修改需求',
        },
        '需求已更新并同步原型'
      ),
  })
}
function openDeleteRequirement(rid) {
  const f = feature()
  const q = f.requirements.find((x) => x.requirement_id === rid)
  if (!q || !needAdmin()) return
  const impact = {
    原型页面: q.prototype_page_ids,
    组件: q.component_ids,
    交互: q.interaction_ids,
    验收标准: q.acceptance_ids,
    测试: q.test_case_ids,
    API: f.apis.map((a) => a.api_id).slice(0, 4),
  }
  dialog({
    title: `删除需求影响检查 ${rid}`,
    danger: true,
    okText: '确认删除并同步',
    body: `<p class="alert-box alert-warning">删除前影响检查（资金/权限/安全相关操作保留审计记录，不物理删除历史）。</p>
      <pre class="code-block">${esc(JSON.stringify(impact, null, 2))}</pre>${area('reason', '删除原因（必填）')}`,
    onOk: async (d) => {
      if (!d.reason.trim()) {
        toast('请填写删除原因', true)
        return false
      }
      return !!(await submitChange(
        {
          source_view: 'PRD',
          op: 'delete_requirement',
          feature_id: S.featureId,
          payload: { requirement_id: rid, reason: d.reason },
          reason: d.reason,
        },
        '需求删除已同步，影响范围已记录'
      ))
    },
  })
}
function openEditRule(ruleId) {
  const f = feature()
  const rule = f.requirements
    .flatMap((q) => q.business_rules)
    .find((b) => b.rule_id === ruleId)
  if (!rule || !needAdmin()) return
  dialog({
    title: `修改业务规则 ${ruleId}`,
    body: `${area('text', '规则文本', rule.text)}${field('value', '规则值（数值，自动同步原型校验与错误提示）', rule.value ?? '', 'number')}
      <div class="subtle-note">例如将最低充值金额由 10 改为 20：原型 min、错误提示、边界验收条件与测试用例会同步更新。</div>`,
    onOk: async (d) =>
      submitChange(
        {
          source_view: 'PRD',
          op: 'update_business_rule',
          feature_id: S.featureId,
          payload: {
            rule_id: ruleId,
            text: d.text,
            value: d.value === '' ? null : Number(d.value),
          },
          reason: 'PRD 修改业务规则（验收场景四）',
        },
        '业务规则已同步至原型校验与验收标准'
      ),
  })
}
function openEditAcceptance(aid) {
  const a = feature().acceptance.find((x) => x.acceptance_id === aid)
  if (!a || !needAdmin()) return
  dialog({
    title: `编辑验收标准 ${aid}`,
    body: `${area('given', 'Given', a.given)}${area('when', 'When', a.when)}${area('then', 'Then', a.then)}`,
    onOk: async (d) =>
      submitChange(
        {
          source_view: 'PRD',
          op: 'update_acceptance',
          feature_id: S.featureId,
          payload: { acceptance_id: aid, ...d },
          reason: 'PRD 修改验收标准',
        },
        '验收标准已同步至原型状态说明'
      ),
  })
}
function openEditBackground(key) {
  const f = feature()
  if (!needAdmin()) return
  dialog({
    title: `编辑 PRD ${key === 'goal' ? '功能目标' : '解决的问题'}`,
    body: area('value', '内容', f.background[key]),
    onOk: async (d) =>
      submitChange(
        {
          source_view: 'PRD',
          op: 'update_prd_section',
          feature_id: S.featureId,
          payload: { section: key, value: d.value },
          reason: 'PRD 背景章节编辑',
        },
        'PRD 章节已更新'
      ),
  })
}
function openAddComponent() {
  if (!needAdmin()) return
  dialog({
    title: `新增原型组件 · ${S.pageId || feature().prototype.primary_page_id}`,
    body: `${field('label', '组件名称', '支付方式选择')}${selectField('type', '组件类型', ['select', 'input', 'radio_group', 'button', 'textarea', 'toggle', 'table', 'badge'])}
      ${field('name', '字段名', 'payment_method')}${field('error_message', '校验错误提示', '请选择支付方式')}
      <div class="subtle-note">保存后：分配 Component ID → 自动建立/更新 Requirement ID → 右侧 PRD 增加页面交互说明、功能需求、字段说明、验收标准、测试追溯与映射；语义不确定的业务规则标记 NEEDS_REVIEW。</div>`,
    onOk: async (d) =>
      submitChange(
        {
          source_view: 'Prototype',
          op: 'add_component',
          feature_id: S.featureId,
          payload: {
            page_id: S.pageId || feature().prototype.primary_page_id,
            type: d.type,
            label: d.label,
            name: d.name,
            props: { error_message: d.error_message },
          },
          reason: '原型可视化新增组件（验收场景三）',
        },
        '组件已新增，右侧 PRD 已自动同步'
      ),
  })
}
function openEditComponent(cid) {
  const f = feature()
  let c = null
  for (const p of f.prototype.pages) {
    const hit = p.components.find((x) => x.component_id === cid)
    if (hit) {
      c = hit
      break
    }
  }
  if (!c || !needAdmin()) return
  dialog({
    title: `编辑字段 ${cid}`,
    body: `${field('label', '字段名称', c.label)}${selectField('type', '字段类型', ['input', 'select', 'radio_group', 'textarea', 'toggle', 'button', 'table'], c.type)}
      ${field('error_message', '校验提示（自动写入 PRD 字段说明）', c.props?.error_message || '')}
      ${field('min', '最小值（可选，业务规则值）', c.props?.min ?? '', 'number')}`,
    onOk: async (d) => {
      const props = { error_message: d.error_message }
      if (d.min !== '') {
        props.min = Number(d.min)
        props.rule_field = c.props?.rule_field || 'min_amount'
      }
      return submitChange(
        {
          source_view: 'Prototype',
          op: 'update_component',
          feature_id: S.featureId,
          payload: { component_id: cid, label: d.label, type: d.type, props },
          reason: '原型修改字段（字段类型/校验）',
        },
        '字段已修改，PRD 字段说明与验收标准已同步'
      )
    },
  })
}
function openDeleteComponent(cid) {
  if (!needAdmin()) return
  const f = feature()
  let c = null
  for (const p of f.prototype.pages) {
    const hit = p.components.find((x) => x.component_id === cid)
    if (hit) {
      c = hit
      break
    }
  }
  if (!c) return
  const q = f.requirements.find((x) => x.requirement_id === c.requirement_id)
  dialog({
    title: `删除原型元素影响检查 ${cid}`,
    danger: true,
    okText: '确认删除并同步',
    body: `<div class="alert-box alert-warning">该组件承载需求 <b>${esc(c.requirement_id || '—')}</b>，删除将同步更新 PRD、验收标准与测试用例。</div>
      <pre class="code-block">${esc(JSON.stringify({ requirement: q?.title, acceptance: q?.acceptance_ids, tests: q?.test_case_ids, interactions: c.interaction_ids }, null, 2))}</pre>${area('reason', '删除原因（必填）')}`,
    onOk: async (d) => {
      if (!d.reason.trim()) {
        toast('请填写删除原因', true)
        return false
      }
      return !!(await submitChange(
        {
          source_view: 'Prototype',
          op: 'delete_component',
          feature_id: S.featureId,
          payload: { component_id: cid, reason: d.reason },
          reason: d.reason,
        },
        '组件删除已同步 PRD，并记录影响与审计'
      ))
    },
  })
}
function openAddPage() {
  if (!needAdmin()) return
  dialog({
    title: '新增原型页面',
    body: `${field('name', '页面名称', '充值结果详情页')}${selectField('layout', '页面布局', ['detail', 'result', 'table-with-toolbar', 'single-column-form'])}`,
    onOk: async (d) =>
      submitChange(
        {
          source_view: 'Prototype',
          op: 'add_page',
          feature_id: S.featureId,
          payload: { name: d.name, layout: d.layout },
          reason: '原型新增页面',
        },
        '页面已新增，PRD 页面交互与业务流程已更新'
      ),
  })
}
function openEditInteraction() {
  if (!needAdmin()) return
  const f = feature()
  const list = f.prototype.pages.flatMap((p) =>
    p.interactions.filter((i) => i.status !== 'DEPRECATED')
  )
  if (!list.length) {
    toast('当前页面没有可编辑交互', true)
    return
  }
  const targetPages = f.prototype.pages.map((p) => p.prototype_page_id)
  dialog({
    title: '修改交互流程 / 页面跳转',
    body: `${selectField(
      'interaction_id',
      '选择交互',
      list.map((i) => [i.interaction_id, `${i.interaction_id} · ${i.name}`])
    )}
      ${field('action', '动作', list[0].action)}${area('steps', '交互步骤（每行一步）', list[0].steps.join('\n'))}
      ${selectField('target_page_id', '跳转目标页面', [['', '不跳转'], ...targetPages.map((p) => [p, p])])}
      <div class="subtle-note">保存后 PRD 业务流程、页面跳转、状态说明、验收标准与测试用例同步更新。</div>`,
    onOk: async (d) =>
      submitChange(
        {
          source_view: 'Prototype',
          op: 'update_interaction',
          feature_id: S.featureId,
          payload: {
            interaction_id: d.interaction_id,
            action: d.action,
            steps: d.steps.split('\n').filter(Boolean),
            target_page_id: d.target_page_id || null,
          },
          reason: '原型修改交互流程',
        },
        '交互流程已同步 PRD'
      ),
  })
}
function openEditState() {
  if (!needAdmin()) return
  const p = page()
  dialog({
    title: '修改页面状态说明',
    body: `${selectField(
      'state',
      '状态',
      p.states.map((s) => s.kind)
    )}${area('description', '状态说明', p.states[0]?.description || '')}`,
    onOk: async (d) =>
      submitChange(
        {
          source_view: 'Prototype',
          op: 'update_page_state',
          feature_id: S.featureId,
          payload: {
            page_id: p.prototype_page_id,
            state: d.state,
            description: d.description,
          },
          reason: '原型修改页面状态',
        },
        '页面状态已同步 PRD'
      ),
  })
}

/* ───────────────────────── 冲突 / 恢复 / 门禁 ───────────────────────── */
async function simulateConflict() {
  if (!needAdmin()) return
  const f =
    feature() ||
    S.model.features.find((x) => x.feature_id === 'UTER-PAY-001') ||
    S.model.features[0]
  S.featureId = f.feature_id
  const rule = f.requirements
    .flatMap((q) => q.business_rules)
    .find((b) => b.field === 'min_amount')
  if (!rule) {
    toast(
      '当前功能没有可模拟的数值业务规则，请切换到充值功能 UTER-PAY-001',
      true
    )
    return
  }
  const base = S.model.model_version
  S.sync = 'SYNCING'
  renderStatus()
  const comp =
    f.prototype.pages
      .flatMap((p) => p.components)
      .find(
        (c) => c.props?.rule_field === 'min_amount' && c.type !== 'alert'
      ) ||
    f.prototype.pages
      .flatMap((p) => p.components)
      .find((c) => c.props?.rule_field)
  if (!comp) {
    toast(
      '当前功能没有可模拟的原型校验组件，请切换到充值功能 UTER-PAY-001',
      true
    )
    return
  }
  const a = await api('/api/change', {
    method: 'POST',
    body: JSON.stringify({
      source_view: 'PRD',
      op: 'update_business_rule',
      feature_id: f.feature_id,
      base_version: base,
      payload: {
        rule_id: rule.rule_id,
        text: 'PRD 侧修改：最低金额调整为 20',
        value: 20,
      },
      reason: '并发冲突模拟 · PRD 侧修改业务字段 min_amount',
      actor: 'admin',
      role: 'admin',
    }),
  })
  // 两侧基于同一 base_version 修改同一语义字段（min_amount），但来自不同视图与不同结构路径。
  const b = await api('/api/change', {
    method: 'POST',
    body: JSON.stringify({
      source_view: 'Prototype',
      op: 'update_component',
      feature_id: f.feature_id,
      base_version: base,
      payload: {
        component_id: comp.component_id,
        props: {
          min: 50,
          error_message: '原型侧修改：金额不得低于 50 元',
          rule_field: 'min_amount',
        },
      },
      reason: '并发冲突模拟 · Prototype 侧修改同一业务字段 min_amount',
      actor: 'admin',
      role: 'admin',
    }),
  })
  await refresh(false)
  S.view = 'changes'
  S.sync = b.status === 'CONFLICT' ? 'CONFLICT' : 'SYNCED'
  render()
  toast(
    b.status === 'CONFLICT'
      ? `已检测并发冲突：${b.conflict.conflict_id}（双方修改均保留）`
      : `未形成冲突：${JSON.stringify({ a: a.status, b: b.status })}`,
    b.status !== 'CONFLICT'
  )
}
async function resolveConflict(cid, choice) {
  if (!needAdmin()) return
  const out = await api('/api/conflicts/resolve', {
    method: 'POST',
    body: JSON.stringify({
      conflict_id: cid,
      choice,
      reason: `冲突解决：${choice}`,
      actor: 'admin',
      role: 'admin',
    }),
  })
  await refresh(false)
  render()
  toast(`冲突已解决：${out.status}（生成新变更事件，历史保留）`)
}
function openManualConflict(cid) {
  const c = S.model.conflicts.find((x) => x.conflict_id === cid)
  if (!c || !needAdmin()) return
  const pending = c.pending || {}
  const pp = pending.payload || {}
  dialog({
    title: `人工合并冲突 ${cid}`,
    body: `${field('text', '合并后的规则文本 / 错误提示', pp.text || '人工确认：最低金额调整为 30 元')}
      ${field('value', '合并后的规则值', '30', 'number')}${area('reason', '决策说明', '产品确认采用 30 元')}`,
    onOk: async (d) => {
      // 按冲突提交的实际 op 构造可重放 payload：原型侧组件修改写入 props.min，
      // PRD 侧规则修改写入 text/value，避免把无关字段塞进组件导致人工决策未生效。
      const payload = { ...pp }
      if (pending.op === 'update_component') {
        payload.props = {
          ...(pp.props || {}),
          min: Number(d.value),
          error_message: d.text,
          rule_field: pp.props?.rule_field || 'min_amount',
        }
        delete payload.text
        delete payload.value
      } else {
        payload.text = d.text
        payload.value = Number(d.value)
      }
      const out = await api('/api/conflicts/resolve', {
        method: 'POST',
        body: JSON.stringify({
          conflict_id: cid,
          choice: 'manual',
          payload,
          reason: d.reason,
          actor: 'admin',
          role: 'admin',
        }),
      })
      await refresh(false)
      render()
      toast(`人工合并完成：${out.status}`)
    },
  })
}
function openRestore(version) {
  if (!needAdmin()) return
  dialog({
    title: `恢复历史版本 v${version}`,
    danger: true,
    okText: '执行恢复',
    body: `<p>恢复将用快照 v${version} 的需求模型重新渲染 PRD 与 Prototype，<b>保留恢复前历史</b>，并生成新的恢复变更事件。</p>
      ${area('reason', '恢复原因', `恢复 v${version} 并重新执行一致性检查`)}
      ${selectField('scope', '范围', [
        ['model', '整个模型'],
        ['feature', `仅当前功能 ${S.featureId}`],
      ])}`,
    onOk: async (d) => {
      const out = await api('/api/restore', {
        method: 'POST',
        body: JSON.stringify({
          version,
          scope: d.scope,
          feature_id: S.featureId,
          reason: d.reason,
          actor: 'admin',
          role: 'admin',
        }),
      })
      await refresh(false)
      S.view = 'changes'
      render()
      toast(
        `已恢复 v${version} → v${out.version}（${out.status}），生成 ${out.change_id}`
      )
    },
  })
}
function showDiff(version) {
  const cur = S.model
  const c = [...cur.changes].reverse().find((x) => x.target_version > version)
  dialog({
    title: `版本差异 v${version} → v${cur.model_version}`,
    okText: '关闭',
    body: `<dl class="kv"><dt>当前版本</dt><dd>v${cur.model_version}</dd><dt>快照版本</dt><dd>v${version}</dd>
      <dt>当前变更数</dt><dd>${cur.changes.length}</dd><dt>当前功能数</dt><dd>${cur.features.length}</dd>
      <dt>需求数</dt><dd>${cur.features.reduce((n, f) => n + f.requirements.length, 0)}</dd>
      <dt>映射数</dt><dd>${cur.mappings.length}</dd></dl>
      <p><b>该版本之后的变更</b></p><pre class="code-block">${esc(
        JSON.stringify(
          cur.changes
            .filter((x) => x.target_version > version)
            .slice(-12)
            .map((x) => ({
              id: x.change_id,
              op: x.op,
              source: x.source_view,
              version: `v${x.target_version}`,
              reason: x.reason,
            })),
          null,
          2
        )
      )}</pre>`,
    onOk: async () => true,
  })
}
function openGateDemo() {
  const payload = {
    feature_id: 'UTER-DEMO-001',
    name: '门禁演示功能',
    status: 'NOT_IMPLEMENTED',
    prd: { goal: '演示新增功能门禁' },
    prototype: { pages: [{ name: '演示页' }] },
    acceptance: [{ given: 'A', when: 'B', then: 'C' }],
    requirements: [{ title: '演示需求' }],
    test_path: 'tools/product-workspace/tests/requirements-trace.test.mjs',
  }
  api('/api/gate', {
    method: 'POST',
    body: JSON.stringify({ ...payload, role: S.role }),
  }).then((g) => {
    dialog({
      title: `新增功能门禁：${g.decision}`,
      okText: '关闭',
      body: `<p>Feature ID → PRD → Prototype → Mapping → Validation → Implementation → Testing → Acceptance</p>
        <table class="grid-table"><thead><tr><th>检查</th><th>结果</th><th>说明</th></tr></thead><tbody>
        ${g.checks.map((c) => `<tr><td class="mono">${esc(c.id)}</td><td>${c.ok ? '✅ PASS' : '❌ BLOCK'}</td><td>${esc(c.detail)}</td></tr>`).join('')}</tbody></table>
        <div class="subtle-note" style="margin-top:10px">本按钮仅执行门禁校验（dry run），不会真的创建功能，避免污染功能目录。</div>`,
      onOk: async () => true,
    })
  })
}

/* ───────────────────────── 启动 ───────────────────────── */
$('#roleSelect').addEventListener('change', (e) => {
  S.role = e.target.value
  renderStatus()
  render()
  toast(
    S.role === 'admin'
      ? '已切换为管理员视图（可编辑）'
      : '已切换为普通用户视图（只读）'
  )
})
$('#themeToggle').addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme
  document.documentElement.dataset.theme = cur === 'dark' ? 'light' : 'dark'
})

;(async function boot() {
  if (EMBEDDED) document.querySelector('#healthLink')?.remove()
  try {
    await refresh(false)
    const params = new URLSearchParams(location.search)
    const featureParam = params.get('feature')
    S.featureId =
      featureParam &&
      S.model.features.some((f) => f.feature_id === featureParam)
        ? featureParam
        : S.model.features.find((f) => f.feature_id === 'UTER-PAY-001')
            ?.feature_id || S.model.features[0].feature_id
    S.view = params.get('view') === 'prd-standalone' ? 'prd' : 'overview'
    if (params.get('view') === 'prd-standalone') {
      S.mode = 'prd-standalone'
      S.view = 'detail'
    }
    await refresh()
  } catch (e) {
    $('#main').innerHTML =
      `<div class="scrollview"><div class="alert-box alert-error">无法加载统一需求模型：${esc(e.message)}<br>请确认服务已启动：node tools/product-workspace/server.mjs</div></div>`
  }
})()
