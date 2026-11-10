/*
 * UTER 文档投影渲染器 —— 把唯一权威模型渲染成人类可读的 PRD / Prototype / 注册表 / 报告
 *
 * 重要：docs/product/** 下的 Markdown 全部是「投影（Projection）」，不是事实源。
 *  事实源：docs/product/registry/product-model.json
 *  编辑入口：产品规格中心（PRD 视图 / Prototype 视图）→ engine.applyChange()
 *  引擎在每次有效变更后调用 renderFeatureDocs() 重渲染受影响 Feature 的两侧投影，
 *  因此文件层与模型层保持一致；直接手工编辑这些 Markdown 会在下次同步时被覆盖。
 *
 * 用法：
 *   node tools/product-workspace/render-docs.mjs --all      # 全量渲染
 *   node tools/product-workspace/render-docs.mjs --feature UTER-PAY-001
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prototypeHTMLPath, renderPrototypeHTML } from './render-html.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DOCS = path.join(ROOT, 'docs/product');
const MODEL_FILE = path.join(DOCS, 'registry/product-model.json');
const NOW = () => new Date().toISOString();
const clone = (x) => JSON.parse(JSON.stringify(x));

/* ───────────────────────── 基础工具 ───────────────────────── */
function write(rel, content) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content.endsWith('\n') ? content : content + '\n');
}
const cell = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>').trim();
const list = (arr, empty = '—') => (arr && arr.length ? arr.map((x) => `- ${x}`).join('\n') : empty);
const inline = (arr, empty = '—') => (arr && arr.length ? arr.map((x) => `\`${x}\``).join(', ') : empty);
const table = (headers, rows) => `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n${rows.map((r) => `| ${r.map(cell).join(' | ')} |`).join('\n')}`;
const anchor = (id) => `<a id="${id}"></a>`;
const domainDir = (f) => f.domain.toLowerCase();

/** 极简 YAML 序列化（标量 / 数组 / 对象），避免引入外部依赖 */
function yaml(value, indent = 0) {
  const pad = ' '.repeat(indent);
  const scalar = (v) => {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return String(v);
    const s = String(v);
    return /^[\w./:@\-\u4e00-\u9fa5 ]+$/.test(s) && !/^\s|\s$/.test(s) ? s : JSON.stringify(s);
  };
  if (Array.isArray(value)) {
    if (!value.length) return `${pad}[]`;
    return value.map((v) => {
      if (v && typeof v === 'object') return `${pad}-\n${yaml(v, indent + 2)}`;
      return `${pad}- ${scalar(v)}`;
    }).join('\n');
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) return `${pad}{}`;
    return entries.map(([k, v]) => {
      if (v && typeof v === 'object') {
        const child = Array.isArray(v) && !v.length ? ' []' : Array.isArray(v) && v.every((x) => x === null || typeof x !== 'object') ? ` [${v.map(scalar).join(', ')}]` : `\n${yaml(v, indent + 2)}`;
        return `${pad}${k}:${child}`;
      }
      return `${pad}${k}: ${scalar(v)}`;
    }).join('\n');
  }
  return `${pad}${scalar(value)}`;
}

const STATUS_LABEL = {
  IMPLEMENTED: '已实现（前后端均有证据）',
  PARTIALLY_IMPLEMENTED: '部分实现（存在明确缺口）',
  FRONTEND_ONLY: '仅前端（未发现后端实现）',
  BACKEND_ONLY: '仅后端（未发现用户侧页面）',
  DOCUMENTED_ONLY: '仅文档规划（无代码实现）',
  NOT_IMPLEMENTED: '未实现（仅规划原型，非已上线功能）',
  UNKNOWN: '证据不足，待确认（不编造业务决策）',
};

