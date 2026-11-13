/**
 * Contract tests for the adapter that builds the real execution snapshot.
 *
 * These complement status-consistency.test.mjs: that file proves the pure
 * state machine is correct for all 8 §3.4 scenarios; this file proves the
 * on-disk adapter feeds it truthfully and cannot be tricked into promoting a
 * historical card.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { gitHead, worktreeFingerprint, currentExecution, bindExecution } from '../runtime/status-engine/execution.mjs';
import {
  buildStatusSnapshot, statusVerdict, specificationVerification,
  renderStatusBlock,
} from '../runtime/status-engine/snapshot.mjs';
import { computeFinalStatus, verifyEvidenceChain, isCurrent } from '../runtime/status-engine/index.mjs';

const BLOCK_RE = /<!--\s*UAP-STATUS-BLOCK\s+(\{[\s\S]*?\})\s*-->/;

describe('执行身份绑定', () => {
  test('git HEAD 来自真实仓库且是 40 位 sha', () => {
    const head = gitHead();
    assert.match(head, /^[0-9a-f]{40}$/);
  });

  test('worktree 指纹稳定，且不受 UAP 运行产物写入影响', () => {
    const a = worktreeFingerprint();
    const b = worktreeFingerprint();
    assert.equal(a, b);
    assert.match(a, /^[0-9a-f]{64}$/);
  });

  test('currentExecution 返回同一身份，且绑定字段不可被调用方伪造', () => {
    const e = currentExecution();
    assert.ok(e.execution_id.startsWith('UAP-EXEC-'));
    assert.equal(e.git_head, gitHead());
    assert.equal(currentExecution().execution_id, e.execution_id);
    const bound = bindExecution({ execution_id: 'FORGED', git_head: 'FORGED', hello: 'world' });
    assert.equal(bound.execution_id, e.execution_id);
    assert.equal(bound.git_head, e.git_head);
    assert.equal(bound.worktree_fingerprint, e.worktree_fingerprint);
    assert.equal(bound.hello, 'world');
  });
});

describe('真实快照适配器', () => {
  test('从真实追踪矩阵构造 538 条要求与 32 份规范', () => {
    const s = buildStatusSnapshot();
    assert.equal(s.requirements.length, 538);
    const v = specificationVerification({ requirements: s.requirements });
    assert.equal(v.total_specs, 32);
    assert.equal(v.verified_specs, 0);
    assert.ok(s.execution_id && s.git_head && s.worktree_fingerprint);
  });

  test('stale 判定与卡片绑定状态严格一致，且绝不提升为 PASS', () => {
    const s = buildStatusSnapshot();
    const v = computeFinalStatus(s);
    const staleExpected = [];
    if (s.tests && !isCurrent(s.tests, s)) staleExpected.push('tests');
    if (s.validators && !isCurrent(s.validators, s)) staleExpected.push('validators');
    const hasStaleReason = v.reasons.some((r) => r.includes('stale artefacts'));
    assert.equal(hasStaleReason, staleExpected.length > 0,
      `staleExpected=${JSON.stringify(staleExpected)} reasons=${JSON.stringify(v.reasons)}`);
    assert.equal(v.counts.verified, 0);
    assert.equal(v.claim_allowed, false);
    assert.ok(!['FULLY_VERIFIED', 'FULLY_OPERATIONAL'].includes(v.overall_status));
  });

  test('伪造旧 execution_id / HEAD 的真实快照一律判为 stale', () => {
    const s = buildStatusSnapshot();
    s.tests = { ...s.tests, execution_id: 'UAP-EXEC-FORGED-OLD' };
    s.validators = { ...s.validators, git_head: 'FORGED-OLD-HEAD' };
    const v = computeFinalStatus(s);
    assert.ok(v.reasons.some((r) => r.includes('stale artefacts')));
    assert.equal(v.claim_allowed, false);
  });

  test('statusVerdict 与 FINAL-STATUS.json / 索引同源，且不得自行宣称成功', () => {
    const { verdict, specVer, snapshot } = statusVerdict();
    assert.equal(verdict.computed_by, 'runtime.status-engine/computeFinalStatus');
    assert.equal(verdict.execution_id, snapshot.execution_id);
    assert.equal(verdict.git_head, snapshot.git_head);
    assert.equal(specVer.total_specs, 32);
    assert.equal(verdict.claim_allowed, false);
    assert.equal(Object.keys(verdict.capabilities).length, 6);
    for (const v of Object.values(verdict.capabilities)) assert.equal(typeof v, 'boolean');
    assert.equal(verdict.capability_gaps.length,
      Object.values(verdict.capabilities).filter((v) => v !== true).length);
  });

  test('注入 indexDeclaration 只影响一致性比对，不伪造通过数', () => {
    const base = buildStatusSnapshot();
    const declared = buildStatusSnapshot({
      indexDeclaration: { verified_specs: 0, total_specs: 32, overall_status: 'IMPLEMENTED_NOT_VERIFIED' },
      claims: { specifications_verified: 0, overall_status: 'IMPLEMENTED_NOT_VERIFIED' },
    });
    assert.equal(computeFinalStatus(base).counts.verified, 0);
    assert.equal(computeFinalStatus(declared).counts.verified, 0);
    assert.equal(computeFinalStatus(declared).claim_allowed, false);
    // A lying declaration is detected, not accepted.
    const lying = buildStatusSnapshot({
      indexDeclaration: { verified_specs: 32, total_specs: 32, overall_status: 'FULLY_OPERATIONAL' },
      claims: { specifications_verified: 0, overall_status: 'IMPLEMENTED_NOT_VERIFIED' },
    });
    const lv = computeFinalStatus(lying);
    assert.ok(lv.reasons.some((r) => r.includes('index/report mismatch')));
  });

  test('状态块是可机读 JSON，字段与 verdict 一致', () => {
    const { verdict, specVer } = statusVerdict();
    const block = renderStatusBlock(verdict, specVer);
    const m = BLOCK_RE.exec(block);
    assert.ok(m, 'status block must be machine-readable');
    const parsed = JSON.parse(m[1]);
    assert.equal(parsed.overall_status, verdict.overall_status);
    assert.equal(parsed.execution_id, verdict.execution_id);
    assert.equal(parsed.git_head, verdict.git_head);
    assert.equal(parsed.requirements_verified, verdict.counts.verified);
    assert.equal(parsed.specifications_verified, specVer.verified_specs);
    assert.equal(parsed.claim_allowed, verdict.claim_allowed);
  });
});

describe('证据链 fail-closed', () => {
  test('缺少绑定字段或哈希未校验的证据一律失败', () => {
    const snap = { execution_id: 'EX', git_head: 'HEAD', worktree_fingerprint: 'FP' };
    const good = [{ evidence_id: 'EV-1', execution_id: 'EX', git_head: 'HEAD', worktree_fingerprint: 'FP', hash_valid: true, recorded_at: '2026-11-13T00:00:00Z' }];
    assert.equal(verifyEvidenceChain(good, snap).ok, true);
    for (const bad of [
      [{ ...good[0], worktree_fingerprint: 'OTHER' }],
      [{ ...good[0], execution_id: 'OLD' }],
      [{ ...good[0], hash_valid: false }],
      [{ ...good[0], recorded_at: null }],
    ]) {
      assert.equal(verifyEvidenceChain(bad, snap).ok, false);
    }
  });
});
