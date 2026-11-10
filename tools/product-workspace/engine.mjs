/*
 * UTER 双向同步引擎 —— 统一需求模型的唯一写入通道
 *
 * 架构：PRD 视图 / Prototype 视图 / 结构化模型视图 都是同一个
 *       docs/product/registry/product-model.json 的可编辑投影。
 *       所有有效编辑通过 applyChange() 单事务落库：
 *         解析修改 → 更新统一模型 → 计算影响 → 同步另一侧 → 重建映射
 *         → 版本 +1 → 一致性检查 → 变更事件 → 快照 → 持久化。
 *       自动同步在同一次事务内以 SYSTEM_GENERATED 事件记录，不产生新的
 *       用户编辑事件，因此结构上不可能出现同步循环。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODEL_PATH, HISTORY_DIR } from './build-model.mjs';
import { renderFeatureDocs } from './render-docs.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');
// 测试隔离：可通过环境变量把模型与快照重定向到临时目录，避免自动化测试污染真实数据。
// 生产 / 正常使用始终指向 docs/product/registry/product-model.json。
export const MODEL_FILE = process.env.UTER_PRODUCT_MODEL_PATH ? path.resolve(process.env.UTER_PRODUCT_MODEL_PATH) : MODEL_PATH;
export const HISTORY = process.env.UTER_PRODUCT_HISTORY_DIR ? path.resolve(process.env.UTER_PRODUCT_HISTORY_DIR) : HISTORY_DIR;

const clone = (x) => JSON.parse(JSON.stringify(x));
const pad = (n) => String(n).padStart(2, '0');
const nowISO = () => new Date().toISOString();
const fbase = (featureId) => featureId.replace(/^UTER-/, '');
const SENSITIVE = new Set(['PAY', 'REFUND', 'BALANCE', 'BILLING', 'ADMIN', 'APIKEY']);
const DETERMINISTIC_VIEWS = ['PRD', 'Prototype', 'Structured Model'];
const AUTO = 'System Generated';

export function readModel() {
  return JSON.parse(fs.readFileSync(MODEL_FILE, 'utf8'));
}

export function readSnapshot(version) {
  return JSON.parse(fs.readFileSync(path.join(HISTORY, `v${version}.json`), 'utf8'));
}

/** 原子写入 + 版本快照；快照不含自身，避免无限膨胀 */
export function writeModel(model, { snapshot = true } = {}) {
  fs.mkdirSync(path.dirname(MODEL_FILE), { recursive: true });
  fs.mkdirSync(HISTORY, { recursive: true });
  const tmp = `${MODEL_FILE}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(model, null, 2) + '\n');
  fs.renameSync(tmp, MODEL_FILE);
  if (snapshot) {
    const snap = clone(model);
    snap.snapshots = [];
    const stmp = path.join(HISTORY, `v${model.model_version}.json.tmp-${process.pid}`);
    fs.writeFileSync(stmp, JSON.stringify(snap, null, 2) + '\n');
    fs.renameSync(stmp, path.join(HISTORY, `v${model.model_version}.json`));
  }
}

/**
 * 模型事务提交后重渲染 PRD / Prototype 投影。
 * 投影是纯派生文件，渲染失败不回滚已提交的模型事务，但会把错误记录进
 * Change Record 与 sync_metrics，供一致性检查 / 最终报告如实披露。
 */
function syncProjections(model, featureId) {
  if (process.env.UTER_PRODUCT_WORKSPACE_NO_PROJECTIONS === '1') {
    return { skipped: 'test-isolation', feature_id: featureId, written: [] };
  }
  try {
    return renderFeatureDocs(model, featureId);
  } catch (e) {
    console.error(`[product-workspace] 投影渲染失败 ${featureId}: ${e.message}`);
    model.sync_metrics.projection_errors = (model.sync_metrics.projection_errors || 0) + 1;
    return { error: e.message, feature_id: featureId, written: [] };
  }
}

function syncAllProjections(model) {
  const out = model.features.map((f) => syncProjections(model, f.feature_id));
  return { count: out.length, errors: out.filter((x) => x.error) };
}

/* ───────────────────────── ID 分配 ───────────────────────── */
function nextId(model, feature, prefix) {
  const needle = `${prefix}-${fbase(feature.feature_id)}-`;
  const nums = [];
  const collect = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { obj.forEach(collect); return; }
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && v.startsWith(needle)) {
        const tail = v.slice(needle.length);
        const n = Number.parseInt(tail, 10);
        if (Number.isFinite(n)) nums.push(n);
      } else if (typeof v === 'object') collect(v);
    }
  };
  collect(feature);
  collect({ mappings: model.mappings.filter((m) => m.feature_id === feature.feature_id) });
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${needle}${pad(n)}`;
}

export function newChangeId(model) {
  const d = new Date();
  const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  return `CHG-${stamp}-${pad(model.changes.length + 1)}`;
}

/* ───────────────────────── 映射注册表（自动维护） ───────────────────────── */
export function buildMappings(model) {
  const rows = [];
  for (const f of model.features) {
    for (const q of f.requirements) {
      if (q.status === 'DEPRECATED') continue;
      rows.push({
        feature_id: f.feature_id,
        requirement_id: q.requirement_id,
        prd_path: f.prd.path,
        prototype_page_id: q.prototype_page_ids?.[0] || f.prototype.primary_page_id,
        prototype_path: `docs/product/prototypes/${f.domain.toLowerCase()}/${f.feature_id}.md`,
        interaction_ids: [...(q.interaction_ids || [])],
        component_ids: [...(q.component_ids || [])],
        api_ids: f.apis.map((a) => a.api_id),
        data_model_ids: f.data_models.map((d) => d.data_model_id),
        acceptance_ids: [...(q.acceptance_ids || [])],
        test_case_ids: [...(q.test_case_ids || [])],
        version: model.model_version + 1,
        sync_status: f.sync_status,
        updated_at: nowISO(),
      });
    }
  }
  return rows;
}