/* ───────────────────────── PRD 投影 ───────────────────────── */
export function renderPRD(f, model) {
  const prdPath = f.prd.path;
  const protoPath = `docs/product/prototypes/${domainDir(f)}/${f.feature_id}.md`;
  const protoHtml = prototypeHTMLPath(f);
  const L = [];
  L.push(`# ${f.feature_id} · ${f.name} — 产品需求文档（PRD）`, '');
  L.push(`> **投影文档 · 禁止直接手工编辑**。唯一权威数据源为 \`docs/product/registry/product-model.json\`（Single Source of Truth）。`);
  L.push(`> 请在产品规格中心（\`http://127.0.0.1:7788/\`）通过 PRD 或 Prototype 视图编辑；所有有效变更经统一模型事务化双写，并自动重渲染 PRD 与原型投影。`);
  L.push(`> 模型版本 **v${model.model_version}** · PRD 版本 v${f.prd.version} · 渲染于 ${NOW()} · 设计基线 UTER Design System 3.0`, '');
  L.push(`> **实现状态：\`${f.status}\` — ${STATUS_LABEL[f.status] || f.status}**。${f.status === 'NOT_IMPLEMENTED' ? '本文描述的是规划需求与规划原型，不代表该能力已上线。' : ''}`);
  if (f.status_note) L.push(`> 状态证据说明：${f.status_note}`);
  if (f.open_decisions?.length) L.push(`> **待产品决策（${f.open_decisions.length}）**：${f.open_decisions.join('；')}`);
  L.push('');

  /* 1 基础信息 */
  L.push('## 1. 基础信息', '');
  L.push(table(['字段', '值'], [
    ['Feature ID', `\`${f.feature_id}\``],
    ['功能名称', f.name],
    ['业务模块', f.module],
    ['领域 / Domain', f.domain],
    ['实现状态', `\`${f.status}\``],
    ['优先级', f.priority],
    ['用户角色', inline(f.roles)],
    ['PRD ID / 版本', `${f.prd.prd_id} / v${f.prd.version}`],
    ['原型 ID', f.prototype.prototype_id],
    ['原型文档', `\`${protoPath}\``],
    ['交互式原型（HTML）', `\`${protoHtml}\``],
    ['同步状态', `\`${f.sync_status}\``],
    ['最近同步', f.last_synced_at],
    ['最近变更来源', f.last_change_source],
    ['权威数据模型', '`docs/product/registry/product-model.json`'],
    ['关联 Change ID', inline(f.requirements.flatMap((q) => q.change_ids || []).filter(Boolean)) || '初始基线（无变更事件）'],
  ]), '');
  if (f.evidence_note) L.push(`> 盘点证据备注：${f.evidence_note}`, '');

  /* 2 产品背景 */
  L.push('## 2. 产品背景', '');
  L.push(`- **目标**：${f.background.goal}`);
  L.push(`- **问题**：${f.background.problem || '—'}`);
  L.push('- **使用场景**：', list(f.background.scenarios));
  L.push('- **边界 / 不含范围**：', list(f.background.boundaries));
  if (f.background.related?.length) L.push('- **关联功能**：', inline(f.background.related));
  L.push('');

  /* 3 用户角色 */
  L.push(`## 3. ${f.prd.sections[2]}`, '');
  L.push(table(['角色', '可见性 / 权限', '来源'], f.roles.map((r) => [r, `具备「${f.name}」访问权限`, '统一需求模型 roles 字段'])), '');
  L.push('- 权限约束：', list(f.flows.permissions));

  /* 4 用户故事 */
  L.push('## 4. 用户故事', '');
  L.push(table(['角色', '行为', '价值', '完整描述'], f.user_stories.map((s) => [s.role, s.action, s.goal, s.text])), '');

  /* 5 功能范围 */
  L.push('## 5. 功能范围', '');
  L.push('### 5.1 范围内', '', list(f.scope.included));
  L.push('### 5.2 范围外', '', list(f.scope.excluded));
  L.push('### 5.3 上游依赖', '', inline(f.scope.upstream));
  L.push('### 5.4 下游依赖', '', inline(f.scope.downstream));
  L.push('');

  /* 6 业务流程 */
  L.push('## 6. 业务流程', '');
  L.push('### 6.1 主流程', '', f.flows.normal.map((s, i) => `${i + 1}. ${s}`).join('\n'));
  L.push('### 6.2 异常流程', '', list(f.flows.exception));
  L.push('### 6.3 边界流程', '', list(f.flows.boundary));
  L.push('### 6.4 页面状态集合', '', inline(f.flows.states));
  L.push('### 6.5 状态恢复', '', list(f.flows.recovery));
  L.push('');

  /* 7 功能需求 */
  L.push('## 7. 功能需求', '');
  for (const q of f.requirements) {
    L.push(`### ${anchor(q.requirement_id)}${q.requirement_id} · ${q.title}`, '');
    L.push(table(['字段', '值'], [
      ['状态 / 优先级', `${q.status} / ${q.priority}`],
      ['描述', q.description],
      ['页面入口', `\`${q.entry}\``],
      ['输出', q.output],
      ['权限', q.permission],
      ['数据变更', q.data_change],
      ['关联原型页面', inline(q.prototype_page_ids)],
      ['关联组件', inline(q.component_ids)],
      ['关联交互', inline(q.interaction_ids)],
      ['关联验收标准', inline(q.acceptance_ids)],
      ['关联测试用例', inline(q.test_case_ids)],
      ['关联 Change ID', inline(q.change_ids)],
    ]), '');
    L.push('**输入字段**', '');
    L.push(q.inputs?.length ? table(['字段名', '类型', '必填', '校验规则'], q.inputs.map((i) => [i.name, i.type, i.required ? '是' : '否', list(i.validation)])) : '—', '');
    L.push('**业务规则**', '');
    L.push(q.business_rules?.length ? table(['Rule ID', '规则', '字段', '值', '状态'], q.business_rules.map((b) => [b.rule_id, b.text, b.field ?? '—', b.value ?? '—', b.status])) : '—', '');
    L.push('**错误提示**', '', list(q.error_messages));
    if (q.deprecation) L.push(`> 该需求已废弃（${q.deprecation.change_id}）：${q.deprecation.reason}；影响范围 ${JSON.stringify(q.deprecation.impact)}`, '');
  }

  /* 8 页面交互 */
  L.push(`## 8. ${f.prd.sections[7]}`, '');
  L.push(table(['Prototype Page ID', '页面', '布局', '入口', '状态', '关联需求'], f.prototype.pages.map((p) => [
    `[${p.prototype_page_id}](${protoPath}#${p.prototype_page_id})`, p.name, p.layout, `\`${p.entry}\``,
    p.planned ? 'PLANNED（规划原型）' : p.status, inline(p.requirement_ids),
  ])), '');
  L.push('**交互清单**', '');
  const allInt = f.prototype.pages.flatMap((p) => p.interactions.map((i) => [p.prototype_page_id, i]));
  L.push(allInt.length ? table(['页面', 'Interaction ID', '名称', '触发', '动作', '步骤', '目标页面'], allInt.map(([pid, i]) => [pid, i.interaction_id, i.name, `\`${i.trigger}\``, `\`${i.action}\``, list(i.steps), i.target_page_id || '—'])) : '—', '');
  L.push(`> 完整可操作原型（表单、按钮、弹窗、抽屉、列表、状态切换、跳转、状态恢复）见 **交互式 HTML 原型** \`${protoHtml}\`（可直接用浏览器打开，左原型 / 右 PRD 同源双栏）、产品规格中心左侧 Prototype 面板，及 \`${protoPath}\`。`, '');

  /* 9 API 和数据模型 */
  L.push(`## 9. ${f.prd.sections[8]}`, '');
  L.push('### 9.1 API', '');
  L.push(f.apis.length ? table(['API ID', '方法', '路径', '请求', '响应', '错误码', '证据来源'], f.apis.map((a) => [a.api_id, a.method || '—', `\`${a.path || a.endpoint || a.name}\``, a.request || '—', a.response || '—', inline(a.errors), a.source || '—'])) : '—', '');
  L.push('### 9.2 数据模型', '');
  L.push(f.data_models.length ? table(['Data Model ID', '模型', '字段', '证据来源'], f.data_models.map((d) => [d.data_model_id, d.name || d.model || '—', d.fields?.length ? inline(d.fields) : '见源码', d.source || d.evidence || '—'])) : '—', '');
  L.push('### 9.3 代码证据', '');
  L.push(list([...f.evidence.code, ...f.evidence.models]));
  L.push('');

  /* 10 验收标准 */
  L.push(`## 10. ${f.prd.sections[9]}（Given / When / Then）`, '');
  L.push(f.acceptance.length ? table(['Acceptance ID', '类型', 'Given', 'When', 'Then', '原型页面', '状态'], f.acceptance.map((a) => [a.acceptance_id, a.type, a.given, a.when, a.then, a.prototype_page_id || '—', a.status || 'ACTIVE'])) : '—', '');

  /* 11 测试追溯 */
  L.push('## 11. 测试追溯', '');
  L.push(f.tests.length ? table(['Test Case ID', '名称', '关联需求', '关联验收', '测试路径', '类型', '结果'], f.tests.map((t) => [t.test_case_id, t.name, t.requirement_id, inline(t.acceptance_ids), `\`${t.path}\``, t.kind, t.result])) : '—', '');
  L.push('**代码层测试证据**', '', inline(f.evidence.tests));
  L.push('**页面 / API 证据**', '', inline([...f.evidence.pages, ...f.evidence.apis]));
  L.push('');

  /* 12 版本变更 */
  const changes = model.changes.filter((c) => c.feature_id === f.feature_id || c.feature_id === 'ALL');
  L.push(`## 12. ${f.prd.sections[11]}`, '');
  L.push(table(['版本', '来源', 'Change ID', '操作', '同步状态', '说明'], [
    ['v1', '基线', 'INITIAL_BASELINE', '全量功能盘点建模', 'SYNCED', '由真实代码证据建立初始统一需求模型'],
    ...changes.slice(-30).map((c) => [`v${c.target_version}`, c.source_view, c.change_id, c.op, c.sync_status, c.reason]),
  ]), '');
  L.push(`> 版本快照：\`docs/product/history/vN.json\`。历史恢复会生成新的 Change ID 与快照，不覆盖既有历史。`, '');
  return L.join('\n');
}

