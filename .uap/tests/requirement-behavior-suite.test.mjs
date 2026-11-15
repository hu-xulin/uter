/**
 * Honesty self-test for .uap/tools/requirement-behavior-suite.mjs.
 *
 * It does NOT re-verify the 538 requirements. It verifies that THE SUITE ITSELF
 * does not fabricate PASS lines: every PASS must be produced by a real
 * execution + assertion, and tampering with a real dependency / erasing the
 * real command output must make the corresponding PASS disappear.
 *
 * Run: node --test .uap/tests/requirement-behavior-suite.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  runBehaviorSuite, CHECKS, REQUIREMENT_IDS, loadKnownIds, buildProbeAssertions,
} from '../tools/requirement-behavior-suite.mjs';

// One REAL run up front (real go/node commands + real runtime calls). The suite
// caches the REAL spawn results process-wide, so the injected-dependency tests
// below are fast while still exercising the exact production code path.
const baseline = runBehaviorSuite();

const passIds = (result) => result.lines.map((l) => /^REQ_ASSERT (\S+) PASS /.exec(l)?.[1]).filter(Boolean);
const hasPass = (result, id) => result.lines.some((l) => l.startsWith(`REQ_ASSERT ${id} PASS`));

test('PASS 行格式合法、ID 均在 538 矩阵且唯一', () => {
  const known = loadKnownIds();
  assert.equal(CHECKS.length, REQUIREMENT_IDS.length, 'CHECKS 与 REQUIREMENT_IDS 一致');
  assert.equal(new Set(REQUIREMENT_IDS).size, REQUIREMENT_IDS.length, '每个需求 ID 至多绑定一条断言');
  const seen = new Set();
  for (const line of baseline.lines) {
    const m = /^REQ_ASSERT (\S+) PASS (.+)$/.exec(line);
    assert.ok(m, `PASS 行格式错误: ${line}`);
    const [, id, detail] = m;
    assert.ok(known.has(id), `ID 不存在于 538 矩阵: ${id}`);
    assert.ok(!seen.has(id), `ID 被输出两次（共享断言）: ${id}`);
    seen.add(id);
    assert.ok(detail.trim().length > 0, 'PASS 行必须携带真实证据 detail');
    const rec = baseline.checks.find((c) => c.requirement_id === id);
    assert.ok(rec && rec.pass === true, `${id} 无对应的真实通过 check`);
  }
  // 绝不凭空打印一个编造的 ID
  assert.ok(!baseline.lines.some((l) => l.includes('FAKE-NOT-A-REAL-ID')), '套件不得打印任何编造 ID');
});

test('② PASS 行数量与真实执行次数一致', () => {
  assert.equal(baseline.executed, CHECKS.length, 'executed 应等于真实尝试执行+断言的 check 数');
  assert.equal(baseline.checks.length, baseline.executed, '每个 check 都恰好被真实执行一次');
  assert.equal(baseline.lines.length, baseline.checks.filter((c) => c.pass).length,
    'PASS 行数必须等于真实通过的 check 数（不多打印、不伪造）');
  assert.ok(baseline.lines.length <= baseline.executed, 'PASS 行数不可能超过真实执行次数');
  // 真实环境全部断言成立时，PASS 行数与真实执行次数严格一致
  assert.equal(baseline.lines.length, baseline.executed,
    '真实环境全部通过时，PASS 行数应与真实执行次数一致');
});

test('① 注入故意失败的依赖：被断言的需求不再输出 PASS', () => {
  // 把 summarize 注入成恒返回「全部通过」的假结果；真实 ST1 断言
  // all_pass===false 必然失败，故 UAP-05-002-REQ-013 不应再 PASS。
  const fakeSummary = () => ({
    status_model: 'FAKE', total: 1,
    counts: { PASS: 1, FAIL: 0, BLOCKED: 0, SKIPPED: 0, NOT_RUN: 0, NOT_APPLICABLE: 0 },
    pass: 1, fail: 0, blocked: 0, skipped: 0, not_run: 0, not_applicable: 0,
    all_pass: true, has_failure: false, has_blocking: false, false_pass_attempts: 0, problems: [],
  });
  const broken = runBehaviorSuite({ deps: { status: { summarize: fakeSummary } } });
  const id = 'UAP-05-002-REQ-013';
  assert.ok(!hasPass(broken, id), `${id} 在 summarize 被注入假通过后仍输出 PASS（伪造！）`);
  const rec = broken.checks.find((c) => c.requirement_id === id);
  assert.ok(rec && rec.pass === false, `${id} 应记为 pass=false`);
  // 依赖同一假 summarize 的其它状态断言也应消失（篡改传播）
  for (const other of ['UAP-05-002-REQ-014', 'UAP-00-004-REQ-003', 'UAP-05-004-ACC-004']) {
    assert.ok(!hasPass(broken, other), `${other} 依赖被篡改的 summarize 却仍 PASS`);
  }
});

test('③ 篡改运行时行为：DENY 断言消失（策略被改为恒 ALLOW）', () => {
  const broken = runBehaviorSuite({
    deps: {
      policy: {
        check: () => ({ allowed: true, decision: 'ALLOW', reason: 'injected', agent_id: 'x', permission: 'x' }),
      },
    },
  });
  for (const id of ['UAP-00-003-REQ-005', 'UAP-00-003-REQ-004', 'UAP-00-003-REQ-007', 'UAP-00-002-REQ-014']) {
    assert.ok(!hasPass(broken, id), `${id} 策略被篡改为 ALLOW 后仍输出 PASS（伪造！）`);
    const rec = broken.checks.find((c) => c.requirement_id === id);
    assert.ok(rec && rec.pass === false, `${id} 应记为 pass=false`);
  }
});

test('④ 命令未真实执行时：所有依赖该命令的需求都无 PASS，且无任何未执行需求的 PASS', () => {
  const broken = runBehaviorSuite({
    deps: {
      // 故意让外部命令「未执行/失败」：exit!=0、stdout 为空
      spawn: () => ({ exit_code: 1, stdout: '', stderr: '', error: 'injected: command not executed' }),
    },
  });
  const spawnIds = CHECKS.filter((c) => ['pay', 'model', 'node'].includes(c.group)).map((c) => c.requirement_id);
  for (const id of spawnIds) {
    assert.ok(!hasPass(broken, id), `${id} 依赖的命令未真实执行却输出 PASS（伪造！）`);
  }
  // 每个仍然输出的 PASS 行，都必须能找到对应 pass=true 的真实 check
  for (const line of broken.lines) {
    const id = /^REQ_ASSERT (\S+) PASS /.exec(line)?.[1];
    assert.ok(id, `非法 PASS 行: ${line}`);
    assert.ok(broken.checks.some((c) => c.requirement_id === id && c.pass === true), `${id} 无真实通过的 check`);
  }
  // 纯函数/运行时类断言仍可真实通过，证明这是「局部失效」而非整体崩掉
  assert.ok(broken.lines.length > 0, '注入局部失败不应导致整个套件无输出');
});

test('真实执行抛异常时 fail-closed：该段不输出 PASS 且套件完整跑完', () => {
  const boom = () => { throw new Error('injected boom'); };
  const broken = runBehaviorSuite({ deps: { runtime: { gitHead: boom, fingerprintBasis: boom } } });
  for (const id of ['UAP-08-001-REQ-006', 'UAP-08-002-REQ-009']) {
    assert.ok(!hasPass(broken, id), `${id} 依赖的运行时函数抛异常却仍 PASS`);
    const rec = broken.checks.find((c) => c.requirement_id === id);
    assert.ok(rec && rec.pass === false && /EXCEPTION/.test(rec.detail), `${id} 应记为 pass=false 且 detail 含 EXCEPTION`);
  }
  assert.equal(broken.executed, CHECKS.length, '局部异常不应中断其余 check 的真实执行');
  assert.ok(broken.lines.length > 0, '其余不依赖该运行时的 check 仍应真实输出 PASS');
});

test('buildProbeAssertions 的 required_output 与真实 PASS 行一一对应且互不相同', () => {
  const assertions = buildProbeAssertions();
  assert.equal(assertions.length, CHECKS.length);
  const req0 = assertions.map((a) => a.required_output[0]);
  assert.equal(new Set(req0).size, req0.length, '每条断言的 required_output[0] 必须互不相同（distinct）');
  for (const a of assertions) {
    assert.match(a.required_output[0], /^REQ_ASSERT UAP-\d{2}-\d{3}-(REQ|ACC)-\d{3} PASS$/, `非法 required_output: ${a.required_output[0]}`);
    assert.ok(loadKnownIds().has(a.requirement_id));
  }
  // baseline 真实输出的每个 ID 都应有对应的 required_output 前缀
  for (const id of passIds(baseline)) {
    assert.ok(req0.includes(`REQ_ASSERT ${id} PASS`), `${id} 缺少可写入 yaml 的 required_output`);
  }
});
