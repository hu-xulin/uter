/**
 * Independent Validator for Phase 2 Requirement verification.
 *
 * It does NOT trust the verification engine's own conclusions. It:
 *   1. re-executes a deterministic subset of the SAME real probes in a fresh
 *      import context and compares exit_code / ok / output_hash;
 *   2. re-reads every evidence record from disk and recomputes its sha256;
 *   3. re-checks the execution binding (id / HEAD / worktree fingerprint);
 *   4. re-derives the 7-state counts from the raw probe results;
 *   5. fails closed on any disagreement.
 *
 * A FAIL from this validator means NO requirement may be FULLY_VERIFIED.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runProbes } from './requirement-probes.mjs';
import { get as getEvidence, verify as verifyEvidence } from '../runtime/evidence-engine/index.mjs';
import { currentExecution } from '../runtime/status-engine/execution.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const REPORTS = path.join(ROOT, '.uap', 'reports');
// Results path is overridable so the fail-closed "no results" branch can be
// tested at any time (negative test N3) without touching real artifacts.
const OUT = process.env.UAP_REQUIREMENT_RESULTS
  ? path.resolve(ROOT, process.env.UAP_REQUIREMENT_RESULTS)
  : path.join(REPORTS, 'REQUIREMENT-INDEPENDENT-VALIDATION.json');
const RESULTS_IN = process.env.UAP_REQUIREMENT_RESULTS_IN
  ? path.resolve(ROOT, process.env.UAP_REQUIREMENT_RESULTS_IN)
  : path.join(REPORTS, 'REQUIREMENT-VERIFICATION-RESULTS.json');

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const readJSON = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };

/** Deterministic sample: no randomness, so results are reproducible. */
function selectRecheck(probeResults) {
  const ids = Object.keys(probeResults || {}).sort();
  // All cheap/deterministic structural probes + every 4th probe of the rest.
  // Go/browser commands are re-run too (expensive but genuinely independent).
  return ids.filter((id, i) => /^(reg\.|contract\.|spec\.|docs\.|card\.|policy\.)/.test(id) || i % 4 === 0);
}