/* ───────────────────────── Prototype 投影 ───────────────────────── */
export function renderPrototype(f, model) {
  const protoPath = `docs/product/prototypes/${domainDir(f)}/${f.feature_id}.md`;
  const L = [];
  L.push(`# ${f.feature_id} · ${f.name} — 交互式原型说明`, '');
  L.push(`> **投影文档 · 禁止直接手工编辑**。原型事实源与 PRD 相同：\`docs/product/registry/product-model.json\`。`);
  L.push(`> 模型版本 **v${model.model_version}** · 渲染于 ${NOW()} · 设计基线 UTER Design System 3.0`, '');
  L.push(`> **\`DEMO / MOCK\`**：本原型仅使用合成数据，不发起真实支付、退款、余额变更、账户操作或写生产数据；所有订单、金额、响应均为模拟值。`);
  L.push(`> **实现状态 \`${f.status}\`**：${STATUS_LABEL[f.status] || f.status}${f.status === 'NOT_IMPLEMENTED' ? '；下列页面均为规划原型（PLANNED），不得视为已上线能力。' : ''}`);
  L.push('');
  L.push(`打开可操作原型（推荐）：**交互式 HTML 原型** \`docs/product/prototypes/${domainDir(f)}/${f.feature_id}.html\` —— 自包含网页，左原型 / 右 PRD 同源双栏，浏览器直接打开即可操作；或产品规格中心 \`http://127.0.0.1:7788/\` → Feature Catalog → \`${f.feature_id}\` → 左侧 Prototype 面板。支持 PC / H5 视口、表单校验、弹窗 / 抽屉、列表 / 详情、加载 / 空 / 错误 / 成功 / 禁用 / 权限不足状态、页面跳转与状态恢复。`, '');
  L.push(`对应 PRD：[\`${f.prd.path}\`](../../prd/${domainDir(f)}/${f.feature_id}.md)`, '');

  L.push('## 页面总览', '');
  L.push(table(['Prototype Page ID', '页面名称', '布局', '入口', '状态', '规划标记', '关联需求'], f.prototype.pages.map((p) => [
    `[${p.prototype_page_id}](#${p.prototype_page_id})`, p.name, p.layout, `\`${p.entry}\``, p.status, p.planned ? 'PLANNED' : 'ACTIVE', inline(p.requirement_ids),
  ])), '');

  f.prototype.pages.forEach((p, idx) => {
    L.push(`## ${anchor(p.prototype_page_id)}页面 ${idx + 1}：${p.prototype_page_id} · ${p.name}`, '');
    L.push(table(['属性', '值'], [
      ['布局', p.layout], ['入口', `\`${p.entry}\``], ['状态', p.planned ? 'PLANNED（规划原型）' : p.status],
      ['Demo 声明', p.demo_notice || 'DEMO / MOCK'], ['规划提示', p.planned_notice || '—'],
      ['关联需求', inline(p.requirement_ids)],
    ]), '');
    if (p.planned) L.push(`> ⚠️ 该页面为 **规划原型**，${p.planned_notice || '未发现对应的已上线前端实现'}。不得据此判断功能已交付。`, '');

    L.push('### 组件清单', '');
    L.push(p.components.length ? table(['Component ID', '类型', '名称 / 文案', '字段', '必填', '选项', '动作 / 触发', '校验 / 属性', '关联需求', '状态'], p.components.map((c) => [
      c.component_id, c.type, c.label, c.name || '—', c.required ? '是' : '否', inline(c.options),
      [c.action, c.trigger].filter(Boolean).map((x) => `\`${x}\``).join(' / ') || '—',
      c.props && Object.keys(c.props).length ? `\`${JSON.stringify(c.props)}\`` : '—',
      c.requirement_id || '—', c.status,
    ])) : '—', '');

    L.push('### 交互与页面跳转', '');
    L.push(p.interactions.length ? table(['Interaction ID', '名称', '触发', '动作', '步骤', '目标页面', '关联需求', '状态'], p.interactions.map((i) => [
      `${anchor(i.interaction_id)}${i.interaction_id}`, i.name, `\`${i.trigger}\``, `\`${i.action}\``, list(i.steps), i.target_page_id || '—', i.requirement_id || '—', i.status,
    ])) : '—', '');

    L.push('### 页面状态', '');
    L.push(p.states.length ? table(['State ID', 'Kind', '说明'], (Array.isArray(p.states) ? p.states : []).map((s) => typeof s === 'string' ? ['—', s, `${s} 状态`] : [s.state_id, s.kind || s.name, s.description])) : '—', '');

    const inputs = p.components.filter((c) => ['input', 'select', 'radio_group', 'textarea', 'checkbox'].includes(c.type) && c.required);
    L.push('### 表单校验（与 PRD 业务规则同源）', '');
    L.push(inputs.length ? table(['字段', '组件', '校验规则来源', '错误提示'], inputs.map((c) => [
      c.name || c.component_id, c.component_id,
      c.props?.rule_field ? `\`${c.props.rule_field}\`${c.props.min !== undefined ? ` min=${c.props.min}` : ''}` : 'PRD 业务规则',
      c.props?.error_message || '由 PRD 业务规则同步生成',
    ])) : '本页无必填输入组件。', '');
    L.push('');
  });

  L.push('## 双向定位与同步', '');
  L.push(table(['方向', '定位键', '目标'], [
    ['PRD → Prototype', 'Requirement ID', '本文档组件清单 / 交互清单中的「关联需求」列'],
    ['Prototype → PRD', 'Prototype Page ID', `\`${f.prd.path}\` §8 页面与交互`],
    ['Prototype → PRD', 'Interaction ID', 'PRD §6 业务流程 / §8 交互清单'],
    ['Prototype → PRD', 'Component ID', 'PRD §7 功能需求「关联组件」列'],
  ]), '');
  L.push('> 在产品规格中心中点击任一 ID 会在另一侧高亮定位；功能切换时两侧依据统一映射注册表重新加载。', '');
  L.push('## 原型 Mock 数据约束', '');
  L.push(list([
    '所有金额、订单号、支付结果、余额、用户信息均为合成值，标记 `MOCK`。',
    '不调用真实支付网关、退款接口、余额写入接口或账户管理接口。',
    '不修改数据库、不写生产数据、不产生真实资金流水。',
    '业务规则（例如最低充值金额）来自 PRD 业务规则字段，原型校验由双向同步引擎按 `rule_field` 自动更新。',
  ]), '');
  return L.join('\n');
}

/** 单个 Feature 的三份投影（供同步引擎在每次变更后调用） */
export function renderFeatureDocs(model, featureId) {
  const f = model.features.find((x) => x.feature_id === featureId);
  if (!f) return { written: [], skipped: `Feature 不存在: ${featureId}` };
  const a = f.prd.path;
  const b = `docs/product/prototypes/${domainDir(f)}/${f.feature_id}.md`;
  const c = prototypeHTMLPath(f);
  write(a, renderPRD(f, model));
  write(b, renderPrototype(f, model));
  write(c, renderPrototypeHTML(f, model));
  return { written: [a, b, c], feature_id: featureId, model_version: model.model_version };
}

