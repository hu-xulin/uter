/**
 * Phase 2 security negative tests (§9 of the Phase-2 instruction).
 *
 * Each test proves a system CANNOT produce a false positive. Go-side negative
 * tests (sandbox config rejection, duplicate-fund side effects) are executed
 * for real via `go test` sub-processes — never mocked at this layer.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

function go(args, timeoutMs = 300000) {
  const r = spawnSync('go', args, {
    cwd: ROOT, encoding: 'utf8', timeout: timeoutMs,
    env: { ...process.env, GOWORK: 'off' },
  });
  assert.equal(r.status, 0, `go ${args.join(' ')} must exit 0 (stderr: ${r.stderr?.slice(0, 500)})`);
  return r.stdout;
}

function computeFinalStatusMod() {
  // eslint-disable-next-line import/no-unresolved
  return import('../runtime/status-engine/index.mjs');
}

describe('Phase 2 安全负向测试', () => {
  test('N1 没有有效证据的 requirement 不能产生 VERIFIED', async () => {
    const { computeFinalStatus } = await computeFinalStatusMod();
    const base = (evidence) => ({
      execution_id: 'E', git_head: 'H',
      requirements: [{
        requirement_id: 'R1', implementation_status: 'IMPLEMENTED',
        verification_status: 'VERIFIED', verification_state: 'FULLY_VERIFIED',
        test_cases: ['t1'], evidence, blockers: [],
      }],
      tests: { total: 1, pass: 1, fail: 0, skipped: 0, not_executed: 0, execution_id: 'E', git_head: 'H', exit_code: 0, passing_test_names: ['t1'] },
      validators: { results: [{ status: 'PASS' }], execution_id: 'E', git_head: 'H', exit_code: 0 },
      p0_blockers: [], capabilities: {},
    });
    const noEvidence = computeFinalStatus(base([]));
    assert.equal(noEvidence.counts.verified, 0);
    assert.equal(noEvidence.claim_allowed, false);
    const unbound = computeFinalStatus(base([{ execution_id: 'OTHER', git_head: 'H', hash_valid: true }]));
    assert.equal(unbound.counts.verified, 0);
    const bareStringEvidence = computeFinalStatus(base(['UAP-EV-some-id']));
    assert.equal(bareStringEvidence.counts.verified, 0, 'a bare evidence id proves no binding');
  });

  test('N2 哈希不一致 / 绑定不一致的证据不能产生 VERIFIED', async () => {
    const { computeFinalStatus, verifyEvidenceChain } = await computeFinalStatusMod();
    const badHash = computeFinalStatus({
      execution_id: 'E', git_head: 'H',
      requirements: [{
        requirement_id: 'R1', implementation_status: 'IMPLEMENTED',
        verification_status: 'VERIFIED', verification_state: 'FULLY_VERIFIED',
        test_cases: ['t1'],
        evidence: [{ execution_id: 'E', git_head: 'H', hash_valid: false, worktree_fingerprint: 'F' }],
        blockers: [],
      }],
      tests: { total: 1, pass: 1, fail: 0, skipped: 0, not_executed: 0, execution_id: 'E', git_head: 'H', exit_code: 0, passing_test_names: ['t1'] },
      validators: { results: [{ status: 'PASS' }], execution_id: 'E', git_head: 'H', exit_code: 0 },
      p0_blockers: [], capabilities: {},
    });
    assert.equal(badHash.counts.verified, 0, 'hash_valid=false evidence must never verify');
    const chain = verifyEvidenceChain([{ execution_id: 'E', git_head: 'H', hash_valid: false }], { execution_id: 'E', git_head: 'H' });
    assert.equal(chain.ok, false, 'evidence chain must fail closed on hash mismatch');
  });

  test('N3 独立验证失败时引擎不得输出 PASS', async () => {
    // The validator is fail-closed: point it at a nonexistent results file
    // (env override, no real artifacts touched) and it must exit non-zero
    // with a FATAL reason — and must never print a PASS verdict.
    const r = spawnSync('node', ['.uap/tools/requirement-independent-validator.mjs'], {
      cwd: ROOT, encoding: 'utf8', timeout: 300000,
      env: { ...process.env, UAP_REQUIREMENT_RESULTS_IN: '.uap/reports/NO-SUCH-RESULTS.json' },
    });
    assert.notEqual(r.status, 0, 'without verification results the independent validator must exit non-zero');
    const combined = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    assert.match(combined, /FATAL/, 'must report the fail-closed reason');
    assert.doesNotMatch(combined, /"ok"\s*:\s*true/, 'must never emit ok:true without results');
  });

  test('N4 沙箱配置误指向生产网关必须被拒绝执行', () => {
    const out = go(['test', './service/paymentsandbox/', '-run',
      'TestConfigRejectsProductionGateway|TestConfigRejectsProviderSandboxWithoutCredentials|TestConfigRejectsRealLookingCredentials', '-count=1', '-v']);
    assert.match(out, /--- PASS: TestConfigRejectsProductionGateway/, 'production gateway URL must be rejected');
    assert.match(out, /--- PASS: TestConfigRejectsProviderSandboxWithoutCredentials/, 'provider sandbox without credentials must be blocked');
    assert.match(out, /--- PASS: TestConfigRejectsRealLookingCredentials/, 'credential-looking literals must be rejected');
    assert.doesNotMatch(out, /--- FAIL/);
  });

  test('N5 未授权生产操作必须被权限策略拒绝（fail-closed）', async () => {
    const { check } = await import('../runtime/policy-engine/index.mjs');
    for (const action of ['production_deploy', 'production_write', 'real_payment', 'real_refund', 'secret_export', 'destructive_git', 'quality_gate_disable']) {
      const r = check(action, { reason: 'phase2 negative test' });
      assert.equal(r.allowed, false, `${action} must be denied by policy`);
    }
    // An unknown action must also be denied (default_effect=deny).
    const unknown = check('totally_unknown_action', {});
    assert.equal(unknown.allowed, false);
  });

  test('N6 重复任务不能造成重复资金副作用（真实隔离库故障注入）', () => {
    const out = go(['test', './model/', '-run',
      'TestPhase2DBIntegration/fault_02_commit_then_response_lost|TestPhase2DBIntegration/fault_03_same_request_concurrently|TestPhase2DBIntegration/db_11_idempotency|TestPhase2DBIntegration/db_12_duplicate_request|TestPhase2DBIntegration/db_20_order_balance_ledger_consistency|TestPhase2DBIntegration/fault_04_partial_success_then_crash', '-count=1', '-v']);
    assert.doesNotMatch(out, /--- FAIL/, 'idempotency/fault-injection subtests must pass');
    for (const sub of ['fault_02_commit_then_response_lost', 'fault_03_same_request_concurrently', 'db_11_idempotency', 'db_12_duplicate_request', 'db_20_order_balance_ledger_consistency']) {
      assert.match(out, new RegExp(`--- PASS: TestPhase2DBIntegration/${sub}`), `${sub} must pass on a real isolated DB`);
    }
  });

  test('N7 用户 WIP 不能被自动修复覆盖（既有边界测试真实通过）', () => {
    // The WIP-protection negative case lives inside real-code-repair-boundaries.test.mjs
    // (test name: "WIP 保护：…必须拒绝修复"). Assert it exists by content, then run it for real.
    const boundaryFile = path.join(ROOT, '.uap', 'tests', 'real-code-repair-boundaries.test.mjs');
    assert.ok(fs.existsSync(boundaryFile), 'the repair-boundary test file must exist');
    const content = fs.readFileSync(boundaryFile, 'utf8');
    assert.match(content, /WIP 保护/, 'the WIP-protection negative case must exist in the boundary suite');
    // Nested `node --test` must not inherit the outer runner's NODE_TEST_CONTEXT,
    // which makes the inner test runner misbehave (zero tests / misparsed TAP).
    const nestedEnv = { ...process.env };
    delete nestedEnv.NODE_TEST_CONTEXT;
    const r = spawnSync('node', ['--test', '--test-concurrency=1', '.uap/tests/real-code-repair-boundaries.test.mjs'], {
      cwd: ROOT, encoding: 'utf8', timeout: 300000, env: nestedEnv,
    });
    const out = r.stdout ?? '';
    const failCount = Number(/# fail (\d+)/.exec(out)?.[1] ?? 1);
    assert.equal(failCount, 0, 'the repair-boundary suite (incl. WIP protection) must pass');
    assert.match(out, /# pass ([1-9]\d*)/, 'the suite must contain real passing assertions');
  });

  test('N8 Go handler 层 19 类业务安全负向测试必须全部真实 PASS（TestPhase2SecurityNegative）', () => {
    // controller/phase2_security_negative_test.go 对 N1–N19 每类攻击面跑真实
    // handler 请求（隔离 :memory: SQLite，无任何真实网络/支付/凭据）。本测试
    // 解析机器可读的 `NEG <id> <status> <detail>` 行：任何类别缺失、或状态不是
    // PASS（含 BLOCKED/NOT_RUN）都必须让本测试失败——不允许静默降级。
    const r = spawnSync('go', ['test', './controller/', '-run', 'TestPhase2SecurityNegative', '-count=1', '-v', '-json'], {
      cwd: ROOT, encoding: 'utf8', timeout: 600000,
      env: { ...process.env, GOWORK: 'off' },
    });
    assert.equal(r.status, 0, `go test must exit 0 (stderr: ${r.stderr?.slice(0, 800)})`);
    const stdout = r.stdout ?? '';
    // -json 模式下每行一个事件；NEG 行出现在 t.Logf 的 Output 事件里。
    const results = new Map();
    for (const line of stdout.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{')) continue;
      let event;
      try { event = JSON.parse(trimmed); } catch { continue; }
      const output = event?.Output;
      if (typeof output !== 'string') continue;
      for (const m of output.matchAll(/NEG (n\d{2}) (PASS|FAIL|BLOCKED|NOT_RUN) (.*)/g)) {
        // 同一 id 会被子测试与汇总各打印一次，逐条覆盖时取更严格的状态。
        const rank = { PASS: 0, BLOCKED: 1, NOT_RUN: 1, FAIL: 2 };
        const prev = results.get(m[1]);
        if (!prev || rank[m[2]] >= rank[prev.status]) results.set(m[1], { status: m[2], detail: m[3].trim() });
      }
    }
    const expected = Array.from({ length: 19 }, (_, i) => `n${String(i + 1).padStart(2, '0')}`);
    for (const id of expected) {
      const result = results.get(id);
      assert.ok(result, `category ${id} must print a NEG line`);
      assert.equal(
        result.status, 'PASS',
        `category ${id} must PASS (got ${result.status}: ${result.detail}) — BLOCKED/NOT_RUN fail this gate`,
      );
    }
    assert.equal(results.size, expected.length, 'no unexpected extra NEG categories');
  });
});
