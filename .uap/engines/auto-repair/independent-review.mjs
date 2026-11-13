/**
 * 独立代码审查 / 独立验证路径（UAP 1.0 §1.11 / §4.4 / §8）
 *
 * 硬约束：**不导入任何 UAP 运行时模块**（不用 evidence-engine、不用
 * status-engine、不调用 UAP validator），只用 node 内置模块 + git/go 真实命令，
 * 从磁盘重新计算哈希、重新跑定向测试、重新读 diff。因此它不能复用修复 Agent
 * 的结论，只能靠自己观察到的事实给出 PASS / FAIL。
 *
 * 用法：UAP_REPAIR_LEDGER=.uap/state/repair-ledger/<id>.json node independent-review.mjs
 * 输出：单行 JSON verdict，退出码 0=PASS，1=FAIL（可被 CI 捕获）。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const LEDGER_DIR = path.join(ROOT, '.uap', 'state', 'repair-ledger');
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

function sh(command, args, timeout = 180000) {
  const r = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024 });
  return {
    command: `${command} ${args.join(' ')}`,
    exit_code: r.status,
    stdout: (r.stdout || '').trim(),
    stderr: (r.stderr || '').trim(),
  };
}

function findLatestLedger() {
  if (!fs.existsSync(LEDGER_DIR)) return null;
  const files = fs.readdirSync(LEDGER_DIR).filter((f) => f.endsWith('.json'))
    .map((f) => path.join(LEDGER_DIR, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0] || null;
}

function main() {
  const checks = [];
  const failures = [];
  const add = (name, ok, detail) => {
    checks.push({ name, ok, detail });
    if (!ok) failures.push(`${name}: ${detail}`);
  };

  const ledgerArg = process.env.UAP_REPAIR_LEDGER || '';
  const ledgerFile = ledgerArg
    ? (path.isAbsolute(ledgerArg) ? ledgerArg : path.join(ROOT, ledgerArg))
    : findLatestLedger();
  const ledger = ledgerFile && fs.existsSync(ledgerFile)
    ? JSON.parse(fs.readFileSync(ledgerFile, 'utf8')) : null;
  add('ledger_present', Boolean(ledger), ledger ? rel(ledgerFile) : '未找到修复账本');

  if (ledger) {
    const target = path.join(ROOT, ledger.target_file);
    const backup = path.join(ROOT, ledger.backup_path);
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    const original = fs.existsSync(backup) ? fs.readFileSync(backup, 'utf8') : null;
    add('after_hash_matches_disk', current !== null && sha256(current) === ledger.after_hash,
      `disk=${current === null ? 'missing' : sha256(current)} ledger=${ledger.after_hash}`);
    add('before_hash_matches_backup', original !== null && sha256(original) === ledger.before_hash,
      `backup=${original === null ? 'missing' : sha256(original)} ledger=${ledger.before_hash}`);
    add('code_really_changed', ledger.before_hash !== ledger.after_hash,
      `${ledger.before_hash} -> ${ledger.after_hash}`);
    add('bounded_attempts', Number(ledger.attempts) <= Number(ledger.max_attempts),
      `${ledger.attempts}/${ledger.max_attempts}`);
    add('all_recorded_commands_passed',
      (ledger.commands || []).length > 0 && ledger.commands.every((c) => c.exit_code === 0),
      `${(ledger.commands || []).length} commands, failures=${(ledger.commands || []).filter((c) => c.exit_code !== 0).length}`);
    const allowed = new Set(ledger.allowed_paths || []);
    add('modified_files_in_scope',
      (ledger.modified_files || []).every((f) => allowed.has(f)),
      `modified=${(ledger.modified_files || []).join(',')} allowed=${[...allowed].join(',')}`);
    add('no_sensitive_paths_touched',
      (ledger.modified_files || []).every((f) => !/(payment|refund|secret|\.env|migration|auth)/i.test(f)),
      (ledger.modified_files || []).join(','));

    const head = sh('git', ['rev-parse', 'HEAD']);
    add('git_head_matches', head.exit_code === 0 && head.stdout === ledger.git_head,
      `disk=${head.stdout} ledger=${ledger.git_head}`);

    const diff = sh('git', ['diff', '--name-only', '--', ...(ledger.modified_files || [])]);
    const changed = diff.stdout.split('\n').map((s) => s.trim()).filter(Boolean);
    add('git_diff_confined_to_authorized_file',
      diff.exit_code === 0 && changed.length > 0 && changed.every((f) => allowed.has(f)),
      `changed=[${changed.join(',')}]`);
  }

  // 独立重跑定向测试与关联回归：不采信修复 Agent 记录的结果。
  const repro = sh('go', ['test', './model/', '-run', '^TestReproTrailingSlashCanonicalPathBreaksChannelMatching$', '-count=1']);
  add('reproduction_test_now_passes', repro.exit_code === 0,
    `exit=${repro.exit_code} ${(repro.stdout + repro.stderr).slice(0, 400)}`);
  const canonical = sh('go', ['test', './common/', '-run', '^TestCanonicalUpstreamPath', '-count=1']);
  add('existing_canonical_path_tests_pass', canonical.exit_code === 0,
    `exit=${canonical.exit_code} ${(canonical.stdout + canonical.stderr).slice(0, 400)}`);
  const vet = sh('go', ['vet', './common/', './model/']);
  add('go_vet_clean', vet.exit_code === 0,
    `exit=${vet.exit_code} ${(vet.stdout + vet.stderr).slice(0, 400)}`);

  const verdict = {
    component: 'independent-repair-review',
    verdict: failures.length === 0 ? 'PASS' : 'FAIL',
    at: new Date().toISOString(),
    ledger: ledger ? rel(ledgerFile) : null,
    checks,
    failures,
    commands: [repro, canonical, vet].map((c) => ({ command: c.command, exit_code: c.exit_code })),
  };
  process.stdout.write(`${JSON.stringify(verdict)}\n`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

main();