/* ───────────────────────── 目录 / 标准 / 注册表 / 报告 ───────────────────────── */
function renderCatalog(model) {
  const L = [];
  L.push('# UTER 产品功能目录（PRODUCT FEATURE CATALOG）', '');
  L.push(`> 由唯一权威模型 \`docs/product/registry/product-model.json\` 渲染 · 模型版本 **v${model.model_version}** · 渲染于 ${NOW()}`);
  L.push(`> 盘点基线：\`${model.scan.branch}\` @ \`${model.scan.repository}\`，扫描日期 ${model.scan.scanned_at}；技术栈 ${model.scan.frontend} / ${model.scan.backend}。`, '');
  L.push('## 状态口径', '');
  L.push(table(['状态', '定义', '本次数量'], Object.entries(STATUS_LABEL).map(([k, v], i) => {
    const counts = {};
    model.features.forEach((f) => { counts[f.status] = (counts[f.status] || 0) + 1; });
    return [k, v, counts[k] || 0];
  })), '');
  L.push(`合计 **${model.features.length}** 项功能 · ${model.features.reduce((n, f) => n + f.requirements.length, 0)} 条需求 · ${model.features.reduce((n, f) => n + f.prototype.pages.length, 0)} 个原型页面 · ${model.mappings.length} 条映射。`, '');
  L.push('## 功能清单', '');
  const rows = model.features.map((f) => [
    `[${f.feature_id}](prd/${domainDir(f)}/${f.feature_id}.md)`, f.name, f.module, inline(f.roles), `\`${f.status}\``,
    inline(f.evidence.pages.slice(0, 2)) || '—', inline(f.evidence.apis.slice(0, 2)) || '—',
    inline(f.data_models.map((d) => d.name || d.model).slice(0, 2)) || '—',
    `\`${f.prd.path}\``, `\`docs/product/prototypes/${domainDir(f)}/${f.feature_id}.md\``,
    `\`${prototypeHTMLPath(f)}\``,
    inline(f.tests.map((t) => t.path).slice(0, 1)) || '—', f.priority,
    f.acceptance.length ? `DEFINED(${f.acceptance.length})` : 'PENDING',
    inline(f.evidence.code.slice(0, 2)) || '—',
  ]);
  L.push(table(['Feature ID', '功能名称', '业务模块', '用户角色', '实现状态', '页面路径', 'API 路径', '数据模型', 'PRD 路径', '原型路径', '交互式原型（HTML）', '测试路径', '优先级', '验收状态', '证据来源'], rows), '');
  L.push('> 表格中的页面 / API / 模型 / 代码路径均为真实仓库证据的摘录；完整证据见各 PRD §9 与 §11。', '');
  L.push('## 按状态分组', '');
  const groups = {};
  model.features.forEach((f) => { (groups[f.status] ||= []).push(f); });
  for (const [status, fs_] of Object.entries(groups)) {
    L.push(`### ${status}（${fs_.length}）`, '');
    L.push(list(fs_.map((f) => `\`${f.feature_id}\` ${f.name}${f.status_note ? ` — ${f.status_note}` : ''}${f.open_decisions?.length ? ` ｜ 待产品决策：${f.open_decisions.join('；')}` : ''}`)));
  }
  L.push('');
  L.push('## 证据来源（全量盘点维度）', '');
  L.push(list(model.scan.evidence_sources));
  L.push('', `治理基线：${model.scan.governance}`, '', `设计基线：\`${model.scan.design_system}\`（UTER Design System 3.0；不使用已废弃的 2.1）`, '');
  L.push('## 诚实性声明', '');
  L.push(list([
    '`UNKNOWN` 仅建立待确认条目，不编造业务决策；本次盘点未发现需要标记为 UNKNOWN 的功能。',
    '`NOT_IMPLEMENTED` 功能有 PRD 与规划原型，但原型页面标记 `PLANNED`，不冒充已上线功能。',
    '`BACKEND_ONLY` 功能有后端实现证据但缺少用户侧页面证据，原型按后端能力描述并标注缺口。',
    '`PARTIALLY_IMPLEMENTED` 功能在 PRD 中列明缺失部分与待确认事项。',
    '原型中的所有交易/退款/余额数据均为 `DEMO / MOCK` 合成值，不写真实数据。',
  ]), '');
  return L.join('\n');
}

function standards(model) {
  const s = model.standards;
  const common = (title, no) => `# ${title}\n\n> UTER 产品原型与 PRD 一体化系统 · 规范编号 ${no} · 生效版本 v${model.model_version} · ${NOW()}\n> 本规范由统一需求模型驱动；唯一事实源 \`docs/product/registry/product-model.json\`。设计基线：UTER Design System 3.0。\n`;
  const files = {};

  files['docs/product/PRODUCT-FEATURE-ID-STANDARD.md'] = common('统一 Feature ID 与关联 ID 规范', 'STD-ID-01') + `
## 1. 格式
${table(['对象', '格式', '示例'], Object.entries(s).map(([k, v]) => [k, `\`${v}\``, k.startsWith('feature') ? 'UTER-PAY-001' : k.startsWith('change') ? 'CHG-20261109-120000-01' : `${v.split('-')[0]}-PAY-001-01`]))}

## 2. 规则
1. Feature ID 采用 \`UTER-{DOMAIN}-{NUMBER}\`，DOMAIN 为大写字母，NUMBER 为 3 位数字。
2. 所有关联 ID 以所属 Feature 的 \`{DOMAIN}-{NUMBER}\` 为命名空间，不得跨 Feature 复用。
3. ID 全局唯一；删除功能后 ID 进入 \`feature_id_tombstones\`，不得复用。
4. 每项功能必须同时具备 PRD、Prototype、Mapping、Acceptance、Test Case，并由 Change ID 记录变更。
5. 自动检查：\`V-FID-*\`、\`V-ID-GLOBAL\`、\`V-CROSS-*\`、\`V-MAP-NO-DUP\`。

## 3. 状态分类
${table(['状态', '定义'], Object.entries(STATUS_LABEL).map(([k, v]) => [`\`${k}\``, v]))}
`;

  files['docs/product/PRODUCT-REQUIREMENTS-STANDARD.md'] = common('PRD 编写与必备章节规范', 'STD-PRD-01') + `
## 1. 必备 12 章节（缺一不可）
${table(['#', '章节', '最低要求'], [
    [1, '基础信息', 'Feature ID / 名称 / 模块 / 角色 / 状态 / 优先级 / PRD 版本 / SSOT'],
    [2, '产品背景', '目标、问题、场景、边界'],
    [3, '用户角色', '角色清单与权限'],
    [4, '用户故事', '角色-行为-价值'],
    [5, '功能范围', '范围内 / 范围外 / 上下游依赖'],
    [6, '业务流程', '主流程 / 异常 / 边界 / 状态 / 恢复 / 权限'],
    [7, '功能需求', '每条 REQ 含输入、输出、业务规则、权限、数据变更、错误提示、关联 ID'],
    [8, '页面交互', '页面 / 组件 / 交互 / 跳转 / 状态'],
    [9, 'API 和数据模型', 'API ID、路径、数据模型 ID、代码证据'],
    [10, '验收标准', 'Given / When / Then，覆盖正常 / 异常 / 权限 / 边界'],
    [11, '测试追溯', 'Test Case ID、测试路径、验收关联、代码证据'],
    [12, '版本变更', 'Change ID、版本、变更说明、快照路径'],
  ])}

