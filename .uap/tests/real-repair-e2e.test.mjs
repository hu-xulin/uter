/**
 * 真实自主代码修复 + 独立回归验证闭环 · 端到端自动化测试（node:test）
 * ============================================================================
 * 真实运行完整闭环，并逐项真实触发故障注入，断言「失败被正确传播、没有吞掉」。
 * 不构造假 PASS、不放宽断言、不跳过失败测试、不只写占位注释。
 *
 * 覆盖：
 *   [正常] before exit≠0 / after exit=0 / 独立验证器 PASS / diff 非空 /
 *          哈希改变 / 行为真变 add(2,3)===5 / 测试文件哈希未变
 *   [①] 修复 Agent 中途退出不写补丁 → 验证器 FAIL
 *   [②] 极短 timeout → 非 SUCCEEDED 且验证器非 PASS
 *   [③] 并发冲突共享沙箱 → 文件锁保证有且只有一个成功
 *   [④] 重复任务 → 第二次幂等（attempts=0，不伪造第二次修复）
 *   [⑤] 修复后篡改测试文件 → 验证器 FAIL（哈希锁定 + 独立重跑）
 *   [⑥] 删除 before 证据 → 验证器 FAIL（fail-closed）
 *   [⑦] 缺陷超出候选能力 → attempts 达上限并回滚停止，验证器 FAIL
 *   [⑧] 从保存的中间状态恢复 → 修复完成且验证器 PASS
 *   [CLI] 独立验证器 PASS 退出码 0 / FAIL 退出码 1
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const VERIFY_TOOL = path.join(ROOT, '.uap/tools/independent-regression-e2e.mjs');
const { runRealRepairE2E, createSandbox } = await import('../tools/real-repair-e2e.mjs');
const { verifyIndependentRegression } = await import('../tools/independent-regression-e2e.mjs');

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

function cleanup(t, dir) {
  t.after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } });
}
async function importAdd(sandboxDir, tag) {
  const url = `${pathToFileURL(path.join(sandboxDir, 'src/calc.mjs')).href}?t=${tag}_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
  return (await import(url)).add;
}
const check = (verdict, name) => verdict.checks.find((c) => c.name === name);

// ───────────────────────────── 正常场景 ─────────────────────────────
test('正常场景：红转绿 + 独立验证器 PASS + 行为真变 + 测试文件哈希未变', async (t) => {
  const result = await runRealRepairE2E({});
  cleanup(t, result.sandbox_dir);
  assert.equal(result.status, 'SUCCEEDED', JSON.stringify(result.blockers));

  assert.notEqual(result.before_failing.exit_code, 0, '修复前原始测试必须真实失败');
  assert.equal(result.before_failing.timed_out, false);
  assert.ok(/AssertionError|!==/.test(`${result.before_failing.stdout}${result.before_failing.stderr}`),
    '失败输出必须含真实断言错误');
  assert.equal(result.after_passing.original_test.exit_code, 0);
  assert.equal(result.after_passing.regression_test.exit_code, 0);
  assert.equal(result.after_passing.module_test.exit_code, 0);
  assert.equal(result.after_passing.full_test.exit_code, 0);

  // 自主定位证据：诊断来自失败输出 + 源码扫描，TASK.json 无补丁答案
  assert.ok(result.diagnosis.location, '必须定位到缺陷表达式');
  assert.equal(result.diagnosis.buggy_operator, '*');
  assert.equal(result.diagnosis.failure_output_parsed.actual, 6);
  assert.equal(result.diagnosis.failure_output_parsed.expected, 5);
  assert.ok(result.diagnosis.candidates.length >= 5, '必须推导出一组候选变换');
  assert.equal(result.diagnosis.answer_source.startsWith('NONE'), true);

  assert.ok(result.source_diff.length > 0, 'uni-diff 必须非空');
  assert.ok(/^[-+].*return/m.test(result.source_diff), 'diff 必须真的改了 return 表达式');
  assert.notEqual(result.hashes.before_source, result.hashes.after_source, '源码哈希必须改变');
  assert.deepEqual(result.hashes.test_files, result.before_failing.test_file_sha256,
    '测试文件哈希修复前后一致（没改测试预期）');
  assert.equal(result.attempts, 1, '首个命中候选即红转绿');
  assert.equal(result.rollback, false);

  // 行为真变：独立 import 最终源码直接断言
  const add = await importAdd(result.sandbox_dir, 'normal');
  assert.equal(add(2, 3), 5, 'add(2,3) 必须真的返回 5');
  assert.equal(add(0, 5), 5);
  assert.equal(add(-2, 3), 1);

  // 独立验证器：所有 checks 通过
  const verdict = await verifyIndependentRegression({ sandboxDir: result.sandbox_dir });
  assert.equal(verdict.verdict, 'PASS', JSON.stringify(verdict.failures));
  assert.ok(verdict.checks_total >= 12, `checks 数=${verdict.checks_total}`);
  assert.equal(verdict.checks_passed, verdict.checks_total, JSON.stringify(verdict.failures));
  assert.equal(check(verdict, 'before_failure_reproduced').pass, true, '验证器须独立重建修复前失败');
  assert.equal(check(verdict, 'behavioral_check_add').pass, true);
});

// ───────────────────────────── 故障注入 ① ─────────────────────────────
test('故障注入①：修复 Agent 中途退出/不写补丁 → 独立验证器 FAIL', async (t) => {
  const result = await runRealRepairE2E({ interruptAfterBefore: true });
  cleanup(t, result.sandbox_dir);
  assert.equal(result.status, 'INTERRUPTED');
  assert.notEqual(result.before_failing.exit_code, 0, 'before 失败证据仍真实存在');
  assert.equal(result.after_passing, null, '不得伪造修复后的测试结果');
  const add = await importAdd(result.sandbox_dir, 'fi1');
  assert.notEqual(add(2, 3), 5, '没有补丁，源码必须仍是缺陷态');

  const verdict = await verifyIndependentRegression({ sandboxDir: result.sandbox_dir });
  assert.equal(verdict.verdict, 'FAIL', '失败必须被正确传播，不得吞掉');
  assert.equal(check(verdict, 'after_evidence_present').pass, false);
  assert.equal(check(verdict, 'behavioral_check_add').pass, false);
  assert.equal(check(verdict, 'original_test_independent_rerun').pass, false);
});

// ───────────────────────────── 故障注入 ② ─────────────────────────────
test('故障注入②：极短 timeout → 非 SUCCEEDED 且验证器非 PASS', async (t) => {
  const result = await runRealRepairE2E({
    timeoutMs: 120,
    commandEnv: { UAP_E2E_TEST_DELAY_MS: '900' },
  });
  cleanup(t, result.sandbox_dir);
  assert.notEqual(result.status, 'SUCCEEDED', '超时不得被标记成功');
  assert.equal(result.before_failing.timed_out, true, '修复前命令必须真实超时');
  assert.equal(result.before_failing.exit_code, null, '超时不得伪造 exit_code');
  assert.equal(result.attempts, 0, '超时后不得继续修复');

  const verdict = await verifyIndependentRegression({ sandboxDir: result.sandbox_dir });
  assert.notEqual(verdict.verdict, 'PASS', '验证器必须非 PASS');
  assert.equal(check(verdict, 'before_evidence_present').pass, false,
    '超时污染的 before 证据不得被当作真实失败');
});

// ───────────────────────────── 故障注入 ③ ─────────────────────────────
test('故障注入③：两个实例并发写同一沙箱 → 文件锁保证有且只有一个成功', async (t) => {
  const { sandboxDir } = createSandbox({});
  cleanup(t, sandboxDir);
  const [r1, r2] = await Promise.all([
    runRealRepairE2E({ sandboxDir }),
    runRealRepairE2E({ sandboxDir }),
  ]);
  const succeeded = [r1, r2].filter((r) => r.status === 'SUCCEEDED');
  const lockHeld = [r1, r2].filter((r) => r.status === 'LOCK_HELD');
  assert.equal(succeeded.length, 1, `statuses=${JSON.stringify([r1.status, r2.status])}`);
  assert.equal(lockHeld.length, 1, `statuses=${JSON.stringify([r1.status, r2.status])}`);
  const verdict = await verifyIndependentRegression({ sandboxDir });
  assert.equal(verdict.verdict, 'PASS', '成功实例留下的证据仍能被独立验证通过');
});

// ───────────────────────────── 故障注入 ④ ─────────────────────────────
test('故障注入④：重复任务 → 第二次幂等，不伪造第二次修复', async (t) => {
  const { sandboxDir } = createSandbox({});
  cleanup(t, sandboxDir);
  const r1 = await runRealRepairE2E({ sandboxDir });
  assert.equal(r1.status, 'SUCCEEDED');
  const r2 = await runRealRepairE2E({ sandboxDir });
  assert.equal(r2.status, 'IDEMPOTENT');
  assert.equal(r2.idempotent, true);
  assert.equal(r2.attempts, 0, '第二次不得再次执行修复');
  assert.equal(r2.hashes.after_source, r1.hashes.after_source, '必须复用第一次证据');
  assert.equal(r2.before_failing.exit_code, r1.before_failing.exit_code);
  const verdict = await verifyIndependentRegression({ sandboxDir });
  assert.equal(verdict.verdict, 'PASS');
});

// ───────────────────────────── 故障注入 ⑤ ─────────────────────────────
test('故障注入⑤：修复后篡改测试文件 → 独立验证器 FAIL', async (t) => {
  const result = await runRealRepairE2E({});
  cleanup(t, result.sandbox_dir);
  assert.equal(result.status, 'SUCCEEDED');
  // 追加一个必然失败的错误预期（真实改坏测试，不删测试、不放宽断言）
  fs.appendFileSync(
    path.join(result.sandbox_dir, 'tests/regression.test.mjs'),
    "\nassert.equal(add(2, 3), 999, 'injected wrong expectation');\n",
  );
  const verdict = await verifyIndependentRegression({ sandboxDir: result.sandbox_dir });
  assert.equal(verdict.verdict, 'FAIL', '篡改测试必须被正确传播为 FAIL');
  assert.equal(check(verdict, 'test_files_untampered').pass, false,
    '测试文件 sha256 与 TASK 锁定值不一致');
  assert.equal(check(verdict, 'regression_test_independent_rerun').pass, false);
});

// ───────────────────────────── 故障注入 ⑥ ─────────────────────────────
test('故障注入⑥：删除 before 证据 → 独立验证器 FAIL（fail-closed）', async (t) => {
  const result = await runRealRepairE2E({});
  cleanup(t, result.sandbox_dir);
  assert.equal(result.status, 'SUCCEEDED');
  fs.unlinkSync(path.join(result.sandbox_dir, 'evidence', 'before', 'failing-test.json'));
  const verdict = await verifyIndependentRegression({ sandboxDir: result.sandbox_dir });
  assert.equal(verdict.verdict, 'FAIL');
  assert.equal(check(verdict, 'before_evidence_present').pass, false);
});

// ───────────────────────────── 故障注入 ⑦ ─────────────────────────────
test('故障注入⑦：缺陷超出候选能力 → attempts 达上限并回滚停止，验证器 FAIL', async (t) => {
  const result = await runRealRepairE2E({ unfixable: true });
  cleanup(t, result.sandbox_dir);
  assert.equal(result.status, 'FAILED', '无法修复不得伪造成功');
  assert.equal(result.attempts, result.bounded_by, 'attempts 必须达上限且停止');
  assert.ok(result.attempts <= result.bounded_by, '不得无限循环');
  assert.equal(result.rollback, true, '必须回滚到修复前源码');
  assert.equal(result.after_passing, null, '不得产生 after 绿测试结论');
  const diskHash = sha256(fs.readFileSync(path.join(result.sandbox_dir, 'src/calc.mjs'), 'utf8'));
  assert.equal(diskHash, result.hashes.before_source, '磁盘源码必须已回滚');
  const verdict = await verifyIndependentRegression({ sandboxDir: result.sandbox_dir });
  assert.equal(verdict.verdict, 'FAIL', '失败必须被正确传播');
  assert.equal(check(verdict, 'source_diff_nonempty_and_changes_behavior').pass, false);
  assert.equal(check(verdict, 'behavioral_check_add').pass, false);
});

// ───────────────────────────── 故障注入 ⑧ ─────────────────────────────
test('故障注入⑧：从保存的中间状态恢复 → 修复完成且独立验证器 PASS', async (t) => {
  const { sandboxDir } = createSandbox({});
  cleanup(t, sandboxDir);
  const interrupted = await runRealRepairE2E({ sandboxDir, interruptAfterBefore: true });
  assert.equal(interrupted.status, 'INTERRUPTED');
  const mid = JSON.parse(fs.readFileSync(path.join(sandboxDir, 'repair-status.json'), 'utf8'));
  assert.equal(mid.phase, 'BEFORE_CAPTURED', '必须真实保存了中间状态');
  const midAdd = await importAdd(sandboxDir, 'recover-mid');
  assert.notEqual(midAdd(2, 3), 5, '中断时源码仍为缺陷态');

  const resumed = await runRealRepairE2E({ sandboxDir, resume: true });
  assert.equal(resumed.status, 'SUCCEEDED');
  assert.equal(resumed.recovered, true, '必须标记从中间状态恢复');
  assert.ok(resumed.attempts >= 1);
  const finalAdd = await importAdd(sandboxDir, 'recover-final');
  assert.equal(finalAdd(2, 3), 5);
  const verdict = await verifyIndependentRegression({ sandboxDir });
  assert.equal(verdict.verdict, 'PASS', JSON.stringify(verdict.failures));
});

// ───────────────────────────── 独立验证器 CLI 退出码 ─────────────────────────────
test('独立验证器 CLI：PASS 退出码 0 / FAIL 退出码 1（自己给结论）', async (t) => {
  const result = await runRealRepairE2E({});
  cleanup(t, result.sandbox_dir);
  assert.equal(result.status, 'SUCCEEDED');

  const ok = spawnSync('node', [VERIFY_TOOL, result.sandbox_dir], {
    encoding: 'utf8', timeout: 60000, cwd: ROOT,
  });
  assert.equal(ok.status, 0, `stderr=${ok.stderr}`);
  assert.equal(JSON.parse(ok.stdout).verdict, 'PASS');

  fs.appendFileSync(
    path.join(result.sandbox_dir, 'tests/module.test.mjs'),
    "\nthrow new Error('injected broken test');\n",
  );
  const bad = spawnSync('node', [VERIFY_TOOL, result.sandbox_dir], {
    encoding: 'utf8', timeout: 60000, cwd: ROOT,
  });
  assert.equal(bad.status, 1, `stdout=${bad.stdout} stderr=${bad.stderr}`);
  assert.equal(JSON.parse(bad.stdout).verdict, 'FAIL');
});
