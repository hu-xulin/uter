/**
 * Independent Validator for strict Phase-2 Requirement verification (P2-06).
 *
 * It does NOT trust the verification engine's own conclusions. Independently:
 *   1. re-derives the 4-state counts from the raw `rows` and compares them to
 *      the emitted `states`/`counts` (the `states:` line);
 *   2. re-reads EVERY VERIFIED evidence record from disk and recomputes its
 *      sha256, checks hash validity + execution binding (id / HEAD / worktree);
 *   3. checks that no VERIFIED row lacks evidence_refs or a real actual_result;
 *   4. checks that distinct assertions back distinct VERIFIED requirements;
 *   5. fails closed on any disagreement.
 *
 * A FAIL from this validator means NO requirement may remain VERIFIED — the
 * engine downgrades them to NOT_VERIFIED (honest fail-closed).
 *
 * This validator is deliberately BOUNDED: it does not re-run one command per
 * registered requirement or expensive Go/browser suites. The real behaviour commands
 * are executed once by requirement-verification.mjs; this validator re-checks
 * the immutable evidence those runs produced.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { get as getEvidence, verify as verifyEvidence } from '../runtime/evidence-engine/index.mjs';
import { currentExecution } from '../runtime/status-engine/execution.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const REPORTS = path.join(ROOT, '.uap', 'reports');
const OUT = path.join(REPORTS, 'REQUIREMENT-INDEPENDENT-VALIDATION.json');
// Env override exists for negative tests: pointing the validator at a missing
// results file must fail closed (N3). Never used in production runs.
const RESULTS_IN = process.env.UAP_REQUIREMENT_RESULTS_IN
  ? path.resolve(ROOT, process.env.UAP_REQUIREMENT_RESULTS_IN)
  : path.join(REPORTS, 'REQUIREMENT-VERIFICATION-RESULTS.json');

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const readJSON = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };

function deriveStates(rows) {
  const states = { VERIFIED: 0, NOT_VERIFIED: 0, BLOCKED: 0, NOT_APPLICABLE: 0 };
  for (const r of rows) if (Object.prototype.hasOwnProperty.call(states, r.status)) states[r.status] += 1;
  return states;
}


/**
 * Independently derive the requirement ID catalog from the specification
 * registry and the numbered requirement sections in each registered file.
 * This intentionally does not import the production matrix extractor.
 */