## 2. 强制规则
- PRD 是统一模型的可编辑投影，**不得**作为独立事实源手工维护。
- \`NOT_IMPLEMENTED\` 功能必须写规划 PRD，并显式标注不代表已上线。
- \`UNKNOWN\` 只允许建立待确认条目，禁止编造业务决策、金额、权限或流程。
- 业务规则必须结构化（\`rule_id / text / field / value / status\`），原型的表单校验由 \`rule_field\` 自动同步。
- 每条有效需求必须有 \`prototype_page_ids\`、\`acceptance_ids\`、\`test_case_ids\`（检查项 \`V-MAP-*\`）。
- 资金 / 退款 / 余额 / 权限 / 安全规则的变更必须留痕，敏感域删除采用 DEPRECATED + 审计记录，不物理抹除。
`;

  files['docs/product/PRODUCT-PROTOTYPE-STANDARD.md'] = common('交互式 Prototype 建设规范', 'STD-PROTO-01') + `
## 1. 覆盖要求
- 每个 Feature 至少一个 Prototype Page；按功能类型覆盖表单、按钮、弹窗、抽屉、列表、详情、搜索、筛选、分页。
- 页面必须具备并可在规格中心切换：\`idle / loading / empty / error / success / disabled / permission_denied\`。
- 必填输入必须带 \`props.error_message\` 或 \`props.min\` 或 \`input_type\`（检查项 \`V-PROTO-FORM\`）。
- 每个 button 组件必须有 \`action\`；每个 interaction 必须归属有效需求，跳转目标必须是本 Feature 内页面（\`V-PROTO-BTN / INT / NAV\`）。
- 支持页面跳转、返回、表单状态恢复；PC 与 H5 两种视口。

## 1.1 交互式 HTML 原型（主载体）
- 每个 Feature 必须生成 \`prototypes/{domain}/<Feature ID>.html\`（由统一模型渲染，检查项 \`V-FILE-PROTO-HTML\`），与同目录 \`.md\` 原型说明同名对应。
- HTML 为自包含单文件（内联 CSS / JS，零外部依赖），浏览器直接打开即可操作；左侧原型 / 右侧 PRD 同源双栏，共用同一 \`Feature ID\`。
- 组件必须携带 \`data-component-id\` 与 \`data-requirement-id\`，右侧 PRD 需求块 \`id="req-<Requirement ID>"\`；双向定位必须可点（\`V-HTML-LINK-*\`）。
- 表单校验规则（min / error_message）必须来自 PRD 业务规则同源字段；HTML 在每次有效变更后随两侧投影一起重渲染。

## 2. 数据安全（强制）
- 所有模拟交易、支付、退款、余额、订单、账户数据必须标注 \`DEMO\` 或 \`MOCK\`。
- 禁止发起真实支付 / 退款 / 余额变更 / 账户操作，禁止写生产数据。
- \`NOT_IMPLEMENTED\` 页面必须标记 \`planned: true\` 并显示规划提示，不得冒充上线功能。

## 3. 视觉基线
UTER Design System 3.0：品牌主色 \`#5B5EE6\`、PC 正文 14px、基础圆角 10px、4px 间距网格、Light / Dark 主题；不得使用已废弃的 2.1 基线。
`;

  files['docs/product/PRODUCT-TRACEABILITY-STANDARD.md'] = common('需求追溯与映射注册表规范', 'STD-TRACE-01') + `
## 1. 追溯链
\`Feature ID → Requirement ID → Prototype Page ID → Interaction ID / Component ID → API ID / Data Model ID → Acceptance ID → Test Case ID → Change ID\`

## 2. 注册表
${table(['文件', '内容'], [
    ['registry/product-model.json', '唯一权威结构化模型（SSOT）'],
    ['registry/feature-registry.yaml', '功能主表'],
    ['registry/requirement-registry.yaml', '需求主表'],
    ['registry/prototype-registry.yaml', '原型页面 / 组件 / 交互主表'],
    ['registry/feature-mapping.yaml', '双向映射注册表'],
    ['registry/change-registry.yaml', '变更事件与版本'],
    ['mappings/FEATURE-TRACEABILITY-MATRIX.md', '可读追溯矩阵'],
  ])}

## 3. 自动校验
- ID 唯一、路径存在、映射有效、无重复、无失效路径、无跨 Feature 错误关联。
- 检查项 \`V-MAP-COMPLETE / V-MAP-NO-ORPHAN / V-MAP-NO-DUP / V-CROSS-*\` 与 \`validate({checkFiles:true})\` 的文件存在性检查。
- 每次有效变更后 \`buildMappings()\` 重建注册表，映射版本号随模型版本递增。
`;

  files['docs/product/PRODUCT-SYNC-STANDARD.md'] = common('PRD ↔ Prototype 双向同步规范', 'STD-SYNC-01') + `
## 1. 单一事实源
PRD 视图、Prototype 视图、结构化模型视图都是 \`registry/product-model.json\` 的投影。禁止用字符串替换、Markdown 覆盖或文件复制充当「同步」。

## 2. 支持的操作
${table(['方向', 'op', '自动同步结果'], [
    ['PRD → Prototype', 'add_requirement', '自动创建组件、交互、验收标准、测试用例、映射'],
    ['PRD → Prototype', 'update_requirement', '同步组件名称、校验提示、验收条件、测试状态'],
    ['PRD → Prototype', 'update_business_rule', '按 rule_field 同步原型 min / 错误提示 / 边界验收 / 测试状态'],
    ['PRD → Prototype', 'update_acceptance', '同步原型 success / error 状态描述'],
    ['PRD → Prototype', 'delete_requirement', '影响分析 + 组件/交互失效；敏感域 DEPRECATED 留痕'],
    ['PRD → Prototype', 'update_prd_section', '更新背景章节'],
    ['Prototype → PRD', 'add_component', '自动创建需求（业务规则标 NEEDS_PRODUCT_DECISION）、验收、测试'],
    ['Prototype → PRD', 'add_page', '自动创建需求、页面交互说明、业务流程、验收、测试'],
    ['Prototype → PRD', 'update_component', '同步字段说明、校验、验收条件、测试状态'],
    ['Prototype → PRD', 'update_interaction', '同步业务流程、恢复路径、验收条件'],
    ['Prototype → PRD', 'update_page_state', '同步异常流程说明'],
    ['Prototype → PRD', 'delete_component / delete_interaction', '影响分析 + PRD 说明与验收同步'],
  ])}

## 3. 可靠性约束
- **事务化**：\`applyChange()\` 在 clone 副本上执行，任一步失败整体回滚，不写半成品；持久化使用临时文件 + rename 原子写。
- **不循环**：自动同步事件在同一次变更中以 \`SYSTEM_GENERATED\` 记录，不递归调用 \`applyChange\`，不生成新的用户编辑事件。
- **版本**：每次有效修改生成 Change ID 与 \`vN.json\` 快照；恢复历史生成新变更事件，不覆盖历史。
- **冲突**：基于 \`base_version\` + \`changed_fields\` 路径比较；不同字段自动合并，同字段冲突标记 \`CONFLICT\` 并进入待处理队列。
- **敏感域**：\`PAY / REFUND / BALANCE / BILLING / ADMIN / APIKEY\` 的同字段冲突标记 \`requires_product_decision\`，不允许系统自动任选一方。
- **语义不确定**：无法从原型推断的业务语义标记 \`NEEDS_REVIEW\` 或 \`NEEDS_PRODUCT_DECISION\`，不编造业务规则。
- **投影同步**：每次变更后重渲染受影响 Feature 的 PRD / Prototype Markdown，使文件层与模型层一致。
`;

  files['docs/product/PRODUCT-QUALITY-GATE-STANDARD.md'] = common('新增功能强制门禁与质量规范', 'STD-GATE-01') + `
## 1. 强制门禁顺序
\`Feature ID → PRD → Prototype → Mapping → Validation → Implementation → Testing → Acceptance\`

${table(['检查项', '要求'], [
    ['G1_FEATURE_ID', '符合 UTER-{DOMAIN}-{NUMBER}'],
    ['G2_UNIQUE', '全局唯一且不在 tombstone 中'],
    ['G3_PRD', '提供 PRD 背景 / 目标'],
    ['G4_PROTOTYPE', '提供至少一个原型页面'],
    ['G5_ACCEPTANCE', '定义 Given/When/Then 验收标准'],
    ['G6_MAPPING', '提供需求条目以建立映射'],
    ['G7_TEST', '关联可执行测试路径（.mjs / .ts）'],
  ])}

## 2. 适用范围
- 涉及**用户可见行为、业务规则、权限、数据处理或交互变化**的变更，必须同步更新 PRD 与 Prototype 并通过 \`validate()\`。
- 纯技术重构（不改变上述内容）不机械要求新增 PRD，但仍需在变更记录中说明 \`NO_PRODUCT_CHANGE\` 理由。
- 未通过 \`gate()\` 的新增功能不得进入 Implementation。

## 3. 质量门禁命令（真实执行后记录）
${table(['层面', '命令'], [
    ['Go 格式 / 静态检查', '\`gofmt -l .\` / \`go vet ./...\`'],
    ['Go 测试', '\`make test\` 或 \`go test ./...\`'],
    ['前端类型 / Lint / 单测', '\`bun run typecheck\` / \`bun run lint\` / \`bun run test\`'],
    ['设计系统 / 版权 / 构建', '\`bun run lint:design:strict\` / \`bun run copyright:check\` / \`bun run build:check\`'],
    ['产品系统专项', '\`node --test tools/product-workspace/tests/*.test.mjs\`'],
    ['一致性检查', '\`node tools/product-workspace/check.mjs\`'],
  ])}

## 4. 结果口径
以**真实命令退出码与输出**判定通过与否；不得凭测试文件存在、命令被写入文档或预期结果判定通过。失败项必须如实记录并进入最终报告的剩余问题。
`;

  files['docs/product/README.md'] = `# UTER 产品原型与 PRD 一体化系统

> 本地 \`main\` 分支建设成果 · 模型版本 v${model.model_version} · ${NOW()}

## 入口

| 入口 | 地址 / 路径 |
| --- | --- |
| 产品规格中心（可操作 SPA） | \`http://127.0.0.1:7788/\`（\`node tools/product-workspace/server.mjs\`） |
| 左侧 Prototype / 右侧 PRD 双栏 | 规格中心 → Feature Catalog → 任一 Feature → 左右双栏详情 |
| 交互式 HTML 原型（56 份） | \`docs/product/prototypes/{domain}/<Feature ID>.html\` —— 浏览器直接打开，左原型 / 右 PRD 同源双栏 |
| 唯一权威数据模型 | \`docs/product/registry/product-model.json\` |
| 功能目录 | \`docs/product/PRODUCT-FEATURE-CATALOG.md\` |
| 最终报告 | \`docs/product/reports/UTER-PRODUCT-PRD-PROTOTYPE-SYSTEM-FINAL-REPORT.md\` |

## 目录

${table(['目录', '内容'], [
    ['prd/{domain}/', '56 份 PRD（12 必备章节，模型投影）'],
    ['prototypes/{domain}/', '56 份交互式 HTML 原型（左原型 / 右 PRD 同源双栏）+ 56 份原型说明 Markdown（均为模型投影）'],
    ['registry/', '统一模型 + 5 类注册表'],
    ['mappings/', '可读追溯矩阵'],
    ['standards/ 与根目录 STD 文档', 'ID / PRD / 原型 / 追溯 / 同步 / 门禁规范'],
    ['reports/', '覆盖率、一致性、双向同步、最终报告'],
    ['history/', 'vN.json 版本快照（恢复用）'],
    ['tools/product-workspace/', '构建、引擎、服务、SPA、测试'],
  ])}

## 核心原则

1. **Single Source of Truth**：PRD 与 Prototype 是同一结构化模型的两个可编辑投影，不存在两份独立事实。
2. **不靠字符串替换同步**：所有编辑经 \`engine.applyChange()\` 事务化写入统一模型，再双向派生另一侧并重渲染投影。
3. **真实证据**：功能状态来自真实前后端代码盘点，\`UNKNOWN\` 不编造，\`NOT_IMPLEMENTED\` 规划原型不冒充上线。
4. **MOCK 安全**：所有模拟交易标记 \`DEMO / MOCK\`，不触碰真实资金与生产数据。
5. **可追溯**：Feature / Requirement / Page / Interaction / Component / API / Data Model / Acceptance / Test Case / Change 全链路 ID 关联。
`;
  return files;
}