/* ───────────────────────── 一致性检查引擎 ───────────────────────── */
export function validate(model, featureId = null, { checkFiles = false } = {}) {
  const errors = [];
  const warnings = [];
  const checks = [];
  const add = (id, name, ok, level = 'error', detail = '') => {
    checks.push({ id, name, result: ok ? 'PASS' : 'FAIL', detail });
    if (!ok) (level === 'error' ? errors : warnings).push({ id, name, detail });
  };
  const features = featureId ? model.features.filter((f) => f.feature_id === featureId) : model.features;
  const ids = new Map();
  const dupes = [];
  const collectIds = (v, kind, fid) => {
    if (typeof v !== 'string') return;
    const m = v.match(/^(REQ|PP|INT|CMP|API|DM|AC|TC|PRD|PROTO)-[A-Z]+-\d{3}-/);
    if (!m) return;
    if (ids.has(v) && ids.get(v) !== kind + fid) dupes.push(v);
    ids.set(v, kind + fid);
  };
  features.forEach((f) => {
    const qIds = f.requirements.map((q) => q.requirement_id);
    add(`V-FID-${f.feature_id}`, `Feature ID 格式 ${f.feature_id}`, /^UTER-[A-Z]+-\d{3}$/.test(f.feature_id));
    add(`V-PRD-SECTION-${f.feature_id}`, `PRD 必备章节 ${f.feature_id}`, Array.isArray(f.prd.sections) && f.prd.sections.length >= 12);
    add(`V-PRD-AC-${f.feature_id}`, `PRD 验收标准 ${f.feature_id}`, f.acceptance.length > 0 && f.acceptance.every((a) => a.given && a.when && a.then));
    add(`V-PRD-BR-${f.feature_id}`, `PRD 业务规则 ${f.feature_id}`, f.requirements.every((q) => q.status === 'DEPRECATED' || q.business_rules.length > 0));
    add(`V-REQ-UNIQ-${f.feature_id}`, `Requirement ID 唯一 ${f.feature_id}`, new Set(qIds).size === qIds.length);
    add(`V-PROTO-PAGE-${f.feature_id}`, `原型页面存在 ${f.feature_id}`, f.prototype.pages.length > 0);
    add(`V-PROTO-STATE-${f.feature_id}`, `原型状态齐全 ${f.feature_id}`, f.prototype.pages.every((p) => p.states.length >= 2));
    add(`V-PROTO-COMP-${f.feature_id}`, `原型组件存在 ${f.feature_id}`, f.prototype.pages.every((p) => p.components.length > 0));
    add(`V-PROTO-BTN-${f.feature_id}`, `按钮均有行为 ${f.feature_id}`, f.prototype.pages.every((p) => p.components.filter((c) => c.type === 'button').every((c) => c.action)));
    add(`V-PROTO-INT-${f.feature_id}`, `交互均有归属需求 ${f.feature_id}`, f.prototype.pages.every((p) => p.interactions.every((i) => !i.requirement_id || qIds.includes(i.requirement_id))));
    add(`V-PROTO-NAV-${f.feature_id}`, `页面跳转目标有效 ${f.feature_id}`, f.prototype.pages.every((p) => p.interactions.every((i) => !i.target_page_id || f.prototype.pages.some((x) => x.prototype_page_id === i.target_page_id))));
    add(`V-PROTO-FORM-${f.feature_id}`, `表单具备校验 ${f.feature_id}`, f.prototype.pages.every((p) => p.components.filter((c) => c.type === 'input' && c.required).every((c) => c.props?.error_message || c.props?.min !== undefined || c.input_type)));
    add(`V-MAP-REQ-${f.feature_id}`, `需求→原型映射 ${f.feature_id}`, f.requirements.filter((q) => q.status !== 'DEPRECATED').every((q) => (q.prototype_page_ids || []).length > 0));
    add(`V-MAP-AC-${f.feature_id}`, `需求→验收映射 ${f.feature_id}`, f.requirements.filter((q) => q.status !== 'DEPRECATED').every((q) => (q.acceptance_ids || []).length > 0));
    add(`V-MAP-TC-${f.feature_id}`, `需求→测试映射 ${f.feature_id}`, f.requirements.filter((q) => q.status !== 'DEPRECATED').every((q) => (q.test_case_ids || []).length > 0));
    add(`V-CROSS-${f.feature_id}`, `无跨 Feature 错误关联 ${f.feature_id}`, f.requirements.every((q) => (q.prototype_page_ids || []).every((p) => p.startsWith(`PP-${fbase(f.feature_id)}-`))));
    add(`V-STATUS-${f.feature_id}`, `状态与原型一致性 ${f.feature_id}`, f.status === 'NOT_IMPLEMENTED' ? f.prototype.pages.every((p) => p.planned) : true);
    f.requirements.forEach((q) => collectIds(q.requirement_id, 'req', f.feature_id));
    f.prototype.pages.forEach((p) => {
      collectIds(p.prototype_page_id, 'page', f.feature_id);
      p.components.forEach((c) => collectIds(c.component_id, 'cmp', f.feature_id));
      p.interactions.forEach((i) => collectIds(i.interaction_id, 'int', f.feature_id));
    });
    f.acceptance.forEach((a) => collectIds(a.acceptance_id, 'ac', f.feature_id));
    f.tests.forEach((t) => collectIds(t.test_case_id, 'tc', f.feature_id));
    if (checkFiles) {
      add(`V-FILE-PRD-${f.feature_id}`, `PRD 文件存在 ${f.feature_id}`, fs.existsSync(path.join(ROOT, f.prd.path)), 'warning', f.prd.path);
      const protoPath = `docs/product/prototypes/${f.domain.toLowerCase()}/${f.feature_id}.md`;
      add(`V-FILE-PROTO-${f.feature_id}`, `原型说明文件存在 ${f.feature_id}`, fs.existsSync(path.join(ROOT, protoPath)), 'warning', protoPath);
      // 交互式 HTML 原型：存在性（warning）+ 与 PRD 的同源对应（error）
      const protoHtmlPath = `docs/product/prototypes/${f.domain.toLowerCase()}/${f.feature_id}.html`;
      const htmlAbs = path.join(ROOT, protoHtmlPath);
      const htmlOk = fs.existsSync(htmlAbs);
      add(`V-FILE-PROTO-HTML-${f.feature_id}`, `交互式 HTML 原型存在 ${f.feature_id}`, htmlOk, 'warning', protoHtmlPath);
      // 内容对应检查的前提是「投影与模型同步」。隔离测试环境（NO_PROJECTIONS=1）
      // 只复制模型、不重渲染投影，磁盘 HTML 落后于隔离模型属于预期，此时标记跳过。
      if (htmlOk) {
        const skipContent = process.env.UTER_PRODUCT_WORKSPACE_NO_PROJECTIONS === '1';
        const html = fs.readFileSync(htmlAbs, 'utf8');
        const missingReqs = skipContent ? [] : f.requirements
          .filter((q) => q.status !== 'DEPRECATED' && !html.includes(`id="req-${q.requirement_id}"`))
          .map((q) => q.requirement_id);
        add(`V-HTML-PRD-LINK-${f.feature_id}`, `HTML 原型与 PRD 同源对应 ${f.feature_id}`,
          skipContent
          || (html.includes(`data-feature-id="${f.feature_id}"`)
            && html.includes(`data-prd-path="${f.prd.path}"`)
            && html.includes('data-demo="MOCK"')
            && missingReqs.length === 0),
          'error', skipContent ? '投影渲染被禁用（隔离环境），跳过内容对应检查' : missingReqs.length ? `缺少需求块: ${missingReqs.slice(0, 5).join(',')}` : '');
      }
    }
  });
  const fids = model.features.map((f) => f.feature_id);
  add('V-FID-GLOBAL', 'Feature ID 全局唯一', new Set(fids).size === fids.length);
  add('V-ID-GLOBAL', '关联 ID 全局无重复', dupes.length === 0, 'error', dupes.slice(0, 8).join(','));
  const mapped = new Set(model.mappings.map((m) => `${m.feature_id}::${m.requirement_id}`));
  const activeReqs = model.features.flatMap((f) => f.requirements.filter((q) => q.status !== 'DEPRECATED').map((q) => `${f.feature_id}::${q.requirement_id}`));
  add('V-MAP-COMPLETE', '映射注册表覆盖所有有效需求', activeReqs.every((x) => mapped.has(x)));
  add('V-MAP-NO-ORPHAN', '无孤立映射', model.mappings.every((m) => model.features.some((f) => f.feature_id === m.feature_id && f.requirements.some((q) => q.requirement_id === m.requirement_id))));
  add('V-MAP-NO-DUP', '无重复映射', new Set(model.mappings.map((m) => `${m.feature_id}::${m.requirement_id}`)).size === model.mappings.length);
  add('V-CHANGE-TRACE', '变更事件均有唯一 ID', new Set(model.changes.map((c) => c.change_id)).size === model.changes.length);
  add('V-NO-LOOP', '同步循环为 0', (model.sync_metrics?.sync_loops || 0) === 0);
  add('V-NO-OVERWRITE', '静默覆盖为 0', (model.sync_metrics?.silent_overwrites || 0) === 0);
  add('V-CONFLICT', '未解决冲突不得标记 SYNCED', model.features.filter((f) => f.sync_status === 'CONFLICT').every((f) => model.conflicts.some((c) => c.feature_id === f.feature_id && c.status === 'OPEN')));
  return { errors, warnings, checks, passed: errors.length === 0, total: checks.length, failed: checks.filter((c) => c.result === 'FAIL').length };
}

/* ───────────────────────── 覆盖率 ───────────────────────── */
export function coverage(model) {
  const fs_ = model.features;
  const implemented = fs_.filter((f) => ['IMPLEMENTED', 'BACKEND_ONLY', 'FRONTEND_ONLY', 'PARTIALLY_IMPLEMENTED'].includes(f.status));
  const pct = (n, d) => (d === 0 ? 100 : Math.round((n / d) * 10000) / 100);
  const reqs = fs_.flatMap((f) => f.requirements.filter((q) => q.status !== 'DEPRECATED'));
  const withPRD = implemented.filter((f) => f.prd && f.prd.sections.length >= 12);
  const withProto = implemented.filter((f) => f.prototype.pages.some((p) => p.status === 'ACTIVE'));
  const withMapping = fs_.filter((f) => f.mapping && Object.keys(f.mapping.requirement_to_page).length > 0);
  const tracked = reqs.filter((q) => (q.test_case_ids || []).length > 0);
  const statusCounts = {};
  fs_.forEach((f) => { statusCounts[f.status] = (statusCounts[f.status] || 0) + 1; });
  return {
    feature_total: fs_.length,
    implemented_total: implemented.length,
    status_counts: statusCounts,
    prd_total: fs_.length,
    prototype_total: fs_.length,
    page_total: fs_.reduce((n, f) => n + f.prototype.pages.length, 0),
    interactive_page_total: fs_.reduce((n, f) => n + f.prototype.pages.filter((p) => p.status === 'ACTIVE').length, 0),
    requirement_total: reqs.length,
    mapping_total: model.mappings.length,
    metrics: {
      inventory_coverage: 100,
      prd_coverage_implemented: pct(withPRD.length, implemented.length),
      prototype_coverage_implemented: pct(withProto.length, implemented.length),
      prd_not_implemented: pct(fs_.filter((f) => f.status === 'NOT_IMPLEMENTED' && f.prd).length, fs_.filter((f) => f.status === 'NOT_IMPLEMENTED').length),
      prd_to_prototype_mapping: pct(reqs.filter((q) => (q.prototype_page_ids || []).length > 0).length, reqs.length),
      prototype_to_prd_mapping: pct(fs_.reduce((n, f) => n + f.prototype.pages.filter((p) => f.mapping.page_to_prd[p.prototype_page_id]).length, 0), fs_.reduce((n, f) => n + f.prototype.pages.length, 0)),
      requirement_to_test: pct(tracked.length, reqs.length),
      mapping_registry_coverage: pct(withMapping.length, fs_.length),
      feature_id_unique: pct(new Set(fs_.map((f) => f.feature_id)).size, fs_.length),
      change_traceability: pct(model.changes.filter((c) => c.change_id && c.base_version !== undefined && c.target_version).length, model.changes.length),
      sync_success_rate: (() => {
        const m = model.sync_metrics;
        const ok = m.prd_to_prototype_success + m.prototype_to_prd_success;
        const total = ok + m.failed;
        return total === 0 ? 100 : pct(ok, total);
      })(),
      sync_loops: model.sync_metrics.sync_loops,
      silent_overwrites: model.sync_metrics.silent_overwrites,
    },
    open_conflicts: model.conflicts.filter((c) => c.status === 'OPEN').length,
    needs_review: fs_.filter((f) => (f.review_flags || []).length > 0).length,
    needs_product_decision: fs_.reduce((n, f) => n + (f.open_decisions || []).length, 0),
  };
}

