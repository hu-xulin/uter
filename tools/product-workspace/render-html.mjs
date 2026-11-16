/*
 * UTER 交互式 HTML 原型渲染器 —— 由唯一权威模型渲染真正可操作的原型页面
 *
 * 事实源与 PRD 相同：docs/product/registry/product-model.json。
 * 每个 Feature 生成一份自包含 HTML（零外部依赖，可双击直接打开）：
 *   - 左侧：可操作原型（组件渲染 / 表单校验 / 按钮 MOCK 动作 / 弹窗抽屉 / 状态切换 / 页面跳转 / PC·H5）
 *   - 右侧：同一 Feature 的 PRD 面板（12 章节摘要，同源渲染）
 *   - 双向定位：左侧组件 ↔ 右侧需求 / 验收 / 测试，经 data-* 与内联 MAPPING 联动
 * 所有数据均为 DEMO / MOCK 合成值，不接触真实资金、账户或生产数据。
 * 直接手工编辑生成的 HTML 会在下次同步时被覆盖。
 */
export const prototypeHTMLPath = (f) => `docs/product/prototypes/${f.domain.toLowerCase()}/${f.feature_id}.html`;

const STATUS_LABEL = {
  IMPLEMENTED: '已实现（前后端均有证据）',
  PARTIALLY_IMPLEMENTED: '部分实现（存在明确缺口）',
  FRONTEND_ONLY: '仅前端（未发现后端实现）',
  BACKEND_ONLY: '仅后端（未发现用户侧页面）',
  DOCUMENTED_ONLY: '仅文档规划（无代码实现）',
  NOT_IMPLEMENTED: '未实现（仅规划原型，非已上线功能）',
  UNKNOWN: '证据不足，待确认（不编造业务决策）',
};

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const jesc = (s) => JSON.stringify(String(s ?? '')).replace(/</g, '\\u003c');
const NOW = () => new Date().toISOString();
const domainDir = (f) => f.domain.toLowerCase();

/* ───────── 左侧：组件渲染（真实可操作控件） ───────── */
const INPUT_LIKE = ['input', 'select', 'radio_group', 'textarea', 'checkbox'];

function mockRows(c) {
  const cols = (c.props?.columns || ['名称', '状态', '更新时间']).slice(0, 4);
  const rows = [
    [`MOCK-${c.component_id}-01`, '正常', '2026-11-09 10:00'],
    [`MOCK-${c.component_id}-02`, '处理中', '2026-11-09 10:05'],
    [`MOCK-${c.component_id}-03`, '已完成', '2026-11-09 10:12'],
  ];
  return { cols, rows };
}

