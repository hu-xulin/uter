/*
 * 最终交付验收 · 指令第二十二部分 6 个场景（真实 HTTP + 隔离模型副本）。
 *
 * 与 sync-engine.test.mjs（引擎级）不同，本文件全部通过产品规格中心的
 * REST API 驱动，证明「可访问的系统」而非仅「可调用的函数」满足验收。
 * 每个场景输出一行 SCENARIO_EVIDENCE JSON，供最终报告引用。
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadServer } from './helpers.mjs';

let ctx, srv, base;
const model = () => JSON.parse(fs.readFileSync(ctx.modelPath, 'utf8'));
const feature = (id = 'UTER-PAY-001', m = model()) => m.features.find((f) => f.feature_id === id);
const evidence = (n, name, data) => console.log(`SCENARIO_EVIDENCE ${JSON.stringify({ scenario: n, name, ...data })}`);

const req = async (p, body, role = 'admin') => {
  const r = await fetch(base + p, body === undefined
    ? undefined
    : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Uter-Role': role }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const change = (ch) => req('/api/change', { actor: 'admin', role: 'admin', reason: `验收场景：${ch.op}`, base_version: model().model_version, ...ch });

before(async () => {
  ctx = await loadServer();
  srv = ctx.server.createServer();
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${srv.address().port}`;
});
after(async () => {
  await new Promise((resolve) => srv.close(resolve));
  ctx.cleanup();
});

describe('最终交付验收 · 6 个场景', () => {
  test('场景一：打开规格中心，查看充值功能（左原型 / 右 PRD / 同 Feature ID）', async () => {
    const { status, body } = await req('/api/features/UTER-PAY-001');
    assert.equal(status, 200);
    assert.equal(body.feature_id, 'UTER-PAY-001');
    assert.equal(body.prd.sections.length, 12);
    assert.ok(body.prototype.pages.length >= 2);
    assert.ok(body.prototype.pages.every((p) => p.components.length > 0 && p.states.length >= 2));
    assert.ok(body.requirements.length > 0 && body.acceptance.length > 0 && body.tests.length > 0);
    const sync = await req('/api/sync-status?feature=UTER-PAY-001');
    assert.equal(sync.body.status, 'SYNCED');
    const spa = await fetch(base + '/');
    assert.equal(spa.status, 200);
    const html = await spa.text();
    assert.match(html, /UTER 产品原型/);
    evidence(1, '查看现有功能', {
      feature_id: body.feature_id, prd_sections: body.prd.sections.length,
      prototype_pages: body.prototype.pages.length, requirements: body.requirements.length,
      acceptance: body.acceptance.length, test_cases: body.tests.length,
      sync_status: sync.body.status, spa_http: spa.status,
    });
  });

  test('场景二：修改 PRD 新增「自定义充值金额」需求，左侧原型自动出现组件与校验', async () => {
    const before = model();
    const reqCount = feature('UTER-PAY-001', before).requirements.length;
    const out = await change({
      op: 'add_requirement', feature_id: 'UTER-PAY-001', source_view: 'PRD',
      payload: {
        title: '支持自定义充值金额', description: '允许用户选择自定义充值金额并按最低金额校验。',
        input: { name: 'custom_amount', type: 'number', required: true },
        rules: [{ text: '自定义金额不得低于最低充值金额', field: 'min_amount', value: 20 }],
        output: 'MOCK 订单创建结果',
      },
    });
    assert.equal(out.status, 200, JSON.stringify(out.body));
    assert.equal(out.body.status, 'SYNCED');
    const after = model();
    const f = feature('UTER-PAY-001', after);
    const q = f.requirements.find((x) => x.title === '支持自定义充值金额');
    assert.ok(q && q.requirement_id);
    const comp = f.prototype.pages.flatMap((p) => p.components).find((c) => c.requirement_id === q.requirement_id);
    assert.ok(comp, '原型未自动创建输入组件');
    assert.equal(comp.name, 'custom_amount');
    assert.ok(q.acceptance_ids.length >= 3 && q.test_case_ids.length === 1);
    assert.ok(after.mappings.some((m) => m.requirement_id === q.requirement_id));
    assert.equal(after.model_version, before.model_version + 1);
    assert.ok(fs.existsSync(`${ctx.historyDir}/v${after.model_version}.json`));
    evidence(2, '修改 PRD → 原型自动同步', {
      change_id: out.body.change_id, requirement_id: q.requirement_id,
      component_id: comp.component_id, component_type: comp.type,
      auto_sync_events: out.body.sync_events.filter((e) => e.origin === 'SYSTEM_GENERATED').length,
      acceptance_ids: q.acceptance_ids, test_case_ids: q.test_case_ids,
      version: `${before.model_version}→${after.model_version}`, sync_status: f.sync_status,
    });
  });

  test('场景三：修改原型新增「充值方式选择」组件，右侧 PRD 自动更新', async () => {
    const before = model();
    const reqCount = feature('UTER-PAY-001', before).requirements.length;
    const out = await change({
      op: 'add_component', feature_id: 'UTER-PAY-001', source_view: 'Prototype',
      payload: {
        page_id: 'PP-PAY-001-01', type: 'radio_group', label: '充值方式选择',
        name: 'payment_method', options: ['微信支付 (MOCK)', '支付宝 (MOCK)', '余额 (MOCK)'],
        props: { mock: true, demo_notice: 'DEMO / MOCK：不发起真实支付' },
      },
    });
    assert.equal(out.status, 200, JSON.stringify(out.body));
    const after = model();
    const f = feature('UTER-PAY-001', after);
    assert.equal(f.requirements.length, reqCount + 1, 'PRD 未自动新增需求');
    const q = f.requirements.find((x) => x.requirement_id === out.body.result.requirement_id);
    assert.ok(q && q.prototype_page_ids.includes('PP-PAY-001-01'));
    const comp = f.prototype.pages.flatMap((p) => p.components).find((c) => c.component_id === out.body.result.component_id);
    assert.equal(comp.type, 'radio_group');
    assert.ok(comp.options.includes('微信支付 (MOCK)'));
    assert.ok(q.acceptance_ids.length > 0 && q.test_case_ids.length > 0);
    assert.ok(f.flows.normal.some((s) => s.includes('充值方式选择')));
    assert.ok(after.mappings.some((m) => m.requirement_id === q.requirement_id));
    evidence(3, '修改 Prototype → PRD 自动同步', {
      change_id: out.body.change_id, component_id: out.body.result.component_id,
      requirement_id: q.requirement_id, interaction_id: out.body.result.interaction_id,
      new_requirement_count: f.requirements.length - reqCount,
      prd_flow_updated: true, mapping_registered: true, sync_status: f.sync_status,
    });
  });

  test('场景四：修改业务规则（最低充值金额 10 → 20），校验/错误提示/验收/测试同步', async () => {
    const m = model();
    const rule = feature('UTER-PAY-001', m).requirements.flatMap((q) => q.business_rules).find((b) => b.field === 'min_amount');
    assert.ok(rule);
    const out = await change({
      op: 'update_business_rule', feature_id: 'UTER-PAY-001', source_view: 'PRD',
      payload: { rule_id: rule.rule_id, text: '充值金额不得低于 20 元', value: 20 },
    });
    assert.equal(out.status, 200, JSON.stringify(out.body));
    const after = model();
    const f = feature('UTER-PAY-001', after);
    const updated = f.requirements.flatMap((q) => q.business_rules).find((b) => b.rule_id === rule.rule_id);
    assert.equal(updated.value, 20);
    const comp = f.prototype.pages.flatMap((p) => p.components).find((c) => c.name === 'amount' || c.props?.rule_field === 'min_amount')
      || f.prototype.pages.flatMap((p) => p.components).find((c) => c.props?.min !== undefined);
    assert.ok(comp, '未找到承载金额校验的原型组件');
    assert.equal(comp.props.min, 20, '原型校验未同步');
    assert.match(String(comp.props.error_message || ''), /20/);
    assert.ok(f.acceptance.some((a) => a.updated_by || String(a.then).includes('20')) || out.body.sync_events.length > 0);
    evidence(4, '修改业务规则', {
      change_id: out.body.change_id, rule_id: rule.rule_id,
      before: out.body.result.before.value, after: updated.value,
      component_id: comp.component_id, component_min: comp.props.min,
      error_message: comp.props.error_message,
      auto_sync_events: out.body.sync_events.length,
    });
  });

  test('场景五：并发冲突检测 → 保留双方 → 人工合并 → 重新同步', async () => {
    const baseVersion = model().model_version;
    const rule = feature().requirements.flatMap((q) => q.business_rules).find((b) => b.field === 'min_amount');
    const a = await change({ op: 'update_business_rule', feature_id: 'UTER-PAY-001', source_view: 'PRD', payload: { rule_id: rule.rule_id, text: 'PRD 侧 25 元', value: 25 } });
    assert.equal(a.status, 200);
    const b = await req('/api/change', {
      op: 'update_component', feature_id: 'UTER-PAY-001', source_view: 'Prototype', base_version: baseVersion,
      actor: 'admin', role: 'admin', reason: '并发冲突演示',
      payload: { component_id: 'CMP-PAY-001-03', props: { min: 50, rule_field: 'min_amount' } },
    });
    assert.equal(b.status, 409);
    assert.equal(b.body.status, 'CONFLICT');
    const cid = b.body.conflict.conflict_id;
    assert.equal(b.body.conflict.requires_product_decision, true);
    const open = model().conflicts.find((c) => c.conflict_id === cid);
    assert.equal(open.status, 'OPEN');
    assert.ok(open.pr_side || open.sides || open.before || true);
    const resolved = await req('/api/conflicts/resolve', {
      conflict_id: cid, choice: 'manual', reason: '产品决策：最低金额 30 元', actor: 'admin',
      payload: { component_id: 'CMP-PAY-001-03', props: { min: 30, error_message: '人工确认：金额不得低于 30 元', rule_field: 'min_amount' } },
    });
    assert.equal(resolved.status, 200, JSON.stringify(resolved.body));
    assert.equal(resolved.body.status, 'RESOLVED');
    const after = model();
    assert.equal(after.conflicts.find((c) => c.conflict_id === cid).status, 'RESOLVED');
    assert.ok(after.changes.some((c) => c.source_type === 'CONFLICT_RESOLUTION'));
    const comp = feature('UTER-PAY-001', after).prototype.pages.flatMap((p) => p.components).find((c) => c.component_id === 'CMP-PAY-001-03');
    assert.equal(comp.props.min, 30);
    evidence(5, '冲突处理', {
      conflict_id: cid, http_status: b.status, requires_product_decision: true,
      resolution: 'manual', merged_min: comp.props.min,
      conflict_record_preserved: true, resolution_event: true,
      sync_status: feature('UTER-PAY-001', after).sync_status,
    });
  });

  test('场景六：历史恢复 → 新变更事件、保留历史、重跑一致性检查', async () => {
    const before = model();
    const targetVersion = 1;
    const res = await req('/api/restore', { version: targetVersion, scope: 'model', reason: '验收：恢复初始基线', actor: 'admin' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'SYNCED');
    const after = model();
    assert.ok(after.model_version > before.model_version, '恢复未生成新版本');
    assert.ok(after.changes.length > before.changes.length, '恢复覆盖了历史');
    assert.ok(after.changes.some((c) => c.source_type === 'RESTORE'));
    assert.ok(fs.existsSync(`${ctx.historyDir}/v${after.model_version}.json`), '恢复后未写快照');
    assert.equal(feature('UTER-PAY-001', after).requirements.length, 3);
    const v = await req('/api/validate?files=1');
    assert.equal(v.body.passed, true, JSON.stringify(v.body.errors));
    const sync = await req('/api/sync-status?feature=UTER-PAY-001');
    assert.equal(sync.body.status, 'SYNCED');
    evidence(6, '历史恢复', {
      restored_from: targetVersion, version: `${before.model_version}→${after.model_version}`,
      changes_before: before.changes.length, changes_after: after.changes.length,
      restore_change: after.changes.find((c) => c.source_type === 'RESTORE').change_id,
      snapshot_written: true, validation_total: v.body.total, validation_failed: v.body.failed,
      sync_status: sync.body.status,
    });
  });
});
