/*
 * 自动化测试 · 双向同步引擎（隔离模型副本，不污染真实产品数据）
 * 覆盖 PRD→Prototype、Prototype→PRD、映射、版本、冲突、恢复、事务回滚、门禁、同步可靠性。
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadEngine, change } from './helpers.mjs';

let ctx;
const E = () => ctx.engine;
const M = () => ctx.engine.readModel();
const F = (id = 'UTER-PAY-001', m = M()) => m.features.find((f) => f.feature_id === id);
const RULE = (field, m = M()) => F('UTER-PAY-001', m).requirements.flatMap((q) => q.business_rules).find((b) => b.field === field);

beforeEach(async () => { ctx = await loadEngine(); });
afterEach(() => ctx.cleanup());

describe('PRD → Prototype 同步', () => {
  test('新增需求自动创建原型组件、交互、验收、测试与映射', () => {
    const m = M();
    const out = E().applyChange(m, change({
      op: 'add_requirement', feature_id: 'UTER-PAY-001', source_view: 'PRD', base_version: m.model_version,
      payload: {
        title: '支持自定义充值金额', description: '在充值页允许输入自定义金额并按最低金额校验。',
        input: { name: 'custom_amount', type: 'number', required: true },
        rules: [{ text: '自定义金额不得低于最低充值金额', field: 'min_amount', value: 20 }],
        output: 'MOCK 订单创建结果',
      },
    }));
    assert.equal(out.status, 'SYNCED', JSON.stringify(out.errors));
    assert.match(out.change_id, /^CHG-/);
    assert.equal(out.version, 2);
    assert.ok(out.sync_events.some((e) => e.origin === 'SYSTEM_GENERATED'));
    const f = F();
    const q = f.requirements.find((x) => x.title === '支持自定义充值金额');
    assert.ok(q, '需求未创建');
    assert.ok(q.prototype_page_ids.length > 0, '未映射到原型页面');
    const pg = f.prototype.pages.find((p) => p.prototype_page_id === q.prototype_page_ids[0]);
    assert.ok(pg.components.some((c) => c.requirement_id === q.requirement_id), '原型组件未创建');
    assert.ok(pg.interactions.some((i) => i.requirement_id === q.requirement_id), '原型交互未创建');
    assert.ok(q.acceptance_ids.length >= 3 && q.test_case_ids.length === 1, '验收/测试未补齐');
    assert.equal(q.component_ids[0], pg.components.find((c) => c.requirement_id === q.requirement_id).component_id);
    assert.ok(M().mappings.some((x) => x.requirement_id === q.requirement_id), '映射注册表未更新');
    assert.equal(M().sync_metrics.sync_loops, 0);
  });

  test('修改需求同步更新组件名称、校验提示与验收条件', () => {
    const m = M();
    const q = F('UTER-PAY-001', m).requirements[0];
    const cid = q.component_ids[0];
    const out = E().applyChange(m, change({
      op: 'update_requirement', feature_id: 'UTER-PAY-001', source_view: 'PRD', base_version: m.model_version,
      payload: { requirement_id: q.requirement_id, title: '预设充值金额（已修订）', description: '修订后的描述', rules: ['金额必须为可选预设值'] },
    }));
    assert.equal(out.status, 'SYNCED', JSON.stringify(out.errors));
    const f = F();
    const comp = f.prototype.pages.flatMap((p) => p.components).find((c) => c.component_id === cid);
    assert.equal(comp.label, '预设充值金额（已修订）');
    assert.equal(comp.props.error_message, '金额必须为可选预设值');
    assert.ok(f.acceptance.some((a) => a.requirement_id === q.requirement_id && a.when.includes('预设充值金额（已修订）')));
    assert.ok(f.tests.some((t) => t.requirement_id === q.requirement_id && t.result === 'NOT_RUN'));
  });

  test('修改业务规则同步原型 min、错误提示、边界验收与测试状态', () => {
    const m = M();
    const rule = RULE('min_amount', m);
    assert.ok(rule, '缺少 min_amount 业务规则');
    const out = E().applyChange(m, change({
      op: 'update_business_rule', feature_id: 'UTER-PAY-001', source_view: 'PRD', base_version: m.model_version,
      payload: { rule_id: rule.rule_id, text: '最低充值金额不得低于 20 元', value: 20 },
    }));
    assert.equal(out.status, 'SYNCED', JSON.stringify(out.errors));
    const f = F();
    assert.equal(RULE('min_amount').value, 20);
    const input = f.prototype.pages.flatMap((p) => p.components).find((c) => c.component_id === 'CMP-PAY-001-03');
    assert.equal(input.props.min, 20);
    assert.match(input.props.error_message, /20/);
    const alert = f.prototype.pages.flatMap((p) => p.components).find((c) => c.type === 'alert' && c.props?.rule_field === 'min_amount');
    assert.match(alert.label, /20/);
    assert.ok(f.acceptance.some((a) => a.type === 'boundary' && a.given.includes('20')));
    assert.ok(f.tests.some((t) => t.requirement_id === rule.requirement_id && t.result === 'NOT_RUN'));
    assert.ok(out.result.touched.length > 0);
  });

  test('修改验收标准同步原型状态说明', () => {
    const m = M();
    const a = F('UTER-PAY-001', m).acceptance.find((x) => x.type === 'exception');
    const out = E().applyChange(m, change({
      op: 'update_acceptance', feature_id: 'UTER-PAY-001', source_view: 'PRD', base_version: m.model_version,
      payload: { acceptance_id: a.acceptance_id, then: '展示 MOCK 错误状态并阻止下单' },
    }));
    assert.equal(out.status, 'SYNCED', JSON.stringify(out.errors));
    const f = F();
    const st = f.prototype.pages.find((p) => p.prototype_page_id === a.prototype_page_id).states.find((s) => s.kind === 'error');
    assert.match(st.description, /MOCK 错误状态/);
  });

  test('删除敏感域需求保留审计记录并失效原型元素', () => {
    const m = M();
    const q = F('UTER-PAY-001', m).requirements[1];
    const out = E().applyChange(m, change({
      op: 'delete_requirement', feature_id: 'UTER-PAY-001', source_view: 'PRD', base_version: m.model_version,
      payload: { requirement_id: q.requirement_id, reason: '产品确认下线该能力' }, reason: '产品确认下线该能力',
    }));
    assert.equal(out.status, 'SYNCED', JSON.stringify(out.errors));
    assert.equal(out.result.audit_retained, true);
    const f = F();
    assert.ok(f.requirements.some((x) => x.requirement_id === q.requirement_id && x.status === 'DEPRECATED'), '敏感域需求被物理删除');
    assert.ok(f.audit_trail.some((x) => x.action === 'DEPRECATE_REQUIREMENT'));
    assert.ok(f.prototype.pages.flatMap((p) => p.components).some((c) => c.status === 'DEPRECATED'));
    assert.ok(!M().mappings.some((x) => x.requirement_id === q.requirement_id), '废弃需求仍在映射注册表');
  });

  test('PRD 背景章节可编辑且写入统一模型', () => {
    const m = M();
    const out = E().applyChange(m, change({
      op: 'update_prd_section', feature_id: 'UTER-PAY-001', source_view: 'PRD', base_version: m.model_version,
      payload: { section: 'goal', value: '让用户安全完成 MOCK 充值下单' },
    }));
    assert.equal(out.status, 'SYNCED');
    assert.equal(F().background.goal, '让用户安全完成 MOCK 充值下单');
  });
});

describe('Prototype → PRD 同步', () => {
  test('新增组件自动创建需求、验收、测试，业务规则标 NEEDS_PRODUCT_DECISION', () => {
    const m = M();
    const out = E().applyChange(m, change({
      op: 'add_component', feature_id: 'UTER-PAY-001', source_view: 'Prototype', base_version: m.model_version,
      payload: { page_id: 'PP-PAY-001-01', type: 'select', label: '充值方式选择', name: 'payment_channel', props: { error_message: '请选择充值方式' } },
    }));
    assert.equal(out.status, 'SYNCED', JSON.stringify(out.errors));
    const f = F();
    const q = f.requirements.find((x) => x.requirement_id === out.result.requirement_id);
    assert.ok(q);
    assert.match(q.title, /充值方式选择/);
    assert.equal(q.business_rules[0].status, 'NEEDS_PRODUCT_DECISION');
    assert.ok(q.acceptance_ids.length >= 3 && q.test_case_ids.length === 1);
    assert.ok(f.review_flags.some((x) => x.includes('BUSINESS_RULE_REVIEW')));
    assert.ok(f.flows.normal.some((x) => x.includes('充值方式选择')));
    const pg = f.prototype.pages.find((p) => p.prototype_page_id === 'PP-PAY-001-01');
    assert.ok(pg.components.some((c) => c.component_id === out.result.component_id));
  });

  test('新增页面自动创建页面需求、占位组件并维持一致性检查通过', () => {
    const m = M();
    const out = E().applyChange(m, change({
      op: 'add_page', feature_id: 'UTER-PAY-001', source_view: 'Prototype', base_version: m.model_version,
      payload: { name: '充值结果详情页', layout: 'detail' },
    }));
    assert.equal(out.status, 'SYNCED', JSON.stringify(out.errors));
    const f = F();
    const pg = f.prototype.pages.find((p) => p.prototype_page_id === out.result.page_id);
    assert.ok(pg, '页面未创建');
    assert.ok(pg.components.length > 0, '新页面无组件，一致性检查会失败');
    assert.match(pg.components[0].label, /NEEDS_REVIEW/);
    assert.ok(f.requirements.some((q) => q.requirement_id === out.result.requirement_id && q.prototype_page_ids.includes(pg.prototype_page_id)));
    assert.ok(f.flows.normal.some((x) => x.includes('充值结果详情页')));
    assert.equal(f.mapping.page_to_prd[pg.prototype_page_id], f.prd.path);
    assert.equal(E().validate(M(), 'UTER-PAY-001').passed, true);
  });

  test('修改组件字段同步 PRD 字段说明、验收与测试状态', () => {
    const m = M();
    const q = F('UTER-PAY-001', m).requirements[1];
    const cid = q.component_ids[0] || 'CMP-PAY-001-03';
    const out = E().applyChange(m, change({
      op: 'update_component', feature_id: 'UTER-PAY-001', source_view: 'Prototype', base_version: m.model_version,
      payload: { component_id: cid, label: '自定义金额（原型修改）', props: { error_message: '自定义金额必须大于 0' } },
    }));
    assert.equal(out.status, 'SYNCED', JSON.stringify(out.errors));
    const f = F();
    const comp = f.prototype.pages.flatMap((p) => p.components).find((c) => c.component_id === cid);
    assert.equal(comp.label, '自定义金额（原型修改）');
    const rq = f.requirements.find((x) => x.requirement_id === comp.requirement_id);
    assert.match(rq.description, /PRD 字段说明由双向同步自动更新/);
    assert.ok(rq.error_messages.includes('自定义金额必须大于 0'));
    assert.ok(f.acceptance.some((a) => a.requirement_id === rq.requirement_id && a.when.includes('自定义金额（原型修改）')));
  });

  test('修改交互流程同步 PRD 主流程与恢复路径', () => {
    const m = M();
    const i = F('UTER-PAY-001', m).prototype.pages[0].interactions[0];
    const out = E().applyChange(m, change({
      op: 'update_interaction', feature_id: 'UTER-PAY-001', source_view: 'Prototype', base_version: m.model_version,
      payload: { interaction_id: i.interaction_id, action: 'select_preset_amount', steps: ['click:amount_preset', 'set_amount', 'show_confirm'] },
    }));
    assert.equal(out.status, 'SYNCED', JSON.stringify(out.errors));
    const f = F();
    assert.ok(f.flows.normal.includes('show_confirm'));
    assert.ok(f.requirements.find((q) => q.requirement_id === i.requirement_id)?.description.includes('show_confirm'));
  });

  test('修改页面状态同步 PRD 异常流程', () => {
    const m = M();
    const out = E().applyChange(m, change({
      op: 'update_page_state', feature_id: 'UTER-PAY-001', source_view: 'Prototype', base_version: m.model_version,
      payload: { page_id: 'PP-PAY-001-01', state: 'error', description: 'MOCK 上游超时，允许重试' },
    }));
    assert.equal(out.status, 'SYNCED', JSON.stringify(out.errors));
    assert.ok(F().flows.exception.some((x) => x.includes('MOCK 上游超时')));
  });

  test('删除组件 / 交互会做影响检查并同步 PRD', () => {
    const m = M();
    const cid = 'CMP-PAY-001-04';
    const out = E().applyChange(m, change({
      op: 'delete_component', feature_id: 'UTER-PAY-001', source_view: 'Prototype', base_version: m.model_version,
      payload: { component_id: cid, reason: '原型移除支付方式选择' }, reason: '原型移除支付方式选择',
    }));
    assert.equal(out.status, 'SYNCED', JSON.stringify(out.errors));
    assert.ok(out.result.impact);
    const f = F();
    assert.equal(f.prototype.pages.flatMap((p) => p.components).find((c) => c.component_id === cid).status, 'DEPRECATED');
    assert.ok(f.audit_trail.length > 0);

    const m2 = M();
    const iid = f.prototype.pages[0].interactions.find((x) => x.status !== 'DEPRECATED').interaction_id;
    const out2 = E().applyChange(m2, change({
      op: 'delete_interaction', feature_id: 'UTER-PAY-001', source_view: 'Prototype', base_version: m2.model_version,
      payload: { interaction_id: iid, reason: '交互下线' }, reason: '交互下线',
    }));
    assert.equal(out2.status, 'SYNCED', JSON.stringify(out2.errors));
    assert.ok(F().flows.exception.some((x) => x.includes(iid)));
  });
});

describe('新增功能强制门禁', () => {
  const fullPayload = () => ({
    feature_id: 'UTER-DEMO-001', name: '门禁验收功能', status: 'NOT_IMPLEMENTED', priority: 'P2',
    roles: ['user'], prd: { goal: '演示门禁完整链路', problem: '无' },
    prototype: { pages: [{ name: '演示页面', layout: 'detail', components: [{ type: 'input', label: '演示字段', name: 'demo_field', required: true, props: { error_message: '不得为空' } }] }] },
    acceptance: [{ type: 'normal', given: '用户进入页面', when: '填写演示字段', then: '展示 MOCK 结果' }],
    requirements: [{ title: '演示需求', description: '演示需求描述', rule: '演示字段不得为空' }],
    test_path: 'tools/product-workspace/tests/requirements-trace.test.mjs',
  });

  test('gate() 拒绝不合规的新增功能', () => {
    const g = E().gate(M(), { feature_id: 'BAD-ID' });
    assert.equal(g.allowed, false);
    assert.equal(g.decision, 'BLOCK');
    assert.ok(g.checks.filter((c) => !c.ok).length >= 5);
  });

  test('gate() 放行完整链路', () => {
    const g = E().gate(M(), fullPayload());
    assert.equal(g.allowed, true, JSON.stringify(g.checks.filter((c) => !c.ok)));
  });

  test('applyChange(add_feature) 未过门禁时整体失败且模型不变', () => {
    const m = M();
    const before = m.model_version;
    const out = E().applyChange(m, change({
      op: 'add_feature', feature_id: 'UTER-DEMO-001', source_view: 'Structured Model', base_version: before,
      payload: { feature_id: 'UTER-DEMO-001', name: '缺 PRD 的功能' },
    }));
    assert.equal(out.status, 'FAILED');
    assert.equal(M().model_version, before, '失败事务不应产生新版本');
    assert.equal(F('UTER-DEMO-001'), undefined);
  });

  test('applyChange(add_feature) 通过门禁后具备完整 PRD/原型/映射/验证', () => {
    const m = M();
    const out = E().applyChange(m, change({
      op: 'add_feature', feature_id: 'UTER-DEMO-001', source_view: 'Structured Model', base_version: m.model_version,
      payload: fullPayload(),
    }));
    assert.equal(out.status, 'SYNCED', JSON.stringify(out.errors));
    const nf = F('UTER-DEMO-001');
    assert.ok(nf);
    assert.equal(nf.prd.sections.length, 12);
    assert.equal(nf.versions.prd, out.version, '新增功能未纳入版本管理');
    assert.equal(nf.prd.version, out.version);
    assert.ok(nf.prototype.pages.length > 0 && nf.requirements.length > 0);
    assert.ok(M().mappings.some((x) => x.feature_id === 'UTER-DEMO-001'), '新增功能未建立映射');
    assert.equal(E().validate(M(), 'UTER-DEMO-001').passed, true);
  });
});

describe('冲突检测与版本管理', () => {
  test('跨视图修改同一语义字段被判定 CONFLICT，敏感域要求产品决策', () => {
    const m = M();
    const base = m.model_version;
    const rule = RULE('min_amount', m);
    const a = E().applyChange(m, change({
      op: 'update_business_rule', feature_id: 'UTER-PAY-001', source_view: 'PRD', base_version: base,
      payload: { rule_id: rule.rule_id, text: 'PRD 改为 20', value: 20 },
    }));
    assert.equal(a.status, 'SYNCED');
    const m2 = M();
    const b = E().applyChange(m2, change({
      op: 'update_component', feature_id: 'UTER-PAY-001', source_view: 'Prototype', base_version: base,
      payload: { component_id: 'CMP-PAY-001-03', props: { min: 50, error_message: '原型改为 50', rule_field: 'min_amount' } },
    }));
    assert.equal(b.status, 'CONFLICT');
    assert.ok(b.conflict.overlapping_fields.some((x) => x.includes('min_amount')), JSON.stringify(b.conflict.overlapping_fields));
    assert.equal(b.conflict.requires_product_decision, true);
    assert.equal(b.conflict.prd_side.op, 'update_business_rule');
    assert.equal(b.conflict.prototype_side.op, 'update_component');
    assert.ok(b.conflict.prior_change, '冲突记录必须保留先提交变更');
    assert.equal(F().sync_status, 'CONFLICT');
    assert.equal(M().sync_metrics.silent_overwrites, 0);
  });

  test('不同字段的并发修改自动合并，不产生冲突', () => {
    const m = M();
    const base = m.model_version;
    const rule = RULE('min_amount', m);
    const a = E().applyChange(m, change({
      op: 'update_business_rule', feature_id: 'UTER-PAY-001', source_view: 'PRD', base_version: base,
      payload: { rule_id: rule.rule_id, text: 'PRD 改为 20', value: 20 },
    }));
    const m2 = M();
    const ac = F('UTER-PAY-001', m2).acceptance[0];
    const b = E().applyChange(m2, change({
      op: 'update_acceptance', feature_id: 'UTER-PAY-001', source_view: 'PRD', base_version: base,
      payload: { acceptance_id: ac.acceptance_id, then: '不同字段：展示 MOCK 成功状态' },
    }));
    assert.equal(a.status, 'SYNCED');
    assert.equal(b.status, 'SYNCED');
    assert.equal(RULE('min_amount').value, 20, '先提交的字段修改丢失');
    assert.equal(F().acceptance.find((x) => x.acceptance_id === ac.acceptance_id).then, '不同字段：展示 MOCK 成功状态');
    assert.equal(M().conflicts.length, 0);
  });

  test('解决冲突（保留先提交一侧）生成新版本且双方修改都保留', () => {
    const m = M();
    const base = m.model_version;
    const rule = RULE('min_amount', m);
    E().applyChange(m, change({ op: 'update_business_rule', feature_id: 'UTER-PAY-001', source_view: 'PRD', base_version: base, payload: { rule_id: rule.rule_id, text: 'PRD 20', value: 20 } }));
    const m2 = M();
    const b = E().applyChange(m2, change({ op: 'update_component', feature_id: 'UTER-PAY-001', source_view: 'Prototype', base_version: base, payload: { component_id: 'CMP-PAY-001-03', props: { min: 50, rule_field: 'min_amount' } } }));
    assert.equal(b.status, 'CONFLICT');
    const beforeResolve = M().model_version;
    const out = E().resolveConflict(M(), { conflict_id: b.conflict.conflict_id, choice: 'prior', reason: '产品决定保留先提交一侧', actor: 'admin' });
    assert.equal(out.status, 'RESOLVED');
    const after = M();
    assert.ok(after.model_version > beforeResolve, '冲突解决未生成新版本');
    assert.equal(after.conflicts.find((c) => c.conflict_id === b.conflict.conflict_id).status, 'RESOLVED');
    assert.equal(after.conflicts.find((c) => c.conflict_id === b.conflict.conflict_id).resolution.preserved_both_sides, true);
    assert.equal(RULE('min_amount', after).value, 20, '先提交一侧被覆盖');
    assert.equal(after.sync_metrics.silent_overwrites, 0);
    assert.ok(after.changes.some((c) => c.source_type === 'CONFLICT_RESOLUTION'));
    assert.ok(fs.existsSync(path.join(ctx.historyDir, `v${after.model_version}.json`)), '冲突解决未写快照');
  });

  test('人工合并冲突按产品决策生效', () => {
    const m = M();
    const base = m.model_version;
    const rule = RULE('min_amount', m);
    E().applyChange(m, change({ op: 'update_business_rule', feature_id: 'UTER-PAY-001', source_view: 'PRD', base_version: base, payload: { rule_id: rule.rule_id, text: 'PRD 20', value: 20 } }));
    const m2 = M();
    const b = E().applyChange(m2, change({ op: 'update_component', feature_id: 'UTER-PAY-001', source_view: 'Prototype', base_version: base, payload: { component_id: 'CMP-PAY-001-03', props: { min: 50, rule_field: 'min_amount' } } }));
    const out = E().resolveConflict(M(), {
      conflict_id: b.conflict.conflict_id, choice: 'manual', reason: '产品确认 30 元', actor: 'admin',
      payload: { component_id: 'CMP-PAY-001-03', props: { min: 30, error_message: '人工确认：金额不得低于 30 元', rule_field: 'min_amount' } },
    });
    assert.equal(out.status, 'RESOLVED');
    const comp = F().prototype.pages.flatMap((p) => p.components).find((c) => c.component_id === 'CMP-PAY-001-03');
    assert.equal(comp.props.min, 30, '人工合并值未生效');
    assert.match(comp.props.error_message, /30/);
  });

  test('历史恢复生成新变更事件、保留全部历史并写入快照', () => {
    const m = M();
    const out1 = E().applyChange(m, change({
      op: 'add_requirement', feature_id: 'UTER-PAY-001', source_view: 'PRD', base_version: m.model_version,
      payload: { title: '临时需求', description: '临时需求描述', input: { name: 'tmp', type: 'text', required: true }, rules: ['临时规则'] },
    }));
    assert.equal(out1.status, 'SYNCED');
    const before = M();
    // restoreVersion 与 applyChange 一样会在原对象上提交事务，因此基线值必须先快照，
    // 否则 before 会被原地更新，导致「版本是否递增」的比较恒为 false。
    const baseVersion = before.model_version;
    const changesBefore = before.changes.length;
    assert.equal(before.features.find((f) => f.feature_id === 'UTER-PAY-001').requirements.length, 4);
    const res = E().restoreVersion(before, { version: 1, scope: 'model', reason: '恢复初始基线', actor: 'admin' });
    assert.equal(res.status, 'SYNCED', JSON.stringify(res.validation?.errors));
    const after = M();
    assert.equal(after.features.find((f) => f.feature_id === 'UTER-PAY-001').requirements.length, 3, '恢复未生效');
    assert.equal(after.model_version, baseVersion + 1, '恢复未生成新版本');
    assert.ok(after.changes.length > changesBefore, '恢复覆盖了历史变更');
    assert.ok(after.changes.some((c) => c.source_type === 'RESTORE'));
    assert.ok(fs.existsSync(path.join(ctx.historyDir, `v${after.model_version}.json`)));
    assert.equal(E().validate(after).passed, true);
  });
});

describe('同步可靠性与事务性', () => {
  test('自动同步不产生新的用户编辑事件，synloops / silent_overwrites 为 0', () => {
    const m = M();
    E().applyChange(m, change({
      op: 'add_component', feature_id: 'UTER-PAY-001', source_view: 'Prototype', base_version: m.model_version,
      payload: { page_id: 'PP-PAY-001-01', type: 'input', label: '备注', name: 'remark' },
    }));
    const after = M();
    assert.equal(after.sync_metrics.sync_loops, 0);
    assert.equal(after.sync_metrics.silent_overwrites, 0);
    assert.ok(after.changes.every((c) => c.source_type !== 'SYSTEM_GENERATED'), '自动同步被误记为用户编辑');
    assert.equal(after.changes.filter((c) => c.source_type === 'USER_EDIT').length, 1);
    const rec = after.changes.find((c) => c.source_type === 'USER_EDIT');
    assert.ok(rec.sync_events.some((e) => e.origin === 'SYSTEM_GENERATED'));
    assert.equal(rec.auto_sync, true);
    assert.ok(rec.changed_fields.length > 0 && rec.base_version !== undefined && rec.target_version > rec.base_version);
  });

  test('失败变更整体回滚，不写半成品、不递增版本', () => {
    const m = M();
    const before = fs.readFileSync(ctx.modelPath, 'utf8');
    const out = E().applyChange(m, change({
      op: 'update_requirement', feature_id: 'UTER-PAY-001', source_view: 'PRD', base_version: m.model_version,
      payload: { requirement_id: 'REQ-NOT-EXIST', title: '不存在' },
    }));
    assert.equal(out.status, 'FAILED');
    assert.ok(out.errors.length > 0);
    assert.equal(fs.readFileSync(ctx.modelPath, 'utf8'), before, '失败事务修改了模型文件');
    assert.equal(M().model_version, 1);
  });

  test('未知 Source View 与专用接口误用被拒绝', () => {
    const m = M();
    assert.equal(E().applyChange(m, change({ op: 'update_prd_section', feature_id: 'UTER-PAY-001', source_view: 'Unknown', payload: {} })).status, 'FAILED');
    assert.equal(E().applyChange(m, change({ op: 'restore_version', feature_id: 'UTER-PAY-001', source_view: 'Structured Model' })).status, 'FAILED');
  });

  test('每次有效变更都有唯一 Change ID、快照与可追溯字段', () => {
    const m = M();
    const a = E().applyChange(m, change({ op: 'update_prd_section', feature_id: 'UTER-AUTH-001', source_view: 'PRD', base_version: m.model_version, payload: { section: 'goal', value: 'A' } }));
    const b = E().applyChange(M(), change({ op: 'update_prd_section', feature_id: 'UTER-AUTH-001', source_view: 'PRD', base_version: a.version, payload: { section: 'problem', value: 'B' } }));
    const after = M();
    assert.notEqual(a.change_id, b.change_id);
    assert.equal(new Set(after.changes.map((c) => c.change_id)).size, after.changes.length);
    assert.ok(fs.existsSync(path.join(ctx.historyDir, `v${a.version}.json`)));
    assert.ok(fs.existsSync(path.join(ctx.historyDir, `v${b.version}.json`)));
    assert.equal(E().validate(after).passed, true);
    assert.equal(E().coverage(after).metrics.change_traceability, 100);
  });
});
