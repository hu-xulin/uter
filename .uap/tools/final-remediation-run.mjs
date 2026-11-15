/**
 * UAP FINAL REMEDIATION — single-batch acceptance orchestrator.
 *
 * Why this exists
 * ---------------
 * The audit at baseline 58ad9f607 showed 15 final reports bound to SIX
 * different execution_ids / worktree fingerprints and a git_head that no
 * longer matched HEAD. The cause was not a falsified report: every
 * `uap verify-*` command was launched as a separate, hand-ordered batch, and
 * `currentExecution()` correctly opened a NEW identity whenever a tracked
 * file changed between commands (including concurrent sessions editing the
 * repository). `uap accept` only recomputes the gate — it never re-runs the
 * verifiers — so the mixed batch was baked into the final report.
 *
 * This orchestrator enforces the documented final order:
 *   code freeze -> full tests -> requirement verification -> final reports
 *   -> evidence manifest -> manifest verification -> final acceptance
 *   -> acceptance verification -> read-only integrity check.
 *
 * It NEVER edits a report to make it pass. It runs the real registered UAP
 * commands, records their real exit codes/output, and fails closed on any
 * worktree-fingerprint drift (i.e. any source change during the batch).
 * After the manifest is generated no step is allowed to overwrite an entry;
 * the final pass is strictly read-only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, REPORTS, STATE, relToRoot } from '../runtime/_lib/paths.mjs';
import { nowISO, readJSON, writeJSON } from '../runtime/_lib/util.mjs';
import { startExecution, gitHead, worktreeFingerprint } from '../runtime/status-engine/execution.mjs';
import {
  verifyEvidenceManifest, verifyFinalReportBindings, MANIFEST_FILE, FINAL_REPORTS,
} from '../runtime/evidence-engine/manifest.mjs';

const UAP_CLI = path.join(ROOT, '.uap', 'bin', 'uap.mjs');
const STACK_SH = path.join(ROOT, 'scripts', 'phase2-test-stack.sh');
const LOG_DIR = path.join(REPORTS, 'UAP-FINAL-REMEDIATION-LOGS');
const RESULTS_FILE = path.join(REPORTS, 'UAP-FINAL-REMEDIATION-RESULTS.json');
const args = process.argv.slice(2);
const QUICK = args.includes('--quick');
const NO_STACK = args.includes('--no-stack');

// Mirrors scripts/phase2-test-stack.sh env.sh. Kept explicit so the batch is
// reproducible without relying on a shell `source`.
const STACK_ENV = {
  TEST_FRONTEND_URL: 'http://localhost:3101',
  VISUAL_BASE_URL: 'http://localhost:3101',
  BUSINESS_BASE_URL: 'http://localhost:3101',
  AXE_BASE_URL: 'http://localhost:3101',
  UAP_TEST_STACK: 'isolated',
  UTER_TEST_STACK: 'isolated',
};

fs.mkdirSync(LOG_DIR, { recursive: true });

function runProcess(command, argv, { env = {}, timeoutMs = 900000, cwd = ROOT } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const name = `${path.basename(command)}-${argv.join('-')}`.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 110);
    const logPath = path.join(LOG_DIR, `${name}.log`);
    const stream = fs.createWriteStream(logPath);
    let tail = '';
    let timedOut = false;
    let child;
    try {
      child = spawn(command, argv, {
        cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      stream.end();
      return resolve({ command: `${command} ${argv.join(' ')}`, exit_code: 1, timed_out: false,
        duration_ms: Date.now() - started, log: relToRoot(logPath), stdout_tail: String(error.message), spawn_error: true });
    }
    const onData = (chunk) => {
      stream.write(chunk);
      tail = (tail + chunk.toString()).slice(-4000);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeoutMs);
    child.on('error', (error) => { tail += `\nSPAWN_ERROR ${error.message}`; });
    child.on('close', (code) => {
      clearTimeout(timer);
      stream.end();
      resolve({
        command: `${command} ${argv.join(' ')}`, exit_code: code, timed_out: timedOut,
        duration_ms: Date.now() - started, log: relToRoot(logPath), stdout_tail: tail.slice(-2000),
      });
    });
  });
}

async function uap(step, argv, opts = {}) {
  const r = await runProcess(process.execPath, [UAP_CLI, ...argv], opts);
  return { step, ...r };
}

async function shell(step, argv, opts = {}) {
  const r = await runProcess('bash', argv, opts);
  return { step, ...r };
}

async function httpOk(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.status;
  } catch { return null; }
}

/** Read-only drift check. Never calls currentExecution() (which could itself
 *  open a new identity and mask the drift it is supposed to detect). */
function readCurrentIdentity() {
  return readJSON(path.join(STATE, 'current-execution.json'), null);
}

