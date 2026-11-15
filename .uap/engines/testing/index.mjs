/**
 * UAP engine: testing
 * Executors: quality.engineering / quality.testing / quality.gates
 * Really runs `node --test` and records true exit codes. A test that was not
 * executed is NEVER marked PASS. Empty .uap/tests is recorded as BLOCKED.
 */
import path from 'node:path';
import { REPORTS, TESTS, rootPath, relToRoot } from '../../runtime/_lib/paths.mjs';
import { readText, exists, listFiles, readJSON, writeJSON, nowISO } from '../../runtime/_lib/util.mjs';
import { runCommand } from '../../runtime/_lib/proc.mjs';

export const component = 'engines.testing';
export const version = '1.0.0';
export const executors = ['quality.engineering', 'quality.testing', 'quality.gates'];

const REPORT_FILE = path.join(REPORTS, 'TEST-RUNS.json');

function findTestFiles() {
  if (!exists(TESTS)) return { dir_exists: false, files: [] };
  return {
    dir_exists: true,
    files: listFiles(TESTS, { recursive: true, filter: (a) => /\.test\.mjs$/.test(a) }),
  };
}

function countGoTests() {
  const dirs = ['', 'common', 'controller', 'service', 'model', 'relay', 'router', 'middleware', 'setting'];
  let count = 0;
  const sample = [];
  for (const d of dirs) {
    const files = listFiles(d ? rootPath(d) : rootPath('.'), {
      recursive: Boolean(d), filter: (a) => a.endsWith('_test.go'),
    });
    count += files.length;
    for (const f of files.slice(0, 2)) if (sample.length < 10) sample.push(relToRoot(f));
  }
  return { count, sample };
}

function countWebTests() {
  const files = listFiles(rootPath('web/src'), {
    recursive: true, filter: (a) => /\.(test|spec)\.(ts|tsx|mjs)$/.test(a),
  });
  return { count: files.length, sample: files.slice(0, 8).map((f) => relToRoot(f)) };
}

function ciTestCommands() {
  const wf = listFiles(rootPath('.github/workflows'), {
    recursive: false, filter: (a) => /\.ya?ml$/.test(a),
  });
  const out = [];
  for (const f of wf) {
    readText(f).split('\n').forEach((line, i) => {
      const m = line.match(/^\s*run:\s*(.+)$/);
      if (m && /test|vitest|verify|vet|gofmt/i.test(m[1])) {
        out.push({ file: relToRoot(f), line: i + 1, command: m[1].trim().slice(0, 160) });
      }
    });
  }
  return out.slice(0, 30);
}

/** Layered test plan derived from real discovered test files and CI commands. */
export function plan() {
  const go = countGoTests();
  const web = countWebTests();
  const { dir_exists, files } = findTestFiles();
  return {
    generated_at: nowISO(),
    layers: [
      { layer: 'unit.go', source: '*_test.go', discovered_test_files: go.count, sample: go.sample, gate_command: 'go test ./...' },
      { layer: 'unit.web', source: 'web/src/**/*.test.ts(x)', discovered_test_files: web.count, sample: web.sample, gate_command: 'bun run test' },
      {
        layer: 'uap.runtime', source: '.uap/tests/*.test.mjs', discovered_test_files: files.length,
        gate_command: 'node --test .uap/tests/*.test.mjs',
        status: !dir_exists ? 'BLOCKED_DIR_MISSING' : files.length === 0 ? 'BLOCKED_EMPTY' : 'READY',
      },
      { layer: 'e2e', source: 'web/e2e', gate_command: 'playwright test', status: 'NOT_RUN_LOCAL_GATE' },
      { layer: 'quality_gate', source: 'scripts/verify-all.sh', gate_command: './scripts/verify-all.sh', local_equivalent: './scripts/verify-all.sh --quick' },
    ],
    ci_test_commands: ciTestCommands(),
    policy: 'plan lists real discovered tests; nothing is marked PASS unless actually executed',
  };
}

export function gatePlan() {
  const verify = exists(rootPath('scripts/verify-all.sh'));
  const agents = exists(rootPath('AGENTS.md')) ? readText(rootPath('AGENTS.md')) : '';
  // AGENTS.md mixes inline code and ``` fenced blocks, so match the known gate
  // commands directly from the full text instead of pairing backticks.
  const re = /(?:gofmt -l \.|go vet \.\/\.\.\.|make test|bun run [A-Za-z0-9_:.-]+|\.\/scripts\/verify-all\.sh(?: --quick)?|tsgo -b --force|bunx vitest run [^\s]+|playwright test[A-Za-z0-9_.:-]*)/g;
  const found = [...new Set(agents.match(re) || [])].slice(0, 30);
  const gates = found.map((c) => ({ command: c, source: 'AGENTS.md', run_by_this_engine: false }));
  return {
    verify_all_exists: verify,
    gates,
    note: 'gates are defined by AGENTS.md / CI; this engine only records them, none is claimed as run or passed',
  };
}