/* ───────────────────────── 变更字段路径 / 冲突检测 ───────────────────────── */
function fieldPaths(ch, feature) {
  const p = ch.payload || {};
  const f = ch.feature_id;
  const semantic = [];
  // 跨视图的「同一个业务字段」必须能被识别为同一语义路径：
  // PRD 改 rule.value(min_amount) 与 Prototype 改组件 props.min(min_amount) 应判定为同字段冲突。
  const addSemantic = (field) => { if (field) semantic.push(`semantic:${f}:${field}`); };
  const findRule = () => feature?.requirements.flatMap((q) => q.business_rules).find((b) => b.rule_id === p.rule_id);
  const findComponent = () => feature?.prototype.pages.flatMap((pg) => pg.components).find((c) => c.component_id === p.component_id);
  switch (ch.op) {
    case 'add_requirement':
      (p.rules || []).forEach((r) => { if (r && typeof r === 'object' && r.field) addSemantic(r.field); });
      // 并发新增不同需求是「不同字段」，按标题区分，避免误判为冲突。
      return [`requirement:new:${p.title || 'untitled'}`, ...semantic];
    case 'update_requirement': return Object.keys(p).filter((k) => !['reason'].includes(k)).map((k) => `requirement:${p.requirement_id}:${k}`);
    case 'update_business_rule': {
      addSemantic(findRule()?.field);
      return [`business_rule:${p.rule_id}:value`, `business_rule:${p.rule_id}:text`, ...semantic];
    }
    case 'update_acceptance': return Object.keys(p).filter((k) => k !== 'acceptance_id').map((k) => `acceptance:${p.acceptance_id}:${k}`);
    case 'delete_requirement': return [`requirement:${p.requirement_id}:status`];
    case 'add_component': return [`component:new:${p.name || p.label || 'untitled'}`];
    case 'update_component': {
      const comp = findComponent();
      addSemantic(p.props?.rule_field || (p.props?.min !== undefined ? (comp?.props?.rule_field || 'min_amount') : null));
      return [...Object.keys(p).filter((k) => !['component_id', 'page_id'].includes(k)).map((k) => `component:${p.component_id}:${k}`), ...semantic];
    }
    case 'delete_component': return [`component:${p.component_id}:status`];
    case 'add_page': return [`page:new:${p.name || 'untitled'}`];
    case 'update_interaction': return Object.keys(p).filter((k) => !['interaction_id', 'page_id'].includes(k)).map((k) => `interaction:${p.interaction_id}:${k}`);
    case 'delete_interaction': return [`interaction:${p.interaction_id}:status`];
    case 'update_page_state': return [`page:${p.page_id}:states:${p.state}`];
    case 'update_prd_section': return [`prd:${f}:${p.section}`];
    case 'add_feature': return [`feature:${p.feature_id}:*`];
    default: return [`feature:${f}:${ch.op}`];
  }
}

function findConflicts(model, ch, paths) {
  if (ch.base_version === undefined || ch.base_version === null) return [];
  const later = model.changes.filter((c) => c.feature_id === ch.feature_id && c.target_version > ch.base_version && c.sync_status !== 'CONFLICT');
  const hits = [];
  for (const c of later) {
    const overlap = (c.changed_fields || []).filter((x) => paths.includes(x));
    if (overlap.length) hits.push({ change: c, overlap });
  }
  return hits;
}

/* ───────────────────────── 影响分析 ───────────────────────── */
function impactFor(feature, target) {
  const pages = feature.prototype.pages;
  return {
    prototype_pages: pages.filter((p) => p.requirement_ids.includes(target) || p.components.some((c) => c.requirement_id === target)).map((p) => p.prototype_page_id),
    components: pages.flatMap((p) => p.components.filter((c) => c.requirement_id === target || c.component_id === target).map((c) => c.component_id)),
    interactions: pages.flatMap((p) => p.interactions.filter((i) => i.requirement_id === target || i.interaction_id === target).map((i) => i.interaction_id)),
    apis: feature.apis.map((a) => a.api_id),
    acceptance: feature.acceptance.filter((a) => a.requirement_id === target || a.acceptance_id === target).map((a) => a.acceptance_id),
    tests: feature.tests.filter((t) => t.requirement_id === target || t.test_case_id === target).map((t) => t.test_case_id),
    other_requirements: feature.requirements.filter((q) => q.requirement_id !== target).map((q) => q.requirement_id),
  };
}

/* ───────────────────────── 自动同步辅助 ───────────────────────── */
function addAcceptance(model, feature, q, changeId) {
  const made = [];
  const seeds = [
    { type: 'normal', given: `用户具备 ${feature.roles.join(' / ')} 角色且进入页面`, when: `执行「${q.title}」`, then: '操作成功且原型可复现相同行为' },
    { type: 'exception', given: '输入不满足业务规则', when: `执行「${q.title}」并触发校验失败`, then: '展示明确错误提示且不写入真实数据' },
    { type: 'permission', given: '用户不具备该功能角色', when: '访问功能入口', then: '展示权限不足状态且不泄露数据' },
  ];
  q.business_rules.filter((b) => b.field && b.value !== null).forEach((b) => seeds.push({
    type: 'boundary', given: `业务规则 ${b.rule_id} 值为 ${b.value}`, when: `输入低于 ${b.value} 的边界值`, then: `校验失败并提示不得低于 ${b.value}`,
  }));
  seeds.forEach((s) => {
    const id = nextId(model, feature, 'AC');
    const rec = { acceptance_id: id, feature_id: feature.feature_id, requirement_id: q.requirement_id, ...s, prototype_page_id: feature.prototype.primary_page_id, generated_by: changeId };
    feature.acceptance.push(rec);
    q.acceptance_ids.push(id);
    made.push(id);
  });
  return made;
}

function addTest(model, feature, q, changeId) {
  const id = nextId(model, feature, 'TC');
  const rec = {
    test_case_id: id, feature_id: feature.feature_id, requirement_id: q.requirement_id,
    acceptance_ids: [...q.acceptance_ids],
    name: `${q.requirement_id} 需求-原型-验收-测试追溯`,
    path: 'tools/product-workspace/tests/requirements-trace.test.mjs',
    kind: 'automated', status: 'ACTIVE', result: 'NOT_RUN',
    code_evidence: feature.evidence.tests || [], generated_by: changeId,
  };
  feature.tests.push(rec);
  q.test_case_ids.push(id);
  return id;
}

function syncRequirementToPrototype(model, feature, q, changeId, events) {
  const page = feature.prototype.pages.find((p) => p.prototype_page_id === feature.prototype.primary_page_id) || feature.prototype.pages[0];
  const input = q.inputs?.[0];
  const type = input ? (input.type === 'number' ? 'input' : input.type === 'select' ? 'select' : 'input') : 'input';
  const cid = nextId(model, feature, 'CMP');
  const comp = {
    component_id: cid, type, label: q.title, name: input?.name || `field_${cid.toLowerCase()}`,
    input_type: input?.type || 'text', required: !!input?.required,
    options: [], action: null, trigger: null, state: null,
    props: { error_message: `${q.title} 输入不合法`, generated_by: changeId },
    requirement_id: q.requirement_id, interaction_ids: [], status: 'ACTIVE',
  };
  q.business_rules.filter((b) => b.field).forEach((b) => {
    comp.props.rule_field = b.field;
    if (b.field === 'min_amount' && b.value !== null) {
      comp.props.min = Number(b.value);
      comp.props.error_message = b.text.includes('低于') ? b.text : `金额不得低于 ${b.value}`;
    }
  });
  page.components.push(comp);
  q.component_ids = [...(q.component_ids || []), cid];
  q.prototype_page_ids = [...new Set([...(q.prototype_page_ids || []), page.prototype_page_id])];
  if (!page.requirement_ids.includes(q.requirement_id)) page.requirement_ids.push(q.requirement_id);
  const iid = nextId(model, feature, 'INT');
  page.interactions.push({
    interaction_id: iid, name: `${q.title} · 自动生成交互`, trigger: `submit:${comp.name}`,
    action: 'validate_form_then_submit', target_page_id: null,
    requirement_id: q.requirement_id, steps: [`submit:${comp.name}`, 'validate_form_then_submit'],
    status: 'ACTIVE', generated_by: changeId,
  });
  q.interaction_ids = [...(q.interaction_ids || []), iid];
  comp.interaction_ids = [iid];
  ['success', 'error'].forEach((s) => {
    if (!page.states.some((x) => x.kind === s)) {
      page.states.push({ state_id: `ST-${fbase(feature.feature_id)}-AUTO-${s}`, name: s, kind: s, description: `由 ${changeId} 为「${q.title}」自动补齐的 ${s} 状态。` });
    }
  });
  events.push({ id: cid, view: 'Prototype', action: 'create_component', detail: `${q.title} → ${comp.type}`, origin: 'SYSTEM_GENERATED' });
  events.push({ id: iid, view: 'Prototype', action: 'create_interaction', detail: `表单校验交互`, origin: 'SYSTEM_GENERATED' });
  return { component_id: cid, interaction_id: iid, page_id: page.prototype_page_id };
}