function registries(model) {
  const files = {};
  const head = (name) => `# ${name}\n# 由 docs/product/registry/product-model.json 自动导出，禁止手工编辑\n# model_version: ${model.model_version} / generated_at: ${NOW()}\n`;
  files['docs/product/registry/feature-registry.yaml'] = head('UTER Feature Registry') + yaml({
    model_version: model.model_version,
    total: model.features.length,
    status_counts: model.features.reduce((a, f) => { a[f.status] = (a[f.status] || 0) + 1; return a; }, {}),
    features: model.features.map((f) => ({
      feature_id: f.feature_id, name: f.name, domain: f.domain, module: f.module, status: f.status,
      priority: f.priority, roles: f.roles,       prd_path: f.prd.path,
      prototype_path: `docs/product/prototypes/${domainDir(f)}/${f.feature_id}.md`,
      prototype_html_path: prototypeHTMLPath(f),
      prd_version: f.prd.version, sync_status: f.sync_status,
      requirement_ids: f.requirements.map((q) => q.requirement_id),
      prototype_page_ids: f.prototype.pages.map((p) => p.prototype_page_id),
      acceptance_ids: f.acceptance.map((a) => a.acceptance_id),
      test_case_ids: f.tests.map((t) => t.test_case_id),
      status_note: f.status_note, open_decisions: f.open_decisions,
    })),
  }) + '\n';
  files['docs/product/registry/requirement-registry.yaml'] = head('UTER Requirement Registry') + yaml({
    model_version: model.model_version,
    total: model.features.reduce((n, f) => n + f.requirements.length, 0),
    requirements: model.features.map((f) => ({
      feature_id: f.feature_id,
      items: f.requirements.map((q) => ({
        requirement_id: q.requirement_id, title: q.title, status: q.status, priority: q.priority,
        business_rule_ids: q.business_rules.map((b) => b.rule_id),
        prototype_page_ids: q.prototype_page_ids, component_ids: q.component_ids,
        interaction_ids: q.interaction_ids, acceptance_ids: q.acceptance_ids,
        test_case_ids: q.test_case_ids, change_ids: q.change_ids,
      })),
    })),
  }) + '\n';
  files['docs/product/registry/prototype-registry.yaml'] = head('UTER Prototype Registry') + yaml({
    model_version: model.model_version,
    total_pages: model.features.reduce((n, f) => n + f.prototype.pages.length, 0),
    prototypes: model.features.map((f) => ({
      prototype_id: f.prototype.prototype_id, feature_id: f.feature_id,
      primary_page_id: f.prototype.primary_page_id, viewport_default: f.prototype.viewport_default || 'PC',
      doc_path: `docs/product/prototypes/${domainDir(f)}/${f.feature_id}.md`,
      html_path: prototypeHTMLPath(f),
      pages: f.prototype.pages.map((p) => ({
        prototype_page_id: p.prototype_page_id, name: p.name, entry: p.entry, layout: p.layout,
        status: p.status, planned: p.planned, demo_notice: p.demo_notice,
        component_ids: p.components.map((c) => c.component_id),
        interaction_ids: p.interactions.map((i) => i.interaction_id),
        state_kinds: (p.states || []).map((s) => (typeof s === 'string' ? s : s.kind)),
        requirement_ids: p.requirement_ids,
      })),
    })),
  }) + '\n';
  files['docs/product/registry/feature-mapping.yaml'] = head('UTER Feature Mapping Registry (bidirectional)') + yaml({
    model_version: model.model_version, total: model.mappings.length,
    note: 'requirement_id -> prototype_page_id / prd_path / acceptance_ids / test_case_ids；由 engine.buildMappings() 自动维护',
    mappings: clone(model.mappings),
  }) + '\n';
  files['docs/product/registry/change-registry.yaml'] = head('UTER Change Registry') + yaml({
    model_version: model.model_version, total: model.changes.length,
    snapshots: model.snapshots.map((s) => ({ version: s.version, change_id: s.change_id, reason: s.reason, created_at: s.created_at, restored_from: s.restored_from || null })),
    conflicts: model.conflicts.map((c) => ({ conflict_id: c.conflict_id, feature_id: c.feature_id, status: c.status, requires_product_decision: c.requires_product_decision, choice: c.resolution?.choice || null })),
    changes: model.changes.map((c) => ({
      change_id: c.change_id, feature_id: c.feature_id, source_view: c.source_view,
      source_type: c.source_type, op: c.op, base_version: c.base_version,
      target_version: c.target_version, sync_status: c.sync_status,
      changed_fields: c.changed_fields, reason: c.reason, actor: c.actor, created_at: c.created_at,
      auto_sync: !!c.auto_sync, sync_event_count: (c.sync_events || []).length,
    })),
  }) + '\n';
  return files;
}

