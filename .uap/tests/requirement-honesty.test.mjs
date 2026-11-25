/**
 * Requirement-verification HONESTY negative tests (P2-06).
 *
 * The independent audit's core finding was that a requirement could be marked
 * VERIFIED by file existence, a shared suite run, or a stale evidence record.
 * These tests exercise the EXACT production classifier and prove each false
 * verification path is impossible.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const MATRIX_FILE = path.join(ROOT, '.uap', 'reports', 'REQUIREMENT-TRACEABILITY-MATRIX.json');
function deriveExpectedRequirementIds() {
  const registryPath = path.join(ROOT, '.uap', 'config', 'specification-registry.yaml');
  const registryLines = fs.readFileSync(registryPath, 'utf8').split(/\r?\n/);
  const specs = [];
  let current = null;
  for (const line of registryLines) {
    const idMatch = /^\s*-\s*id:\s*(UAP-\d{2}-\d{3})\s*$/.exec(line);
    if (idMatch) {
      current = { id: idMatch[1], file: null };
      specs.push(current);
      continue;
    }
    if (!current || current.file) continue;
    const fileMatch = /^\s{4}file:\s*"?([^"\n]+?)"?\s*$/.exec(line);
    if (fileMatch) current.file = fileMatch[1];
  }
  assert.ok(specs.length > 0, 'specification registry must contain registered specs');
  const ids = [];
  for (const spec of specs) {
    assert.ok(spec.file, spec.id + ': registry file path missing');
    const source = fs.readFileSync(path.join(ROOT, spec.file), 'utf8');
    for (const [heading, tag] of [['强制性要求', 'REQ'], ['验收条件', 'ACC']]) {
      const parts = source.split(new RegExp('^## ' + heading + '\\s*

import {
  classifyStrict, RequirementStatus, computeStatesFromMatrix,
  detectSharedEvidence, isValidBehaviorAssertion,
  externalBlock, isProhibitionRequirement, loadRegistry,
} from '../tools/requirement-verification.mjs';

const EXEC = { execution_id: 'UAP-EXEC-HONESTY', git_head: 'a'.repeat(40), worktree_fingerprint: 'b'.repeat(64) };
const REQ = { requirement_id: 'UAP-06-002-REQ-004', requirement: '重复支付通知不能重复增加余额', specification_id: 'UAP-06-002' };

function goodAssertion(over = {}) {
  return {
    assertion_id: 'dup-notification-idempotent', probe_id: 'bhv.paymentsandbox',
    probe_kind: 'BEHAVIOR_EXECUTION',
    command: 'go test ./service/paymentsandbox/ -run TestDuplicateNotificationIsIdempotent',
    exit_code: 0, output_hash: 'h1', assertion_found: true,
    skipped: false, raw_status: 'PASS', distinct: true,
    evidence_hash: 'eh1', evidence_hash_valid: true, evidence_disk_hash_valid: true,
    evidence_binding_valid: true, evidence_output_hash: 'h1',
    evidence_execution_id: EXEC.execution_id, evidence_git_head: EXEC.git_head,
    evidence_worktree_fingerprint: EXEC.worktree_fingerprint,
    ...over,
  };
}

describe('P2-06 诚实性负向测试', () => {
  test('STATIC_EXISTENCE 探针永远不能产生 VERIFIED', () => {
    const c = classifyStrict({
      requirement: REQ,
      behaviorAssertions: [goodAssertion({ probe_kind: 'STATIC_EXISTENCE' })],
      declaredProbeKinds: ['STATIC_EXISTENCE'], execution: EXEC,
    });
    assert.equal(c.status, RequirementStatus.NOT_VERIFIED);
    assert.equal(c.status_reason_code, 'PROBE_ONLY_FILE_EXISTENCE');
    assert.equal(c.evidence_refs.length, 0);
    // Even a file-existence claim WITH every evidence field intact is rejected:
    // the guard is on probe_kind, not on the evidence metadata.
    assert.equal(isValidBehaviorAssertion(goodAssertion({ probe_kind: 'STATIC_EXISTENCE' }), EXEC), false);
  });

  test('BLOCKED / SKIPPED / NOT_RUN / FAILED 的原始结果永远不能产生 VERIFIED', () => {
    for (const [raw, skipped] of [['BLOCKED', false], ['SKIPPED', true], ['NOT_RUN', false], ['FAILED', false], ['DRY_RUN_NOT_EXECUTED', false]]) {
      const c = classifyStrict({
        requirement: REQ,
        behaviorAssertions: [goodAssertion({ raw_status: raw, skipped })],
        declaredProbeKinds: ['BEHAVIOR_EXECUTION'], execution: EXEC,
      });
      assert.equal(c.status, RequirementStatus.NOT_VERIFIED, `raw_status=${raw}`);
      assert.equal(c.status_reason_code, 'BEHAVIOR_NOT_RUN', `raw_status=${raw}`);
    }
    assert.equal(isValidBehaviorAssertion(goodAssertion({ raw_status: 'BLOCKED' }), EXEC), false);
  });

  test('证据哈希缺失 / 不匹配 / 磁盘哈希失效 不能产生 VERIFIED', () => {
    const cases = [
      ['missing hash', { evidence_hash: null }],
      ['invalid hash', { evidence_hash_valid: false }],
      ['disk hash mismatch', { evidence_disk_hash_valid: false }],
      ['output hash mismatch', { evidence_output_hash: 'OTHER' }],
      ['binding invalid', { evidence_binding_valid: false }],
    ];
    for (const [name, over] of cases) {
      const c = classifyStrict({
        requirement: REQ, behaviorAssertions: [goodAssertion(over)],
        declaredProbeKinds: ['BEHAVIOR_EXECUTION'], execution: EXEC,
      });
      assert.equal(c.status, RequirementStatus.NOT_VERIFIED, name);
      assert.equal(c.status_reason_code, 'EVIDENCE_INVALID_OR_STALE', name);
    }
  });

  test('绑定到旧执行批次 / 旧 HEAD / 旧指纹的证据不能产生 VERIFIED', () => {
    for (const [name, over] of [
      ['old execution', { evidence_execution_id: 'UAP-EXEC-OLD' }],
      ['old head', { evidence_git_head: '0'.repeat(40) }],
      ['old fingerprint', { evidence_worktree_fingerprint: 'c'.repeat(64) }],
    ]) {
      const c = classifyStrict({
        requirement: REQ, behaviorAssertions: [goodAssertion(over)],
        declaredProbeKinds: ['BEHAVIOR_EXECUTION'], execution: EXEC,
      });
      assert.equal(c.status, RequirementStatus.NOT_VERIFIED, name);
      assert.equal(c.status_reason_code, 'EVIDENCE_INVALID_OR_STALE', name);
    }
    // No execution context at all -> nothing can verify.
    const c = classifyStrict({
      requirement: REQ, behaviorAssertions: [goodAssertion()],
      declaredProbeKinds: ['BEHAVIOR_EXECUTION'], execution: null,
    });
    assert.equal(c.status, RequirementStatus.NOT_VERIFIED);
  });

  test('绑定到旧环境指纹的证据不能产生 VERIFIED（§3.3 环境变更失效）', () => {
    const execEnv = { ...EXEC, environment_fingerprint: 'e'.repeat(64) };
    // Matching environment fingerprint -> still a valid behaviour assertion.
    assert.equal(isValidBehaviorAssertion(goodAssertion({ evidence_environment_fingerprint: 'e'.repeat(64) }), execEnv), true);
    // Mismatched environment fingerprint -> evidence invalid/stale, never VERIFIED.
    const stale = classifyStrict({
      requirement: REQ,
      behaviorAssertions: [goodAssertion({ evidence_environment_fingerprint: 'f'.repeat(64) })],
      declaredProbeKinds: ['BEHAVIOR_EXECUTION'], execution: execEnv,
    });
    assert.equal(stale.status, RequirementStatus.NOT_VERIFIED);
    assert.equal(stale.status_reason_code, 'EVIDENCE_INVALID_OR_STALE');
    assert.equal(isValidBehaviorAssertion(goodAssertion({ evidence_environment_fingerprint: 'f'.repeat(64) }), execEnv), false);
    // Legacy assertion without an environment fingerprint is tolerated (the
    // manifest tolerates the same legacy schema); real records always carry it.
    assert.equal(isValidBehaviorAssertion(goodAssertion(), execEnv), true);
  });

  test('命令 exit 非 0 或断言未在真实输出中观测到 不能产生 VERIFIED', () => {
    const failed = classifyStrict({
      requirement: REQ, behaviorAssertions: [goodAssertion({ exit_code: 1 })],
      declaredProbeKinds: ['BEHAVIOR_EXECUTION'], execution: EXEC,
    });
    assert.equal(failed.status_reason_code, 'BEHAVIOR_COMMAND_FAILED');
    const notObserved = classifyStrict({
      requirement: REQ, behaviorAssertions: [goodAssertion({ assertion_found: false })],
      declaredProbeKinds: ['BEHAVIOR_EXECUTION'], execution: EXEC,
    });
    assert.equal(notObserved.status_reason_code, 'BEHAVIOR_ASSERTION_NOT_OBSERVED');
  });

  test('同一证据/断言覆盖多条不相关要求被拒绝', () => {
    const shared = detectSharedEvidence([
      { command: 'go test ./...', assertion_id: 'suite-all', requirement_id: 'R1' },
      { command: 'go test ./...', assertion_id: 'suite-all', requirement_id: 'R2' },
      { command: 'go test ./...', assertion_id: 'suite-all', requirement_id: 'R3' },
    ]);
    assert.equal(shared.conflicts.length, 1);
    for (const id of ['R1', 'R2', 'R3']) assert.ok(shared.rejected.has(id), id);
    // Distinct assertions for distinct requirements are fine.
    const distinct = detectSharedEvidence([
      { command: 'go test ./... -run TestA', assertion_id: 'a', requirement_id: 'R1' },
      { command: 'go test ./... -run TestB', assertion_id: 'b', requirement_id: 'R2' },
    ]);
    assert.equal(distinct.conflicts.length, 0);
    assert.equal(distinct.rejected.size, 0);
  });

  test('BLOCKED / NOT_APPLICABLE 必须携带具体条件，缺失时 fail-closed', () => {
    const noDep = classifyStrict({
      requirement: REQ, behaviorAssertions: [], declaredProbeKinds: [],
      blockedRule: { dependency: null, unblock_condition: null },
    });
    assert.equal(noDep.status, RequirementStatus.NOT_VERIFIED);
    assert.equal(noDep.status_reason_code, 'BLOCK_CONDITION_MISSING');
    const noBasis = classifyStrict({
      requirement: REQ, behaviorAssertions: [], declaredProbeKinds: [],
      naRule: { reason: 'x', basis: null },
    });
    assert.equal(noBasis.status, RequirementStatus.NOT_VERIFIED);
    assert.equal(noBasis.status_reason_code, 'NA_BASIS_MISSING');
  });

  test('矩阵完整性：与当前注册规范派生的全部要求精确一致、ID 唯一', () => {
    const matrix = JSON.parse(fs.readFileSync(MATRIX_FILE, 'utf8'));
    const rows = matrix.requirements || [];
    const expectedIds = deriveExpectedRequirementIds();
    const ids = rows.map((r) => r.requirement_id);
    assert.ok(expectedIds.length > 0, 'registered specifications must declare requirements');
    assert.equal(new Set(expectedIds).size, expectedIds.length, 'registry-derived requirement IDs must be unique');
    assert.equal(rows.length, expectedIds.length, 'matrix rows must equal the current registered requirement count');
    assert.deepEqual([...ids].sort(), [...expectedIds].sort(), 'matrix IDs must exactly match current registered specifications');
    assert.equal(new Set(ids).size, rows.length, 'duplicate requirement IDs');
    const allowed = new Set(['VERIFIED', 'NOT_VERIFIED', 'BLOCKED', 'NOT_APPLICABLE']);
    for (const r of rows) {
      const st = r.status;
      assert.ok(allowed.has(st), `${r.requirement_id}: invalid status ${st}`);
      if (st === 'VERIFIED') {
        assert.ok((r.evidence_refs || []).length > 0, `${r.requirement_id}: VERIFIED without evidence`);
        assert.ok(r.actual_result, `${r.requirement_id}: VERIFIED without actual_result`);
        const probes = (r.evidence_refs || []).map((e) => e.probe_kind);
        assert.ok(
          probes.length > 0 && probes.every((k) => k === 'BEHAVIOR_EXECUTION'),
          `${r.requirement_id}: VERIFIED without a behaviour probe`,
        );
        assert.ok(r.execution_id && r.git_head, `${r.requirement_id}: VERIFIED without version binding`);
      }
      if (st === 'BLOCKED') assert.ok(r.status_reason || r.blocking_condition, `${r.requirement_id}: BLOCKED without condition`);
      if (st === 'NOT_APPLICABLE') assert.ok(r.na_basis || r.status_reason, `${r.requirement_id}: NOT_APPLICABLE without basis`);
      if (st === 'NOT_VERIFIED') assert.ok(r.status_reason, `${r.requirement_id}: NOT_VERIFIED without reason`);
    }
    const states = computeStatesFromMatrix(matrix);
    const sum = Object.values(states).reduce((a, b) => a + b, 0);
    assert.equal(sum, rows.length, 'states must sum to the matrix row count');
    // Binding fields must be present (machine-checkable evidence chain).
    for (const field of ['execution_id', 'git_head', 'worktree_fingerprint', 'generated_at', 'status_model']) {
      assert.ok(matrix[field], `matrix missing binding field ${field}`);
    }
  });

  test('禁止性要求由本地强制行为验证，不被关键词误判为外部 BLOCKED（§8 语义收窄）', () => {
    const registry = loadRegistry();
    // Prohibitions that mention blocked keywords are NOT external-dependent:
    // their behaviour is the LOCAL enforcement (policy DENY / simulation-only).
    const prohibitions = [
      '测试不得依赖真实资金交易。',
      '不得使用真实支付、真实退款或真实资金账户进行测试。',
      '所有测试均不触碰真实资金。',
      '生产资金、生产数据库、生产密钥和不可逆生产发布默认禁止自动执行。',
      '本次 UAP 建设不得擅自触发生产发布。',
      '生产部署必须经过明确授权。',
    ];
    for (const text of prohibitions) {
      assert.equal(isProhibitionRequirement({ requirement: text }), true, text);
      assert.equal(externalBlock({ requirement: text }, registry), null, `prohibition wrongly blocked: ${text}`);
    }
    // A POSITIVE-capability requirement that genuinely needs the external service
    // stays BLOCKED — the narrowing must not weaken real external blocks.
    const positive = { requirement: '必须完成真实支付沙箱端到端验证。' };
    assert.equal(isProhibitionRequirement(positive), false);
    assert.ok(externalBlock(positive, registry)?.dependency, 'positive real-payment capability must stay BLOCKED');
    assert.ok(externalBlock({ requirement: '必须支持真机验证的 H5 适配。' }, registry), 'positive H5-device capability must stay BLOCKED');
    // With a genuine enforcement assertion a prohibition is VERIFIED, not BLOCKED.
    const c = classifyStrict({
      requirement: { requirement_id: 'UAP-05-002-REQ-010', requirement: '测试不得依赖真实资金交易。' },
      behaviorAssertions: [goodAssertion()],
      declaredProbeKinds: ['BEHAVIOR_EXECUTION'],
      blockedRule: externalBlock({ requirement: '测试不得依赖真实资金交易。' }, registry),
      execution: EXEC,
    });
    assert.equal(c.status, RequirementStatus.VERIFIED);
    assert.equal(c.status_reason_code, 'REAL_BEHAVIOR_ASSERTION');
    // Without an enforcement assertion it falls through to NOT_VERIFIED, never VERIFIED by fiat.
    const noAssert = classifyStrict({
      requirement: { requirement_id: 'UAP-05-002-REQ-010', requirement: '测试不得依赖真实资金交易。' },
      behaviorAssertions: [], declaredProbeKinds: ['BEHAVIOR_EXECUTION'],
      blockedRule: null, execution: EXEC,
    });
    assert.equal(noAssert.status, RequirementStatus.NOT_VERIFIED);
  });
});
, 'm'));
      const body = (parts[1] || '').split(/^## /m)[0];
      const items = body.split(/\r?\n/).filter((line) => /^\d+\.\s+/.test(line));
      items.forEach((_, index) => ids.push(spec.id + '-' + tag + '-' + String(index + 1).padStart(3, '0')));
    }
  }
  return ids;
}


import {
  classifyStrict, RequirementStatus, computeStatesFromMatrix,
  detectSharedEvidence, isValidBehaviorAssertion,
  externalBlock, isProhibitionRequirement, loadRegistry,
} from '../tools/requirement-verification.mjs';

const EXEC = { execution_id: 'UAP-EXEC-HONESTY', git_head: 'a'.repeat(40), worktree_fingerprint: 'b'.repeat(64) };
const REQ = { requirement_id: 'UAP-06-002-REQ-004', requirement: '重复支付通知不能重复增加余额', specification_id: 'UAP-06-002' };

function goodAssertion(over = {}) {
  return {
    assertion_id: 'dup-notification-idempotent', probe_id: 'bhv.paymentsandbox',
    probe_kind: 'BEHAVIOR_EXECUTION',
    command: 'go test ./service/paymentsandbox/ -run TestDuplicateNotificationIsIdempotent',
    exit_code: 0, output_hash: 'h1', assertion_found: true,
    skipped: false, raw_status: 'PASS', distinct: true,
    evidence_hash: 'eh1', evidence_hash_valid: true, evidence_disk_hash_valid: true,
    evidence_binding_valid: true, evidence_output_hash: 'h1',
    evidence_execution_id: EXEC.execution_id, evidence_git_head: EXEC.git_head,
    evidence_worktree_fingerprint: EXEC.worktree_fingerprint,
    ...over,
  };
}

describe('P2-06 诚实性负向测试', () => {
  test('STATIC_EXISTENCE 探针永远不能产生 VERIFIED', () => {
    const c = classifyStrict({
      requirement: REQ,
      behaviorAssertions: [goodAssertion({ probe_kind: 'STATIC_EXISTENCE' })],
      declaredProbeKinds: ['STATIC_EXISTENCE'], execution: EXEC,
    });
    assert.equal(c.status, RequirementStatus.NOT_VERIFIED);
    assert.equal(c.status_reason_code, 'PROBE_ONLY_FILE_EXISTENCE');
    assert.equal(c.evidence_refs.length, 0);
    // Even a file-existence claim WITH every evidence field intact is rejected:
    // the guard is on probe_kind, not on the evidence metadata.
    assert.equal(isValidBehaviorAssertion(goodAssertion({ probe_kind: 'STATIC_EXISTENCE' }), EXEC), false);
  });

  test('BLOCKED / SKIPPED / NOT_RUN / FAILED 的原始结果永远不能产生 VERIFIED', () => {
    for (const [raw, skipped] of [['BLOCKED', false], ['SKIPPED', true], ['NOT_RUN', false], ['FAILED', false], ['DRY_RUN_NOT_EXECUTED', false]]) {
      const c = classifyStrict({
        requirement: REQ,
        behaviorAssertions: [goodAssertion({ raw_status: raw, skipped })],
        declaredProbeKinds: ['BEHAVIOR_EXECUTION'], execution: EXEC,
      });
      assert.equal(c.status, RequirementStatus.NOT_VERIFIED, `raw_status=${raw}`);
      assert.equal(c.status_reason_code, 'BEHAVIOR_NOT_RUN', `raw_status=${raw}`);
    }
    assert.equal(isValidBehaviorAssertion(goodAssertion({ raw_status: 'BLOCKED' }), EXEC), false);
  });

  test('证据哈希缺失 / 不匹配 / 磁盘哈希失效 不能产生 VERIFIED', () => {
    const cases = [
      ['missing hash', { evidence_hash: null }],
      ['invalid hash', { evidence_hash_valid: false }],
      ['disk hash mismatch', { evidence_disk_hash_valid: false }],
      ['output hash mismatch', { evidence_output_hash: 'OTHER' }],
      ['binding invalid', { evidence_binding_valid: false }],
    ];
    for (const [name, over] of cases) {
      const c = classifyStrict({
        requirement: REQ, behaviorAssertions: [goodAssertion(over)],
        declaredProbeKinds: ['BEHAVIOR_EXECUTION'], execution: EXEC,
      });
      assert.equal(c.status, RequirementStatus.NOT_VERIFIED, name);
      assert.equal(c.status_reason_code, 'EVIDENCE_INVALID_OR_STALE', name);
    }
  });

  test('绑定到旧执行批次 / 旧 HEAD / 旧指纹的证据不能产生 VERIFIED', () => {
    for (const [name, over] of [
      ['old execution', { evidence_execution_id: 'UAP-EXEC-OLD' }],
      ['old head', { evidence_git_head: '0'.repeat(40) }],
      ['old fingerprint', { evidence_worktree_fingerprint: 'c'.repeat(64) }],
    ]) {
      const c = classifyStrict({
        requirement: REQ, behaviorAssertions: [goodAssertion(over)],
        declaredProbeKinds: ['BEHAVIOR_EXECUTION'], execution: EXEC,
      });
      assert.equal(c.status, RequirementStatus.NOT_VERIFIED, name);
      assert.equal(c.status_reason_code, 'EVIDENCE_INVALID_OR_STALE', name);
    }
    // No execution context at all -> nothing can verify.
    const c = classifyStrict({
      requirement: REQ, behaviorAssertions: [goodAssertion()],
      declaredProbeKinds: ['BEHAVIOR_EXECUTION'], execution: null,
    });
    assert.equal(c.status, RequirementStatus.NOT_VERIFIED);
  });

  test('绑定到旧环境指纹的证据不能产生 VERIFIED（§3.3 环境变更失效）', () => {
    const execEnv = { ...EXEC, environment_fingerprint: 'e'.repeat(64) };
    // Matching environment fingerprint -> still a valid behaviour assertion.
    assert.equal(isValidBehaviorAssertion(goodAssertion({ evidence_environment_fingerprint: 'e'.repeat(64) }), execEnv), true);
    // Mismatched environment fingerprint -> evidence invalid/stale, never VERIFIED.
    const stale = classifyStrict({
      requirement: REQ,
      behaviorAssertions: [goodAssertion({ evidence_environment_fingerprint: 'f'.repeat(64) })],
      declaredProbeKinds: ['BEHAVIOR_EXECUTION'], execution: execEnv,
    });
    assert.equal(stale.status, RequirementStatus.NOT_VERIFIED);
    assert.equal(stale.status_reason_code, 'EVIDENCE_INVALID_OR_STALE');
    assert.equal(isValidBehaviorAssertion(goodAssertion({ evidence_environment_fingerprint: 'f'.repeat(64) }), execEnv), false);
    // Legacy assertion without an environment fingerprint is tolerated (the
    // manifest tolerates the same legacy schema); real records always carry it.
    assert.equal(isValidBehaviorAssertion(goodAssertion(), execEnv), true);
  });

  test('命令 exit 非 0 或断言未在真实输出中观测到 不能产生 VERIFIED', () => {
    const failed = classifyStrict({
      requirement: REQ, behaviorAssertions: [goodAssertion({ exit_code: 1 })],
      declaredProbeKinds: ['BEHAVIOR_EXECUTION'], execution: EXEC,
    });
    assert.equal(failed.status_reason_code, 'BEHAVIOR_COMMAND_FAILED');
    const notObserved = classifyStrict({
      requirement: REQ, behaviorAssertions: [goodAssertion({ assertion_found: false })],
      declaredProbeKinds: ['BEHAVIOR_EXECUTION'], execution: EXEC,
    });
    assert.equal(notObserved.status_reason_code, 'BEHAVIOR_ASSERTION_NOT_OBSERVED');
  });

  test('同一证据/断言覆盖多条不相关要求被拒绝', () => {
    const shared = detectSharedEvidence([
      { command: 'go test ./...', assertion_id: 'suite-all', requirement_id: 'R1' },
      { command: 'go test ./...', assertion_id: 'suite-all', requirement_id: 'R2' },
      { command: 'go test ./...', assertion_id: 'suite-all', requirement_id: 'R3' },
    ]);
    assert.equal(shared.conflicts.length, 1);
    for (const id of ['R1', 'R2', 'R3']) assert.ok(shared.rejected.has(id), id);
    // Distinct assertions for distinct requirements are fine.
    const distinct = detectSharedEvidence([
      { command: 'go test ./... -run TestA', assertion_id: 'a', requirement_id: 'R1' },
      { command: 'go test ./... -run TestB', assertion_id: 'b', requirement_id: 'R2' },
    ]);
    assert.equal(distinct.conflicts.length, 0);
    assert.equal(distinct.rejected.size, 0);
  });

  test('BLOCKED / NOT_APPLICABLE 必须携带具体条件，缺失时 fail-closed', () => {
    const noDep = classifyStrict({
      requirement: REQ, behaviorAssertions: [], declaredProbeKinds: [],
      blockedRule: { dependency: null, unblock_condition: null },
    });
    assert.equal(noDep.status, RequirementStatus.NOT_VERIFIED);
    assert.equal(noDep.status_reason_code, 'BLOCK_CONDITION_MISSING');
    const noBasis = classifyStrict({
      requirement: REQ, behaviorAssertions: [], declaredProbeKinds: [],
      naRule: { reason: 'x', basis: null },
    });
    assert.equal(noBasis.status, RequirementStatus.NOT_VERIFIED);
    assert.equal(noBasis.status_reason_code, 'NA_BASIS_MISSING');
  });

  test('矩阵完整性：538 条、ID 唯一、每个 VERIFIED 都有证据与真实结果', () => {
    const matrix = JSON.parse(fs.readFileSync(MATRIX_FILE, 'utf8'));
    const rows = matrix.requirements || [];
    assert.equal(rows.length, 538, `matrix has ${rows.length} rows`);
    const ids = rows.map((r) => r.requirement_id);
    assert.equal(new Set(ids).size, rows.length, 'duplicate requirement IDs');
    const allowed = new Set(['VERIFIED', 'NOT_VERIFIED', 'BLOCKED', 'NOT_APPLICABLE']);
    for (const r of rows) {
      const st = r.status;
      assert.ok(allowed.has(st), `${r.requirement_id}: invalid status ${st}`);
      if (st === 'VERIFIED') {
        assert.ok((r.evidence_refs || []).length > 0, `${r.requirement_id}: VERIFIED without evidence`);
        assert.ok(r.actual_result, `${r.requirement_id}: VERIFIED without actual_result`);
        const probes = (r.evidence_refs || []).map((e) => e.probe_kind);
        assert.ok(
          probes.length > 0 && probes.every((k) => k === 'BEHAVIOR_EXECUTION'),
          `${r.requirement_id}: VERIFIED without a behaviour probe`,
        );
        assert.ok(r.execution_id && r.git_head, `${r.requirement_id}: VERIFIED without version binding`);
      }
      if (st === 'BLOCKED') assert.ok(r.status_reason || r.blocking_condition, `${r.requirement_id}: BLOCKED without condition`);
      if (st === 'NOT_APPLICABLE') assert.ok(r.na_basis || r.status_reason, `${r.requirement_id}: NOT_APPLICABLE without basis`);
      if (st === 'NOT_VERIFIED') assert.ok(r.status_reason, `${r.requirement_id}: NOT_VERIFIED without reason`);
    }
    const states = computeStatesFromMatrix(matrix);
    const sum = Object.values(states).reduce((a, b) => a + b, 0);
    assert.equal(sum, 538, 'states must sum to 538');
    // Binding fields must be present (machine-checkable evidence chain).
    for (const field of ['execution_id', 'git_head', 'worktree_fingerprint', 'generated_at', 'status_model']) {
      assert.ok(matrix[field], `matrix missing binding field ${field}`);
    }
  });

  test('禁止性要求由本地强制行为验证，不被关键词误判为外部 BLOCKED（§8 语义收窄）', () => {
    const registry = loadRegistry();
    // Prohibitions that mention blocked keywords are NOT external-dependent:
    // their behaviour is the LOCAL enforcement (policy DENY / simulation-only).
    const prohibitions = [
      '测试不得依赖真实资金交易。',
      '不得使用真实支付、真实退款或真实资金账户进行测试。',
      '所有测试均不触碰真实资金。',
      '生产资金、生产数据库、生产密钥和不可逆生产发布默认禁止自动执行。',
      '本次 UAP 建设不得擅自触发生产发布。',
      '生产部署必须经过明确授权。',
    ];
    for (const text of prohibitions) {
      assert.equal(isProhibitionRequirement({ requirement: text }), true, text);
      assert.equal(externalBlock({ requirement: text }, registry), null, `prohibition wrongly blocked: ${text}`);
    }
    // A POSITIVE-capability requirement that genuinely needs the external service
    // stays BLOCKED — the narrowing must not weaken real external blocks.
    const positive = { requirement: '必须完成真实支付沙箱端到端验证。' };
    assert.equal(isProhibitionRequirement(positive), false);
    assert.ok(externalBlock(positive, registry)?.dependency, 'positive real-payment capability must stay BLOCKED');
    assert.ok(externalBlock({ requirement: '必须支持真机验证的 H5 适配。' }, registry), 'positive H5-device capability must stay BLOCKED');
    // With a genuine enforcement assertion a prohibition is VERIFIED, not BLOCKED.
    const c = classifyStrict({
      requirement: { requirement_id: 'UAP-05-002-REQ-010', requirement: '测试不得依赖真实资金交易。' },
      behaviorAssertions: [goodAssertion()],
      declaredProbeKinds: ['BEHAVIOR_EXECUTION'],
      blockedRule: externalBlock({ requirement: '测试不得依赖真实资金交易。' }, registry),
      execution: EXEC,
    });
    assert.equal(c.status, RequirementStatus.VERIFIED);
    assert.equal(c.status_reason_code, 'REAL_BEHAVIOR_ASSERTION');
    // Without an enforcement assertion it falls through to NOT_VERIFIED, never VERIFIED by fiat.
    const noAssert = classifyStrict({
      requirement: { requirement_id: 'UAP-05-002-REQ-010', requirement: '测试不得依赖真实资金交易。' },
      behaviorAssertions: [], declaredProbeKinds: ['BEHAVIOR_EXECUTION'],
      blockedRule: null, execution: EXEC,
    });
    assert.equal(noAssert.status, RequirementStatus.NOT_VERIFIED);
  });
});
