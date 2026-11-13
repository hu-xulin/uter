#!/usr/bin/env node
/**
 * Build the REAL repair task for defect UAP-REAL-REPAIR-002.
 *
 * The `patch.old` anchor is sliced from the file on disk (never hand-copied),
 * so the single-anchor uniqueness check inside runRealRepair is guaranteed to
 * refer to the exact current source. Re-running this script after the fix
 * will fail loudly instead of silently producing a stale patch.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TARGET = '.uap/engines/auto-repair/independent-review.mjs';
const src = fs.readFileSync(path.join(ROOT, TARGET), 'utf8');

const startMark = '  // 独立重跑定向测试与关联回归：不采信修复 Agent 记录的结果。';
const endMark = '    commands: [repro, canonical, vet].map((c) => ({ command: c.command, exit_code: c.exit_code })),\n  };\n';
const start = src.indexOf(startMark);
const endAnchor = src.indexOf(endMark);
if (start < 0 || endAnchor < 0) {
  process.stderr.write('PATCH PREP FAILED: hard-coded rerun block not found; '
    + 'the defect may already be fixed or the source changed. Refusing to guess.\n');
  process.exit(1);
}
const end = endAnchor + endMark.length;
if (src.indexOf(startMark, start + 1) >= 0) {
  process.stderr.write('PATCH PREP FAILED: anchor is not unique\n');
  process.exit(1);
}
const oldBlock = src.slice(start, end);

const newBlock = `  // 独立重跑定向测试与关联回归：不采信修复 Agent 记录的结果。
  //
  // 命令必须来自本次修复账本（ledger.commands = 修复引擎真实执行过的
  // targeted_tests + regression_tests），绝不能硬编码成某一个历史缺陷的测试。
  // 硬编码会让第二个缺陷被「验证」无关测试并返回假绿 PASS。
  const rerunnable = (ledger?.commands || []).map((c, index) => {
    const tokens = String(c.command || '').trim().split(/\\s+/).filter(Boolean);
    const args = Array.isArray(c.args) && c.args.length ? c.args : tokens.slice(1);
    return {
      label: \`independent_rerun_recorded_command_\${index + 1}\`,
      exe: tokens[0] || null,
      args,
      recorded_exit_code: c.exit_code,
      command: tokens[0] ? \`\${tokens[0]} \${args.join(' ')}\` : '',
    };
  }).filter((c) => c.exe && c.args.length);

  add('ledger_has_commands_to_rerun', rerunnable.length > 0,
    \`rerunnable=\${rerunnable.length} recorded=\${(ledger?.commands || []).length}\`);

  const rerunResults = [];
  for (const c of rerunnable) {
    const r = sh(c.exe, c.args, 180000);
    const output = \`\${r.stdout}\\n\${r.stderr}\`;
    // "go test -run <name>" 匹配不到用例时仍返回 0（只打印
    // "no tests to run"）。把它算作 PASS 会让写错测试名的验证器假绿。
    const emptyRun = /no tests to run|no test files/i.test(output);
    const passed = r.exit_code === 0 && !emptyRun;
    add(c.label, passed,
      \`exit=\${r.exit_code} no_tests_to_run=\${emptyRun} cmd=\${c.command}\`);
    rerunResults.push({
      command: c.command,
      exit_code: r.exit_code,
      no_tests_to_run: emptyRun,
      recorded_exit_code: c.recorded_exit_code,
      passed,
    });
  }

  const verdict = {
    component: 'independent-repair-review',
    verdict: failures.length === 0 ? 'PASS' : 'FAIL',
    at: new Date().toISOString(),
    ledger: ledger ? rel(ledgerFile) : null,
    checks,
    failures,
    commands: rerunResults.map((c) => ({ command: c.command, exit_code: c.exit_code, passed: c.passed })),
    commands_rerun: rerunResults.length,
    independent_rerun_passed: rerunResults.filter((c) => c.passed).length,
  };
`;

const matrix = JSON.parse(fs.readFileSync(
  path.join(ROOT, '.uap', 'reports', 'REQUIREMENT-TRACEABILITY-MATRIX.json'), 'utf8'));
const related = (matrix.requirements || [])
  .filter((r) => /独立|验证|复核|回归|回归验证|regression|independent/i.test(r.requirement || ''))
  .slice(0, 6);
const requirementIds = related.map((r) => r.requirement_id);
const specificationIds = [...new Set(related.map((r) => r.specification_id))];

const task = {
  task_id: 'UAP-REAL-REPAIR-002',
  title: '修复独立复核脚本硬编码单案例测试导致的假绿验证',
  specification_ids: specificationIds,
  requirement_ids: requirementIds,
  defect: {
    description: 'independent-review.mjs 把定向测试、关联回归、go vet 硬编码成 common/request_path.go 单一历史案例，完全不读 ledger.commands；对任何其他缺陷都会重跑无关测试并给出 PASS，无法检查原始缺陷是否消失、关联功能是否回归。',
    impact: 'UAP 声称具备「独立回归验证」，但第二个及以后的真实代码修复都可能得到未经核实的 PASS，形成假验收闭环。',
    reproduction_test: '.uap/tests/fixtures/independent-review-ledger-driven-probe.mjs',
  },
  scope: {
    allowed_paths: [TARGET],
    review_authorizations: [],
  },
  patch: { file: TARGET, old: oldBlock, new: newBlock },
  reproduction_test: {
    command: 'node',
    args: ['.uap/tests/fixtures/independent-review-ledger-driven-probe.mjs'],
  },
  root_cause_probe: {
    command: 'git',
    args: ['grep', '-n', 'TestReproTrailingSlashCanonicalPathBreaksChannelMatching', '--', TARGET],
  },
  targeted_tests: [
    { command: 'node', args: ['.uap/tests/fixtures/independent-review-ledger-driven-probe.mjs'] },
    { command: 'node', args: ['--check', TARGET] },
  ],
  regression_tests: [
    { command: 'node', args: ['--check', '.uap/bin/uap.mjs'] },
    { command: 'git', args: ['diff', '--check', '--', TARGET] },
  ],
  independent_verification: {
    command: 'node',
    args: [TARGET.replace('.mjs', '.mjs')], // placeholder replaced below
    env: {},
  },
  limits: { max_attempts: 3, timeout_ms: 180000, retry_delay_ms: 300 },
};
// The independent reviewer is the file being repaired. After the patch is
// applied this resolves to the FIXED reviewer, which re-reads the new ledger.
task.independent_verification.args = [TARGET];

const out = path.join(ROOT, '.uap', 'state', 'repair-tasks', 'UAP-REAL-REPAIR-002.json');
fs.writeFileSync(out, `${JSON.stringify(task, null, 2)}\n`);
process.stdout.write(`TASK OK ${out}\nold_block_bytes=${Buffer.byteLength(oldBlock)} `
  + `new_block_bytes=${Buffer.byteLength(newBlock)} requirement_ids=${requirementIds.length}\n`);