function controlHTML(c) {
  const name = esc(c.name || c.component_id);
  const reqAttr = `data-component-id="${esc(c.component_id)}" data-requirement-id="${esc(c.requirement_id || '')}"`;
  const val = c.props?.value != null ? esc(c.props.value) : '';
  const minAttr = c.props?.min !== undefined ? ` min="${esc(c.props.min)}" data-min="${esc(c.props.min)}"` : '';
  const maxAttr = c.props?.max !== undefined ? ` max="${esc(c.props.max)}"` : '';
  const errAttr = c.props?.error_message ? ` data-error="${esc(c.props.error_message)}"` : '';
  switch (c.type) {
    case 'input':
      return `<input class="ctl" type="${esc(c.input_type || 'text')}" name="${name}" placeholder="${esc(c.props?.placeholder || '')}" value="${val}"${minAttr}${maxAttr}${errAttr} ${c.required ? 'data-required="1"' : ''}>`;
    case 'textarea':
      return `<textarea class="ctl" name="${name}" rows="3" placeholder="${esc(c.props?.placeholder || '')}"${errAttr} ${c.required ? 'data-required="1"' : ''}>${val}</textarea>`;
    case 'select':
      return `<select class="ctl" name="${name}"${c.required ? ' data-required="1"' : ''}>${(c.options?.length ? c.options : ['请选择']).map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`;
    case 'radio_group':
      return `<div class="radio-group" role="radiogroup" aria-label="${esc(c.label)}">${(c.options || []).map((o, i) => `<label class="radio-item"><input type="radio" name="${name}" value="${esc(o)}" ${i === 0 ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div>`;
    case 'checkbox':
      return `<label class="radio-item"><input type="checkbox" name="${name}" ${val ? 'checked' : ''}><span>${esc(c.props?.placeholder || c.label)}</span></label>`;
    case 'button':
      return `<button class="btn ${c.props?.primary === false ? 'btn-ghost' : 'btn-primary'}" type="button" data-action="${esc(c.action || '')}" ${c.action ? `data-act-btn="${esc(c.action)}"` : 'disabled'}>${esc(c.label)}</button>`;
    case 'badge':
      return `<span class="badge" data-demo="MOCK">${esc(c.label)}</span>`;
    case 'alert':
      return `<div class="alert ${c.state === 'error' ? 'alert-error' : 'alert-info'}" data-alert="${esc(c.props?.rule_field || '')}" hidden>${esc(c.props?.error_message || c.label)}</div>`;
    case 'modal':
      return `<div class="modal-mask" data-modal="${esc(c.trigger || c.component_id)}" hidden><div class="modal" role="dialog" aria-modal="true"><div class="modal-hd"><b>${esc(c.label)}</b><button class="modal-x" type="button" aria-label="关闭">×</button></div><div class="modal-bd"><p class="caption">MOCK 弹窗 · 关联需求 ${esc(c.requirement_id || '—')}。此处仅演示交互，不产生真实数据。</p>${c.props?.body ? `<p>${esc(c.props.body)}</p>` : ''}<div class="modal-actions"><button class="btn btn-primary" type="button" data-mock-ok>确认（MOCK）</button><button class="btn btn-ghost" type="button" data-mock-cancel>取消</button></div></div></div></div>`;
    case 'drawer':
      return `<div class="drawer-mask" data-drawer="${esc(c.trigger || c.component_id)}" hidden><aside class="drawer" role="dialog" aria-modal="true"><div class="modal-hd"><b>${esc(c.label)}</b><button class="modal-x" type="button" aria-label="关闭">×</button></div><div class="drawer-bd"><p class="caption">MOCK 抽屉 · 关联需求 ${esc(c.requirement_id || '—')}</p>${c.props?.body ? `<p>${esc(c.props.body)}</p>` : ''}</div></aside></div>`;
    case 'table': {
      const { cols, rows } = mockRows(c);
      return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map((x) => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.slice(0, cols.length).map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    case 'search':
      return `<div class="search"><input class="ctl" type="search" name="${name}" placeholder="${esc(c.props?.placeholder || '搜索（MOCK）')}"><button class="btn btn-ghost" type="button" data-mock-search>搜索</button></div>`;
    case 'pagination':
      return `<nav class="pager" aria-label="分页（MOCK）"><button class="pg" type="button">‹</button><button class="pg is-on" type="button">1</button><button class="pg" type="button">2</button><button class="pg" type="button">3</button><button class="pg" type="button">›</button></nav>`;
    case 'stat_card':
      return `<div class="stats"><div class="stat"><span class="stat-k">${esc(c.props?.metric || c.label)}</span><span class="stat-v" data-demo="MOCK">${esc(c.props?.value ?? '128.00')}</span><span class="stat-s">合成数据，非真实值</span></div></div>`;
    case 'tabs':
      return `<div class="tabs" role="tablist">${(c.options || ['标签一', '标签二']).map((o, i) => `<button class="tab ${i === 0 ? 'is-on' : ''}" type="button" role="tab">${esc(o)}</button>`).join('')}</div>`;
    case 'toggle':
      return `<label class="toggle"><input type="checkbox" ${c.props?.default_on ? 'checked' : ''}><span class="toggle-ui"></span><span class="caption">${esc(c.props?.placeholder || '开关')}</span></label>`;
    case 'progress':
      return `<div class="prog"><div class="prog-bar" style="width:${esc(c.props?.value ?? 60)}%"></div><span class="caption">${esc(c.props?.value ?? 60)}%（MOCK）</span></div>`;
    case 'code_block':
      return `<pre class="code" data-code="${esc(c.name || c.component_id)}"><code>${esc(c.props?.code || c.label || '// MOCK')}</code></pre>`;
    case 'timeline':
      return `<ol class="tl">${(c.props?.steps || ['提交（MOCK）', '审核（MOCK）', '完成（MOCK）']).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`;
    default:
      return `<div class="ctl-static">${esc(c.label)}${c.props && Object.keys(c.props).length ? ` <span class="caption mono">${esc(JSON.stringify(c.props))}</span>` : ''}</div>`;
  }
}

function componentHTML(c) {
  if (c.status === 'DEPRECATED') return '';
  const depre = `⚠️ 组件已废弃（${esc(c.deprecation?.change_id || '变更事件')}）：${esc(c.deprecation?.reason || '按变更事件失效')}`;
  const inner = c.status === 'DEPRECATED'
    ? `<div class="cmp cmp-deprecated"><span class="caption">${depre}</span></div>`
    : `<div class="cmp" data-component-id="${esc(c.component_id)}" data-requirement-id="${esc(c.requirement_id || '')}">
        <div class="cmp-meta"><span class="chip mono" data-loc-cmp="${esc(c.component_id)}">${esc(c.component_id)}</span>
        <span class="chip chip-req mono" data-loc-req="${esc(c.requirement_id || '')}">${esc(c.requirement_id || '—')}</span>
        ${c.required ? '<span class="chip chip-req">必填</span>' : ''}</div>
        ${['input', 'select', 'radio_group', 'textarea', 'checkbox'].includes(c.type) && c.label ? `<label class="fld-label">${esc(c.label)}</label>` : ''}
        ${controlHTML(c)}
        <div class="field-err" data-err-for="${esc(c.name || c.component_id)}" hidden></div>
      </div>`;
  return inner;
}

function pageHTML(p, f, idx) {
  const plannedBadge = p.planned ? '<span class="chip chip-plan">PLANNED · 规划原型</span>' : '';
  return `<section class="page-sec" data-page="${esc(p.prototype_page_id)}" ${idx === 0 ? '' : 'hidden'}>
    <div class="page-hd"><b>${esc(p.name)}</b><span class="chip mono">${esc(p.prototype_page_id)}</span>${plannedBadge}
      <span class="caption">布局 ${esc(p.layout)} · 入口 <code>${esc(p.entry)}</code></span></div>
    ${p.planned ? `<div class="alert alert-warn">${esc(p.planned_notice || '规划原型：未发现对应的已上线前端实现，不得视为已上线能力。')}</div>` : ''}
    <div class="canvas-body">${p.components.map((c) => componentHTML(c)).join('\n')}</div>
    <div class="ints"><b class="caption">交互演示</b><div>${p.interactions.filter((i) => i.status !== 'DEPRECATED').map((i) => `<button class="chip" type="button" data-int="${esc(i.interaction_id)}" data-target="${esc(i.target_page_id || '')}" data-steps="${esc((i.steps || []).join(' → '))}" title="${esc(i.name)}">${esc(i.interaction_id)}</button>`).join('') || '<span class="caption">本页无交互</span>'}</div></div>
  </section>`;
}

/* ───────── 右侧：PRD 面板（与 PRD Markdown 同源同章节） ───────── */
function reqBlock(q) {
  return `<details class="req" id="req-${esc(q.requirement_id)}" data-req="${esc(q.requirement_id)}" data-page-ids="${esc((q.prototype_page_ids || []).join(' '))}" data-cmp-ids="${esc((q.component_ids || []).join(' '))}" ${q.status === 'DEPRECATED' ? '' : 'open'}>
    <summary><span class="mono">${esc(q.requirement_id)}</span> · ${esc(q.title)} <span class="chip">${esc(q.status)}</span></summary>
    <div class="req-body">
      <p>${esc(q.description)}</p>
      ${q.inputs?.length ? `<table class="mini"><tr><th>字段</th><th>类型</th><th>必填</th><th>校验</th></tr>${q.inputs.map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.type)}</td><td>${i.required ? '是' : '否'}</td><td>${esc((i.validation || []).join('；'))}</td></tr>`).join('')}</table>` : ''}
      ${q.business_rules?.length ? `<table class="mini"><tr><th>Rule ID</th><th>规则</th><th>字段</th><th>值</th></tr>${q.business_rules.map((b) => `<tr><td class="mono">${esc(b.rule_id)}</td><td>${esc(b.text)}</td><td>${esc(b.field || '—')}</td><td>${esc(b.value ?? '—')}</td></tr>`).join('')}</table>` : ''}
      ${q.error_messages?.length ? `<p class="caption">错误提示：${q.error_messages.map(esc).join('；')}</p>` : ''}
      <p class="caption">关联组件：${(q.component_ids || []).map((x) => `<button class="chip mono" type="button" data-loc-cmp="${esc(x)}">${esc(x)}</button>`).join(' ') || '—'}
      ｜ 页面：${(q.prototype_page_ids || []).map((x) => `<button class="chip mono" type="button" data-goto-page="${esc(x)}">${esc(x)}</button>`).join(' ') || '—'}</p>
    </div></details>`;
}

function prdPanelHTML(f, model) {
  const changes = model.changes.filter((c) => c.feature_id === f.feature_id || c.feature_id === 'ALL');
  return `<div class="prd-body" id="prdPanel" data-feature-id="${esc(f.feature_id)}" data-prd-path="${esc(f.prd.path)}">
    <div class="prd-hd"><b>${esc(f.feature_id)} · ${esc(f.name)} — PRD</b>
      <span class="chip chip-status">${esc(f.status)}</span>
      <span class="chip mono">PRD v${esc(f.prd.version)} · 模型 v${esc(model.model_version)}</span>
      <a class="chip" href="${esc(f.prd.path)}" target="_blank" rel="noopener">打开 PRD Markdown ↗</a></div>
    ${f.open_decisions?.length ? `<div class="alert alert-warn">待产品决策（${f.open_decisions.length}）：${f.open_decisions.map(esc).join('；')}</div>` : ''}
    ${f.status_note ? `<div class="caption status-note">状态证据：${esc(f.status_note)}</div>` : ''}

    <h5>1 基础信息</h5>
    <table class="mini"><tr><th>字段</th><th>值</th></tr>
      <tr><td>实现状态</td><td>${esc(f.status)} — ${esc(STATUS_LABEL[f.status] || f.status)}</td></tr>
      <tr><td>业务模块 / 优先级</td><td>${esc(f.module)} / ${esc(f.priority)}</td></tr>
      <tr><td>用户角色</td><td>${esc(f.roles.join('、'))}</td></tr>
      <tr><td>同步状态</td><td>${esc(f.sync_status)}</td></tr></table>

    <h5>2 产品背景</h5><p>${esc(f.background.goal)}</p>
    ${f.background.scenarios?.length ? `<p class="caption">场景：${f.background.scenarios.map(esc).join('；')}</p>` : ''}
    ${f.background.boundaries?.length ? `<p class="caption">边界：${f.background.boundaries.map(esc).join('；')}</p>` : ''}

    <h5>3 用户角色 / 4 用户故事</h5>
    ${f.user_stories.map((s) => `<p class="story">作为 <b>${esc(s.role)}</b>，我希望 <b>${esc(s.action)}</b>，以便 <b>${esc(s.goal)}</b>。</p>`).join('') || '<p class="caption">—</p>'}

    <h5>6 业务流程</h5>
    <ol class="flow">${(f.flows.normal || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    ${(f.flows.exception || []).length ? `<p class="caption">异常：${f.flows.exception.map(esc).join('；')}</p>` : ''}
    ${(f.flows.states || []).length ? `<p class="caption">页面状态：${f.flows.states.map(esc).join('、')}</p>` : ''}

    <h5>7 功能需求（点击下方组件 ID 可在左侧原型高亮）</h5>
    ${f.requirements.map(reqBlock).join('\n')}

    <h5>8 页面交互</h5>
    <table class="mini"><tr><th>页面</th><th>名称</th><th>关联需求</th></tr>
      ${f.prototype.pages.map((p) => `<tr><td><button class="chip mono" type="button" data-goto-page="${esc(p.prototype_page_id)}">${esc(p.prototype_page_id)}</button></td><td>${esc(p.name)}</td><td>${esc((p.requirement_ids || []).join('、'))}</td></tr>`).join('')}</table>

    <h5>9 API 和数据模型</h5>
    ${f.apis.length ? `<table class="mini"><tr><th>API</th><th>方法 / 路径</th></tr>${f.apis.map((a) => `<tr><td class="mono">${esc(a.api_id)}</td><td class="mono">${esc(a.method || '—')} ${esc(a.path || a.endpoint || a.name)}</td></tr>`).join('')}</table>` : '<p class="caption">—</p>'}
    ${f.data_models.length ? `<p class="caption">数据模型：${f.data_models.map((d) => esc(d.name || d.model)).join('、')}</p>` : ''}

    <h5>10 验收标准（Given / When / Then）</h5>
    <table class="mini"><tr><th>AC</th><th>Given</th><th>When</th><th>Then</th><th>需求</th></tr>
      ${f.acceptance.map((a) => `<tr><td class="mono">${esc(a.acceptance_id)}</td><td>${esc(a.given)}</td><td>${esc(a.when)}</td><td>${esc(a.then)}</td><td><button class="chip mono" type="button" data-loc-req="${esc(a.requirement_id || '')}">${esc(a.requirement_id || '—')}</button></td></tr>`).join('')}</table>

    <h5>11 测试追溯</h5>
    ${f.tests.length ? `<table class="mini"><tr><th>TC</th><th>名称</th><th>需求</th><th>结果</th></tr>${f.tests.map((t) => `<tr><td class="mono">${esc(t.test_case_id)}</td><td>${esc(t.name)}</td><td><button class="chip mono" type="button" data-loc-req="${esc(t.requirement_id || '')}">${esc(t.requirement_id || '—')}</button></td><td>${esc(t.result || '—')}</td></tr>`).join('')}</table>` : '<p class="caption">—</p>'}

    <h5>12 版本变更</h5>
    <p class="caption">基线 v1 · ${changes.length ? `另有 ${changes.length} 条变更事件（最新 ${esc(changes[changes.length - 1]?.change_id || '')}）` : '暂无变更事件'}。完整历史见 PRD Markdown §12 与 docs/product/history/。</p>
  </div>`;
}

/* ───────── 外壳：CSS + 交互 JS ───────── */
function shellCSS() {
  return `
:root{--ds-primary:#5B5EE6;--ds-primary-weak:#EEEFFF;--ds-text:#1F2329;--ds-text-2:#646A73;--ds-border:#DEE0E3;--ds-surface:#FFFFFF;--ds-bg:#F5F6F7;--ds-ok:#2EA121;--ds-warn:#B25E00;--ds-err:#D93026;--radius:10px}
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{font:14px/1.6 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:var(--ds-text);background:var(--ds-bg)}
.topbar{display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--ds-surface);border-bottom:1px solid var(--ds-border);flex-wrap:wrap}
.topbar .title{font-weight:700}
.split{display:flex;height:calc(100vh - 96px);min-height:0}
.pane{min-width:0;height:100%;overflow-y:auto;background:var(--ds-surface)}
.pane-left{width:50%;border-right:1px solid var(--ds-border)}
.pane-right{flex:1}
.pane-hd{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--ds-border);position:sticky;top:0;background:var(--ds-surface);z-index:5;flex-wrap:wrap}
.canvas{margin:14px;border:1px solid var(--ds-border);border-radius:var(--radius);padding:16px;transition:max-width .2s}
.canvas.h5{max-width:390px;margin:14px auto}
.page-hd{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.cmp{border:1px solid var(--ds-border);border-radius:var(--radius);padding:10px 12px;margin-bottom:10px;background:var(--ds-surface)}
.cmp-meta{display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap}
.chip{display:inline-block;font-size:12px;border:1px solid var(--ds-border);border-radius:999px;padding:1px 8px;background:var(--ds-bg);cursor:default}
button.chip{cursor:pointer}
.chip-req{color:var(--ds-primary);border-color:var(--ds-primary-weak);background:var(--ds-primary-weak)}
.chip-plan{color:var(--ds-warn)}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
.fld-label{display:block;font-weight:600;margin-bottom:4px;font-size:13px}
.ctl{width:100%;min-height:34px;padding:6px 10px;border:1px solid var(--ds-border);border-radius:10px;font:inherit;color:inherit;background:var(--ds-surface)}
.ctl:focus{outline:2px solid var(--ds-primary-weak);border-color:var(--ds-primary)}
.ctl-static{padding:4px 0}
.radio-group{display:flex;gap:12px;flex-wrap:wrap}
.radio-item{display:inline-flex;align-items:center;gap:6px}
.btn{min-height:34px;padding:6px 16px;border-radius:10px;border:1px solid transparent;font:inherit;cursor:pointer}
.btn-primary{background:var(--ds-primary);color:#fff}
.btn-primary:hover{filter:brightness(1.06)}
.btn-ghost{background:var(--ds-surface);border-color:var(--ds-border);color:var(--ds-text)}
.btn:disabled{opacity:.5;cursor:not-allowed}
.badge{display:inline-block;font-size:12px;color:var(--ds-warn);background:#FFF7E8;border:1px solid #F5D8A8;border-radius:999px;padding:2px 10px}
.alert{border-radius:var(--radius);padding:8px 12px;margin:6px 0;font-size:13px}
.alert-error{background:#FDECEA;color:var(--ds-err);border:1px solid #F5B9B4}
.alert-info{background:var(--ds-primary-weak);color:var(--ds-primary)}
.alert-warn{background:#FFF7E8;color:var(--ds-warn);border:1px solid #F5D8A8}
.tbl-wrap{overflow:auto;border:1px solid var(--ds-border);border-radius:10px}
.tbl,.mini{width:100%;border-collapse:collapse;font-size:13px}
.tbl th,.mini th{text-align:left;background:var(--ds-bg);padding:6px 10px;border-bottom:1px solid var(--ds-border);white-space:nowrap}
.tbl td,.mini td{padding:6px 10px;border-bottom:1px solid var(--ds-border)}
.search{display:flex;gap:8px}
.pager{display:flex;gap:4px}
.pg{min-width:28px;min-height:28px;border:1px solid var(--ds-border);border-radius:6px;background:var(--ds-surface);cursor:pointer}
.pg.is-on{background:var(--ds-primary);color:#fff;border-color:var(--ds-primary)}
.tabs{display:flex;gap:4px;border-bottom:1px solid var(--ds-border);padding-bottom:6px}
.tab{border:none;background:none;padding:4px 12px;cursor:pointer;border-radius:6px;font:inherit}
.tab.is-on{background:var(--ds-primary-weak);color:var(--ds-primary);font-weight:600}
.toggle{display:inline-flex;align-items:center;gap:8px;cursor:pointer}
.toggle-ui{width:36px;height:20px;border-radius:999px;background:var(--ds-border);position:relative;transition:.15s}
.toggle input{display:none}
.toggle input:checked+.toggle-ui{background:var(--ds-primary)}
.toggle input:checked+.toggle-ui::after{transform:translateX(16px)}
.toggle-ui::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:.15s}
.prog{background:var(--ds-bg);border-radius:999px;height:10px;overflow:auto;position:relative}
.prog-bar{height:10px;border-radius:999px;background:var(--ds-primary)}
.prog .caption{position:absolute;left:calc(100% + 8px);top:-4px;white-space:nowrap}
.prog{overflow:visible;width:60%}
.code{background:#0F1115;color:#D6E2F0;border-radius:10px;padding:12px;overflow:auto;font-size:12px}
.tl{list-style:none;margin:0;padding:0}
.tl li{padding:6px 0 6px 18px;position:relative}
.tl li::before{content:'';position:absolute;left:4px;top:12px;width:8px;height:8px;border-radius:50%;background:var(--ds-primary)}
.stats{display:flex;gap:10px;flex-wrap:wrap}
.stat{flex:1;min-width:140px;border:1px solid var(--ds-border);border-radius:var(--radius);padding:10px 12px}
.stat-k{display:block;font-size:12px;color:var(--ds-text-2)}
.stat-v{font-size:22px;font-weight:700}
.stat-s{display:block;font-size:12px;color:var(--ds-text-2)}
.ints{margin-top:10px;padding-top:8px;border-top:1px dashed var(--ds-border)}
.field-err{color:var(--ds-err);font-size:12px;margin-top:4px}
.modal-mask,.drawer-mask{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:50}
.modal{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:min(480px,92vw);background:var(--ds-surface);border-radius:12px}
.modal-hd{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--ds-border)}
.modal-x{border:none;background:none;font-size:18px;cursor:pointer}
.modal-bd,.drawer-bd{padding:14px 16px}
.drawer{position:absolute;top:0;right:0;height:100%;width:min(420px,90vw);background:var(--ds-surface);border-left:1px solid var(--ds-border)}
.modal-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
.skeleton{height:14px;border-radius:6px;background:linear-gradient(90deg,#EEE 25%,#F7F7F7 45%,#EEE 65%);background-size:200% 100%;animation:sk 1.2s infinite;margin:10px 0}
@keyframes sk{0%{background-position:200% 0}100%{background-position:-200% 0}}
.state-card{border:1px dashed var(--ds-border);border-radius:var(--radius);padding:36px;text-align:center;color:var(--ds-text-2)}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1F2329;color:#fff;border-radius:10px;padding:8px 16px;font-size:13px;z-index:99;opacity:0;transition:.2s;pointer-events:none}
.toast.show{opacity:1}
.flash{animation:fl 1.6s ease}
@keyframes fl{0%,60%{box-shadow:0 0 0 3px rgba(91,94,230,.55)}100%{box-shadow:none}}
.prd-body{padding:14px}
.prd-hd{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.prd-body h5{margin:14px 0 6px;font-size:13px;color:var(--ds-primary);border-top:1px solid var(--ds-border);padding-top:10px}
.req{border:1px solid var(--ds-border);border-radius:var(--radius);margin-bottom:8px}
.req summary{cursor:pointer;padding:8px 12px;font-weight:600}
.req-body{padding:0 12px 10px}
.req-body p{margin:6px 0}
.story{background:var(--ds-bg);border-radius:10px;padding:6px 10px;margin:6px 0}
.flow{margin:4px 0 8px;padding-left:20px}
.status-note{background:var(--ds-bg);border-radius:10px;padding:6px 10px}
.demo-banner{background:#FFF7E8;color:var(--ds-warn);padding:8px 16px;font-size:13px;border-bottom:1px solid #F5D8A8}
@media (max-width:900px){.split{flex-direction:column;height:auto}.pane-left{width:100%;border-right:none;border-bottom:1px solid var(--ds-border)}.pane{height:auto;max-height:none}}
`;
}

function shellJS() {
  return `
(function(){
  var F = document.body.dataset.featureId;
  var $ = function(s,r){return (r||document).querySelector(s)};
  var $$ = function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
  function toast(msg){var t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(function(){t.classList.remove('show')},2200);}
  function flash(el){if(!el)return;el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');}
  function gotoPage(pid){
    var sec=$('.page-sec[data-page="'+pid+'"]');if(!sec)return toast('未找到页面 '+pid);
    $$('.page-sec').forEach(function(s){s.hidden=s!==sec});
    var sel=$('#pageSel');if(sel)sel.value=pid;
    window.scrollTo({top:0});
  }
  function locateReq(rid){
    if(!rid)return;
    var el=document.getElementById('req-'+rid);
    if(!el)return toast('右侧未找到 '+rid);
    el.open=true;el.scrollIntoView({block:'center'});flash(el);
  }
  function locateCmp(cid){
    var el=$('.cmp[data-component-id="'+cid+'"]');
    if(!el)return toast('左侧未找到 '+cid);
    var sec=el.closest('.page-sec');if(sec){$$('.page-sec').forEach(function(s){s.hidden=s!==sec});var sel=$('#pageSel');if(sel)sel.value=sec.dataset.page;}
    el.scrollIntoView({block:'center'});flash(el);
  }
  // 双向定位（原型 ↔ PRD）
  document.addEventListener('click',function(e){
    var t=e.target.closest('[data-loc-req],[data-loc-cmp],[data-goto-page],[data-int],[data-act-btn],[data-mock-ok],[data-mock-cancel],[data-mock-search],.modal-x,.pg,.tab');
    if(!t)return;
    if(t.dataset.locReq!==undefined&&t.dataset.locReq!==''){locateReq(t.dataset.locReq);return;}
    if(t.dataset.locCmp){locateCmp(t.dataset.locCmp);return;}
    if(t.dataset.gotoPage){gotoPage(t.dataset.gotoPage);return;}
    if(t.dataset.int){
      var steps=t.dataset.steps;toast('MOCK 交互 '+t.dataset.int+(steps?'：'+steps:''));
      var sec=t.closest('.page-sec');
      if(t.dataset.target){gotoPage(t.dataset.target);}
      else if(sec){var first=sec.querySelector('.cmp');if(first)flash(first);}
      return;
    }
    if(t.dataset.mockOk!==undefined||t.dataset.mockCancel!==undefined||t.classList.contains('modal-x')){
      var m=t.closest('.modal-mask,.drawer-mask');if(m)m.hidden=true;toast('MOCK 操作完成，未产生真实数据');return;
    }
    if(t.dataset.mockSearch!==undefined){toast('MOCK 搜索：仅演示交互');return;}
    if(t.classList.contains('pg')){var pg=t.parentNode.querySelector('.is-on');if(pg)pg.classList.remove('is-on');t.classList.add('is-on');toast('MOCK 分页：第 '+t.textContent+' 页');return;}
    if(t.classList.contains('tab')){var tb=t.parentNode.querySelector('.is-on');if(tb)tb.classList.remove('is-on');t.classList.add('is-on');return;}
    if(t.dataset.actBtn){
      var act=t.dataset.actBtn;
      $$('[data-alert]').forEach(function(a){a.hidden=true});
      // 表单校验（规则来自 PRD 业务规则，同源同步）
      var bad=null;
      $$('.cmp .ctl[data-required],.cmp .ctl[data-min]').forEach(function(inp){
        var errEl=document.querySelector('[data-err-for="'+inp.name+'"]');
        var msg='';
        if(inp.dataset.required&&inp.type!=='radio'&&inp.type!=='checkbox'&&!String(inp.value).trim())msg=inp.dataset.error||'该字段为必填项';
        if(!msg&&inp.dataset.min!==undefined&&inp.value!==''&&Number(inp.value)<Number(inp.dataset.min))msg=inp.dataset.error||('不得低于 '+inp.dataset.min);
        if(errEl){errEl.textContent=msg;errEl.hidden=!msg;}
        if(msg&&!bad)bad={inp:inp,msg:msg};
      });
      var alertEl=document.querySelector('[data-alert]');
      if(bad){if(alertEl){alertEl.textContent=bad.msg;alertEl.hidden=false;}locateCmp(bad.inp.closest('.cmp').dataset.componentId);toast('校验未通过：'+bad.msg);return;}
      if(alertEl)alertEl.hidden=true;
      var modal=document.querySelector('[data-modal="'+act+'"]');if(modal){modal.hidden=false;return;}
      var drawer=document.querySelector('[data-drawer="'+act+'"]');if(drawer){drawer.hidden=false;return;}
      var code=document.querySelector('[data-code]');
      if(code)code.querySelector('code').textContent='// MOCK 响应（无真实资金/账户操作）\\n{\\n  "feature_id": "'+F+'",\\n  "action": "'+act+'",\\n  "form": '+JSON.stringify(collectForm())+'\\n}';
      toast('MOCK 动作 '+act+' 已执行（合成数据）');
      return;
    }
  });
  function collectForm(){
    var out={};
    $$('.canvas .ctl').forEach(function(el){if(el.name)out[el.name]=el.type==='radio'?(document.querySelector('input[name="'+el.name+'"]:checked')||{}).value||null:el.type==='checkbox'?el.checked:el.value;});
    return out;
  }
  // 页面切换 / 状态切换 / 视口
  var pageSel=$('#pageSel'),stateSel=$('#stateSel'),vpSel=$('#vpSel');
  if(pageSel)pageSel.addEventListener('change',function(){gotoPage(pageSel.value)});
  if(stateSel)stateSel.addEventListener('change',function(){applyState(stateSel.value)});
  if(vpSel)vpSel.addEventListener('change',function(){var c=$('#protoCanvas');c.classList.toggle('h5',vpSel.value==='H5');});
  function applyState(st){
    var canvas=$('#protoCanvas');
    var holder=$('#stateOverlay');
    $$('.page-sec').forEach(function(s){s.hidden=!!st&&st!=='idle'});
    if(!st||st==='idle'){holder.hidden=true;return;}
    holder.hidden=false;
    if(st==='loading')holder.innerHTML='<div class="skeleton" style="width:70%"></div><div class="skeleton" style="width:90%"></div><div class="skeleton" style="width:55%"></div>';
    else if(st==='empty')holder.innerHTML='<div class="state-card">暂无数据（MOCK 空态）</div>';
    else if(st==='error')holder.innerHTML='<div class="state-card">加载失败，请重试（MOCK 错误态）</div>';
    else if(st==='disabled')holder.innerHTML='<div class="state-card">当前操作不可用（MOCK 禁用态）</div>';
    else if(st==='no-permission')holder.innerHTML='<div class="state-card">权限不足：该功能不向当前角色开放（MOCK）</div>';
    else if(st==='success')holder.innerHTML='<div class="state-card" style="color:var(--ds-ok)">操作成功（MOCK 成功态）</div>';
  }
  // 顶部还原按钮
  var reset=$('#resetBtn');
  if(reset)reset.addEventListener('click',function(){applyState('idle');if(stateSel)stateSel.value='idle';if(vpSel)vpSel.value='PC';$('#protoCanvas').classList.remove('h5');toast('已恢复默认视图');});
})();
`;
}

export function renderPrototypeHTML(f, model) {
  const mdPath = `docs/product/prototypes/${domainDir(f)}/${f.feature_id}.html`;
  const pages = f.prototype.pages;
  const stateKinds = [...new Set(pages.flatMap((p) => (p.states || []).map((s) => (typeof s === 'string' ? s : (s.kind || s.name)))))];
  const states = ['idle', ...stateKinds.filter((s) => s && s !== 'idle')];
  const banner = pages[0]?.demo_notice || 'DEMO / MOCK：本原型只使用合成数据，不发起真实支付、退款、余额变更或账户操作。';
  return `<!DOCTYPE html>
<html lang="zh-CN" data-feature-id="${esc(f.feature_id)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(f.feature_id)} · ${esc(f.name)} — 交互式原型 × PRD</title>
<style>${shellCSS()}</style>
</head>
<body data-feature-id="${esc(f.feature_id)}" data-prd-path="${esc(f.prd.path)}" data-model-version="${esc(model.model_version)}">
<div class="demo-banner" data-demo="MOCK">🧪 ${esc(banner)} 实现状态 <b>${esc(f.status)}</b>（${esc(STATUS_LABEL[f.status] || f.status)}）${f.status === 'NOT_IMPLEMENTED' ? ' · 以下均为规划原型，非已上线能力' : ''}</div>
<header class="topbar">
  <span class="title">${esc(f.feature_id)} · ${esc(f.name)}</span>
  <span class="chip mono">模型 v${esc(model.model_version)} · 原型 v${esc(f.prototype.prototype_id)}</span>
  <span class="chip mono" title="与 PRD 同一数据源">同源：registry/product-model.json</span>
  <a class="chip" href="${esc(f.prd.path)}" target="_blank" rel="noopener">PRD Markdown ↗</a>
  <a class="chip" href="${esc(mdPath.replace(/\.html$/, '.md'))}" target="_blank" rel="noopener">原型说明 ↗</a>
  <span style="flex:1"></span>
  <label class="caption">页面 <select id="pageSel" class="ctl" style="width:auto;min-width:150px;display:inline-block">${pages.map((p, i) => `<option value="${esc(p.prototype_page_id)}" ${i === 0 ? 'selected' : ''}>${esc(p.prototype_page_id)} · ${esc(p.name)}</option>`).join('')}</select></label>
  <label class="caption">状态 <select id="stateSel" class="ctl" style="width:auto;display:inline-block">${states.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select></label>
  <label class="caption">视口 <select id="vpSel" class="ctl" style="width:auto;display:inline-block"><option>PC</option><option>H5</option></select></label>
  <button id="resetBtn" class="btn btn-ghost" type="button">恢复默认</button>
</header>
<main class="split">
  <section class="pane pane-left" aria-label="交互式原型">
    <div class="pane-hd"><b>原型（可操作）</b><span class="chip mono">${esc(pages[0]?.prototype_page_id || '')}</span><span class="chip chip-req">点击组件 ID / 需求 ID 双向定位</span></div>
    <div class="canvas" id="protoCanvas">
      ${pages.map((p, i) => pageHTML(p, f, i)).join('\n')}
      <div id="stateOverlay" hidden></div>
    </div>
  </section>
  <section class="pane pane-right" aria-label="PRD 面板">
    <div class="pane-hd"><b>PRD（同源对应）</b><span class="chip chip-req">点击需求 / 组件 / 页面 ID 回到左侧</span></div>
    ${prdPanelHTML(f, model)}
  </section>
</main>
<div id="toast" class="toast" role="status" aria-live="polite"></div>
<script>${shellJS()}</script>
</body>
</html>`;
}

/** 单个 Feature 的三份投影（PRD MD / 原型说明 MD / 交互式原型 HTML） */
export function renderFeatureHTML(model, featureId) {
  const f = model.features.find((x) => x.feature_id === featureId);
  if (!f) return null;
  return renderPrototypeHTML(f, model);
}