function traceabilityMatrix(model) {
  const L = ['# UTER 需求追溯矩阵（Feature → PRD → Prototype → Acceptance → Test → Change）', ''];
  L.push(`> 由 \`registry/product-model.json\` v${model.model_version} 自动导出 · ${NOW()} · 共 ${model.mappings.length} 条映射`, '');
  L.push(table(['Feature ID', 'Requirement ID', 'PRD 路径', 'Prototype Page ID', 'Interaction / Component IDs', 'API / Data Model IDs', 'Acceptance IDs', 'Test Case IDs', '映射版本'], model.mappings.map((m) => [
    m.feature_id, m.requirement_id, `\`${m.prd_path}\``, m.prototype_page_id,
    inline([...(m.interaction_ids || []), ...(m.component_ids || [])].slice(0, 6)) || '—',
    inline([...(m.api_ids || []), ...(m.data_model_ids || [])].slice(0, 4)) || '—',
    inline(m.acceptance_ids), inline(m.test_case_ids), m.version,
  ])), '');
  L.push('', '## 按 Feature 聚合', '');
  const byF = {};
  model.mappings.forEach((m) => { (byF[m.feature_id] ||= []).push(m); });
  L.push(table(['Feature ID', '需求数', '页面数', '验收数', '测试数', 'PRD', '原型'], Object.entries(byF).map(([fid, ms]) => {
    const f = model.features.find((x) => x.feature_id === fid);
    return [fid, ms.length, new Set(ms.map((m) => m.prototype_page_id)).size, ms.reduce((n, m) => n + (m.acceptance_ids?.length || 0), 0), ms.reduce((n, m) => n + (m.test_case_ids?.length || 0), 0), `\`${f.prd.path}\``, `\`${ms[0].prototype_path}\``];
  })), '');
  return L.join('\n');
}

