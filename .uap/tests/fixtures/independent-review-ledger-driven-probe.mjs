#!/usr/bin/env node
/**
 * Behavioural reproduction probe for the independent-review defect.
 *
 * Defect: `.uap/engines/auto-repair/independent-review.mjs` hard-codes three
 * commands belonging to ONE historical repair (common/request_path.go). It
 * never reads `ledger.commands`, so for any other defect it "verifies" unrelated
 * tests and can return PASS without checking the repaired code at all.
 *
 * This probe builds a ledger whose only recorded command matches no Go test,
 * runs the reviewer against it, and requires the reviewer to:
 *   1. produce an `independent_rerun_*` check (i.e. actually be ledger-driven);
 *   2. mark that check as FAILED because no test actually ran;
 *   3. report `no_tests_to_run=true` in the check detail.
 *
 * Before the fix: no such check exists -> exit 1 (defect reproduced).
 * After the fix:  all three conditions hold -> exit 0.
 *
 * The probe deliberately does NOT assert the overall verdict (other structural
 * checks on a synthetic ledger will fail); it asserts the rerun behaviour only.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const REVIEW = path.join(ROOT, '.uap', 'engines', 'auto-repair', 'independent-review.mjs');
const TARGET = '.uap/engines/auto-repair/independent-review.mjs';

const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
const ledgerPath = path.join(os.tmpdir(), `uap-review-probe-${process.pid}.json`);
const bogusArgs = ['test', './common/', '-run', '^UAP_REVIEW_PROBE_NO_SUCH_TEST$', '-count=1'];

const ledger = {
  execution_id: 'UAP-REVIEW-PROBE',
  task_id: 'UAP-REVIEW-PROBE',
  git_head: (head.stdout || '').trim(),
  target_file: TARGET,
  before_hash: '0'.repeat(64),
  after_hash: '1'.repeat(64),
  backup_path: '.uap/state/repair-sandbox/backups/does-not-exist',
  allowed_paths: [TARGET],
  modified_files: [TARGET],
  max_attempts: 3,
  attempts: 1,
  commands: [{ command: `go ${bogusArgs.join(' ')}`, args: bogusArgs, exit_code: 0 }],
  status: 'TESTS_PASSED',
};

fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
let result;
try {
  result = spawnSync(process.execPath, [REVIEW], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, UAP_REPAIR_LEDGER: ledgerPath },
  });
} finally {
  fs.rmSync(ledgerPath, { force: true });
}

const stdout = (result?.stdout || '').trim();
let verdict = null;
try { verdict = JSON.parse(stdout.split('\n').pop()); } catch { /* handled below */ }

function fail(message) {
  process.stderr.write(`${message}\nreviewer stdout: ${stdout.slice(0, 1500)}\n`);
  process.exit(1);
}

if (!verdict) fail('PROBE FAIL: independent-review produced no machine-readable verdict');
const reruns = (verdict.checks || []).filter((c) => String(c.name).startsWith('independent_rerun_'));
if (reruns.length !== 1) {
  fail(`PROBE FAIL: expected exactly 1 ledger-driven rerun check, got ${reruns.length}. `
    + 'The reviewer is still hard-coding commands instead of reading ledger.commands.');
}
if (reruns[0].ok !== false) {
  fail('PROBE FAIL: a recorded command that runs no test was accepted as a passing rerun.');
}
if (!/no_tests_to_run=true/.test(String(reruns[0].detail))) {
  fail(`PROBE FAIL: rerun detail does not identify the empty-test condition: ${reruns[0].detail}`);
}
process.stdout.write('PROBE PASS: reviewer is ledger-driven and rejects an empty test run\n');
