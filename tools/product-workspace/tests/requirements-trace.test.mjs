/*
 * 自动化测试 · 功能目录 / PRD / 原型 / 映射 / 注册表 / 追溯矩阵
 * 只读真实模型与真实文件，任何断言失败都代表交付物不完整。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, REAL_MODEL } from './helpers.mjs';

const require = createRequire(import.meta.url);
const yaml = require(path.join(ROOT, 'web/node_modules/js-yaml'));
const model = JSON.parse(fs.readFileSync(REAL_MODEL, 'utf8'));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const PRD_SECTIONS = ['基础信息', '产品背景', '用户角色', '用户故事', '功能范围', '业务流程', '功能需求', '页面交互', 'API 和数据模型', '验收标准', '测试追溯', '版本变更'];

describe('功能目录与 Feature ID', () => {
  test('模型是 v1+ 且声明了唯一事实源', () => {
    assert.ok(model.model_version >= 1);
    assert.equal(model.source_of_truth, 'docs/product/registry/product-model.json');
    assert.equal(model.design_system, 'docs/design-system/UTER-DESIGN-SYSTEM-3.0.md');
    assert.ok(!JSON.stringify(model.design_system).includes('2.1'));
  });

  test('56 项功能 ID 格式合法且全局唯一', () => {
    assert.equal(model.features.length, 56);
    const ids = model.features.map((f) => f.feature_id);
    for (const id of ids) assert.match(id, /^UTER-[A-Z]+-\d{3}$/);
    assert.equal(new Set(ids).size, ids.length);
  });

  test('状态只允许规定枚举，且状态说明真实存在', () => {
    const allowed = new Set(['IMPLEMENTED', 'PARTIALLY_IMPLEMENTED', 'FRONTEND_ONLY', 'BACKEND_ONLY', 'DOCUMENTED_ONLY', 'NOT_IMPLEMENTED', 'UNKNOWN']);
    for (const f of model.features) {
      assert.ok(allowed.has(f.status), `${f.feature_id} 状态非法: ${f.status}`);
      if (f.status === 'BACKEND_ONLY' || f.status === 'PARTIALLY_IMPLEMENTED' || f.status === 'NOT_IMPLEMENTED') {
        assert.ok((f.evidence.apis.length + f.evidence.code.length + f.evidence.pages.length) > 0 || f.status_note, `${f.feature_id} 缺少状态证据`);
      }
    }
  });

  test('功能目录覆盖全部 Feature ID 并含 14 类字段', () => {
    const cat = read('docs/product/PRODUCT-FEATURE-CATALOG.md');
    for (const f of model.features) assert.ok(cat.includes(f.feature_id), `目录缺少 ${f.feature_id}`);
    for (const h of ['Feature ID', '功能名称', '业务模块', '用户角色', '实现状态', '页面路径', 'API 路径', '数据模型', 'PRD 路径', '原型路径', '测试路径', '优先级', '验收状态', '证据来源']) {
      assert.ok(cat.includes(h), `目录缺少列 ${h}`);
    }
    assert.ok(cat.includes('UNKNOWN'), '目录必须说明 UNKNOWN 口径');
  });

  test('NOT_IMPLEMENTED 仅建规划原型，不冒充已上线', () => {
    for (const f of model.features.filter((x) => x.status === 'NOT_IMPLEMENTED')) {
      assert.ok(f.prototype.pages.every((p) => p.planned), `${f.feature_id} 规划页面未标记 planned`);
      const md = read(`docs/product/prototypes/${f.domain.toLowerCase()}/${f.feature_id}.md`);
      assert.ok(md.includes('规划原型') || md.includes('PLANNED'));
      assert.ok(read(f.prd.path).includes('NOT_IMPLEMENTED'));
    }
  });
});

describe('PRD 体系', () => {
  test('每项功能都有真实 PRD 文件且具备完整 12 章节', () => {
    for (const f of model.features) {
      assert.ok(exists(f.prd.path), `缺少 ${f.prd.path}`);
      const md = read(f.prd.path);
      for (let i = 0; i < PRD_SECTIONS.length; i++) {
        assert.ok(md.includes(`## ${i + 1}. ${PRD_SECTIONS[i]}`), `${f.prd.path} 缺少章节 ${i + 1} ${PRD_SECTIONS[i]}`);
      }
      assert.ok(md.includes('禁止直接手工编辑'), `${f.prd.path} 缺少 SSOT 声明`);
      assert.ok(md.includes('Given'), `${f.prd.path} 缺少 Given/When/Then`);
    }
  });

  test('PRD 中的业务规则、验收标准、测试追溯均来自模型', () => {
    for (const f of model.features) {
      const md = read(f.prd.path);
      for (const q of f.requirements) assert.ok(md.includes(q.requirement_id), `${f.prd.path} 缺少 ${q.requirement_id}`);
      for (const a of f.acceptance) assert.ok(md.includes(a.acceptance_id), `${f.prd.path} 缺少 ${a.acceptance_id}`);
      for (const t of f.tests) assert.ok(md.includes(t.test_case_id), `${f.prd.path} 缺少 ${t.test_case_id}`);
      assert.ok(f.requirements.every((q) => q.business_rules.length > 0));
      assert.ok(f.acceptance.every((a) => a.given && a.when && a.then));
    }
  });
});

describe('Prototype 体系', () => {
  test('每项功能都有原型说明文件且标注 DEMO / MOCK', () => {
    for (const f of model.features) {
      const rel = `docs/product/prototypes/${f.domain.toLowerCase()}/${f.feature_id}.md`;
      assert.ok(exists(rel), `缺少 ${rel}`);
      const md = read(rel);
      assert.match(md, /DEMO \/ MOCK|DEMO|MOCK/);
      for (const p of f.prototype.pages) assert.ok(md.includes(p.prototype_page_id), `${rel} 缺少 ${p.prototype_page_id}`);
    }
  });

  test('每个页面具备状态集合、组件、按钮行为与有效跳转', () => {
    for (const f of model.features) {
      for (const p of f.prototype.pages) {
        assert.ok(p.states.length >= 2, `${p.prototype_page_id} 状态不足`);
        assert.ok(p.components.length > 0, `${p.prototype_page_id} 无组件`);
        for (const c of p.components.filter((x) => x.type === 'button')) assert.ok(c.action, `${c.component_id} 按钮无行为`);
        for (const i of p.interactions) {
          if (i.target_page_id) assert.ok(f.prototype.pages.some((x) => x.prototype_page_id === i.target_page_id), `${i.interaction_id} 跳转越界`);
        }
      }
    }
  });

  test('必填输入都有校验提示或数值边界', () => {
    for (const f of model.features) {
      for (const p of f.prototype.pages) {
        for (const c of p.components.filter((x) => x.type === 'input' && x.required)) {
          assert.ok(c.props?.error_message || c.props?.min !== undefined || c.input_type, `${c.component_id} 缺少校验`);
        }
      }
    }
  });
});

describe('映射注册表与追溯', () => {
  test('5 类 YAML 注册表可解析且条目数与模型一致', () => {
    const load = (n) => yaml.load(read(`docs/product/registry/${n}.yaml`));
    const fr = load('feature-registry');
    assert.equal(fr.total, model.features.length);
    assert.equal(fr.features.length, model.features.length);
    assert.equal(load('requirement-registry').total, model.features.reduce((n, f) => n + f.requirements.length, 0));
    assert.equal(load('prototype-registry').total_pages, model.features.reduce((n, f) => n + f.prototype.pages.length, 0));
    const fm = load('feature-mapping');
    assert.equal(fm.total, model.mappings.length);
    assert.equal(fm.mappings.length, model.mappings.length);
    assert.ok(load('change-registry'));
  });

  test('映射完整、无重复、无孤立、无跨 Feature 关联', () => {
    const activeReqs = model.features.flatMap((f) => f.requirements.filter((q) => q.status !== 'DEPRECATED').map((q) => `${f.feature_id}::${q.requirement_id}`));
    const mapped = model.mappings.map((m) => `${m.feature_id}::${m.requirement_id}`);
    assert.equal(new Set(mapped).size, mapped.length, '存在重复映射');
    for (const key of activeReqs) assert.ok(mapped.includes(key), `缺少映射 ${key}`);
    for (const m of model.mappings) {
      const f = model.features.find((x) => x.feature_id === m.feature_id);
      assert.ok(f?.requirements.some((q) => q.requirement_id === m.requirement_id), `孤立映射 ${m.requirement_id}`);
      assert.ok(m.prototype_page_id.startsWith(`PP-${m.feature_id.replace(/^UTER-/, '')}-`), `跨 Feature 关联 ${m.prototype_page_id}`);
    }
  });

  test('追溯矩阵覆盖所有映射且文件存在', () => {
    const mx = read('docs/product/mappings/FEATURE-TRACEABILITY-MATRIX.md');
    for (const m of model.mappings) assert.ok(mx.includes(m.requirement_id), `矩阵缺少 ${m.requirement_id}`);
  });

  test('每条有效需求都有关联原型页面、验收标准和测试用例', () => {
    for (const f of model.features) {
      const qIds = new Set(f.requirements.map((q) => q.requirement_id));
      const aIds = new Set(f.acceptance.map((a) => a.acceptance_id));
      const tIds = new Set(f.tests.map((t) => t.test_case_id));
      for (const q of f.requirements.filter((x) => x.status !== 'DEPRECATED')) {
        assert.ok(q.prototype_page_ids.length > 0, `${q.requirement_id} 无原型页面`);
        assert.ok(q.acceptance_ids.length > 0 && q.acceptance_ids.every((x) => aIds.has(x)), `${q.requirement_id} 验收关联失效`);
        assert.ok(q.test_case_ids.length > 0 && q.test_case_ids.every((x) => tIds.has(x)), `${q.requirement_id} 测试关联失效`);
        assert.ok(qIds.has(q.requirement_id));
      }
    }
  });
});

describe('一致性与覆盖率', () => {
  test('检查引擎（含文件存在性）全部通过', async () => {
    const { validate } = await import('../engine.mjs');
    const v = validate(model, null, { checkFiles: true });
    assert.equal(v.failed, 0, JSON.stringify(v.errors.slice(0, 5)));
    assert.equal(v.warnings.length, 0, JSON.stringify(v.warnings.slice(0, 5)));
    assert.equal(v.passed, true);
    assert.ok(v.total >= 1000, `检查项过少: ${v.total}`);
  });

  test('覆盖率报告与一致性报告真实落盘', () => {
    assert.ok(exists('docs/product/reports/PRODUCT-COVERAGE-REPORT.md'));
    assert.ok(exists('docs/product/reports/PRD-PROTOTYPE-CONSISTENCY-REPORT.md'));
    assert.ok(read('docs/product/reports/PRODUCT-COVERAGE-REPORT.md').includes('56'));
  });
});