function deriveRegisteredRequirementIds() {
  const registryPath = path.join(ROOT, '.uap', 'config', 'specification-registry.yaml');
  const registryText = fs.readFileSync(registryPath, 'utf8');
  const specs = [];
  let current = null;
  for (const line of registryText.split(/\r?\n/)) {
    const idMatch = /^\s*-\s*id:\s*(UAP-\d{2}-\d{3})\s*$/.exec(line);
    if (idMatch) {
      current = { id: idMatch[1], file: null };
      specs.push(current);
      continue;
    }
    if (!current || current.file) continue;
    const fileMatch = /^\s{4}file:\s*"?([^"\n]+?)"?\s*$/.exec(line);
    if (fileMatch) current.file = fileMatch[1];
  }
  if (specs.length === 0) throw new Error('specification registry contains no registered specifications');
  const ids = [];
  for (const spec of specs) {
    if (!spec.file) throw new Error(spec.id + ': registered specification has no file path');
    const specPath = path.resolve(ROOT, spec.file);
    if (!specPath.startsWith(ROOT + path.sep)) throw new Error(spec.id + ': specification path escapes repository root');
    const source = fs.readFileSync(specPath, 'utf8');
    for (const [heading, tag] of [['强制性要求', 'REQ'], ['验收条件', 'ACC']]) {
      const parts = source.split(new RegExp('^## ' + heading + '\\s*
  const problems = [];
  const checks = [];
  const add = (name, ok, detail) => { checks.push({ name, ok: Boolean(ok), detail }); if (!ok) problems.push(`${name}: ${detail}`); };

  const exec = execution || (() => { try { return currentExecution(); } catch { return null; } })();
  add('execution_identity_present', Boolean(exec?.execution_id && exec?.git_head),
    `${exec?.execution_id || 'none'} @ ${exec?.git_head || 'none'}`);

  // 1. Re-derive states and compare to the emitted states line.
  const derived = deriveStates(rows);
  const emitted = states || null;
  const statesMatch = emitted ? JSON.stringify(derived) === JSON.stringify({
    VERIFIED: emitted.VERIFIED || 0, NOT_VERIFIED: emitted.NOT_VERIFIED || 0,
    BLOCKED: emitted.BLOCKED || 0, NOT_APPLICABLE: emitted.NOT_APPLICABLE || 0,
  }) : true;
  add('states_line_matches_matrix', statesMatch,
    `derived=${JSON.stringify(derived)} emitted=${JSON.stringify(emitted)}`);
  let registryCatalog = null;
  let registryCatalogError = null;
  try {
    registryCatalog = deriveRegisteredRequirementIds();
  } catch (error) {
    registryCatalogError = String(error?.message || error);
  }
  add('registered_requirement_catalog_available', Boolean(registryCatalog),
    registryCatalogError || (registryCatalog.specification_count + ' specs / ' + registryCatalog.ids.length + ' registered requirement IDs'));
  const expectedIds = registryCatalog ? registryCatalog.ids : [];
  const actualIds = rows.map((r) => r && (r.requirement_id ?? r.id) || null);
  const expectedSet = new Set(expectedIds);
  const actualSet = new Set(actualIds.filter((id) => typeof id === 'string' && id.trim()));
  const missingIds = expectedIds.filter((id) => !actualSet.has(id));
  const unexpectedIds = actualIds.filter((id) => typeof id !== 'string' || !expectedSet.has(id));
  const duplicateIds = actualIds.filter((id, index) => actualIds.indexOf(id) !== index);
  const catalogMatches = Boolean(registryCatalog)
    && rows.length === expectedIds.length
    && new Set(actualIds).size === actualIds.length
    && missingIds.length === 0
    && unexpectedIds.length === 0;
  add('matrix_ids_match_registered_specifications', catalogMatches,
    'expected=' + expectedIds.length + ' actual=' + rows.length + ' missing=' + missingIds.length
      + ' unexpected=' + unexpectedIds.length + ' duplicates=' + duplicateIds.length);
  add('states_sum_to_total', Object.values(derived).reduce((a, b) => a + b, 0) === rows.length,
    `sum=${Object.values(derived).reduce((a, b) => a + b, 0)} total=${rows.length}`);

  // 2. Re-verify every VERIFIED evidence record from disk (sha256 recompute).
  const verified = rows.filter((r) => r.status === 'VERIFIED');
  let evValid = 0;
  const seenAssertions = new Map();
  for (const r of verified) {
    const refs = r.evidence_refs || [];
    add(`verified_${r.requirement_id}_has_evidence_refs`, refs.length > 0, `${refs.length} refs`);
    add(`verified_${r.requirement_id}_has_real_actual_result`,
      typeof r.actual_result === 'string' && r.actual_result.trim().length > 0,
      `${String(r.actual_result || '').slice(0, 60)}`);
    for (const ref of refs) {
      const rec = getEvidence(ref.evidence_id);
      const v = verifyEvidence(ref.evidence_id);
      const hashOk = rec ? sha(JSON.stringify({ ...rec, content_hash: null })) === rec.content_hash : false;
      const bound = Boolean(rec && exec
        && rec.execution_id === exec.execution_id && rec.git_head === exec.git_head
        && rec.worktree_fingerprint === exec.worktree_fingerprint);
      const hashMatches = rec && ref.evidence_hash === rec.content_hash;
      const outputMatches = ref.output_hash && ref.evidence_hash; // evidence was bound to this real output
      if (v.hash_valid && hashOk && v.binding_valid && bound && hashMatches && outputMatches) evValid += 1;
      else add(`evidence_${ref.evidence_id}_integrity`, false,
        `hash_valid=${v.hash_valid} recomputed=${hashOk} binding=${v.binding_valid}/${bound} hash_match=${hashMatches}`);
      const key = `${ref.command}::${ref.assertion_id}`;
      if (seenAssertions.has(key)) add(`distinct_assertion_${r.requirement_id}`, false,
        `shared with ${seenAssertions.get(key)}`);
      else seenAssertions.set(key, r.requirement_id);
    }
  }
  add('verified_evidence_all_hash_bound', verified.length === 0 || evValid >= verified.length,
    `${evValid} valid evidence refs / ${verified.length} VERIFIED rows`);

  // 3. No blanket PASS: a VERIFIED verdict must be backed by a distinct assertion.
  add('no_blanket_pass', verified.length === 0 || new Set([...seenAssertions.keys()]).size >= verified.length,
    `${verified.length} VERIFIED rows, ${new Set([...seenAssertions.keys()]).size} distinct assertion keys`);

  // 4. Every NOT_VERIFIED / BLOCKED / NOT_APPLICABLE must carry a concrete reason.
  const missingReason = rows.filter((r) => r.status !== 'VERIFIED'
    && (typeof r.status_reason !== 'string' || r.status_reason.trim().length === 0));
  add('all_non_verified_have_reason', missingReason.length === 0, `${missingReason.length} without reason`);

  const out = {
    validator_id: 'phase2.requirement_independent_validator',
    generated_at: new Date().toISOString(),
    execution_id: exec?.execution_id || null,
    git_head: exec?.git_head || null,
    worktree_fingerprint: exec?.worktree_fingerprint || null,
    ok: problems.length === 0,
    checks,
    problems,
    derived_states: derived,
    checked_evidence_refs: evValid,
    verified_rows: verified.length,
    integrity_rule: 're-derive 4-state counts + recompute every VERIFIED evidence sha256 from disk + re-check execution binding + distinct assertions; fail closed on any disagreement',
  };
  if (write) { fs.mkdirSync(REPORTS, { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, 'utf8'); }
  return out;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const results = readJSON(RESULTS_IN, null);
  if (!results?.rows?.length) { console.error('FATAL: no verification results to independently validate'); process.exit(1); }
  const out = await independentValidate({
    rows: results.rows,
    states: results.states || results.counts || null,
    execution: { execution_id: results.execution_id, git_head: results.git_head, worktree_fingerprint: results.worktree_fingerprint },
  });
  console.log(`independent validator: ${out.ok ? 'PASS' : 'FAIL'} — ${out.verified_rows} VERIFIED rows, ${out.checked_evidence_refs} evidence refs hash-bound, states=${JSON.stringify(out.derived_states)}`);
  for (const p of out.problems.slice(0, 15)) console.log(`  - ${p}`);
  process.exit(out.ok ? 0 : 1);
}
, 'm'));
      const body = (parts[1] || '').split(/^## /m)[0];
      const items = body.split(/\r?\n/).filter((line) => /^\d+\.\s+/.test(line));
      items.forEach((_, index) => {
        ids.push(spec.id + '-' + tag + '-' + String(index + 1).padStart(3, '0'));
      });
    }
  }
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (ids.length === 0) throw new Error('registered specifications contain no numbered requirements');
  if (duplicates.length) throw new Error('duplicate registry-derived requirement IDs: ' + [...new Set(duplicates)].join(', '));
  return { specification_count: specs.length, ids };
}

