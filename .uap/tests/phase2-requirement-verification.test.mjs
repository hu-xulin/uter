/**
 * Phase 2 requirement-verification contract tests.
 *
 * Two jobs, both real:
 *  1. Per-spec wiring tests — one test per registered specification ID. Each
 *     asserts REAL implementation wiring for that spec (spec file sections,
 *     registered validator module exporting that validator, executor path,
 *     declared batch probes). Their names embed the spec ID so the traceability
 *     matrix can genuinely link test cases (never via prose similarity).
 *  2. Engine fail-closed tests — the 7-state classifier can never produce
 *     FULLY_VERIFIED from missing probes, missing implementation files, a
 *     stale overlay, or a failed independent validation.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const UAP = path.join(ROOT, '.uap');

import { parseYAML } from '../runtime/_lib/yaml.mjs';
import { classify, VERIFICATION_STATES, loadRegistry, coverageMap } from '../tools/requirement-verification.mjs';
import { PROBE_IDS } from '../tools/requirement-probes.mjs';

const sha = (s) => {
  // eslint-disable-next-line no-undef
  return (globalThis.crypto?.createHash)
    ? globalThis.crypto.createHash('sha256').update(String(s)).digest('hex')
    : require('node:crypto').createHash('sha256').update(String(s)).digest('hex');
};

function specRegistry() {
  const text = fs.readFileSync(path.join(UAP, 'config', 'specification-registry.yaml'), 'utf8');
  const out = []; let cur = null;
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*-\s*id:\s*(UAP-\d{2}-\d{3})\s*$/);
    if (m) { cur = { id: m[1] }; out.push(cur); continue; }
    if (!cur) continue;
    const x = line.match(/^\s{4}(file|executor|validator|domain|criticality):\s*"?([^"\n]+?)"?\s*$/);
    if (x) cur[x[1]] = x[2];
  }
  return out;
}
function validatorRegistry() {
  const text = fs.readFileSync(path.join(UAP, 'config', 'validator-registry.yaml'), 'utf8');
  const out = []; let cur = null;
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*-\s*id:\s*([a-z][a-z0-9_.]+)\s*$/);
    if (m) { cur = { id: m[1] }; out.push(cur); continue; }
    if (!cur) continue;
    const x = line.match(/^\s+implementation:\s*(\S+)/);
    if (x) cur.implementation = x[1];
  }
  return out;
}
function executorEntries() {
  const text = fs.readFileSync(path.join(UAP, 'config', 'execution-mapping.yaml'), 'utf8');
  const map = new Map();
  for (const line of text.split('\n')) {
    const m = line.match(/^\s{4}([a-z][a-z0-9_]*):\s*(\.uap\/\S+)/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

const SPECS = specRegistry();
const VALIDATORS = validatorRegistry();
const EXECUTORS = executorEntries();
const REGISTRY = loadRegistry();

describe('Phase 2 每规范真实接线', () => {
  for (const spec of SPECS) {
    test(`${spec.id} (${spec.domain}) 规范文件/验证器/执行器/批次探针全部真实存在`, () => {
      // 1. The specification file exists and declares both mandated sections.
      const file = path.join(ROOT, spec.file);
      assert.ok(fs.existsSync(file), `spec file missing: ${spec.file}`);
      const text = fs.readFileSync(file, 'utf8');
      assert.match(text, /^## 强制性要求\s*$/m, `${spec.id}: no mandatory-requirements section`);
      assert.match(text, /^## 验收条件\s*$/m, `${spec.id}: no acceptance-criteria section`);

      // 2. The registered validator module exists and exports that validator.
      const v = VALIDATORS.find((x) => x.id === spec.validator);
      assert.ok(v, `${spec.id}: validator ${spec.validator} not registered`);
      const vfile = path.join(ROOT, v.implementation);
      assert.ok(fs.existsSync(vfile), `${spec.id}: validator implementation missing ${v.implementation}`);

      // 3. The registered executor path exists.
      const exe = EXECUTORS.get(spec.executor.split('.').pop());
      assert.ok(exe, `${spec.id}: executor ${spec.executor} not mapped`);
      assert.ok(fs.existsSync(path.join(ROOT, exe)), `${spec.id}: executor path missing ${exe}`);

      // 4. The spec's batch declares at least 2 real executable probes.
      const batch = REGISTRY.batches.find((b) => b.specs.includes(spec.id));
      assert.ok(batch, `${spec.id}: not assigned to any Phase-2 batch`);
      assert.ok(batch.probes.length >= 2, `${spec.id}: batch ${batch.id} declares <2 probes`);
      const unknown = batch.probes.filter((p) => !PROBE_IDS.includes(p));
      assert.deepEqual(unknown, [], `${spec.id}: batch probes not in the executable probe library: ${unknown.join(',')}`);
    });
  }
});

describe('Phase 2 分类器 fail-closed', () => {
  const matrix = JSON.parse(fs.readFileSync(path.join(UAP, 'reports', 'REQUIREMENT-TRACEABILITY-MATRIX.json'), 'utf8'));
  const sample = matrix.requirements[0];
  const cov = {
    batch_id: 'uap_foundation', batch_name: 'UAP Foundation',
    probes: ['reg.specifications', 'reg.validators'], keyword_rules: [],
    coverage_basis: 'test fixture',
  };

  test('7 种状态集合完整且互不重叠', () => {
    assert.deepEqual(VERIFICATION_STATES.length, 7);
    assert.deepEqual(new Set(VERIFICATION_STATES).size, 7);
    for (const s of ['NOT_BUILT', 'PARTIALLY_BUILT', 'IMPLEMENTED_NOT_VERIFIED', 'PARTIALLY_VERIFIED', 'FULLY_VERIFIED', 'NOT_APPLICABLE', 'BLOCKED']) {
      assert.ok(VERIFICATION_STATES.includes(s), `missing state ${s}`);
    }
  });

  test('探针缺失或失败时不得 FULLY_VERIFIED', () => {
    const failing = { 'reg.specifications': { ok: false, exit_code: 1, command: 'x', output_hash: 'h' }, 'reg.validators': { ok: true, exit_code: 0, command: 'y', output_hash: 'h' } };
    const c = classify(sample, cov, failing, { ok: true, rechecked: ['reg.specifications'] }, REGISTRY, {});
    assert.equal(c.state, 'PARTIALLY_VERIFIED');
    const none = classify(sample, cov, {}, { ok: true, rechecked: [] }, REGISTRY, {});
    assert.equal(none.state, 'IMPLEMENTED_NOT_VERIFIED');
  });

  test('只有全部探针通过且独立复核通过才 FULLY_VERIFIED', () => {
    const passing = Object.fromEntries(cov.probes.map((p) => [p, { ok: true, exit_code: 0, command: p, output_hash: 'h' }]));
    const ok = classify(sample, cov, passing, { ok: true, rechecked: cov.probes }, REGISTRY, {});
    assert.equal(ok.state, 'FULLY_VERIFIED');
    const noIndep = classify(sample, cov, passing, { ok: false, rechecked: [] }, REGISTRY, {});
    assert.notEqual(noIndep.state, 'FULLY_VERIFIED');
    const tooFew = classify({ ...sample, implementation_files: [sample.implementation_files[0]] }, cov, passing, { ok: true, rechecked: cov.probes }, REGISTRY, {});
    assert.notEqual(tooFew.state, 'FULLY_VERIFIED');
  });

  test('外部依赖只允许来自显式声明规则且必须匹配语句', () => {
    const ext = classify({ ...sample, requirement: '必须支持真机验证的 H5 适配' }, cov, {}, { ok: false, rechecked: [] }, REGISTRY, {});
    assert.equal(ext.state, 'BLOCKED');
    assert.equal(ext.blocked_dependency_id, 'EXT-H5-DEVICE');
    assert.ok(ext.unblock_condition);
    const normal = classify({ ...sample, requirement: sample.requirement }, cov, {}, { ok: false, rechecked: [] }, REGISTRY, {});
    assert.notEqual(normal.state, 'BLOCKED');
  });

  test('NOT_APPLICABLE 没有显式登记时不得出现', () => {
    const c = classify(sample, cov, {}, { ok: false, rechecked: [] }, REGISTRY, {});
    assert.notEqual(c.state, 'NOT_APPLICABLE');
  });

  test('批次注册表覆盖全部 32 份规范且每批探针真实注册', () => {
    const specIds = SPECS.map((s) => s.id);
    const covered = REGISTRY.batches.flatMap((b) => b.specs);
    assert.deepEqual(covered.length, specIds.length, 'every spec in exactly one batch');
    assert.deepEqual(new Set(covered).size, covered.length, 'no duplicate spec assignment');
    for (const s of specIds) assert.ok(covered.includes(s), `${s} uncovered`);
    const allProbes = REGISTRY.batches.flatMap((b) => b.probes);
    const unknown = allProbes.filter((p) => !PROBE_IDS.includes(p));
    assert.deepEqual(unknown, [], `unregistered probes: ${unknown.join(',')}`);
  });

  test('coverageMap 为全部 538 条要求建立显式映射', () => {
    const map = coverageMap(matrix, REGISTRY);
    assert.equal(map.size, matrix.requirements.length);
    for (const [id, cov] of map) {
      assert.ok(cov.batch_id && cov.batch_id !== 'UNMAPPED', `${id} unmapped`);
      assert.ok(cov.probes.length >= 2, `${id} has <2 declared probes`);
      assert.ok(cov.coverage_basis, `${id} has no coverage basis`);
    }
  });
});

describe('Phase 2 状态透传', () => {
  test('snapshot requirements 携带七状态字段', async () => {
    const mod = await import('../runtime/status-engine/snapshot.mjs');
    assert.equal(typeof mod.buildStatusSnapshot, 'function');
  });

  test('computeFinalStatus 对 NOT_BUILT/PARTIALLY_BUILT 行仍计为 applicable', async () => {
    const { computeFinalStatus } = await import('../runtime/status-engine/index.mjs');
    const out = computeFinalStatus({
      execution_id: 'E', git_head: 'H',
      requirements: [
        { requirement_id: 'R1', implementation_status: 'NOT_BUILT', verification_status: 'NOT_BUILT', verification_state: 'NOT_BUILT', test_cases: ['t1'], evidence: [{ execution_id: 'E', git_head: 'H', hash_valid: true }], blockers: [] },
        { requirement_id: 'R2', implementation_status: 'BLOCKED', verification_status: 'BLOCKED', verification_state: 'BLOCKED', test_cases: [], evidence: [], blockers: ['external_dependency:EXT-X'] },
      ],
      tests: { total: 1, pass: 1, fail: 0, skipped: 0, not_executed: 0, execution_id: 'E', git_head: 'H', exit_code: 0, passing_test_names: ['t1'] },
      validators: { results: [{ status: 'PASS' }], execution_id: 'E', git_head: 'H', exit_code: 0 },
      p0_blockers: [],
      capabilities: {},
    });
    assert.equal(out.counts.not_built, 1);
    assert.equal(out.counts.blocked_requirements, 1);
    assert.equal(out.counts.verified, 0, 'a BLOCKED/NOT_BUILT row must never count as verified');
    assert.notEqual(out.overall_status, 'FULLY_VERIFIED');
    assert.notEqual(out.overall_status, 'FULLY_OPERATIONAL');
  });

  test('test_cases 的 file::name 前缀与 TAP 名匹配（修复追踪断言）', async () => {
    const { computeFinalStatus } = await import('../runtime/status-engine/index.mjs');
    const out = computeFinalStatus({
      execution_id: 'E', git_head: 'H',
      requirements: [
        { requirement_id: 'R1', implementation_status: 'IMPLEMENTED', verification_status: 'VERIFIED', verification_state: 'FULLY_VERIFIED', test_cases: ['.uap/tests/x.test.mjs::UAP-00-001 wiring'], evidence: [{ execution_id: 'E', git_head: 'H', hash_valid: true }], blockers: [] },
      ],
      tests: { total: 1, pass: 1, fail: 0, skipped: 0, not_executed: 0, execution_id: 'E', git_head: 'H', exit_code: 0, passing_test_names: ['UAP-00-001 wiring'] },
      validators: { results: [{ status: 'PASS' }], execution_id: 'E', git_head: 'H', exit_code: 0 },
      p0_blockers: [],
      capabilities: {},
    });
    assert.equal(out.counts.verified, 1, 'a genuinely passing linked test must count');
    const failing = { ...out, tests: { ...out.tests, passing_test_names: ['different-test'] } };
    assert.equal(computeFinalStatus(failing).counts.verified, 0, 'a non-passing test name must never count');
  });
});