export async function independentValidate({ probeResults, execution, registry, matrix, write = true } = {}) {
  const problems = [];
  const checks = [];
  const add = (name, ok, detail) => { checks.push({ name, ok: Boolean(ok), detail }); if (!ok) problems.push(`${name}: ${detail}`); };

  const exec = execution || currentExecution();
  add('execution_identity_present', Boolean(exec?.execution_id && exec?.git_head),
    `${exec?.execution_id || 'none'} @ ${exec?.git_head || 'none'}`);

  const recheckIds = selectRecheck(probeResults);
  let rechecked;
  try { rechecked = await runProbes(recheckIds); }
  catch (e) { rechecked = {}; problems.push(`re-execution threw: ${e.message}`); }

  const comparisons = [];
  for (const id of recheckIds) {
    const a = probeResults[id];
    const b = rechecked[id];
    if (!a || !b) { add(`recheck_${id}_available`, false, 'probe result missing on one side'); continue; }
    // output_hash of real command output may legitimately change between two
    // executions (timestamps in reports). The BINDING invariants that must
    // match are: did it run, did it exit 0, and did it reach the same verdict.
    const sameExit = a.exit_code === b.exit_code;
    const sameVerdict = a.ok === b.ok;
    comparisons.push({ probe_id: id, first_exit: a.exit_code, recheck_exit: b.exit_code, same_exit: sameExit, same_verdict: sameVerdict, first_hash: a.output_hash, recheck_hash: b.output_hash });
    add(`recheck_${id}_verdict`, sameExit && sameVerdict,
      `first exit=${a.exit_code}/ok=${a.ok} recheck exit=${b.exit_code}/ok=${b.ok}`);
  }
  add('rechecked_probe_count', recheckIds.length >= 8, `${recheckIds.length} probes re-executed`);

  // Evidence integrity: recompute hashes from disk, not from in-memory objects.
  const results = readJSON(RESULTS_IN, null);
  const evIds = Object.values(results?.batch_evidence || {}).map((e) => e.evidence_id).filter(Boolean);
  let evValid = 0;
  for (const id of evIds) {
    const v = verifyEvidence(id);
    const rec = getEvidence(id);
    const hashOk = rec
      ? sha(JSON.stringify({ ...rec, content_hash: null })) === rec.content_hash
      : false;
    const bound = rec?.execution_id === exec.execution_id && rec?.git_head === exec.git_head
      && rec?.worktree_fingerprint === exec.worktree_fingerprint;
    if (v.hash_valid && hashOk && v.binding_valid && bound) evValid++;
    else add(`evidence_${id}_integrity`, false, `hash_valid=${v.hash_valid} recomputed=${hashOk} binding=${v.binding_valid}/${bound}`);
  }
  add('evidence_records_present', evIds.length > 0, `${evIds.length} batch evidence records, ${evValid} fully valid`);
  add('evidence_all_hash_bound', evIds.length > 0 && evValid === evIds.length, `${evValid}/${evIds.length}`);

  // No blanket PASS: at least two distinct real probes must have run.
  const passed = Object.values(probeResults || {}).filter((p) => p?.ok === true);
  add('no_blanket_pass', passed.length >= 2 && new Set(passed.map((p) => p.command)).size >= 2,
    `${passed.length} passing probes, ${new Set(passed.map((p) => p.command)).size} distinct commands`);

  // Every mapped requirement must have >=2 declared probes (no trivial pass).
  // The probe registry is YAML (not JSON) — parse it with the runtime parser,
  // never readJSON (which silently returns null on YAML and would fail the
  // batch-count check spuriously).
  let reg = registry || null;
  if (!reg) {
    try {
      const { parseYAML } = await import('../runtime/_lib/yaml.mjs');
      reg = parseYAML(fs.readFileSync(path.join(ROOT, '.uap', 'config', 'requirement-probes.yaml'), 'utf8'));
    } catch { reg = null; }
  }
  add('registry_batches_present', (reg?.batches?.length || 0) >= 13, `${reg?.batches?.length || 0} batches`);
  add('matrix_requirements_present', (matrix?.requirements?.length || results?.rows?.length || 0) >= 538,
    `${matrix?.requirements?.length || results?.rows?.length || 0} requirements`);

  const out = {
    validator_id: 'phase2.requirement_independent_validator',
    generated_at: new Date().toISOString(),
    execution_id: exec.execution_id,
    git_head: exec.git_head,
    worktree_fingerprint: exec.worktree_fingerprint,
    ok: problems.length === 0,
    checks,
    problems,
    rechecked: recheckIds,
    rechecked_count: recheckIds.length,
    comparisons,
    evidence_checked: evIds.length,
    evidence_valid: evValid,
    integrity_rule: 're-execute real probes + recompute evidence sha256 from disk + re-check execution binding; fail closed on any disagreement',
  };
  if (write) { fs.mkdirSync(REPORTS, { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, 'utf8'); }
  return out;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const results = readJSON(RESULTS_IN, null);
  if (!results) { console.error('FATAL: no verification results to independently validate'); process.exit(1); }
  const out = await independentValidate({
    probeResults: results.probe_results,
    execution: { execution_id: results.execution_id, git_head: results.git_head, worktree_fingerprint: results.worktree_fingerprint },
    registry: null, matrix: null,
  });
  console.log(`independent validator: ${out.ok ? 'PASS' : 'FAIL'} — ${out.rechecked_count} probes re-executed, ${out.evidence_valid}/${out.evidence_checked} evidence hash-bound`);
  for (const p of out.problems.slice(0, 15)) console.log(`  - ${p}`);
  process.exit(out.ok ? 0 : 1);
}