export function renderReportFiles(model, validation, cov) {
  const files = {};
  files['docs/product/reports/PRODUCT-COVERAGE-REPORT.md'] = `# UTER 产品文档与原型覆盖率报告

> 数据源 \`registry/product-model.json\` v${model.model_version} · ${NOW()} · 由 \`engine.coverage()\` 真实计算

## 总览
${table(['指标', '数值'], [
    ['盘点功能总数', cov.feature_total], ['有实现证据的功能', cov.implemented_total],
    ['PRD 文档数', cov.prd_total], ['Prototype 文档数', cov.prototype_total],
    ['原型页面总数', cov.page_total], ['可交互页面数', cov.interactive_page_total],
    ['有效需求数', cov.requirement_total], ['双向映射数', cov.mapping_total],
    ['未解决冲突', cov.open_conflicts], ['NEEDS_REVIEW 功能数', cov.needs_review],
    ['待产品决策项', cov.needs_product_decision],
  ])}

## 状态分布
${table(['状态', '数量'], Object.entries(cov.status_counts).map(([k, v]) => [k, v]))}

## 覆盖率指标
${table(['指标', '百分比 / 数值'], Object.entries(cov.metrics).map(([k, v]) => [k, typeof v === 'number' && k.includes('sync_loops') === false && k.includes('silent_overwrites') === false && !['sync_loops', 'silent_overwrites'].includes(k) ? `${v}%` : v]))}

> \`sync_loops\` 与 \`silent_overwrites\` 是计数不是百分比，均为 0 表示无同步循环、无静默覆盖。

## 说明
- \`prd_coverage_implemented\` 与 \`prototype_coverage_implemented\` 以有实现证据的 ${cov.implemented_total} 项功能为分母。
- \`inventory_coverage = 100%\` 指本次盘点已覆盖扫描到的全部前端路由 / feature 模块 / 后端路由与控制器维度，不代表 Uter 未来新增功能自动纳入。
- 覆盖率由模型实时计算，不手工填写；新增功能后需重新执行 \`node tools/product-workspace/render-docs.mjs --all\`。
`;

  const failed = validation.checks.filter((c) => c.result === 'FAIL');
  files['docs/product/reports/PRD-PROTOTYPE-CONSISTENCY-REPORT.md'] = `# UTER PRD / Prototype 一致性检查报告

> 检查引擎 \`engine.validate(model, null, {checkFiles:true})\` · 模型 v${model.model_version} · ${NOW()}

## 结果
${table(['项', '值'], [
    ['结论', validation.passed ? 'PASS' : 'FAIL'], ['检查项总数', validation.total],
    ['失败项', validation.failed], ['错误', validation.errors.length], ['警告', validation.warnings.length],
  ])}

## 失败明细
${failed.length ? table(['Check ID', '检查项'], failed.map((c) => [c.id, c.name])) : '无失败项。'}

## 警告明细（文件存在性）
${validation.warnings.length ? table(['Check ID', '检查项', '路径'], validation.warnings.map((w) => [w.id, w.name, w.detail])) : '所有 PRD / 原型投影文件均存在。'}

## 检查维度
${table(['前缀', '检查内容'], [
    ['V-FID / V-ID', 'Feature ID 格式与全局唯一、关联 ID 无重复'],
    ['V-PRD', 'PRD 12 章节、验收标准、业务规则'],
    ['V-PROTO', '页面、状态、组件、按钮行为、交互归属、跳转目标、表单校验'],
    ['V-MAP', '需求→原型 / 验收 / 测试映射、注册表完整性、孤立与重复映射'],
    ['V-CROSS', '无跨 Feature 错误关联'],
    ['V-STATUS', '实现状态与原型 planned 标记一致'],
    ['V-FILE', 'PRD / 原型投影文件真实存在'],
    ['V-CHANGE / V-NO-LOOP / V-NO-OVERWRITE / V-CONFLICT', '变更可追溯、同步循环 0、静默覆盖 0、冲突状态合规'],
  ])}
`;

  // ── 双向同步报告（数据源：变更事件 + 同步指标 + 冲突记录，不手工填报） ──
  const bySource = {};
  for (const c of model.changes) bySource[c.source_view] = (bySource[c.source_view] || 0) + 1;
  const byType = {};
  for (const c of model.changes) byType[c.source_type] = (byType[c.source_type] || 0) + 1;
  const autoEvents = model.changes.flatMap((c) => c.sync_events || []).filter((e) => e.origin === 'SYSTEM_GENERATED');
  const userEdits = model.changes.filter((c) => c.source_type === 'USER_EDIT');
  const restores = model.changes.filter((c) => c.source_type === 'RESTORE');
  const syncStates = {};
  for (const f of model.features) syncStates[f.sync_status] = (syncStates[f.sync_status] || 0) + 1;
  files['docs/product/reports/BIDIRECTIONAL-SYNC-REPORT.md'] = `# UTER PRD ⇄ Prototype 双向同步报告

> 唯一数据源 \`registry/product-model.json\` v${model.model_version} · ${NOW()} · 由变更事件与同步指标实时汇总

## 架构

\`\`\`
用户编辑 PRD  ─┐
用户编辑 Prototype ─┼→ applyChange() 单事务 → 统一需求模型 → 派生对侧视图
结构化模型编辑 ─┘        ↓ 版本+1 / 映射重建 / 一致性检查 / 快照 / 投影重渲染
\`\`\`

- 两侧不各自保存事实，只保存 \`feature_id + model_version\` 派生的可编辑视图。
- 自动同步在同一次事务内以 \`SYSTEM_GENERATED\` 事件记录，不递归调用 \`applyChange\`，结构上杜绝同步循环。
- 写操作要求 \`X-Uter-Role: admin\`；服务仅绑定 \`127.0.0.1\`，可叠加 Bearer Token。

## 变更事件

${table(['项', '数量'], [
    ['变更事件总数', model.changes.length],
    ['用户编辑 (USER_EDIT)', userEdits.length],
    ['系统自动同步事件 (SYSTEM_GENERATED)', autoEvents.length],
    ['冲突解决事件', model.changes.filter((c) => c.source_type === 'CONFLICT_RESOLUTION').length],
    ['历史恢复事件 (RESTORE)', restores.length],
    ['开放冲突', model.conflicts.filter((c) => c.status === 'OPEN').length],
    ['版本快照', model.snapshots.length],
  ])}

### 来源分布
${table(['Source View', '事件数'], Object.entries(bySource).map(([k, v]) => [k, v]))}

### 事件类型分布
${table(['Source Type', '事件数'], Object.entries(byType).map(([k, v]) => [k, v]))}

## 同步状态与可靠性

${table(['项', '值'], [
    ['PRD → Prototype 成功', model.sync_metrics.prd_to_prototype_success],
    ['Prototype → PRD 成功', model.sync_metrics.prototype_to_prd_success],
    ['同步成功率', cov.metrics.sync_success_rate + '%'],
    ['同步循环 sync_loops', model.sync_metrics.sync_loops],
    ['静默覆盖 silent_overwrites', model.sync_metrics.silent_overwrites],
    ['失败变更', model.sync_metrics.failed],
    ['投影渲染失败', model.sync_metrics.projection_errors || 0],
    ['需求 → 测试用例追溯率', cov.metrics.requirement_to_test + '%'],
    ['变更历史可追溯率', cov.metrics.change_traceability + '%'],
  ])}

### Feature 同步状态分布
${table(['状态', '功能数'], Object.entries(syncStates).map(([k, v]) => [k, v]))}

## 冲突与恢复策略

- 并发修改按 \`base_version\` 比对；不同字段自动合并，同字段冲突标记 \`CONFLICT\` 并保留双方值。
- 支付 / 退款 / 余额 / 权限 / 安全相关字段冲突不自动择一，必须走人工合并决策。
- 未解决冲突不会显示 \`SYNCED\`；解决动作生成新的 \`CONFLICT_RESOLUTION\` 事件。
- 历史恢复不删除历史：生成 \`RESTORE\` 事件、版本 +1、写入新快照，并重新渲染两侧投影。
- 无法从原型变化确定业务语义时进入 \`NEEDS_REVIEW\` / \`NEEDS_PRODUCT_DECISION\`，不凭空生成规则。

## 自动化验证

自动化用例位于 \`tools/product-workspace/tests/\`，通过 \`node --test tools/product-workspace/tests/*.test.mjs\` 执行：
覆盖 PRD→Prototype（新增/修改/删除需求、改字段、改业务规则、改验收标准）、
Prototype→PRD（新增/删除组件/页面、改字段/交互/状态/跳转）、
防循环、不丢失修改、并发冲突、失败回滚、版本恢复、双栏联动与 6 个验收场景。
真实执行结果记录在最终报告的「自动化测试」章节。
`;
  return files;
}

/** 仅重渲染报告族（覆盖率 / 一致性 / 双向同步），供 CLI 与 CI 使用。 */
export function writeReportFiles(model, validation, cov) {
  const out = [];
  Object.entries(renderReportFiles(model, validation, cov)).forEach(([rel, content]) => {
    write(rel, content);
    out.push(rel);
  });
  return out;
}

/* ───────────────────────── 全量渲染入口 ───────────────────────── */
export function renderAll(model, { validation, cov, skipReports = false } = {}) {
  const written = [];
  const put = (rel, content) => { write(rel, content); written.push(rel); };

  model.features.forEach((f) => {
    put(f.prd.path, renderPRD(f, model));
    put(`docs/product/prototypes/${domainDir(f)}/${f.feature_id}.md`, renderPrototype(f, model));
    put(prototypeHTMLPath(f), renderPrototypeHTML(f, model));
  });
  put('docs/product/PRODUCT-FEATURE-CATALOG.md', renderCatalog(model));
  Object.entries(standards(model)).forEach(([rel, content]) => put(rel, content));
  Object.entries(registries(model)).forEach(([rel, content]) => put(rel, content));
  put('docs/product/mappings/FEATURE-TRACEABILITY-MATRIX.md', traceabilityMatrix(model));
  if (!skipReports && validation && cov) Object.entries(renderReportFiles(model, validation, cov)).forEach(([rel, content]) => put(rel, content));
  return written;
}

/* ───────────────────────── CLI ───────────────────────── */
async function main() {
  const argv = process.argv.slice(2);
  const model = JSON.parse(fs.readFileSync(MODEL_FILE, 'utf8'));
  const single = argv.includes('--feature') ? argv[argv.indexOf('--feature') + 1] : null;
  if (single) {
    const out = renderFeatureDocs(model, single);
    console.log('[render-docs]', JSON.stringify(out));
    return;
  }
  const engine = await import('./engine.mjs');
  // 先渲染全部投影，再执行含文件存在性检查的一致性校验，避免把「尚未生成文件」误报为警告。
  const files = renderAll(model, { skipReports: true });
  const validation = engine.validate(model, null, { checkFiles: true });
  const cov = engine.coverage(model);
  files.push(...writeReportFiles(model, validation, cov));
  console.log(`[render-docs] 写入 ${files.length} 个文件；模型 v${model.model_version}；一致性 checks=${validation.total} failed=${validation.failed} warnings=${validation.warnings.length}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error('[render-docs] 失败:', e); process.exit(1); });
}