function driftRecord(batch, label) {
  const identity = readCurrentIdentity();
  const fpNow = worktreeFingerprint();
  return {
    label,
    current_execution_id: identity?.execution_id ?? null,
    batch_execution_id: batch.execution_id,
    fingerprint_now: fpNow,
    batch_fingerprint: batch.worktree_fingerprint,
    ip_drifted: identity?.execution_id !== batch.execution_id,
    fingerprint_drifted: fpNow !== batch.worktree_fingerprint,
  };
}

async function main() {
  const startedAt = nowISO();
  const wallStart = Date.now();
  const steps = [];
  const drift = [];
  const preflight = {};

  // ---- phase 0: preflight (read-only) -------------------------------------
  for (const bin of ['node', 'git', 'go', 'bun', 'redis-server', 'sqlite3']) {
    try {
      const r = await runProcess('/usr/bin/env', [bin, '--version'], { timeoutMs: 15000 });
      preflight[bin] = r.exit_code;
    } catch { preflight[bin] = null; }
  }
  preflight.web_node_modules = fs.existsSync(path.join(ROOT, 'web', 'node_modules'));
  preflight.web_package_json = fs.existsSync(path.join(ROOT, 'web', 'package.json'));
  preflight.head_at_freeze = gitHead();
  try {
    preflight.branch = execFileSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }).trim();
    preflight.uncommitted_at_freeze = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).split('\n').filter((l) => l.trim()).length;
  } catch (error) {
    preflight.branch = null;
    preflight.uncommitted_at_freeze = null;
    preflight.git_preflight_error = error.message;
  }

  // ---- phase 1: freeze code, open ONE batch ------------------------------
  const batch = startExecution('uap-final-remediation single-batch acceptance');
  const record = async (step, promise) => {
    const r = await promise;
    steps.push(r);
    const d = driftRecord(batch, step);
    if (d.ip_drifted || d.fingerprint_drifted) drift.push(d);
    console.log(`[${r.exit_code === 0 ? 'OK' : 'FAIL'}] ${step} exit=${r.exit_code} ${r.duration_ms}ms${d.ip_drifted || d.fingerprint_drifted ? ' *** DRIFT ***' : ''}`);
    return r;
  };

  // ---- phase 2: real build + self-tests (no source edits after this) -----
  await record('build', uap('build', ['build'], { timeoutMs: 1800000 }));
  await record('uap_selftest', uap('uap_selftest', ['test', '--all'], { timeoutMs: 1200000 }));

  // ---- phase 3: isolated stack + verifiers ------------------------------
  let stackStarted = false;
  if (!NO_STACK && !QUICK) {
    const start = await shell('isolated_stack_start', [STACK_SH, 'start'], { timeoutMs: 300000 });
    steps.push(start);
    stackStarted = start.exit_code === 0;
    preflight.stack_frontend_http = await httpOk('http://localhost:3101');
    preflight.stack_backend_http = await httpOk('http://localhost:3100');
    console.log(`[${stackStarted ? 'OK' : 'FAIL'}] isolated_stack_start exit=${start.exit_code} frontend=${preflight.stack_frontend_http} backend=${preflight.stack_backend_http}`);
  }
  if (stackStarted) {
    const d = driftRecord(batch, 'after_stack_start');
    if (d.ip_drifted || d.fingerprint_drifted) drift.push(d);
  }

  await record('validators', uap('validators', ['validate', '--all'], { env: stackStarted ? STACK_ENV : {}, timeoutMs: 1800000 }));
  if (!QUICK && stackStarted) {
    await record('verify_e2e', uap('verify_e2e', ['verify-e2e'], { env: STACK_ENV, timeoutMs: 1200000 }));
    await record('verify_visual', uap('verify_visual', ['verify-visual'], { env: STACK_ENV, timeoutMs: 1200000 }));
  }
  await record('verify_database', uap('verify_database', ['verify-database'], { env: stackStarted ? STACK_ENV : {}, timeoutMs: 900000 }));
  await record('verify_payment', uap('verify_payment', ['verify-payment'], { env: stackStarted ? STACK_ENV : {}, timeoutMs: 900000 }));
  await record('verify_security', uap('verify_security', ['verify-security'], { env: stackStarted ? STACK_ENV : {}, timeoutMs: 900000 }));
  await record('verify_requirements', uap('verify_requirements', ['verify-requirements'], { env: stackStarted ? STACK_ENV : {}, timeoutMs: 900000 }));

  if (stackStarted) {
    const stop = await shell('isolated_stack_stop', [STACK_SH, 'stop'], { timeoutMs: 180000 });
    steps.push(stop);
    console.log(`[${stop.exit_code === 0 ? 'OK' : 'FAIL'}] isolated_stack_stop exit=${stop.exit_code}`);
  }

  // ---- phase 4: final reports -> manifest -> acceptance ------------------
  await record('final_reports', uap('final_reports', ['report', '--final'], { timeoutMs: 900000 }));
  await record('final_acceptance', uap('final_acceptance', ['accept'], { timeoutMs: 900000 }));

  // ---- phase 5: STRICTLY READ-ONLY integrity verification ----------------
  const manifest = verifyEvidenceManifest({ strictCurrent: true });
  const bindings = verifyFinalReportBindings();
  const manifestDisk = readJSON(MANIFEST_FILE, null);
  const acceptance = readJSON(path.join(REPORTS, 'FINAL-ACCEPTANCE.json'), null);
  const manifestTime = Date.parse(manifestDisk?.generated_at || '');
  const overwrittenAfterManifest = [];
  const reportBindings = [];
  for (const name of FINAL_REPORTS) {
    const file = path.join(REPORTS, name);
    const isJson = name.endsWith('.json');
    if (!fs.existsSync(file)) { reportBindings.push({ name, exists: false, is_json: isJson }); continue; }
    const data = isJson ? readJSON(file, null) : null;
    reportBindings.push({
      name, exists: true, is_json: isJson, bytes: fs.statSync(file).size,
      execution_id: data?.execution_id ?? null,
      git_head: data?.git_head ?? null,
      worktree_fingerprint: data?.worktree_fingerprint ?? null,
      status: data?.status ?? null,
      mtime: new Date(fs.statSync(file).mtimeMs).toISOString(),
    });
    if (Number.isFinite(manifestTime) && fs.statSync(file).mtimeMs > manifestTime + 2000) {
      overwrittenAfterManifest.push(name);
    }
  }
  // Markdown deliverables are hashed by the manifest but carry no JSON
  // binding block; only JSON reports participate in the batch-binding check.
  const jsonReports = reportBindings.filter((r) => r.exists && r.is_json);
  const integrity = {
    checked_at: nowISO(),
    manifest_ok: manifest.ok, manifest_problems: manifest.problems,
    manifest_checked: manifest.checked,
    manifest_integrity_hash: manifest.manifest_integrity_hash ?? null,
    bindings_ok: bindings.ok, bindings_problems: bindings.problems,
    acceptance_manifest_hash_match: acceptance?.evidence_manifest_hash === manifestDisk?.manifest_integrity_hash,
    single_batch: jsonReports.every((r) => r.execution_id === batch.execution_id),
    single_head: jsonReports.every((r) => r.git_head === batch.git_head),
    single_fingerprint: jsonReports.every((r) => r.worktree_fingerprint === batch.worktree_fingerprint),
    overwritten_after_manifest: overwrittenAfterManifest,
    frozen_fingerprint_now: worktreeFingerprint(),
    frozen_fingerprint_match: worktreeFingerprint() === batch.worktree_fingerprint,
    report_bindings: reportBindings,
  };
  integrity.integrity_ok = manifest.ok && bindings.ok && integrity.single_batch
    && integrity.single_head && integrity.single_fingerprint
    && overwrittenAfterManifest.length === 0 && drift.length === 0
    && integrity.frozen_fingerprint_match;

  const failedSteps = steps.filter((s) => s.exit_code !== 0);
  const result = {
    schema_version: '1.0',
    component: 'uap.final-remediation.orchestrator',
    started_at: startedAt,
    finished_at: nowISO(),
    duration_ms: Date.now() - wallStart,
    mode: QUICK ? 'QUICK (e2e/visual skipped)' : (NO_STACK ? 'NO_STACK' : 'FULL'),
    batch_execution_id: batch.execution_id,
    batch_git_head: batch.git_head,
    batch_worktree_fingerprint: batch.worktree_fingerprint,
    preflight,
    steps,
    step_count: steps.length,
    step_failed: failedSteps.length,
    drift_events: drift,
    integrity,
    final_acceptance: {
      status: acceptance?.status ?? null,
      overall_status: acceptance?.overall_status ?? null,
      claim_allowed: acceptance?.claim_allowed ?? null,
      counts: acceptance?.counts ?? null,
      blocked_items: acceptance?.blocked_items ?? null,
    },
    // Honest verdict of THIS orchestration run. It never claims FULLY_VERIFIED.
    orchestration_status: failedSteps.length || !integrity.integrity_ok ? 'FAILED' : 'EVIDENCE_CONSISTENT',
    note: 'A consistent evidence batch is NOT an acceptance PASS. The gate verdict is copied verbatim from FINAL-ACCEPTANCE.json.',
  };
  writeJSON(RESULTS_FILE, result);
  console.log('\n=== FINAL REMEDIATION ORCHESTRATION ===');
  console.log(`batch=${batch.execution_id} head=${batch.git_head}`);
  console.log(`steps=${steps.length} failed=${failedSteps.length} drift=${drift.length}`);
  console.log(`manifest_ok=${manifest.ok} bindings_ok=${bindings.ok} integrity_ok=${integrity.integrity_ok}`);
  console.log(`acceptance=${result.final_acceptance.overall_status} claim_allowed=${result.final_acceptance.claim_allowed}`);
  console.log(`orchestration_status=${result.orchestration_status}`);
  return result.orchestration_status === 'EVIDENCE_CONSISTENT' ? 0 : 1;
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().then((code) => { process.exit(code); }).catch((error) => {
    console.error('final-remediation orchestrator crashed:', error);
    process.exit(1);
  });
}
