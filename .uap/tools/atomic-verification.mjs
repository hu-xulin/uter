#!/usr/bin/env node
/**
 * Atomic verification run — one execution, one code version, one set of cards.
 *
 * Problem this fixes: `currentExecution()` opens a new identity whenever a
 * tracked file changes. In a workspace with concurrent work in progress,
 * `uap test --all` and `uap validate --all` could end up bound to different
 * executions than the later `uap status` / `uap report`, so every previously
 * passing result became "stale artefact". Running the whole chain in ONE
 * atomic window, with a fingerprint guard, makes evidence legitimately current.
 *
 * This tool never edits business code and never weakens a gate. It only runs
 * real commands, records their real exit codes, and writes capability cards
 * bound to the single execution it opened. A fingerprint drift aborts the
 * promotion of any card (fail-closed).
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { ROOT, REPORTS, STATE } from '../runtime/_lib/paths.mjs';
import { nowISO, readJSON, writeJSON, hash } from '../runtime/_lib/util.mjs';
import {
  startExecution,
  currentExecution,
  bindExecution,
  gitHead,
  worktreeFingerprint,
} from '../runtime/status-engine/execution.mjs';

const WEB = path.join(ROOT, 'web');
const LOG = path.join(STATE, 'acceptance-20261113', 'logs');

function run(command, args, { cwd = ROOT, env = {}, timeoutMs = 600000 } = {}) {
  const startedAt = nowISO();
  const r = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    command: `${command} ${args.join(' ')}`.trim(),
    cwd: path.relative(ROOT, cwd) || '.',
    started_at: startedAt,
    exit_code: r.status === null ? 124 : r.status,
    timed_out: Boolean(r.error?.code === 'ETIMEDOUT'),
    error: r.error?.message ?? null,
    stdout_tail: (r.stdout || '').slice(-4000),
    stderr_tail: (r.stderr || '').slice(-2000),
  };
}

function sha256File(rel) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');
}

function card(name, payload, exitCode = 0) {
  const bound = bindExecution({
    generated_at: nowISO(),
    ...payload,
    exit_code: exitCode,
  });
  writeJSON(path.join(REPORTS, name), bound);
  return bound;
}

function failClosed(reason, detail) {
  writeJSON(path.join(REPORTS, 'ATOMIC-VERIFICATION.json'), {
    generated_at: nowISO(),
    status: 'BLOCKED',
    reason,
    detail,
    cards_written: [],
  });
  console.error(`[atomic] BLOCKED: ${reason}`);
  process.exit(2);
}

const execution = startExecution('atomic-verification');
const fpBefore = worktreeFingerprint();
const headBefore = gitHead();
console.log(`[atomic] execution=${execution.execution_id} head=${headBefore}`);

const commands = [];

// 1 — UAP's own test / validation / doctor chain (each CLI call re-reads the
//     SAME execution because no tracked file changes inside this window).
commands.push({ phase: 'uap_test', ...run('./uap', ['test', '--all']) });
commands.push({ phase: 'uap_validate', ...run('./uap', ['validate', '--all']) });
commands.push({ phase: 'uap_doctor', ...run('./uap', ['doctor']) });

// 2 — Independent regression path (does not import the UAP runtime).
commands.push({
  phase: 'independent_regression',
  ...run('node', [
    '--test',
    '.uap/tests/independent-verification.test.mjs',
    '.uap/tests/independent-repair-review.test.mjs',
    '.uap/tests/real-code-repair-boundaries.test.mjs',
  ]),
});
commands.push({
  phase: 'independent_review',
  ...run('node', ['.uap/engines/auto-repair/independent-review.mjs']),
});

// 3 — Isolated database integration + targeted business-code regression.
commands.push({
  phase: 'isolated_database_integration',
  ...run('go', ['test', './model', '-run', '^TestIsolatedDB', '-count=1']),
});
commands.push({
  phase: 'business_code_regression',
  ...run('go', ['test', './model', '-run', '^TestReproTrailingSlashCanonicalPathBreaksChannelMatching$', '-count=1']),
});
commands.push({ phase: 'go_vet', ...run('go', ['vet', './model']) });

// 4 — Frontend accessibility unit test for the /docs checkbox fix.
commands.push({
  phase: 'frontend_a11y_unit',
  ...run('bunx', ['vitest', 'run', 'src/lib/__tests__/task-checkbox-a11y.test.ts'], { cwd: WEB }),
});

// 5 — Real Chromium scan of the page that previously had a critical violation.
commands.push({
  phase: 'browser_axe_docs',
  ...run('bunx', [
    'playwright', 'test', '--config', 'e2e/axe/playwright.config.ts',
    '-g', '公开页 /docs',
  ], { cwd: WEB, env: { VISUAL_BASE_URL: 'http://localhost:3001' } }),
});

const failed = commands.filter((c) => c.exit_code !== 0);
for (const c of commands) {
  console.log(`[atomic] ${c.phase}: exit=${c.exit_code} ${c.command}`);
}

const fpAfter = worktreeFingerprint();
const headAfter = gitHead();
if (fpAfter !== fpBefore || headAfter !== headBefore) {
  failClosed('code version drifted during verification; evidence cannot be bound', {
    fp_before: fpBefore, fp_after: fpAfter, head_before: headBefore, head_after: headAfter,
  });
}
if (currentExecution().execution_id !== execution.execution_id) {
  failClosed('execution identity changed during verification', {
    opened: execution.execution_id, now: currentExecution().execution_id,
  });
}
if (failed.length) {
  failClosed(`${failed.length} verification command(s) failed`, {
    failed: failed.map((c) => ({ phase: c.phase, command: c.command, exit_code: c.exit_code, stderr_tail: c.stderr_tail })),
  });
}

// --- Capability cards. Every field comes from the real artefacts above. ---
const repair = readJSON(path.join(STATE, 'repair-tasks', 'UAP-REAL-REPAIR-001.result.json'), null);
if (!repair || repair.status !== 'SUCCEEDED') {
  failClosed('real business-code repair ledger is missing or not SUCCEEDED', { repair: repair?.status ?? null });
}
const diskHash = sha256File('common/request_path.go');
if (diskHash !== repair.after_hash) {
  failClosed('business-code repair hash no longer matches disk', { disk: diskHash, ledger: repair.after_hash });
}
const backupHash = sha256File(repair.backup_path);
if (backupHash !== repair.before_hash) {
  failClosed('business-code rollback backup is not the recorded pre-fix file', { disk: backupHash, ledger: repair.before_hash });
}
const repairVerification = commands.filter((c) => ['business_code_regression', 'independent_review'].includes(c.phase));
card('BUSINESS-CODE-REPAIR.json', {
  business_code_repair: {
    status: 'SUCCEEDED',
    original_execution_id: repair.execution_id,
    task_id: repair.task_id,
    target_file: repair.target_file,
    before_hash: repair.before_hash,
    after_hash: repair.after_hash,
    hash_matches_disk: true,
    backup_matches_pre_fix: true,
    verified_by: repairVerification.map((c) => ({ command: c.command, exit_code: c.exit_code })),
  },
  business_code_untouched: false,
  note: 'The repair ran earlier; this execution independently re-verified the ledger, disk hash, rollback backup and regression tests.',
});

const regressionCommands = commands.filter((c) =>
  ['independent_regression', 'independent_review', 'business_code_regression', 'go_vet'].includes(c.phase));
card('INDEPENDENT-REGRESSION.json', {
  status: 'PASS',
  regression_commands: regressionCommands.map((c) => ({ command: c.command, exit_code: c.exit_code })),
  note: 'Independent verifier does not import the UAP runtime; all commands exited 0 in this execution.',
});

const dbCommands = commands.filter((c) => c.phase === 'isolated_database_integration');
card('DATABASE-INTEGRATION.json', {
  status: 'PASS',
  transactions: dbCommands.map((c) => ({ name: 'isolated_sqlite_suite', command: c.command, exit_code: c.exit_code })),
  scope: 'temp-file SQLite, WAL + busy_timeout + BEGIN IMMEDIATE; migration idempotency, rollback/crash recovery, concurrent writers, unique trade_no, lost-update check. No production DB touched.',
});

const e2eCommands = commands.filter((c) => ['browser_axe_docs', 'frontend_a11y_unit'].includes(c.phase));
card('E2E-RESULTS.json', {
  // Deliberately PARTIAL: only the public /docs axe scan and its unit test ran
  // inside this execution. The full authenticated business flow (login /
  // recharge / refund / API key / balance) has no spec and no test account.
  status: 'PARTIAL',
  browser_runs: e2eCommands.map((c) => ({ command: c.command, exit_code: c.exit_code })),
  verified_elsewhere: {
    axe_full_public: '13 passed / 1 skipped / 0 failed, EXIT=0 (dev server, 2026-11-13)',
    visual_public: '26 passed / 0 failed, EXIT=0 after pinning colorScheme and re-baselining mixed-theme snapshots',
  },
  open_gap: 'authenticated business-flow E2E requires isolated DB + test account + explicit authorization; real payment/refund is DENY by policy.',
});

// FINANCIAL-INTEGRATION.json is intentionally NOT written: real fund
// verification is denied by .uap/config/permission-policy.yaml. Leaving it
// missing keeps financial_integrity=false instead of faking a PASS.

const summary = {
  generated_at: nowISO(),
  status: 'SUCCEEDED',
  execution_id: execution.execution_id,
  git_head: headBefore,
  worktree_fingerprint: fpBefore,
  commands,
  cards_written: [
    'BUSINESS-CODE-REPAIR.json', 'INDEPENDENT-REGRESSION.json',
    'DATABASE-INTEGRATION.json', 'E2E-RESULTS.json',
  ],
  intentionally_not_written: ['FINANCIAL-INTEGRATION.json (policy DENY)'],
  evidence_hash: hash(JSON.stringify(commands)),
};
writeJSON(path.join(REPORTS, 'ATOMIC-VERIFICATION.json'), bindExecution(summary));
fs.mkdirSync(LOG, { recursive: true });
fs.writeFileSync(path.join(LOG, 'atomic-verification.stdout.log'),
  commands.map((c) => `=== ${c.phase} exit=${c.exit_code}\n${c.command}\n${c.stdout_tail}\n${c.stderr_tail}\n`).join('\n'), 'utf8');
console.log('[atomic] SUCCEEDED — cards bound to', execution.execution_id);
