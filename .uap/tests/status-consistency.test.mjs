/**
 * §3.4 status consistency tests — 8 mandatory scenarios.
 *
 * These are real `node --test` cases. They use synthetic snapshots so each
 * scenario is deterministic and independent of whatever is on disk; the
 * generator that builds the real snapshot from disk is tested separately in
 * status-snapshot.test.mjs.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeFinalStatus, verifyEvidenceChain, isCurrent, FINAL_STATES,
} from '../runtime/status-engine/index.mjs';

const EX = 'UAP-EXEC-TEST-0001';
const HEAD = 'abc123';

function req(i, overrides = {}) {
  return {
    requirement_id: `UAP-00-001-REQ-${String(i).padStart(3, '0')}`,
    specification_id: 'UAP-00-001',
    implementation_status: 'IMPLEMENTED',
    verification_status: 'VERIFIED',
    test_cases: [`test::case-${i}`],
    evidence: [{ evidence_id: `EV-${i}`, execution_id: EX, git_head: HEAD, hash_valid: true, recorded_at: '2026-11-13T00:00:00Z' }],
    blockers: [],
    ...overrides,
  };
}

function fullSnapshot(n = 32) {
  const requirements = Array.from({ length: n }, (_, i) => req(i + 1));
  return {
    execution_id: EX,
    git_head: HEAD,
    computed_at: '2026-11-13T00:00:00Z',
    requirements,
    tests: {
      total: n, pass: n, fail: 0, skipped: 0, not_executed: 0,
      passing_test_names: requirements.flatMap((r) => r.test_cases),
      execution_id: EX, git_head: HEAD, exit_code: 0,
    },
    validators: { results: [{ status: 'PASS' }], execution_id: EX, git_head: HEAD, exit_code: 0 },
    spec_index_statuses: Array.from({ length: n }, () => 'VERIFIED'),
    claims: { specifications_verified: n },
    p0_blockers: [],
    capabilities: {
      real_code_repair: true, independent_regression: true, recovery: true,
      e2e: true, database_integration: true, financial_integrity: true,
    },
  };
}

describe('§3.4 状态一致性 — 8 个必须正确的场景', () => {
  test('1. 32 项全部通过 → FULLY_OPERATIONAL（且可声明成功）', () => {
    const v = computeFinalStatus(fullSnapshot(32));
    assert.equal(v.overall_status, 'FULLY_OPERATIONAL');
    assert.equal(v.counts.verified, 32);
    assert.equal(v.claim_allowed, true);
    assert.equal(v.three_independent_results.uter_real_compliance, 'FULLY_COMPLIANT');
  });

  test('2. 存在一项未验证 → 不得 FULLY_VERIFIED / FULLY_OPERATIONAL', () => {
    const s = fullSnapshot(32);
    s.requirements[7] = req(8, { verification_status: 'NOT_VERIFIED' });
    const v = computeFinalStatus(s);
    assert.ok(!['FULLY_VERIFIED', 'FULLY_OPERATIONAL'].includes(v.overall_status));
    assert.equal(v.counts.verified, 31);
    assert.equal(v.claim_allowed, false);
  });

  test('3. 存在一项未实现 → PARTIALLY_BUILT 或更低，不得 FULLY_*', () => {
    const s = fullSnapshot(32);
    s.requirements[3] = req(4, { implementation_status: 'NOT_IMPLEMENTED', evidence: [], test_cases: [] });
    const v = computeFinalStatus(s);
    assert.ok(!['FULLY_VERIFIED', 'FULLY_OPERATIONAL'].includes(v.overall_status));
    assert.equal(v.counts.not_implemented, 1);
  });

  test('4. 存在一项阻断 → 不得 FULLY_*；关键依赖阻断判定 BLOCKED', () => {
    const s = fullSnapshot(32);
    s.requirements[5] = req(6, { implementation_status: 'BLOCKED' });
    s.p0_blockers = [{ status: 'OPEN', category: 'CRITICAL_DEPENDENCY_MISSING' }];
    const v = computeFinalStatus(s);
    assert.equal(v.overall_status, 'BLOCKED');
    assert.equal(v.claim_allowed, false);

    // A non-critical P0 blocker still forbids FULLY_* but is PARTIALLY_VERIFIED.
    const s2 = fullSnapshot(32);
    s2.p0_blockers = [{ status: 'OPEN', category: 'TEST_FAILURE' }];
    const v2 = computeFinalStatus(s2);
    assert.ok(!['FULLY_VERIFIED', 'FULLY_OPERATIONAL'].includes(v2.overall_status));
  });

  test('5. 存在测试失败 → 不得 FULLY_*', () => {
    const s = fullSnapshot(32);
    s.tests.fail = 1;
    s.tests.pass = 31;
    const v = computeFinalStatus(s);
    assert.ok(!['FULLY_VERIFIED', 'FULLY_OPERATIONAL'].includes(v.overall_status));
    assert.ok(v.reasons.some((r) => r.includes('test(s) failed')));
  });

  test('6. 存在缺失证据 → 不得 FULLY_*', () => {
    const s = fullSnapshot(32);
    s.requirements[11] = req(12, { evidence: [] });
    const v = computeFinalStatus(s);
    assert.ok(!['FULLY_VERIFIED', 'FULLY_OPERATIONAL'].includes(v.overall_status));
    assert.ok(v.reasons.some((r) => r.includes('no evidence record')));
  });

  test('7. 历史通过但当前失败（execution_id / HEAD 不匹配）→ 不得算通过', () => {
    const s = fullSnapshot(32);
    s.tests.execution_id = 'UAP-EXEC-OLD';
    s.validators.git_head = 'oldhead';
    const v = computeFinalStatus(s);
    assert.ok(!['FULLY_VERIFIED', 'FULLY_OPERATIONAL'].includes(v.overall_status));
    assert.ok(v.reasons.some((r) => r.includes('stale artefacts')));
    // Even a stale test result that claims all-pass must not be promoted.
    assert.equal(isCurrent(s.tests, s), false);
  });

  test('8. 规范索引与最终报告不一致 → 不得 FULLY_*', () => {
    const s = fullSnapshot(32);
    s.claims.specifications_verified = 32;
    s.spec_index_statuses = Array.from({ length: 32 }, (_, i) => (i === 9 ? 'IMPLEMENTED_NOT_VERIFIED' : 'VERIFIED'));
    const v = computeFinalStatus(s);
    assert.ok(!['FULLY_VERIFIED', 'FULLY_OPERATIONAL'].includes(v.overall_status));
    assert.ok(v.reasons.some((r) => r.includes('index/report mismatch')));
  });
});

describe('状态引擎附加不变量', () => {
  test('跳过的测试永不算通过', () => {
    const s = fullSnapshot(32);
    s.tests.skipped = 1;
    const v = computeFinalStatus(s);
    assert.ok(!['FULLY_VERIFIED', 'FULLY_OPERATIONAL'].includes(v.overall_status));
    assert.ok(v.reasons.some((r) => r.includes('skipped/not executed')));
  });

  test('真实业务代码修复闭环缺失 → 最高只能 FULLY_VERIFIED，不能 FULLY_OPERATIONAL', () => {
    const s = fullSnapshot(32);
    s.capabilities.real_code_repair = false;
    const v = computeFinalStatus(s);
    assert.equal(v.overall_status, 'FULLY_VERIFIED');
    assert.ok(v.capability_gaps.includes('real_code_repair'));
  });

  test('NOT_APPLICABLE 无理由与审批 → 不得 FULLY_*', () => {
    const s = fullSnapshot(32);
    s.requirements[0] = req(1, { implementation_status: 'NOT_APPLICABLE', na_reason: null, na_approval: null });
    const v = computeFinalStatus(s);
    assert.ok(!['FULLY_VERIFIED', 'FULLY_OPERATIONAL'].includes(v.overall_status));
  });

  test('无执行身份 / 无要求 → NOT_BUILT', () => {
    assert.equal(computeFinalStatus({}).overall_status, 'NOT_BUILT');
    assert.equal(computeFinalStatus({ execution_id: EX, git_head: HEAD, requirements: [] }).overall_status, 'NOT_BUILT');
  });

  test('所有状态都在状态机枚举内', () => {
    for (const s of [fullSnapshot(), fullSnapshot(0), {}]) {
      assert.ok(FINAL_STATES.includes(computeFinalStatus(s).overall_status));
    }
  });

  test('证据链校验：ID/HEAD/哈希/篡改任一项不合格即失败', () => {
    const good = req(1).evidence;
    assert.equal(verifyEvidenceChain(good, { execution_id: EX, git_head: HEAD }).ok, true);
    const cases = [
      [{ ...good[0], execution_id: 'OTHER' }],
      [{ ...good[0], git_head: 'other' }],
      [{ ...good[0], hash_valid: false }],
      [{ ...good[0], immutable_violation: true }],
      [{ ...good[0], recorded_at: null }],
    ];
    for (const c of cases) {
      assert.equal(verifyEvidenceChain(c, { execution_id: EX, git_head: HEAD }).ok, false);
    }
  });
});