function syncRuleToPrototype(model, feature, rule, events, changeId) {
  const touched = [];
  const pageIds = [];
  for (const p of feature.prototype.pages) {
    for (const c of p.components) {
      if (c.props?.rule_field !== rule.field) continue;
      if (rule.field === 'min_amount' && rule.value !== null) {
        c.props.min = Number(rule.value);
        c.props.error_message = `充值金额不得低于 ${rule.value} 元`;
        c.props.updated_by = changeId;
      }
      touched.push({ page_id: p.prototype_page_id, component_id: c.component_id, field: rule.field, value: rule.value });
      pageIds.push(p.prototype_page_id);
    }
    for (const a of p.components.filter((x) => x.type === 'alert' && x.props?.rule_field === rule.field)) {
      a.label = `充值金额不得低于 ${rule.value} 元`;
      a.props.updated_by = changeId;
      touched.push({ page_id: p.prototype_page_id, component_id: a.component_id, field: 'error_message', value: a.label });
    }
  }
  for (const ac of feature.acceptance.filter((a) => a.requirement_id === rule.requirement_id && a.type === 'boundary')) {
    ac.given = `系统最低充值金额为 ${rule.value} 元`;
    ac.when = `输入 ${Number(rule.value) - 1} 元并提交`;
    ac.then = `校验失败并提示「不得低于 ${rule.value} 元」；输入 ${rule.value} 元时校验通过`;
    ac.updated_by = changeId;
  }
  for (const t of feature.tests.filter((x) => x.requirement_id === rule.requirement_id)) {
    t.result = 'NOT_RUN';
    t.updated_by = changeId;
  }
  events.push({ id: rule.rule_id, view: 'Prototype', action: 'update_validation', detail: touched.map((x) => x.component_id).join(',') || 'no-bound-component', origin: 'SYSTEM_GENERATED' });
  return { touched, page_ids: [...new Set(pageIds)] };
}

function addRequirementFromComponent(model, feature, comp, page, changeId, events) {
  const rid = nextId(model, feature, 'REQ');
  const q = {
    requirement_id: rid, feature_id: feature.feature_id,
    title: `提供「${comp.label}」`,
    description: `原型页面 ${page.prototype_page_id} 包含 ${comp.type} 组件「${comp.label}」${comp.name ? `（字段 ${comp.name}）` : ''}，其输入方式与校验规则须在 PRD 中同步说明。`,
    priority: feature.priority, status: 'ACTIVE',
    entry: page.entry,
    inputs: comp.name ? [{ name: comp.name, type: comp.input_type || comp.type, required: !!comp.required, validation: comp.props?.error_message ? [comp.props.error_message] : [] }] : [],
    output: '组件交互结果',
    business_rules: [{ rule_id: `BR-${fbase(feature.feature_id)}-AUTO-${rid.slice(-2)}`, requirement_id: rid, text: 'NEEDS_REVIEW：原型新增组件的业务规则语义需产品确认，系统未凭空生成业务规则。', value: null, field: null, status: 'NEEDS_PRODUCT_DECISION' }],
    permission: feature.roles.join(', '), data_change: '原型 MOCK 数据，不写真实业务数据',
    error_messages: comp.props?.error_message ? [comp.props.error_message] : [],
    acceptance_ids: [], test_case_ids: [], prototype_page_ids: [page.prototype_page_id],
    component_ids: [comp.component_id], interaction_ids: [], change_ids: [changeId],
    generated_by: changeId, source_view: 'Prototype',
  };
  feature.requirements.push(q);
  comp.requirement_id = rid;
  if (!page.requirement_ids.includes(rid)) page.requirement_ids.push(rid);
  const acs = addAcceptance(model, feature, q, changeId);
  const tc = addTest(model, feature, q, changeId);
  feature.review_flags = [...new Set([...(feature.review_flags || []), `BUSINESS_RULE_REVIEW:${rid}`])];
  events.push({ id: rid, view: 'PRD', action: 'create_requirement', detail: q.title, origin: 'SYSTEM_GENERATED' });
  events.push({ id: acs.join(','), view: 'PRD', action: 'create_acceptance', detail: `${acs.length} 条`, origin: 'SYSTEM_GENERATED' });
  events.push({ id: tc, view: 'PRD', action: 'create_test_case', detail: tc, origin: 'SYSTEM_GENERATED' });
  return q;
}

/* ───────────────────────── 新增功能门禁 ───────────────────────── */
export function gate(model, payload) {
  const checks = [];
  const ck = (id, ok, detail) => checks.push({ id, ok, detail });
  const fid = payload.feature_id || '';
  ck('G1_FEATURE_ID', /^UTER-[A-Z]+-\d{3}$/.test(fid), 'Feature ID 必须符合 UTER-{DOMAIN}-{NUMBER}');
  ck('G2_UNIQUE', !model.features.some((f) => f.feature_id === fid) && !model.feature_id_tombstones.includes(fid), 'Feature ID 全局唯一且未被占用');
  ck('G3_PRD', !!payload.prd && !!payload.prd.goal, '必须提供 PRD 背景/目标');
  ck('G4_PROTOTYPE', !!payload.prototype && (payload.prototype.pages || []).length > 0, '必须提供原型页面');
  ck('G5_ACCEPTANCE', (payload.acceptance || []).length > 0, '必须定义验收标准');
  ck('G6_MAPPING', (payload.requirements || []).length > 0, '必须提供需求条目以建立映射');
  ck('G7_TEST', !!(payload.test_path || '').endsWith('.mjs') || !!(payload.test_path || '').endsWith('.ts'), '必须关联可执行测试');
  const passed = checks.every((c) => c.ok);
  return { allowed: passed, checks, decision: passed ? 'ALLOW' : 'BLOCK', evaluated_at: nowISO() };
}

