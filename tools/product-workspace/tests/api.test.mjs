/*
 * 自动化测试 · 产品规格中心 REST API（真实 HTTP，隔离模型副本）
 * 覆盖只读视图、写权限边界、变更、冲突、恢复、门禁与静态资源。
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadServer } from './helpers.mjs';

let ctx, srv, base;
const get = (p, opts = {}) => fetch(base + p, opts);
const post = (p, body, role = 'admin') => get(p, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(role ? { 'X-Uter-Role': role } : {}) },
  body: JSON.stringify(body),
});
const json = async (p, opts) => { const r = await get(p, opts); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const postJson = async (p, body, role) => { const r = await post(p, body, role); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const model = () => JSON.parse(fs.readFileSync(ctx.modelPath, 'utf8'));

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

describe('静态资源与健康检查', () => {
  test('GET /api/health 返回模型与设计系统基线', async () => {
    const { status, body } = await json('/api/health');
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.features, 56);
    assert.match(body.design_system, /3\.0/);
  });

  test('SPA 入口、脚本与样式可访问', async () => {
    for (const [p, type] of [['/', 'text/html'], ['/app.js', 'javascript'], ['/styles.css', 'text/css']]) {
      const r = await get(p);
      assert.equal(r.status, 200, `${p} 不可访问`);
      assert.ok((r.headers.get('content-type') || '').includes(type), `${p} Content-Type 错误`);
      assert.ok((await r.text()).length > 100);
    }
  });

  test('静态路径越界被拒绝', async () => {
    const r = await get('/../../engine.mjs');
    assert.ok([200, 403, 404].includes(r.status));
    const t = await r.text();
    assert.ok(!t.includes('applyChange(model'), '越界读取到了服务端源码');
  });
});

describe('只读模型视图', () => {
  test('功能列表、单功能详情、映射、覆盖率、变更、版本、冲突、同步状态', async () => {
    const checks = [
      ['/api/features', (b) => b.total === 56 && b.features.length === 56],
      ['/api/features/UTER-PAY-001', (b) => b.feature_id === 'UTER-PAY-001' && b.prd.sections.length === 12],
      ['/api/coverage', (b) => b.feature_total === 56 && b.metrics.prd_coverage_implemented === 100],
      ['/api/validate?files=1', (b) => b.passed === true && b.failed === 0],
      ['/api/mappings', (b) => b.total === 124],
      ['/api/changes', (b) => Array.isArray(b.changes)],
      ['/api/versions', (b) => b.current >= 1 && Array.isArray(b.snapshots)],
      ['/api/conflicts', (b) => Array.isArray(b.conflicts)],
      ['/api/sync-status?feature=UTER-PAY-001', (b) => b.feature_id === 'UTER-PAY-001' && b.status === 'SYNCED'],
      ['/api/model', (b) => b.source_of_truth === 'docs/product/registry/product-model.json'],
    ];
    for (const [p, check] of checks) {
      const { status, body } = await json(p);
      assert.equal(status, 200, `${p} 返回 ${status}`);
      assert.ok(check(body), `${p} 数据不符合预期: ${JSON.stringify(body).slice(0, 300)}`);
    }
  });

  test('不存在的 Feature 与缺少参数的请求返回 4xx', async () => {
    assert.equal((await json('/api/features/UTER-NOPE-999')).status, 404);
    assert.equal((await json('/api/sync-status')).status, 400);
    assert.equal((await json('/api/no-such-endpoint')).status, 404);
  });
});

describe('写权限边界', () => {
  test('普通用户写操作被拒绝（403），且不修改模型', async () => {
    const before = model().model_version;
    const r = await postJson('/api/change', { op: 'update_prd_section', feature_id: 'UTER-PAY-001', source_view: 'PRD', payload: { section: 'goal', value: '未授权修改' } }, 'viewer');
    assert.equal(r.status, 403);
    assert.match(r.body.error, /管理员角色/);
    assert.equal(model().model_version, before);
    const noRole = await postJson('/api/change', { op: 'update_prd_section', feature_id: 'UTER-PAY-001', source_view: 'PRD', payload: {} }, null);
    assert.equal(noRole.status, 403);
  });

  test('管理员写操作成功并递增版本', async () => {
    const before = model().model_version;
    const r = await postJson('/api/change', {
      op: 'add_requirement', feature_id: 'UTER-PAY-001', source_view: 'PRD', base_version: before,
      actor: 'admin', reason: 'API 自动化测试新增需求',
      payload: { title: 'API 测试需求', description: 'API 测试需求描述', input: { name: 'api_field', type: 'text', required: true }, rules: ['api_field 不得为空'] },
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.status, 'SYNCED');
    assert.equal(r.body.version, before + 1);
    assert.ok(r.body.sync_events.some((e) => e.origin === 'SYSTEM_GENERATED'));
    assert.equal(model().features.find((f) => f.feature_id === 'UTER-PAY-001').requirements.length, 4);
  });

  test('门禁接口可校验新增功能', async () => {
    const bad = await postJson('/api/gate', { feature_id: 'bad' });
    assert.equal(bad.status, 200);
    assert.equal(bad.body.decision, 'BLOCK');
    const good = await postJson('/api/gate', {
      feature_id: 'UTER-DEMO-001', prd: { goal: 'g' }, prototype: { pages: [{ name: 'p' }] },
      acceptance: [{ given: 'a', when: 'b', then: 'c' }], requirements: [{ title: 'r' }],
      test_path: 'tools/product-workspace/tests/api.test.mjs',
    });
    assert.equal(good.body.decision, 'ALLOW');
  });
});

describe('冲突与恢复接口', () => {
  test('跨视图同字段并发返回 409 CONFLICT，并可经接口解决', async () => {
    const m = model();
    const baseVersion = m.model_version;
    const f = m.features.find((x) => x.feature_id === 'UTER-PAY-001');
    const rule = f.requirements.flatMap((q) => q.business_rules).find((b) => b.field === 'min_amount');
    const a = await postJson('/api/change', { op: 'update_business_rule', feature_id: 'UTER-PAY-001', source_view: 'PRD', base_version: baseVersion, payload: { rule_id: rule.rule_id, text: 'PRD 20', value: 20 } });
    assert.equal(a.status, 200);
    const b = await postJson('/api/change', { op: 'update_component', feature_id: 'UTER-PAY-001', source_view: 'Prototype', base_version: baseVersion, payload: { component_id: 'CMP-PAY-001-03', props: { min: 50, rule_field: 'min_amount' } } });
    assert.equal(b.status, 409);
    assert.equal(b.body.status, 'CONFLICT');
    assert.equal(b.body.conflict.requires_product_decision, true);
    const resolved = await postJson('/api/conflicts/resolve', { conflict_id: b.body.conflict.conflict_id, choice: 'prior', reason: 'API 测试：保留先提交一侧', actor: 'admin' });
    assert.equal(resolved.status, 200);
    assert.equal(resolved.body.status, 'RESOLVED');
    assert.equal(model().conflicts.find((c) => c.conflict_id === b.body.conflict.conflict_id).status, 'RESOLVED');
  });

  test('恢复接口生成新版本并保留历史', async () => {
    const before = model();
    const res = await postJson('/api/restore', { version: 1, scope: 'model', reason: 'API 测试恢复基线', actor: 'admin' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'SYNCED');
    const after = model();
    assert.ok(after.model_version > before.model_version);
    assert.ok(after.changes.length > before.changes.length);
    assert.equal(after.features.find((f) => f.feature_id === 'UTER-PAY-001').requirements.length, 3);
  });
});