async function runSuite() {
  const { dir_exists, files } = findTestFiles();
  let args;
  let blockedReason = null;
  if (files.length > 0) {
    args = ['--test', ...files.map((f) => relToRoot(f))];
  } else {
    args = ['--test', '.uap/tests/'];
    blockedReason = dir_exists
      ? 'no *.test.mjs files in .uap/tests/ (empty directory)'
      : '.uap/tests/ directory missing';
  }

  const r = await runCommand({ command: 'node', args, timeoutMs: 120000 });
  const stdout = r.stdout;
  const passM = stdout.match(/#\s*pass\s+(\d+)/i);
  const failM = stdout.match(/#\s*fail\s+(\d+)/i);
  const testsM = stdout.match(/#\s*tests\s+(\d+)/i);
  const tap = {
    tests: testsM ? Number(testsM[1]) : null,
    pass: passM ? Number(passM[1]) : null,
    fail: failM ? Number(failM[1]) : null,
  };

  let status;
  if (r.spawn_error || r.timed_out) status = 'BLOCKED';
  else if (files.length === 0) status = 'BLOCKED'; // no test files => can never be PASS
  else if (r.exit_code === 0 && tap.tests !== null && tap.tests > 0 && tap.fail === 0) status = 'PASSED_EXECUTED';
  else if (r.exit_code !== 0) status = 'FAILED';
  else status = 'EXECUTED_NO_TAP_PARSE';

  return [{
    command: r.command,
    args,
    exit_code: r.exit_code,
    signal: r.signal,
    timed_out: r.timed_out,
    spawn_error: r.spawn_error,
    duration_ms: r.duration_ms,
    stdout_summary: stdout.slice(0, 800),
    stderr_summary: r.stderr.slice(0, 400),
    tap,
    status,
    blocked_reason: blockedReason,
  }];
}

export function artifactOk(file) {
  if (!exists(file)) return true;
  let j;
  try { j = readJSON(file); } catch { return false; }
  if (!j || !Array.isArray(j.runs) || !j.test_plan || !j.gate_plan || !j.summary) return false;
  for (const r of j.runs) {
    // A PASS is only valid when it was really executed with real TAP results.
    if (/PASS/.test(r.status) && !(r.exit_code === 0 && r.tap && r.tap.tests > 0)) return false;
  }
  return true;
}

export function health() {
  const checks = {};
  checks.tests_dir_exists = exists(TESTS);
  checks.verify_all_exists = exists(rootPath('scripts/verify-all.sh'));
  let goCount = 0;
  try { goCount = countGoTests().count; } catch { goCount = 0; }
  checks.go_tests_discovered = goCount >= 1;
  let p = null;
  try { p = plan(); } catch { p = null; }
  checks.plan_layers = Boolean(p && p.layers.length >= 3);
  checks.report_schema = artifactOk(REPORT_FILE);
  const ok = Object.values(checks).every(Boolean);
  return {
    component, ok, checks,
    summary: `go_tests=${goCount} plan_layers=${p ? p.layers.length : 0} `
      + `uap_runtime_status=${p ? p.layers[2].status : 'n/a'} report_schema=${checks.report_schema}`,
    checked_at: nowISO(),
  };
}

export async function execute(task = {}, ctx = {}) {
  const started = nowISO();
  const runs = await runSuite();
  const testPlan = plan();
  const gates = gatePlan();
  const summary = {
    total: runs.length,
    executed: runs.filter((r) => r.exit_code !== null).length,
    passed: runs.filter((r) => r.status === 'PASSED_EXECUTED').length,
    blocked: runs.filter((r) => r.status === 'BLOCKED').length,
    failed: runs.filter((r) => r.status === 'FAILED').length,
  };

  writeJSON(REPORT_FILE, {
    schema_version: '1.0', generated_at: started,
    executor_ids: executors, node_version: process.version, environment: 'local',
    runs, summary, test_plan: testPlan, gate_plan: gates,
    policy: { never_mark_unrun_as_pass: true, blocked_not_pass: true },
  });

  const cmdSummary = runs.map((r) => ({
    command: r.command, args: r.args, exit_code: r.exit_code,
    timed_out: r.timed_out, spawn_error: r.spawn_error, duration_ms: r.duration_ms,
  }));

  return {
    status: 'SUCCEEDED',
    summary: `really executed ${runs.length} node --test command(s); `
      + `exit_codes=[${runs.map((r) => r.exit_code).join(',')}] statuses=[${runs.map((r) => r.status).join(',')}]; `
      + `blocked_reasons=[${runs.map((r) => r.blocked_reason || 'none').join('; ')}]; `
      + `passed=${summary.passed} blocked=${summary.blocked} (unrun tests are NEVER PASS)`,
    changed_files: [relToRoot(REPORT_FILE)],
    commands: cmdSummary,
    evidence_refs: [],
    outputs: {
      ...summary,
      run_statuses: runs.map((r) => r.status),
      run_exit_codes: runs.map((r) => r.exit_code),
      tap: runs.map((r) => r.tap),
      blocked_reasons: runs.map((r) => r.blocked_reason),
      test_plan_layers: testPlan.layers.length,
      uap_runtime_status: testPlan.layers[2].status,
      go_test_files: countGoTests().count,
      web_test_files: countWebTests().count,
      ci_test_commands: testPlan.ci_test_commands.length,
      gate_count: gates.gates.length,
      verify_all_exists: gates.verify_all_exists,
    },
  };
}
