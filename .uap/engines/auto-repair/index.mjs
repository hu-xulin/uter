/**
 * UAP engine: auto-repair
 * Executor: quality.auto_repair
 * Bounded repair loop over a REAL sandbox fixture. It only ever writes files
 * under .uap/state/repair-sandbox/ (and its own report). Uter business code
 * and tests are never touched.
 */
import fs from 'node:fs';
import path from 'node:path';
import { STATE, REPORTS, relToRoot } from '../../runtime/_lib/paths.mjs';
import { exists, readJSON, writeJSON, nowISO, hash } from '../../runtime/_lib/util.mjs';
import { runCommand } from '../../runtime/_lib/proc.mjs';

export const component = 'engines.auto-repair';
export const version = '1.0.0';
export const executors = ['quality.auto_repair'];

const SANDBOX = path.join(STATE, 'repair-sandbox');
const FIXTURE = path.join(SANDBOX, 'billing-sample.mjs');
const REPORT_FILE = path.join(REPORTS, 'AUTO-REPAIR.json');

const BEFORE = `// UAP repair sandbox fixture — deliberately defective, NOT business code.
export function toPayAmount(amount) {
  return amount;
}

export function charge(amount) {
  const paid = Math.floor(amount * 100);
  return paid;
}
`;

const DEFECT_RE = /Math\.floor\s*\(\s*amount\s*\*\s*100\s*\)/;

const STRATEGIES = [
  {
    id: 'S1-delegate-to-central-helper',
    description: 'Replace the bare local conversion with the centralised toPayAmount helper and give that helper a validated, saturated implementation.',
    authorized: true,
    apply: (text) => text
      .replace(
        'export function toPayAmount(amount) {\n  return amount;\n}',
        `export function toPayAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) throw new Error('invalid amount');
  return Math.min(Math.trunc(n * 100), 2147483647);
}`,
      )
      .replace('  const paid = Math.floor(amount * 100);', '  const paid = toPayAmount(amount);'),
  },
  {
    id: 'S2-inline-guard',
    description: 'Keep the local expression but validate the input and clamp the result in place before charging.',
    authorized: true,
    apply: (text) => text.replace(
      '  const paid = Math.floor(amount * 100);',
      `  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) throw new Error('invalid amount');
  const paid = Math.min(Math.trunc(n * 100), 2147483647);`,
    ),
  },
  {
    id: 'S3-fail-closed-reject',
    description: 'Remove the unbounded conversion entirely and reject unvalidated / out-of-range input at the boundary.',
    authorized: true,
    apply: (text) => text.replace(
      '  const paid = Math.floor(amount * 100);\n  return paid;',
      `  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0 || n > 21474836) throw new Error('amount out of range');
  return Math.trunc(n * 100);`,
    ),
  },
];

function detect(text) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (DEFECT_RE.test(lines[i])) return { detected: true, line: i + 1, snippet: lines[i].trim() };
  }
  return { detected: false, line: null, snippet: null };
}

function diffLines(before, after) {
  const a = before.split('\n');
  const b = after.split('\n');
  const out = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    if (a[i] !== b[i]) out.push({ line: i + 1, before: a[i] ?? null, after: b[i] ?? null });
  }
  return out;
}

function sandboxOnly() {
  const abs = path.resolve(FIXTURE);
  const box = path.resolve(SANDBOX);
  return abs.startsWith(`${box}${path.sep}`);
}

function cmdRecord(r) {
  return {
    command: r.command, exit_code: r.exit_code, signal: r.signal,
    timed_out: r.timed_out, spawn_error: r.spawn_error, duration_ms: r.duration_ms,
  };
}

function artifactOk(file) {
  if (!exists(file)) return true;
  let j;
  try { j = readJSON(file); } catch { return false; }
  if (!j || !Array.isArray(j.attempts) || j.attempts.length > 3) return false;
  if (!Array.isArray(j.diff) || !j.safety || j.safety.only_sandbox_files_written !== true) return false;
  if (!['FIXED', 'UNRESOLVED'].includes(j.final_status)) return false;
  return true;
}

export function health() {
  const checks = {};
  checks.state_dir_exists = exists(STATE);
  checks.sandbox_path_is_scoped = sandboxOnly();
  checks.defect_detector_hits_fixture = detect(BEFORE).detected === true;
  checks.strategy_count_bounded = STRATEGIES.length >= 1 && STRATEGIES.length <= 3;
  checks.report_schema = artifactOk(REPORT_FILE);
  const ok = Object.values(checks).every(Boolean);
  return {
    component, ok, checks,
    summary: `defect_detected_on_fixture=${checks.defect_detector_hits_fixture} `
      + `strategies=${STRATEGIES.length} sandbox_scoped=${checks.sandbox_path_is_scoped}`,
    checked_at: nowISO(),
  };
}

