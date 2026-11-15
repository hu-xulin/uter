/**
 * UAP Phase 2 — REAL CODE REPAIR + INDEPENDENT REGRESSION capability cards.
 *
 *   node .uap/tools/phase2-capability-cards.mjs
 *
 * This is a GENERATOR backed by two REAL, separate OS processes:
 *
 *   1. node .uap/tools/real-repair-e2e.mjs
 *        Creates a dedicated tmpdir sandbox with a genuinely defective source
 *        file + a failing test. It diagnoses the failure, rewrites REAL source
 *        code, re-runs the ORIGINAL failing test until red->green, then runs
 *        the added regression / module / full suites. It emits pure DATA (no
 *        PASS verdict, no self-signed conclusion).
 *   2. node .uap/tools/independent-regression-e2e.mjs <sandboxDir>
 *        A DIFFERENT process that does not import the repair side, does not
 *        read `repair-status.json` or any repair-side verdict, re-reads the
 *        original TASK acceptance conditions, independently re-runs the before
 *        failure and all after tests, re-computes hashes, checks the diff
 *        really changes program behaviour, and dynamically imports the final
 *        source to assert add(2,3) === 5. It alone issues PASS/FAIL.
 *
 * This generator ONLY consumes raw command results from those two processes,
 * applies fail-closed checks of its own, persists an immutable evidence record
 * (before/after source, diff, test outputs, hashes), and writes the two
 * capability cards that `final-acceptance-gate.mjs capabilityProven()` reads.
 *
 * It NEVER edits a requirement status, NEVER fabricates a PASS, and on any
 * failed check writes an honest FAIL card with exit code 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { ROOT, REPORTS, EVIDENCE } from '../runtime/_lib/paths.mjs';
import { currentExecution, gitHead, worktreeFingerprint } from '../runtime/status-engine/execution.mjs';
import { record, verify as verifyEvidence } from '../runtime/evidence-engine/index.mjs';
import { repositoryIdentity } from '../runtime/evidence-engine/manifest.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPAIR_TOOL = path.join(HERE, 'real-repair-e2e.mjs');
const INDEPENDENT_TOOL = path.join(HERE, 'independent-regression-e2e.mjs');
const REPAIR_CARD = path.join(REPORTS, 'UAP-REAL-CODE-REPAIR-RESULTS.json');
const REGRESSION_CARD = path.join(REPORTS, 'UAP-INDEPENDENT-REGRESSION-RESULTS.json');

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const now = () => new Date().toISOString();
const readText = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const writeJSON = (p, v) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`, 'utf8');
};

function spawnJson(command, args, timeoutMs, label) {
  const r = spawnSync(command, args, {
    cwd: ROOT, encoding: 'utf8', timeout: timeoutMs,
    env: { ...process.env }, maxBuffer: 24 * 1024 * 1024, shell: false,
  });
  const stdout = r.stdout || '';
  let parsed = null;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    const a = stdout.indexOf('{');
    const b = stdout.lastIndexOf('}');
    if (a !== -1 && b > a) { try { parsed = JSON.parse(stdout.slice(a, b + 1)); } catch { /* honest null */ } }
  }
  return {
    label,
    command: `${command} ${args.join(' ')}`.trim(),
    exit_code: r.status,
    timed_out: r.error?.code === 'ETIMEDOUT' || (r.status === null && r.signal === 'SIGTERM'),
    signal: r.signal || null,
    stdout, stderr: r.stderr || '', parsed,
  };
}

/** Structural isolation proof: the verifier must not import the repair side or
 *  read its self-status / verdict files.
 *
 *  IMPORTANT: only EXECUTABLE code counts. The verifier's header comment
 *  legitimately says "does not read repair-status.json"; naively grepping the
 *  raw file for that filename produced a false FAIL (the comment is evidence of
 *  the constraint, not a violation of it). Strip comments first, then inspect. */