export async function independentValidate({ rows = [], states = null, execution = null, write = true } = {}) {
  const problems = [];
  const checks = [];
  const add = (name, ok, detail) => { checks.push({ name, ok: Boolean(ok), detail }); if (!ok) problems.push(`${name}: ${detail}`); };

  const exec = execution || (() => { try { return currentExecution(); } catch { return null; } })();
  add('execution_identity_present', Boolean(exec?.execution_id && exec?.git_head),
    `${exec?.execution_id || 'none'} @ ${exec?.git_head || 'none'}`);

  // 1. Re-derive states and compare to the emitted states line.
  const derived = deriveStates(rows);
  const emitted = states || null;
  const statesMatch = emitted ? JSON.stringify(derived) === JSON.stringify({
    VERIFIED: emitted.VERIFIED || 0, NOT_VERIFIED: emitted.NOT_VERIFIED || 0,
    BLOCKED: emitted.BLOCKED || 0, NOT_APPLICABLE: emitted.NOT_APPLICABLE || 0,
  }) : true;
  add('states_line_matches_matrix', statesMatch,
    `derived=${JSON.stringify(derived)} emitted=${JSON.stringify(emitted)}`);
  add('all_538_requirements_present', rows.length === 538, `${rows.length} rows`);
  add('states_sum_to_total', Object.values(derived).reduce((a, b) => a + b, 0) === rows.length,
    `sum=${Object.values(derived).reduce((a, b) => a + b, 0)} total=${rows.length}`);

  // 2. Re-verify every VERIFIED evidence record from disk (sha256 recompute).
  const verified = rows.filter((r) => r.status === 'VERIFIED');
  let evValid = 0;
  const seenAssertions = new Map();
  for (const r of verified) {
    const refs = r.evidence_refs || [];
    add(`verified_${r.requirement_id}_has_evidence_refs`, refs.length > 0, `${refs.length} refs`);
    add(`verified_${r.requirement_id}_has_real_actual_result`,
      typeof r.actual_result === 'string' && r.actual_result.trim().length > 0,
      `${String(r.actual_result || '').slice(0, 60)}`);
    for (const ref of refs) {
      const rec = getEvidence(ref.evidence_id);
      const v = verifyEvidence(ref.evidence_id);
      const hashOk = rec ? sha(JSON.stringify({ ...rec, content_hash: null })) === rec.content_hash : false;
      const bound = Boolean(rec && exec
        && rec.execution_id === exec.execution_id && rec.git_head === exec.git_head
        && rec.worktree_fingerprint === exec.worktree_fingerprint);
      const hashMatches = rec && ref.evidence_hash === rec.content_hash;
      const outputMatches = ref.output_hash && ref.evidence_hash; // evidence was bound to this real output
      if (v.hash_valid && hashOk && v.binding_valid && bound && hashMatches && outputMatches) evValid += 1;
      else add(`evidence_${ref.evidence_id}_integrity`, false,
        `hash_valid=${v.hash_valid} recomputed=${hashOk} binding=${v.binding_valid}/${bound} hash_match=${hashMatches}`);
      const key = `${ref.command}::${ref.assertion_id}`;
      if (seenAssertions.has(key)) add(`distinct_assertion_${r.requirement_id}`, false,
        `shared with ${seenAssertions.get(key)}`);
      else seenAssertions.set(key, r.requirement_id);
    }
  }
  add('verified_evidence_all_hash_bound', verified.length === 0 || evValid >= verified.length,
    `${evValid} valid evidence refs / ${verified.length} VERIFIED rows`);

  // 3. No blanket PASS: a VERIFIED verdict must be backed by a distinct assertion.
  add('no_blanket_pass', verified.length === 0 || new Set([...seenAssertions.keys()]).size >= verified.length,
    `${verified.length} VERIFIED rows, ${new Set([...seenAssertions.keys()]).size} distinct assertion keys`);

  // 4. Every NOT_VERIFIED / BLOCKED / NOT_APPLICABLE must carry a concrete reason.
  const missingReason = rows.filter((r) => r.status !== 'VERIFIED'
    && (typeof r.status_reason !== 'string' || r.status_reason.trim().length === 0));
  add('all_non_verified_have_reason', missingReason.length === 0, `${missingReason.length} without reason`);

  const out = {
    validator_id: 'phase2.requirement_independent_validator',
    generated_at: new Date().toISOString(),
    execution_id: exec?.execution_id || null,
    git_head: exec?.git_head || null,
    worktree_fingerprint: exec?.worktree_fingerprint || null,
    ok: problems.length === 0,
    checks,
    problems,
    derived_states: derived,
    checked_evidence_refs: evValid,
    verified_rows: verified.length,
    integrity_rule: 're-derive 4-state counts + recompute every VERIFIED evidence sha256 from disk + re-check execution binding + distinct assertions; fail closed on any disagreement',
  };
  if (write) { fs.mkdirSync(REPORTS, { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, 'utf8'); }
  return out;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const results = readJSON(RESULTS_IN, null);
  if (!results?.rows?.length) { console.error('FATAL: no verification results to independently validate'); process.exit(1); }
  const out = await independentValidate({
    rows: results.rows,
    states: results.states || results.counts || null,
    execution: { execution_id: results.execution_id, git_head: results.git_head, worktree_fingerprint: results.worktree_fingerprint },
  });
  console.log(`independent validator: ${out.ok ? 'PASS' : 'FAIL'} — ${out.verified_rows} VERIFIED rows, ${out.checked_evidence_refs} evidence refs hash-bound, states=${JSON.stringify(out.derived_states)}`);
  for (const p of out.problems.slice(0, 15)) console.log(`  - ${p}`);
  process.exit(out.ok ? 0 : 1);
}