export async function execute(task = {}, ctx = {}) {
  const started = nowISO();
  const commands = [];

  // Reset ONLY the sandbox fixture to its known-defective state.
  fs.mkdirSync(SANDBOX, { recursive: true });
  fs.writeFileSync(FIXTURE, BEFORE, 'utf8');
  const before = BEFORE;
  const defect = detect(before);

  const repairPlan = STRATEGIES.map((s) => ({
    strategy_id: s.id, description: s.description,
    authorized: s.authorized && sandboxOnly(),
    target: 'billing-sample.mjs charge()',
  }));

  const attempts = [];
  let selected = null;
  let after = before;

  for (const s of STRATEGIES) {
    if (attempts.length >= 3) break;
    const candidate = s.apply(before);
    const remaining = detect(candidate);
    const changed = candidate !== before;

    // Real syntax verification of the candidate through node --check.
    fs.writeFileSync(FIXTURE, candidate, 'utf8');
    const chk = await runCommand({ command: 'node', args: ['--check', FIXTURE] });
    commands.push({ label: `syntax check ${s.id}`, ...cmdRecord(chk) });
    const syntaxOk = !chk.spawn_error && !chk.timed_out && chk.exit_code === 0;

    const accepted = s.authorized && sandboxOnly() && changed && !remaining.detected && syntaxOk;
    const attempt = {
      strategy_id: s.id,
      authorized: s.authorized && sandboxOnly(),
      applied: changed,
      defect_remaining: remaining.detected,
      syntax_ok: syntaxOk,
      node_check_exit_code: chk.exit_code,
      before_sha256: hash(before),
      after_sha256: hash(candidate),
      diff: diffLines(before, candidate),
      outcome: accepted ? 'ACCEPTED' : 'REJECTED',
    };
    attempts.push(attempt);
    if (accepted && !selected) {
      selected = s.id;
      after = candidate;
    }
  }

  // Persist the selected fix (or restore the original) inside the sandbox only.
  fs.writeFileSync(FIXTURE, after, 'utf8');

  // Independent re-verification.
  const finalDefect = detect(after);
  const finalChk = await runCommand({ command: 'node', args: ['--check', FIXTURE] });
  commands.push({ label: 'final re-verification', ...cmdRecord(finalChk) });
  const finalSyntaxOk = !finalChk.spawn_error && !finalChk.timed_out && finalChk.exit_code === 0;
  const finalStatus = selected && !finalDefect.detected && finalSyntaxOk ? 'FIXED' : 'UNRESOLVED';

  writeJSON(REPORT_FILE, {
    schema_version: '1.0', generated_at: started,
    executor_id: 'quality.auto_repair',
    sandbox_dir: relToRoot(SANDBOX),
    fixture: relToRoot(FIXTURE),
    simulated_only: true,
    defect: { pattern: DEFECT_RE.source, ...defect, before_content: before },
    plan: repairPlan,
    attempts,
    selected_strategy: selected,
    after_content: after,
    diff: diffLines(before, after),
    verification: {
      rechecked: true,
      defect_remaining: finalDefect.detected,
      node_check_exit_code: finalChk.exit_code,
      syntax_ok: finalSyntaxOk,
    },
    final_status: finalStatus,
    safety: {
      only_sandbox_files_written: sandboxOnly(),
      business_code_untouched: true,
      tests_untouched: true,
      no_destructive_commands: true,
      simulated_only: true,
    },
    commands,
  });

  return {
    status: 'SUCCEEDED',
    summary: `bounded sandbox repair: defect_detected=${defect.detected} strategies_tried=${attempts.length} `
      + `selected=${selected || 'none'} final_status=${finalStatus}; `
      + `node --check exit_codes=[${commands.map((c) => c.exit_code).join(',')}]`,
    changed_files: [relToRoot(FIXTURE), relToRoot(REPORT_FILE)],
    commands,
    evidence_refs: [],
    outputs: {
      defect_detected: defect.detected,
      strategies_available: STRATEGIES.length,
      attempts: attempts.length,
      accepted_strategy: selected,
      final_status: finalStatus,
      defect_remaining_after: finalDefect.detected,
      final_syntax_ok: finalSyntaxOk,
      diff_line_count: diffLines(before, after).length,
      node_check_exit_codes: commands.map((c) => c.exit_code),
      only_sandbox_files_written: sandboxOnly(),
      simulated_only: true,
    },
  };
}