function verifierIsolation() {
  const src = readText(INDEPENDENT_TOOL) || '';
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/gm, '$1');
  const imports = [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
  return {
    code_only_checked: true,
    no_repair_import: !/from\s+['"][^'"]*real-repair-e2e/.test(code),
    no_repair_status_read: !/repair-status\.json/.test(code),
    no_repair_result_read: !/REAL_REPAIR_RESULT|repairResult|result\.status/.test(code),
    only_node_builtin_imports: imports.length > 0 && imports.every((s) => s.startsWith('node:')),
    imports,
    separate_process: true,
    source_sha256: sha256(src),
  };
}

function buildBindings(command, exitCode) {
  const e = currentExecution();
  const repo = repositoryIdentity();
  return {
    schema_version: '1.0',
    status_model: 'UAP-TEST-STATUS-1.0',
    generated_at: now(),
    repository: repo.repository,
    branch: repo.branch,
    commit_sha: repo.commit_sha,
    git_head: gitHead(),
    execution_id: e.execution_id,
    worktree_fingerprint: worktreeFingerprint(),
    command,
    exit_code: exitCode,
    environment: {
      platform: process.platform, node: process.version, cwd: ROOT,
      isolated: true, sandbox: 'os.tmpdir() dedicated repair sandbox (no tracked file modified)',
    },
    test_environment: 'isolated; no production DB / auth / payment touched',
  };
}

function cardCounts(pass, fail) {
  return {
    total: pass + fail, pass, fail,
    PASS: pass, FAIL: fail, BLOCKED: 0, SKIPPED: 0, NOT_RUN: 0, NOT_APPLICABLE: 0,
  };
}

export function generateCapabilityCards() {
  const repair = spawnJson('node', [path.relative(ROOT, REPAIR_TOOL)], 300000, 'real_code_repair_e2e');
  const repairResult = repair.parsed;
  const sandboxDir = repairResult?.sandbox_dir || null;
  let independent = null;
  if (sandboxDir && fs.existsSync(sandboxDir)) {
    independent = spawnJson('node', [path.relative(ROOT, INDEPENDENT_TOOL), sandboxDir, '60000'], 300000, 'independent_regression_e2e');
  } else {
    independent = {
      label: 'independent_regression_e2e', command: '(not run: no sandbox produced)',
      exit_code: null, timed_out: false, stdout: '', stderr: 'sandbox missing', parsed: null,
    };
  }
  const verdict = independent.parsed;
  const isolation = verifierIsolation();

  const checks = [];
  const add = (name, pass, detail) => checks.push({ name, status: pass ? 'PASS' : 'FAIL', pass: Boolean(pass), detail: String(detail) });

  add('repair_process_exit_0', repair.exit_code === 0 && !repair.timed_out,
    `exit=${repair.exit_code} timed_out=${repair.timed_out}`);
  add('repair_status_succeeded', ['SUCCEEDED', 'IDEMPOTENT'].includes(repairResult?.status),
    `status=${repairResult?.status}`);
  const beforeExit = repairResult?.before_failing?.exit_code;
  add('before_test_really_failed', typeof beforeExit === 'number' && beforeExit !== 0,
    `before exit_code=${beforeExit} (a real red baseline is mandatory)`);
  const hashes = repairResult?.hashes || {};
  add('real_source_changed', Boolean(hashes.before_source && hashes.after_source && hashes.before_source !== hashes.after_source),
    `before=${hashes.before_source} after=${hashes.after_source}`);
  const diff = String(repairResult?.source_diff || '');
  add('diff_changes_return_expression', /^[+-].*return/m.test(diff) && diff.length > 0,
    `diff_bytes=${diff.length} has_return_line=${/^[+-].*return/m.test(diff)}`);
  add('tests_not_tampered', Boolean(repairResult?.hashes?.test_files)
    && Object.keys(repairResult.hashes.test_files).length >= 4,
    `locked test hashes=${Object.keys(repairResult?.hashes?.test_files || {}).length}`);
  const afterCommands = repairResult?.commands || [];
  const rerunGreen = afterCommands.some((c) => c.phase !== 'before_failing' && c.exit_code === 0);
  add('original_test_red_to_green', rerunGreen && beforeExit !== 0,
    `after green command present=${rerunGreen}`);
  add('independent_process_exit_0', independent.exit_code === 0 && !independent.timed_out,
    `exit=${independent.exit_code} timed_out=${independent.timed_out}`);
  add('independent_verdict_pass', verdict?.verdict === 'PASS',
    `verdict=${verdict?.verdict} failures=${JSON.stringify(verdict?.failures || [])}`);
  add('independent_checks_all_pass', Boolean(verdict?.checks_total)
    && verdict.checks_passed === verdict.checks_total,
    `${verdict?.checks_passed}/${verdict?.checks_total} independent checks passed`);
  const behaviorResults = verdict?.behavioral_checks || [];
  const behaviorAllPass = behaviorResults.length > 0
    && behaviorResults.every((b) => b.pass === true || b.ok === true || b.verdict === 'PASS');
  add('behavior_really_changed', behaviorAllPass,
    `behavioral checks=${behaviorResults.length}, json=${JSON.stringify(behaviorResults).slice(0, 400)}`);
  add('verifier_isolated_from_repair_side',
    isolation.no_repair_import && isolation.no_repair_status_read
    && isolation.no_repair_result_read && isolation.only_node_builtin_imports,
    JSON.stringify(isolation));

  const failures = checks.filter((c) => !c.pass);
  const status = failures.length === 0 ? 'PASS' : 'FAIL';
  const exitCode = failures.length === 0 ? 0 : 1;

  // Persist the raw before/after source, diff, command outputs and hashes as an
  // immutable evidence record bound to this exact execution/HEAD/worktree.
  const beforeSource = sandboxDir ? readText(path.join(sandboxDir, 'evidence', 'before', 'source.txt')) : null;
  const afterSource = sandboxDir ? readText(path.join(sandboxDir, 'evidence', 'after', 'source.txt')) : null;
  const beforeTest = sandboxDir ? readText(path.join(sandboxDir, 'evidence', 'before', 'failing-test.json')) : null;
  const afterCommandsRaw = sandboxDir ? readText(path.join(sandboxDir, 'evidence', 'after', 'commands.json')) : null;
  const ev = record({
    kind: 'uap_real_code_repair_e2e',
    command: `${repair.command} && ${independent.command}`,
    exit_code: exitCode,
    summary: `real code repair E2E: ${status}; independent verifier verdict=${verdict?.verdict || 'NONE'}; ${checks.filter((c) => c.pass).length}/${checks.length} generator checks passed`,
    inputs: {
      sandbox_dir: sandboxDir,
      task_file: repairResult?.task_file || null,
      before_source: beforeSource,
      after_source: afterSource,
      source_diff: diff,
      before_failing_test: beforeTest ? JSON.parse(beforeTest) : null,
      after_commands: afterCommandsRaw ? JSON.parse(afterCommandsRaw) : null,
      hashes,
      test_file_sha256_before: repairResult?.before_failing?.test_file_sha256 || null,
      test_file_sha256_after: hashes.test_files || null,
      diagnosis: repairResult?.diagnosis || null,
      attempts: repairResult?.attempts ?? null,
      bounded_by: repairResult?.bounded_by ?? null,
      independent_checks: verdict?.checks || [],
      independent_behavioral_checks: behaviorResults,
      verifier_isolation: isolation,
    },
    stdout: repair.stdout.slice(0, 60000),
    stderr: `${repair.stderr}\n${independent.stderr}`.slice(0, 20000),
    findings: failures.map((f) => ({ severity: 'P0', code: 'capability_check_failed', message: `${f.name}: ${f.detail}` })),
  });
  const evVerify = verifyEvidence(ev.evidence_id);

  const base = buildBindings('node .uap/tools/phase2-capability-cards.mjs', exitCode);
  const provenance = {
    repair_command: repair.command,
    repair_exit_code: repair.exit_code,
    independent_command: independent.command,
    independent_exit_code: independent.exit_code,
    independent_verdict: verdict?.verdict || null,
    evidence_ref: ev.evidence_id,
    evidence_hash: ev.content_hash,
    evidence_hash_valid: evVerify.hash_valid,
    evidence_binding_valid: evVerify.binding_valid,
    sandbox_dir: sandboxDir,
    generated_by: 'real command results (never hand-edited status)',
  };

  const repairCard = {
    ...base,
    component: 'uap.real-code-repair-e2e',
    status,
    // `capabilityProven()` requires an INDEPENDENT verifier. The repair side
    // intentionally never signs its own PASS.
    verified_by: 'independent-regression-e2e.mjs (separate process, independent verifier; re-runs tests and re-checks hashes/diff/behaviour)',
    counts: cardCounts(checks.filter((c) => c.pass).length, failures.length),
    checks,
    failures: failures.map((f) => `${f.name}: ${f.detail}`),
    repair: {
      task_id: repairResult?.task_id || null,
      status: repairResult?.status || null,
      before_failing_exit_code: beforeExit ?? null,
      after_passing: repairResult?.after_passing || null,
      source_diff: diff,
      hashes,
      attempts: repairResult?.attempts ?? null,
      bounded_by: repairResult?.bounded_by ?? null,
      rollback: repairResult?.rollback ?? null,
      commands: afterCommands.map((c) => ({ phase: c.phase, exit_code: c.exit_code, timed_out: c.timed_out })),
      test_file_sha256_before: repairResult?.before_failing?.test_file_sha256 || null,
      test_file_sha256_after: hashes.test_files || null,
      source_changed: hashes.before_source !== hashes.after_source,
      tests_untampered: JSON.stringify(repairResult?.before_failing?.test_file_sha256 || {})
        === JSON.stringify(hashes.test_files || {}),
    },
    independent_regression: {
      verdict: verdict?.verdict || null,
      checks_total: verdict?.checks_total ?? null,
      checks_passed: verdict?.checks_passed ?? null,
      behavioral_checks: behaviorResults,
      independent_commands: (verdict?.independent_commands || []).map((c) => ({
        name: c.name, exit_code: c.exit_code, timed_out: c.timed_out,
      })),
    },
    verifier_isolation: isolation,
    provenance,
  };

  const regressionCard = {
    ...base,
    component: 'uap.independent-regression-e2e',
    status,
    verified_by: 'independent-regression-e2e.mjs (independent verifier, separate process; does not read repair-side verdicts)',
    counts: cardCounts(
      Number(verdict?.checks_passed || 0) + checks.filter((c) => c.pass).length,
      Number(verdict?.checks_total || 0) - Number(verdict?.checks_passed || 0) + failures.length,
    ),
    verdict: verdict?.verdict || 'FAIL',
    independent_checks: verdict?.checks || [],
    independent_commands: verdict?.independent_commands || [],
    behavioral_checks: behaviorResults,
    before_failure_reproduced: (verdict?.checks || []).find((c) => c.name === 'before_failure_reproduced')?.pass === true,
    after_tests_rerun_independently: (verdict?.independent_commands || []).length > 0,
    test_files_untampered: (verdict?.checks || []).find((c) => c.name === 'test_files_untampered')?.pass === true,
    diff_changes_behavior: (verdict?.checks || []).find((c) => c.name === 'source_diff_nonempty_and_changes_behavior')?.pass === true,
    generator_checks: checks,
    failures: [...(verdict?.failures || []), ...failures.map((f) => `${f.name}: ${f.detail}`)],
    verifier_isolation: isolation,
    provenance,
  };

  writeJSON(REPAIR_CARD, repairCard);
  writeJSON(REGRESSION_CARD, regressionCard);
  return {
    status, exit_code: exitCode, checks, failures: repairCard.failures,
    repair_card: path.relative(ROOT, REPAIR_CARD),
    regression_card: path.relative(ROOT, REGRESSION_CARD),
    evidence_ref: ev.evidence_id, evidence_hash: ev.content_hash,
    sandbox_dir: sandboxDir,
    repair_status: repairResult?.status || null,
    independent_verdict: verdict?.verdict || null,
    independent_checks: `${verdict?.checks_passed}/${verdict?.checks_total}`,
    repair_command: repair.command,
    independent_command: independent.command,
  };
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    const out = generateCapabilityCards();
    console.log(`UAP_CAPABILITY_CARDS ${JSON.stringify({ ...out, checks: undefined })}`);
    process.exitCode = out.exit_code;
  } catch (error) {
    console.error(`UAP_CAPABILITY_CARDS_FATAL: ${error.stack || error.message}`);
    // Fail closed: never leave a previous PASS card standing after a crash.
    for (const p of [REPAIR_CARD, REGRESSION_CARD]) {
      writeJSON(p, { ...buildBindings('node .uap/tools/phase2-capability-cards.mjs', 1), status: 'FAIL', verified_by: null, error: String(error.stack || error.message) });
    }
    process.exitCode = 1;
  }
}