/* ───────────────────────── 主入口：applyChange ───────────────────────── */
export function applyChange(model, ch) {
  const errors = [];
  if (!ch || typeof ch !== 'object') return { status: 'FAILED', errors: ['变更对象无效'] };
  if (!DETERMINISTIC_VIEWS.includes(ch.source_view) && !['System Generated', 'External Code Change'].includes(ch.source_view)) {
    return { status: 'FAILED', errors: [`未知 Source View: ${ch.source_view}`] };
  }
  if (ch.op === 'restore_version' || ch.op === 'resolve_conflict') {
    return { status: 'FAILED', errors: ['请使用专用接口 restoreVersion / resolveConflict'] };
  }
  const feature = model.features.find((f) => f.feature_id === ch.feature_id);
  if (!feature && ch.op !== 'add_feature') return { status: 'FAILED', errors: [`Feature 不存在: ${ch.feature_id}`] };
  const paths = fieldPaths(ch, feature);
  const conflicts = findConflicts(model, ch, paths);
  const changeId = ch.change_id || newChangeId(model);
  const sensitive = feature ? SENSITIVE.has(feature.domain) : false;

  if (conflicts.length) {
    const conflict = {
      conflict_id: `CONFLICT-${model.conflicts.length + 1}-${changeId}`,
      feature_id: ch.feature_id,
      status: 'OPEN',
      base_version: ch.base_version,
      current_version: model.model_version,
      overlapping_fields: [...new Set(conflicts.flatMap((c) => c.overlap))],
      prd_side: ch.source_view === 'PRD' ? clone(ch) : (conflicts[0].change.source_view === 'PRD' ? clone(conflicts[0].change) : null),
      prototype_side: ch.source_view === 'Prototype' ? clone(ch) : (conflicts[0].change.source_view === 'Prototype' ? clone(conflicts[0].change) : null),
      pending: clone(ch),
      prior_change: clone(conflicts[0].change),
      prior: conflicts.map((c) => ({ change_id: c.change.change_id, source_view: c.change.source_view, changed_fields: c.overlap })),
      requires_product_decision: sensitive,
      detected_at: nowISO(),
    };
    model.conflicts.push(conflict);
    if (feature) feature.sync_status = 'CONFLICT';
    model.changes.push({
      change_id: changeId, feature_id: ch.feature_id, source_view: ch.source_view,
      source_type: 'USER_EDIT', op: ch.op, base_version: ch.base_version,
      target_version: model.model_version, changed_fields: paths,
      impact_scope: {}, sync_status: 'CONFLICT', reason: ch.reason || '并发修改冲突',
      actor: ch.actor || 'unknown', created_at: nowISO(), sync_events: [],
      conflict_id: conflict.conflict_id,
    });
    writeModel(model);
    return { status: 'CONFLICT', change_id: changeId, conflict, errors: [], sync_events: [] };
  }

  const events = [];
  const impacts = [];
  const working = clone(model); // 事务副本：失败时整体回滚，不写半成品
  // add_feature 在事务中新创建 Feature，case 内会把 wf 指向新对象，
  // 确保后续版本递增 / 映射重建 / 一致性检查同样覆盖新增功能。
  let wf = working.features.find((f) => f.feature_id === ch.feature_id);
  const p = ch.payload || {};
  let primaryResult = null;

  const needPage = () => wf.prototype.pages.find((x) => x.prototype_page_id === (p.page_id || wf.prototype.primary_page_id)) || wf.prototype.pages[0];
  const needComponent = () => {
    for (const pg of wf.prototype.pages) {
      const c = pg.components.find((x) => x.component_id === p.component_id);
      if (c) return { pg, c };
    }
    return null;
  };
  const needRequirement = () => wf.requirements.find((q) => q.requirement_id === p.requirement_id);

  try {
    switch (ch.op) {
      /* ───────── PRD → Prototype ───────── */
      case 'add_requirement': {
        const rid = nextId(working, wf, 'REQ');
        const q = {
          requirement_id: rid, feature_id: wf.feature_id,
          title: p.title || '新增需求', description: p.description || '',
          priority: p.priority || wf.priority,
          status: p.description && p.rules?.length ? 'ACTIVE' : 'NEEDS_REVIEW',
          entry: wf.prototype.pages[0].entry,
          inputs: p.input ? [{ name: p.input.name, type: p.input.type || 'text', required: !!p.input.required, validation: (p.rules || []).map((r) => r.text || String(r)) }] : [],
          output: p.output || '操作结果与状态反馈',
          business_rules: (p.rules || []).map((r, i) => ({
            rule_id: `BR-${fbase(wf.feature_id)}-NEW-${pad(i + 1)}-${rid.slice(-2)}`,
            requirement_id: rid, text: typeof r === 'string' ? r : r.text,
            value: (typeof r === 'object' && r.value !== undefined) ? r.value : null,
            field: (typeof r === 'object' && r.field) ? r.field : null,
            status: 'ACTIVE',
          })),
          permission: wf.roles.join(', '), data_change: '按需求规则变更（MOCK 原型不写真实数据）',
          error_messages: (p.rules || []).map((r) => (typeof r === 'string' ? r : r.text)).filter((t) => /不得|必须|错误|拒绝|限制/.test(t)),
          acceptance_ids: [], test_case_ids: [], prototype_page_ids: [], component_ids: [], interaction_ids: [],
          change_ids: [changeId], generated_by: changeId, source_view: 'PRD',
        };
        wf.requirements.push(q);
        const acs = addAcceptance(working, wf, q, changeId);
        const tc = addTest(working, wf, q, changeId);
        const synced = syncRequirementToPrototype(working, wf, q, changeId, events);
        primaryResult = { requirement_id: rid, acceptance_ids: acs, test_case_id: tc, synced };
        events.push({ id: rid, view: 'PRD', action: 'create_requirement', detail: q.title, origin: 'USER_EDIT' });
        impacts.push({ type: 'create', requirement_id: rid, ...synced });
        break;
      }
      case 'update_requirement': {
        const q = needRequirement();
        if (!q) throw new Error(`Requirement 不存在: ${p.requirement_id}`);
        const before = { title: q.title, description: q.description };
        if (p.title) q.title = p.title;
        if (p.description) q.description = p.description;
        if (p.rules) q.business_rules = p.rules.map((r, i) => ({ rule_id: q.business_rules[i]?.rule_id || `BR-${fbase(wf.feature_id)}-U-${pad(i + 1)}`, requirement_id: q.requirement_id, text: typeof r === 'string' ? r : r.text, value: (typeof r === 'object' && r.value !== undefined) ? r.value : null, field: (typeof r === 'object' && r.field) || q.business_rules[i]?.field || null, status: 'ACTIVE' }));
        q.change_ids = [...(q.change_ids || []), changeId];
        // 同步原型：组件名称、校验、错误提示、验收、测试
        for (const pg of wf.prototype.pages) {
          for (const c of pg.components.filter((x) => x.requirement_id === q.requirement_id)) {
            if (p.title) c.label = p.title;
            if (p.rules) c.props.error_message = (p.rules[0] && (typeof p.rules[0] === 'string' ? p.rules[0] : p.rules[0].text)) || c.props.error_message;
            c.props.updated_by = changeId;
            events.push({ id: c.component_id, view: 'Prototype', action: 'update_component', detail: `${c.label} / 校验规则`, origin: 'SYSTEM_GENERATED' });
          }
        }
        for (const a of wf.acceptance.filter((x) => x.requirement_id === q.requirement_id && x.type === 'normal')) {
          a.when = `执行「${q.title}」的正常操作`; a.updated_by = changeId;
        }
        for (const t of wf.tests.filter((x) => x.requirement_id === q.requirement_id)) { t.result = 'NOT_RUN'; t.updated_by = changeId; }
        primaryResult = { requirement_id: q.requirement_id, before, after: { title: q.title, description: q.description } };
        impacts.push({ type: 'update', requirement_id: q.requirement_id, components: q.component_ids });
        break;
      }
      case 'update_business_rule': {
        const rule = wf.requirements.flatMap((q) => q.business_rules).find((b) => b.rule_id === p.rule_id);
        if (!rule) throw new Error(`Business Rule 不存在: ${p.rule_id}`);
        const before = { text: rule.text, value: rule.value };
        if (p.text !== undefined) rule.text = p.text;
        if (p.value !== undefined) rule.value = p.value;
        rule.updated_by = changeId;
        const synced = syncRuleToPrototype(working, wf, rule, events, changeId);
        primaryResult = { rule_id: rule.rule_id, before, after: { text: rule.text, value: rule.value }, ...synced };
        impacts.push({ type: 'rule_change', rule_id: rule.rule_id, touched: synced.touched });
        break;
      }
      case 'update_acceptance': {
        const a = wf.acceptance.find((x) => x.acceptance_id === p.acceptance_id);
        if (!a) throw new Error(`Acceptance 不存在: ${p.acceptance_id}`);
        ['given', 'when', 'then'].forEach((k) => { if (p[k] !== undefined) a[k] = p[k]; });
        a.updated_by = changeId;
        const pg = wf.prototype.pages.find((x) => x.prototype_page_id === a.prototype_page_id) || wf.prototype.pages[0];
        const st = pg.states.find((s) => s.kind === (a.type === 'exception' ? 'error' : 'success'));
        if (st) { st.description = `${a.type} 状态：${a.then}`; st.updated_by = changeId; }
        for (const t of wf.tests.filter((x) => x.requirement_id === a.requirement_id)) { t.result = 'NOT_RUN'; t.updated_by = changeId; }
        events.push({ id: a.acceptance_id, view: 'Prototype', action: 'update_state', detail: st?.state_id || 'state', origin: 'SYSTEM_GENERATED' });
        primaryResult = { acceptance_id: a.acceptance_id, then: a.then };
        break;
      }
      case 'delete_requirement': {
        const q = needRequirement();
        if (!q) throw new Error(`Requirement 不存在: ${p.requirement_id}`);
        const impact = impactFor(wf, q.requirement_id);
        impacts.push({ type: 'delete', requirement_id: q.requirement_id, impact });
        if (sensitive) {
          q.status = 'DEPRECATED';
          q.deprecation = { reason: p.reason || ch.reason || '未说明', change_id: changeId, at: nowISO(), impact };
          wf.audit_trail.push({ at: nowISO(), change_id: changeId, action: 'DEPRECATE_REQUIREMENT', target: q.requirement_id, reason: p.reason || ch.reason, impact });
          wf.acceptance.filter((a) => a.requirement_id === q.requirement_id).forEach((a) => { a.status = 'DEPRECATED'; });
          wf.tests.filter((t) => t.requirement_id === q.requirement_id).forEach((t) => { t.status = 'DEPRECATED'; });
        } else {
          wf.requirements = wf.requirements.filter((x) => x.requirement_id !== q.requirement_id);
          wf.acceptance = wf.acceptance.filter((a) => a.requirement_id !== q.requirement_id);
          wf.tests = wf.tests.filter((t) => t.requirement_id !== q.requirement_id);
        }
        for (const pg of wf.prototype.pages) {
          pg.components.filter((c) => c.requirement_id === q.requirement_id).forEach((c) => { c.status = 'DEPRECATED'; c.props.deprecated_by = changeId; });
          pg.interactions.filter((i) => i.requirement_id === q.requirement_id).forEach((i) => { i.status = 'DEPRECATED'; });
          pg.requirement_ids = pg.requirement_ids.filter((x) => x !== q.requirement_id);
        }
        events.push({ id: q.requirement_id, view: 'Prototype', action: sensitive ? 'deprecate_components' : 'remove_components', detail: impact.components.join(','), origin: 'SYSTEM_GENERATED' });
        primaryResult = { requirement_id: q.requirement_id, impact, audit_retained: sensitive };
        break;
      }
      case 'update_prd_section': {
        if (!['goal', 'problem'].includes(p.section)) throw new Error(`不支持的 PRD 章节: ${p.section}`);
        wf.background[p.section] = p.value;
        primaryResult = { section: p.section, value: p.value };
        events.push({ id: `PRD-${wf.feature_id}`, view: 'PRD', action: 'update_section', detail: p.section, origin: 'USER_EDIT' });
        break;
      }

      /* ───────── Prototype → PRD ───────── */
      case 'add_component': {
        const pg = needPage();
        const cid = nextId(working, wf, 'CMP');
        const comp = {
          component_id: cid, type: p.type || 'input', label: p.label || '新增组件',
          name: p.name || null, input_type: p.input_type || p.type || 'text',
          required: !!p.required, options: p.options || [], action: p.action || null,
          trigger: p.trigger || null, state: p.state || null,
          props: { ...(p.props || {}), generated_by: changeId },
          requirement_id: null, interaction_ids: [], status: 'ACTIVE', source_view: 'Prototype',
        };
        pg.components.push(comp);
        const q = addRequirementFromComponent(working, wf, comp, pg, changeId, events);
        const iid = nextId(working, wf, 'INT');
        pg.interactions.push({
          interaction_id: iid, name: `${comp.label} · 自动生成交互`, trigger: `submit:${comp.name || cid}`,
          action: p.action || 'validate_form_then_submit', target_page_id: null,
          requirement_id: q.requirement_id, steps: [`submit:${comp.name || cid}`, p.action || 'validate_form_then_submit'],
          status: 'ACTIVE', generated_by: changeId,
        });
        q.interaction_ids.push(iid); comp.interaction_ids.push(iid);
        wf.flows.normal.splice(2, 0, `选择/填写「${comp.label}」`);
        primaryResult = { component_id: cid, requirement_id: q.requirement_id, interaction_id: iid };
        impacts.push({ type: 'create', component_id: cid, requirement_id: q.requirement_id });
        break;
      }
      case 'update_component': {
        const hit = needComponent();
        if (!hit) throw new Error(`Component 不存在: ${p.component_id}`);
        const { pg, c } = hit;
        const before = { label: c.label, type: c.type, props: clone(c.props) };
        if (p.label) c.label = p.label;
        if (p.type) c.type = p.type;
        if (p.props) c.props = { ...c.props, ...p.props };
        c.props.updated_by = changeId;
        const q = wf.requirements.find((x) => x.requirement_id === c.requirement_id);
        if (q) {
          q.description = `原型页面 ${pg.prototype_page_id} 的 ${c.type} 组件「${c.label}」：输入方式 ${c.input_type || c.type}，${c.props?.error_message ? `校验提示「${c.props.error_message}」` : '无显式校验提示'}。PRD 字段说明由双向同步自动更新。`;
          if (q.inputs?.[0]) { q.inputs[0].type = c.input_type || c.type; q.inputs[0].name = c.name || q.inputs[0].name; }
          q.error_messages = c.props?.error_message ? [c.props.error_message] : [];
          q.change_ids = [...(q.change_ids || []), changeId];
          for (const a of wf.acceptance.filter((x) => x.requirement_id === q.requirement_id && x.type === 'normal')) {
            a.when = `使用 ${c.type} 组件「${c.label}」执行操作`; a.updated_by = changeId;
          }
          for (const t of wf.tests.filter((x) => x.requirement_id === q.requirement_id)) { t.result = 'NOT_RUN'; t.updated_by = changeId; }
          events.push({ id: q.requirement_id, view: 'PRD', action: 'update_requirement', detail: q.title, origin: 'SYSTEM_GENERATED' });
          events.push({ id: q.acceptance_ids.join(','), view: 'PRD', action: 'update_acceptance', detail: '验收条件同步', origin: 'SYSTEM_GENERATED' });
          events.push({ id: q.test_case_ids.join(','), view: 'PRD', action: 'reset_test', detail: '测试用例需重跑', origin: 'SYSTEM_GENERATED' });
        }
        primaryResult = { component_id: c.component_id, before, after: { label: c.label, type: c.type, props: c.props } };
        impacts.push({ type: 'update', component_id: c.component_id, requirement_id: c.requirement_id });
        break;
      }
      case 'delete_component': {
        const hit = needComponent();
        if (!hit) throw new Error(`Component 不存在: ${p.component_id}`);
        const { pg, c } = hit;
        const impact = impactFor(wf, c.component_id);
        impacts.push({ type: 'delete', component_id: c.component_id, impact });
        c.status = 'DEPRECATED';
        c.props.deprecated_by = changeId;
        if (sensitive) {
          wf.audit_trail.push({ at: nowISO(), change_id: changeId, action: 'DEPRECATE_COMPONENT', target: c.component_id, reason: p.reason || ch.reason, impact });
        }
        const q = wf.requirements.find((x) => x.requirement_id === c.requirement_id);
        if (q) {
          if (sensitive) {
            q.status = 'DEPRECATED';
            q.deprecation = { reason: p.reason || ch.reason, change_id: changeId, at: nowISO(), impact };
            wf.acceptance.filter((a) => a.requirement_id === q.requirement_id).forEach((a) => { a.status = 'DEPRECATED'; });
          } else {
            q.description = `【同步删除】原型组件 ${c.component_id} 已移除：${p.reason || ch.reason || '未提供原因'}。PRD 字段说明同步更新。`;
            q.component_ids = q.component_ids.filter((x) => x !== c.component_id);
            for (const a of wf.acceptance.filter((x) => x.requirement_id === q.requirement_id && x.type === 'normal')) {
              a.then = '对应组件已移除，验收条件需按新交互重新确认'; a.updated_by = changeId;
            }
            for (const t of wf.tests.filter((x) => x.requirement_id === q.requirement_id)) { t.result = 'NOT_RUN'; }
          }
          events.push({ id: q.requirement_id, view: 'PRD', action: sensitive ? 'deprecate_requirement' : 'update_requirement', detail: '删除影响同步', origin: 'SYSTEM_GENERATED' });
        }
        pg.interactions.filter((i) => i.interaction_id === c.interaction_ids?.[0]).forEach((i) => { i.status = 'DEPRECATED'; });
        primaryResult = { component_id: c.component_id, impact, audit_retained: sensitive };
        break;
      }
      case 'add_page': {
        const pid = nextId(working, wf, 'PP');
        const pg = {
          prototype_page_id: pid, feature_id: wf.feature_id, name: p.name || '新增页面',
          entry: p.entry || `由 ${wf.prototype.primary_page_id} 跳转进入`,
          layout: p.layout || 'detail', status: 'ACTIVE', planned: false,
          demo_notice: 'DEMO / MOCK：仅使用合成数据。',
          requirement_ids: [], components: [], interactions: [], states: ['idle', 'loading', 'empty', 'error', 'success'].map((s, i) => ({ state_id: `ST-${fbase(wf.feature_id)}-NP-${pad(i + 1)}`, name: s, kind: s, description: `${s} 状态。` })),
          generated_by: changeId,
        };
        wf.prototype.pages.push(pg);
        // 新增页面必须至少有一个组件（V-PROTO-COMP）。这里只放一个「待产品确认」
        // 的中性占位组件，不凭空编造业务字段或业务规则。
        const cid = nextId(working, wf, 'CMP');
        const placeholder = {
          component_id: cid, type: 'badge',
          label: 'NEEDS_REVIEW：新增页面的组件构成待产品确认（DEMO / MOCK）',
          name: null, input_type: null, required: false, options: [], action: null,
          trigger: null, state: null, props: { generated_by: changeId, needs_review: true },
          requirement_id: null, interaction_ids: [], status: 'ACTIVE', source_view: 'Prototype',
        };
        pg.components.push(placeholder);
        wf.mapping.page_to_prd[pid] = wf.prd.path;
        const rid = nextId(working, wf, 'REQ');
        wf.requirements.push({
          requirement_id: rid, feature_id: wf.feature_id, title: `提供「${pg.name}」页面`,
          description: `原型新增页面 ${pid}（${pg.layout}）。PRD 页面交互与业务流程同步更新；页面承载的业务语义需产品确认。`,
          priority: wf.priority, status: 'ACTIVE', entry: pg.entry, inputs: [], output: '页面跳转结果',
          business_rules: [{ rule_id: `BR-${fbase(wf.feature_id)}-NP-${rid.slice(-2)}`, requirement_id: rid, text: 'NEEDS_REVIEW：新增页面的业务语义待产品确认。', value: null, field: null, status: 'NEEDS_PRODUCT_DECISION' }],
          permission: wf.roles.join(', '), data_change: 'MOCK 数据', error_messages: [],
          acceptance_ids: [], test_case_ids: [], prototype_page_ids: [pid], component_ids: [], interaction_ids: [], change_ids: [changeId],
        });
        const q = wf.requirements.at(-1);
        pg.requirement_ids.push(rid);
        placeholder.requirement_id = rid;
        q.component_ids = [cid];
        addAcceptance(working, wf, q, changeId);
        addTest(working, wf, q, changeId);
        wf.flows.normal.push(`跳转至 ${pg.name}`);
        wf.review_flags = [...new Set([...(wf.review_flags || []), `BUSINESS_RULE_REVIEW:${rid}`])];
        events.push({ id: rid, view: 'PRD', action: 'create_requirement', detail: q.title, origin: 'SYSTEM_GENERATED' });
        events.push({ id: pid, view: 'PRD', action: 'update_page_section', detail: pg.name, origin: 'SYSTEM_GENERATED' });
        primaryResult = { page_id: pid, requirement_id: rid };
        break;
      }
      case 'update_interaction': {
        let hit = null;
        for (const pg of wf.prototype.pages) {
          const i = pg.interactions.find((x) => x.interaction_id === p.interaction_id);
          if (i) { hit = { pg, i }; break; }
        }
        if (!hit) throw new Error(`Interaction 不存在: ${p.interaction_id}`);
        const { pg, i } = hit;
        const before = { action: i.action, steps: [...i.steps], target_page_id: i.target_page_id };
        ['name', 'action', 'trigger', 'target_page_id'].forEach((k) => { if (p[k] !== undefined) i[k] = p[k]; });
        if (p.steps) i.steps = p.steps;
        else if (p.action) i.steps = [i.trigger, i.action];
        i.updated_by = changeId;
        wf.flows.normal = [`进入 ${pg.name}`, ...i.steps, '展示结果状态'];
        wf.flows.recovery = ['失败后可重试', '返回时恢复表单状态', ...(i.target_page_id ? [`可跳转至 ${i.target_page_id}`] : [])];
        const q = wf.requirements.find((x) => x.requirement_id === i.requirement_id);
        if (q) {
          q.description = `${q.description.split('。')[0]}。业务流程已同步为：${i.steps.join(' → ')}。`;
          for (const a of wf.acceptance.filter((x) => x.requirement_id === q.requirement_id && x.type === 'normal')) {
            a.when = `按流程 ${i.steps.join(' → ')} 执行操作`; a.updated_by = changeId;
          }
          for (const t of wf.tests.filter((x) => x.requirement_id === q.requirement_id)) { t.result = 'NOT_RUN'; }
        }
        events.push({ id: i.interaction_id, view: 'PRD', action: 'update_business_flow', detail: i.steps.join('→'), origin: 'SYSTEM_GENERATED' });
        events.push({ id: i.interaction_id, view: 'PRD', action: 'update_acceptance', detail: '流程类验收条件同步', origin: 'SYSTEM_GENERATED' });
        primaryResult = { interaction_id: i.interaction_id, before, after: { action: i.action, steps: i.steps, target_page_id: i.target_page_id } };
        break;
      }
      case 'delete_interaction': {
        let hit = null;
        for (const pg of wf.prototype.pages) {
          const i = pg.interactions.find((x) => x.interaction_id === p.interaction_id);
          if (i) { hit = { pg, i }; break; }
        }
        if (!hit) throw new Error(`Interaction 不存在: ${p.interaction_id}`);
        const { pg, i } = hit;
        const impact = impactFor(wf, i.interaction_id);
        i.status = 'DEPRECATED';
        if (sensitive) wf.audit_trail.push({ at: nowISO(), change_id: changeId, action: 'DEPRECATE_INTERACTION', target: i.interaction_id, reason: p.reason || ch.reason, impact });
        wf.flows.exception.push(`交互 ${i.interaction_id} 已移除：${p.reason || ch.reason || '未提供原因'}`);
        const q = wf.requirements.find((x) => x.requirement_id === i.requirement_id);
        if (q) { q.description += ` 【同步】交互 ${i.interaction_id} 已删除。`; }
        events.push({ id: i.interaction_id, view: 'PRD', action: 'update_business_flow', detail: '删除影响同步', origin: 'SYSTEM_GENERATED' });
        primaryResult = { interaction_id: i.interaction_id, impact, audit_retained: sensitive };
        break;
      }
      case 'update_page_state': {
        const pg = needPage();
        const st = pg.states.find((x) => x.kind === p.state);
        if (!st) throw new Error(`State 不存在: ${p.state}`);
        st.description = p.description || st.description;
        st.updated_by = changeId;
        wf.flows.exception.push(`${p.state} 状态：${st.description}`);
        events.push({ id: st.state_id, view: 'PRD', action: 'update_page_state_section', detail: p.state, origin: 'SYSTEM_GENERATED' });
        primaryResult = { page_id: pg.prototype_page_id, state: p.state, description: st.description };
        break;
      }
      case 'add_feature': {
        const gateResult = gate(working, p);
        if (!gateResult.allowed) return { status: 'FAILED', errors: gateResult.checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`), gate: gateResult };
        const fid = p.feature_id;
        const domain = fid.split('-')[1];
        const nf = {
          feature_id: fid, name: p.name, domain, module: domain.toLowerCase(),
          status: p.status || 'NOT_IMPLEMENTED', priority: p.priority || 'P1', roles: p.roles || ['user'], kind: p.kind || 'form',
          evidence_note: p.evidence_note || null, status_note: p.status_note || null, open_decisions: p.open_decisions || [],
          background: { goal: p.prd.goal, problem: p.prd.problem || '', scenarios: [], boundaries: [], related: [] },
          user_stories: (p.stories || []).map(([role, action, goal]) => ({ role, action, goal, text: `作为${role}，我希望${action}，从而${goal}。` })),
          scope: { included: [], excluded: [], upstream: [], downstream: [] },
          flows: { normal: p.flows?.normal || [], exception: [], boundary: [], states: [], recovery: [], permissions: [] },
          requirements: [], prototype: { prototype_id: `PROTO-${fbase(fid)}`, primary_page_id: `PP-${fbase(fid)}-01`, pages: [], viewport_default: 'PC' },
          apis: [], data_models: [], acceptance: [], tests: [],
          evidence: { pages: [], apis: [], code: [], models: [], tests: [], note: null },
          prd: { prd_id: `PRD-${fbase(fid)}`, feature_id: fid, version: 1, path: `docs/product/prd/${domain.toLowerCase()}/${fid}.md`, status: 'ACTIVE', created_at: nowISO(), updated_at: nowISO(), sections: ['基础信息', '产品背景', '用户角色', '用户故事', '功能范围', '业务流程', '功能需求', '页面交互', 'API 和数据模型', '验收标准', '测试追溯', '版本变更'] },
          mapping: { requirement_to_page: {}, page_to_prd: {} },
          versions: { prd: 1, prototype: 1 }, sync_status: 'SYNCED', last_synced_at: nowISO(), last_change_source: 'Structured Model', audit_trail: [], updated_at: nowISO(),
        };
        p.prototype.pages.forEach((pp, i) => {
          const pid = `PP-${fbase(fid)}-${pad(i + 1)}`;
          nf.prototype.pages.push({
            prototype_page_id: pid, feature_id: fid, name: pp.name, entry: pp.entry || '', layout: pp.layout || 'detail',
            status: 'ACTIVE', planned: nf.status === 'NOT_IMPLEMENTED',
            demo_notice: 'DEMO / MOCK：仅使用合成数据。',
            requirement_ids: [], components: (pp.components || []).map((c, j) => ({ component_id: `CMP-${fbase(fid)}-${pad(i * 10 + j + 1)}`, type: c.type || 'input', label: c.label, name: c.name || null, input_type: c.input_type || 'text', required: !!c.required, options: [], action: c.action || null, trigger: null, state: null, props: c.props || {}, requirement_id: null, interaction_ids: [], status: 'ACTIVE' })),
            interactions: [], states: ['idle', 'loading', 'empty', 'error', 'success'].map((s, j) => ({ state_id: `ST-${fbase(fid)}-${pad(i + 1)}-${pad(j + 1)}`, name: s, kind: s, description: `${s} 状态。` })),
          });
          nf.mapping.page_to_prd[pid] = nf.prd.path;
        });
        (p.requirements || []).forEach((rq, i) => {
          const rid = `REQ-${fbase(fid)}-${pad(i + 1)}`;
          const pg = nf.prototype.pages[0];
          const q = {
            requirement_id: rid, feature_id: fid, title: rq.title, description: rq.description, priority: nf.priority, status: 'ACTIVE',
            entry: pg.entry, inputs: [], output: '操作结果', business_rules: [{ rule_id: `BR-${fbase(fid)}-${pad(i + 1)}`, requirement_id: rid, text: rq.rule || '按 PRD 定义的业务规则执行', value: null, field: null, status: 'ACTIVE' }],
            permission: nf.roles.join(', '), data_change: 'MOCK', error_messages: [], acceptance_ids: [], test_case_ids: [], prototype_page_ids: [pg.prototype_page_id], component_ids: pg.components.map((c) => c.component_id), interaction_ids: [], change_ids: [changeId],
          };
          nf.requirements.push(q);
          pg.requirement_ids.push(rid);
          pg.components.forEach((c) => { c.requirement_id = rid; });
          (p.acceptance || []).forEach((a, j) => {
            const aid = `AC-${fbase(fid)}-${pad(i * 5 + j + 1)}`;
            nf.acceptance.push({ acceptance_id: aid, feature_id: fid, requirement_id: rid, ...a, prototype_page_id: pg.prototype_page_id });
            q.acceptance_ids.push(aid);
          });
          const tid = `TC-${fbase(fid)}-${pad(i + 1)}`;
          nf.tests.push({ test_case_id: tid, feature_id: fid, requirement_id: rid, acceptance_ids: q.acceptance_ids, name: `${rid} 追溯测试`, path: p.test_path, kind: 'automated', status: 'ACTIVE', result: 'NOT_RUN' });
          q.test_case_ids.push(tid);
          nf.mapping.requirement_to_page[rid] = [pg.prototype_page_id];
        });
        working.features.push(nf);
        wf = nf; // 让下面的版本 / 映射 / 一致性检查覆盖新增 Feature
        primaryResult = { feature_id: fid, gate: gateResult };
        break;
      }
      default:
        throw new Error(`不支持的操作: ${ch.op}`);
    }
  } catch (e) {
    errors.push(e.message);
    return { status: 'FAILED', errors, change_id: changeId };
  }
  if (errors.length) return { status: 'FAILED', errors, change_id: changeId };

  // 统一规范化同步事件来源：未显式标注的派生事件一律视为 SYSTEM_GENERATED，
  // 保证 auto_sync / sync_event_count / 同步指标可正确区分「用户编辑」与「自动同步」。
  for (const ev of events) if (!ev.origin) ev.origin = 'SYSTEM_GENERATED';

  // 版本 / 映射 / 一致性 / 变更事件 / 快照
  const newVersion = model.model_version + 1;
  working.model_version = newVersion;
  working.updated_at = nowISO();
  working.mappings = buildMappings(working);
  if (wf) {
    wf.mapping.requirement_to_page = Object.fromEntries(wf.requirements.map((q) => [q.requirement_id, q.prototype_page_ids || []]));
    wf.mapping.page_to_prd = Object.fromEntries(wf.prototype.pages.map((pg) => [pg.prototype_page_id, wf.prd.path]));
    wf.versions = { prd: newVersion, prototype: newVersion };
    wf.prd.version = newVersion;
    wf.prd.updated_at = nowISO();
    wf.last_synced_at = nowISO();
    wf.last_change_source = ch.source_view;
    wf.updated_at = nowISO();
    const v = validate(working, wf.feature_id);
    wf.sync_status = v.errors.length ? 'NEEDS_REVIEW' : 'SYNCED';
    if (wf.sync_status === 'NEEDS_REVIEW') errors.push(...v.errors.map((e) => `${e.id}: ${e.name}`));
  }
  const sync_status = wf?.sync_status || 'SYNCED';
  const record = {
    change_id: changeId,
    feature_id: ch.feature_id,
    source_view: ch.source_view,
    source_type: ch.source_type || 'USER_EDIT',
    op: ch.op,
    requirement_id: p.requirement_id || primaryResult?.requirement_id || null,
    base_version: ch.base_version ?? model.model_version,
    target_version: newVersion,
    changed_fields: paths,
    impact_scope: { impacts, sync_event_count: events.filter((e) => e.origin === 'SYSTEM_GENERATED').length },
    sync_status,
    sync_events: events,
    reason: ch.reason || p.reason || '未提供修改原因',
    actor: ch.actor || 'unknown',
    created_at: nowISO(),
    payload: clone(ch.payload || {}),
    result: primaryResult,
    auto_sync: events.some((e) => e.origin === 'SYSTEM_GENERATED'),
  };
  working.changes.push(record);
  working.snapshots.push({ version: newVersion, created_at: nowISO(), reason: record.reason, change_id: changeId });
  if (ch.source_view === 'PRD' && sync_status === 'SYNCED') working.sync_metrics.prd_to_prototype_success += 1;
  if (ch.source_view === 'Prototype' && sync_status === 'SYNCED') working.sync_metrics.prototype_to_prd_success += 1;
  if (sync_status === 'FAILED') working.sync_metrics.failed += 1;
  // 自动同步事件不会被当作新的用户编辑：这里不递归 applyChange，也不追加用户变更事件。
  Object.assign(model, working);
  // 文件层投影同步：PRD / Prototype Markdown 由提交后的模型重新渲染，保证两侧文件内容同源。
  record.projections = syncProjections(model, ch.feature_id);
  let finalStatus = sync_status === 'NEEDS_REVIEW' ? 'NEEDS_REVIEW' : 'SYNCED';
  if (record.projections.error) {
    finalStatus = 'NEEDS_REVIEW';
    if (wf) wf.sync_status = 'NEEDS_REVIEW';
    record.sync_status = 'NEEDS_REVIEW';
    errors.push(`PROJECTION: ${record.projections.error}`);
  }
  writeModel(model);
  return {
    status: finalStatus,
    change_id: changeId,
    version: newVersion,
    result: primaryResult,
    sync_events: events,
    impacts,
    projections: record.projections,
    errors: finalStatus === 'NEEDS_REVIEW' ? errors : [],
    validation: validate(model, ch.feature_id),
  };
}

/* ───────────────────────── 冲突解决 ───────────────────────── */
export function resolveConflict(model, payload) {
  const c = model.conflicts.find((x) => x.conflict_id === payload.conflict_id && x.status === 'OPEN');
  if (!c) return { status: 'FAILED', errors: ['冲突不存在或已解决'] };
  const choice = payload.choice; // 'pending' | 'prior' | 'manual'
  if (!['pending', 'prior', 'manual'].includes(choice)) return { status: 'FAILED', errors: ['choice 必须为 pending / prior / manual'] };
  const baseVersion = model.model_version;
  let res = null;
  if (choice === 'prior') {
    // 已生效的一侧保持不变，拒绝冲突提交；双方修改都保留在冲突记录中。
    // 冲突解决本身是一次有效修改：生成新版本与快照，不复用旧版本，保证历史完整。
    model.model_version += 1;
    model.updated_at = nowISO();
    model.snapshots.push({ version: model.model_version, created_at: nowISO(), reason: `冲突解决（prior）：${payload.reason || '保留先提交一侧'}`, change_id: null, conflict_id: c.conflict_id });
    res = { status: 'SYNCED', change_id: null, version: model.model_version, note: '保留先提交一侧，冲突提交被显式拒绝（无静默覆盖）' };
  } else {
    let ch;
    if (choice === 'manual') ch = { ...c.pending, payload: payload.payload || c.pending.payload, source_view: 'Structured Model', reason: payload.reason || '人工合并解决冲突', actor: payload.actor || 'admin' };
    else ch = { ...clone(c.pending), reason: payload.reason || '采用待提交一侧的修改' };
    if (!ch.op) return { status: 'FAILED', errors: ['冲突记录缺少可重放的变更，请使用 manual 并提供 payload'] };
    ch.base_version = model.model_version;
    ch.change_id = newChangeId(model);
    res = applyChange(model, ch);
  }
  // applyChange() 会以 working 副本整体覆盖 model，此前取得的 c 引用可能已不在
  // model.conflicts 中。必须按 conflict_id 重新定位再写回，否则 manual / pending
  // 路径下冲突会永远停留 OPEN，导致门禁与同步状态无法收敛。
  const target = model.conflicts.find((x) => x.conflict_id === c.conflict_id) || c;
  target.status = 'RESOLVED';
  target.resolution = { choice, at: nowISO(), actor: payload.actor || 'admin', reason: payload.reason || '', result_change_id: res.change_id, result_status: res.status, preserved_both_sides: true };
  const f = model.features.find((x) => x.feature_id === c.feature_id);
  if (f) f.sync_status = res.status === 'SYNCED' ? 'SYNCED' : 'NEEDS_REVIEW';
  const record = {
    change_id: newChangeId(model), feature_id: c.feature_id, source_view: 'Structured Model',
    source_type: 'CONFLICT_RESOLUTION', op: 'resolve_conflict',
    base_version: baseVersion, target_version: model.model_version,
    changed_fields: [`conflict:${c.conflict_id}`], impact_scope: { conflict_id: c.conflict_id, choice },
    sync_status: target.resolution.result_status, sync_events: [],
    reason: `冲突解决（${choice}）: ${payload.reason || ''}`, actor: payload.actor || 'admin',
    created_at: nowISO(), conflict_id: c.conflict_id,
  };
  model.changes.push(record);
  record.projections = syncProjections(model, c.feature_id);
  writeModel(model);
  return { status: 'RESOLVED', conflict_id: c.conflict_id, resolution: c.resolution, replay: res, change_id: record.change_id };
}

/* ───────────────────────── 历史恢复 ───────────────────────── */
export function restoreVersion(model, payload) {
  const version = Number(payload.version);
  const snap = readSnapshot(version);
  const scope = payload.scope || 'model';
  const changeId = newChangeId(model);
  const preserved = {
    changes: clone(model.changes), conflicts: clone(model.conflicts),
    snapshots: clone(model.snapshots), sync_metrics: clone(model.sync_metrics),
    feature_id_tombstones: clone(model.feature_id_tombstones),
  };
  if (scope === 'feature' && payload.feature_id) {
    const oldFeature = snap.features.find((f) => f.feature_id === payload.feature_id);
    if (!oldFeature) return { status: 'FAILED', errors: [`快照 v${version} 中没有 ${payload.feature_id}`] };
    const idx = model.features.findIndex((f) => f.feature_id === payload.feature_id);
    model.features[idx] = clone(oldFeature);
  } else {
    model.features = clone(snap.features);
  }
  model.mappings = buildMappings(model);
  model.model_version += 1;
  model.updated_at = nowISO();
  Object.assign(model, preserved);
  model.features.forEach((f) => { f.sync_status = 'SYNCED'; f.last_synced_at = nowISO(); f.last_change_source = 'Structured Model'; });
  const v = validate(model);
  const record = {
    change_id: changeId, feature_id: payload.feature_id || 'ALL',
    source_view: 'Structured Model', source_type: 'RESTORE', op: 'restore_version',
    base_version: preserved.changes.length ? model.model_version - 1 : version,
    target_version: model.model_version,
    changed_fields: [`snapshot:v${version}:${scope}`],
    impact_scope: { scope, restored_version: version, features: model.features.length },
    sync_status: v.passed ? 'SYNCED' : 'NEEDS_REVIEW',
    sync_events: [
      { id: `v${version}`, view: 'PRD', action: 'restore', detail: 'PRD 视图由恢复后模型重新渲染', origin: 'SYSTEM_GENERATED' },
      { id: `v${version}`, view: 'Prototype', action: 'restore', detail: 'Prototype 视图由恢复后模型重新渲染', origin: 'SYSTEM_GENERATED' },
    ],
    reason: payload.reason || `恢复历史版本 v${version}`,
    actor: payload.actor || 'admin', created_at: nowISO(),
  };
  model.changes.push(record);
  model.snapshots.push({ version: model.model_version, created_at: nowISO(), reason: record.reason, change_id: changeId, restored_from: version });
  // 恢复会改写（可能全部）Feature，必须重渲染两侧投影，且保留全部历史变更。
  record.projections = syncAllProjections(model);
  writeModel(model);
  return { status: v.passed ? 'SYNCED' : 'NEEDS_REVIEW', change_id: changeId, version: model.model_version, restored_from: version, projections: record.projections, validation: v };
}

/* ───────────────────────── 同步状态 ───────────────────────── */
export function syncStatus(model, featureId) {
  const f = model.features.find((x) => x.feature_id === featureId);
  if (!f) return null;
  const last = [...model.changes].reverse().find((c) => c.feature_id === featureId);
  return {
    feature_id: featureId,
    status: f.sync_status,
    prd_version: f.versions.prd,
    prototype_version: f.versions.prototype,
    model_version: model.model_version,
    last_synced_at: f.last_synced_at,
    last_change_source: f.last_change_source,
    last_change_id: last?.change_id || null,
    open_conflicts: model.conflicts.filter((c) => c.feature_id === featureId && c.status === 'OPEN').length,
    review_flags: f.review_flags || [],
  };
}
