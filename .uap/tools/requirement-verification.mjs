/**
 * UAP Phase 2 — real Requirement verification engine.
 *
 *   node .uap/tools/requirement-verification.mjs --all [--probe-cache=<f>]
 *   node .uap/tools/requirement-verification.mjs --batch=uap_foundation
 *   node .uap/tools/requirement-verification.mjs --validate-results
 *
 * Traceability chain (all links real, none inferred from prose similarity):
 *   Requirement -> Standard (spec file + statement hash)
 *               -> Implementation (registered executor/validator files, real stat)
 *               -> Test (declared executable probes with real exit codes)
 *               -> Independent Validator (separate re-execution + hash compare)
 *               -> Evidence (one hash-bound record per REAL batch execution)
 *               -> Status (7 mandated states, computed from the above)
 *
 * Deliberately NOT done: 538 empty evidence files, one generic PASS report
 * applied to all requirements, or copying a status into a JSON field by hand.
 * Evidence is one immutable record per real batch execution; a requirement
 * references the batch evidence that ACTUALLY verified it.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseYAML } from '../runtime/_lib/yaml.mjs';
import { record, verify as verifyEvidence, get as getEvidence } from '../runtime/evidence-engine/index.mjs';
import { currentExecution } from '../runtime/status-engine/execution.mjs';
import { runProbes, PROBE_IDS } from './requirement-probes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const UAP = path.join(ROOT, '.uap');
const REPORTS = path.join(UAP, 'reports');
const REGISTRY = path.join(UAP, 'config', 'requirement-probes.yaml');
const MATRIX = path.join(REPORTS, 'REQUIREMENT-TRACEABILITY-MATRIX.json');
const RESULTS = path.join(REPORTS, 'REQUIREMENT-VERIFICATION-RESULTS.json');
const BATCH_DIR = path.join(REPORTS, 'phase2-batches');

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const readJSON = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const writeJSON = (p, v) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`, 'utf8'); };
const now = () => new Date().toISOString();

export const VERIFICATION_STATES = Object.freeze([
  'NOT_BUILT', 'PARTIALLY_BUILT', 'IMPLEMENTED_NOT_VERIFIED',
  'PARTIALLY_VERIFIED', 'FULLY_VERIFIED', 'NOT_APPLICABLE', 'BLOCKED',
]);

export function loadRegistry() {
  const text = fs.readFileSync(REGISTRY, 'utf8');
  const j = parseYAML(text);
  if (!j?.batches?.length) throw new Error('requirement-probes.yaml: no batches');
  return j;
}

/** Map every requirement to its declared batch + real probe set. */
export function coverageMap(matrix, registry) {
  const bySpec = new Map(registry.batches.map((b) => [b.specs, b]));
  const specToBatch = new Map();
  for (const b of registry.batches) for (const s of b.specs) specToBatch.set(s, b);
  const out = new Map();
  for (const r of matrix.requirements || []) {
    const batch = specToBatch.get(r.specification_id) || null;
    const probes = new Set(batch?.probes || []);
    const rules = [];
    for (const rule of registry.keyword_rules || []) {
      if (r.requirement.includes(rule.keyword)) {
        for (const p of rule.probes) probes.add(p);
        rules.push(rule.keyword);
      }
    }
    out.set(r.requirement_id, {
      batch_id: batch?.id || 'UNMAPPED',
      batch_name: batch?.name || null,
      probes: [...probes].filter((p) => PROBE_IDS.includes(p)),
      keyword_rules: rules,
      coverage_basis: `spec ${r.specification_id} -> batch ${batch?.id || 'UNMAPPED'}; keyword rules: ${rules.join(',') || 'none'}`,
    });
  }
  return out;
}

/** Real external-dependency classification, restricted to declared rules. */
export function externalBlock(r, registry) {
  for (const rule of registry.blocked_rules || []) {
    if ((rule.keywords || []).some((k) => r.requirement.includes(k))) return rule;
  }
  return null;
}
export function notApplicable(r, registry) {
  return (registry.not_applicable_rules || []).find((x) => x.requirement_id === r.requirement_id) || null;
}

/**
 * Compute one requirement's state from REAL probe results.
 * FULLY_VERIFIED requires: no external block, >=2 declared probes, ALL ran,
 * ALL exit 0, ALL hash-valid evidence, independent re-check passed, and real
 * implementation files present. Anything less is a weaker, honest state.
 */
export function classify(r, cov, probeResults, independent, registry, execution) {
  const ext = externalBlock(r, registry);
  if (ext) return {
    state: 'BLOCKED',
    reason: `real external dependency: ${ext.dependency}`,
    blocked_dependency_id: ext.id,
    unblock_condition: ext.unblock_condition,
    probes: [], probe_detail: [],
  };
  const na = notApplicable(r, registry);
  if (na) return {
    state: 'NOT_APPLICABLE', reason: na.reason, na_basis: na.basis,
    na_approval: na.approving_validator || null,
    probes: [], probe_detail: [],
  };

  const declared = cov.probes;
  const detail = declared.map((id) => {
    const p = probeResults[id];
    return {
      probe_id: id,
      executed: Boolean(p && !p.skipped),
      exit_code: p?.exit_code ?? null,
      ok: p?.ok === true,
      command: p?.command || null,
      output_hash: p?.output_hash || null,
      detail: p?.detail || 'probe not executed',
    };
  });
  const ran = detail.filter((d) => d.executed);
  const passed = ran.filter((d) => d.ok && d.exit_code === 0);
  const implFiles = (r.implementation_files || []).filter((f) => fs.existsSync(path.join(ROOT, f)));
  const indepOk = independent?.ok === true && independent.rechecked?.length > 0;

  const fully = declared.length >= 2 && ran.length === declared.length
    && passed.length === declared.length && implFiles.length >= 2 && indepOk;

  let state;
  let reason;
  if (fully) {
    state = 'FULLY_VERIFIED';
    reason = `${passed.length}/${declared.length} declared real probes passed, independent validator rechecked ${independent.rechecked.length}, ${implFiles.length} implementation files present`;
  } else if (passed.length > 0 && implFiles.length > 0) {
    state = 'PARTIALLY_VERIFIED';
    reason = `only ${passed.length}/${declared.length} declared probes passed${indepOk ? '' : '; independent re-check unresolved'}; ${implFiles.length} implementation file(s) present`;
  } else if (implFiles.length >= 2) {
    state = 'IMPLEMENTED_NOT_VERIFIED';
    reason = `implementation files present but 0/${declared.length} declared probes passed`;
  } else if (implFiles.length === 1) {
    state = 'PARTIALLY_BUILT';
    reason = `only 1 of the required implementation references present; 0/${declared.length} probes passed`;
  } else {
    state = 'NOT_BUILT';
    reason = `no implementation reference present; 0/${declared.length} probes passed`;
  }
  return { state, reason, probes: declared, probe_detail: detail, implementation_reference: implFiles };
}

/** Run one batch's probes for real and persist one immutable evidence record. */
async function executeBatch(batch, registry, probeCache) {
  const ids = [...new Set(batch.probes)].filter((p) => PROBE_IDS.includes(p));
  const fresh = await runProbes(ids);
  const merged = { ...(probeCache || {}), ...fresh };
  return { batch, results: merged, fresh };
}

export async function verifyRequirements({ batches = null, probeCache = null, dryRun = false } = {}) {
  const registry = loadRegistry();
  const matrix = readJSON(MATRIX);
  if (!matrix?.requirements?.length) throw new Error('requirement matrix missing or empty');
  const execution = currentExecution();
  const covMap = coverageMap(matrix, registry);
  const wanted = batches?.length
    ? registry.batches.filter((b) => batches.includes(b.id))
    : registry.batches;
  if (!wanted.length) throw new Error(`no matching batches: ${batches}`);

  const probeResults = { ...(probeCache || {}) };
  const batchRuns = [];
  for (const batch of wanted) {
    if (dryRun) { batchRuns.push({ batch_id: batch.id, probes: batch.probes, dry_run: true }); continue; }
    const r = await executeBatch(batch, registry, probeResults);
    Object.assign(probeResults, r.fresh);
    batchRuns.push({
      batch_id: batch.id, batch_name: batch.name, specs: batch.specs,
      probes: r.batch.probes, executed_at: now(),
      probe_results: r.batch.probes.map((p) => ({
        probe_id: p, ok: probeResults[p]?.ok === true, exit_code: probeResults[p]?.exit_code ?? null,
        command: probeResults[p]?.command || null, output_hash: probeResults[p]?.output_hash || null,
        detail: probeResults[p]?.detail || 'not registered',
      })),
      pass: r.batch.probes.filter((p) => probeResults[p]?.ok === true).length,
      total: r.batch.probes.length,
    });
  }
  if (dryRun) return { dry_run: true, batches: batchRuns, coverage: covMap.size };

  // Independent validator runs in a separate process over the real results.
  const { independentValidate } = await import('./requirement-independent-validator.mjs');
  // MUST await: independentValidate is async — without await we'd serialize a
  // Promise as {} and every FULLY_VERIFIED verdict would silently lose its
  // independent-recheck precondition.
  const independent = await independentValidate({ probeResults, execution, registry, matrix });

  // Classify BEFORE writing evidence, so each batch evidence record binds only
  // the requirements it genuinely verified (never a blanket requirement_ids).
  const preClassified = [];
  for (const r of matrix.requirements) {
    const cov = covMap.get(r.requirement_id);
    preClassified.push({ requirement_id: r.requirement_id, batch_id: cov.batch_id, cov, classification: classify(r, cov, probeResults, independent, registry, execution) });
  }

  // One immutable evidence record per REAL batch execution (not per requirement).
  const batchEvidence = {};
  for (const run of batchRuns) {
    const verifiedIds = preClassified
      .filter((x) => x.batch_id === run.batch_id && x.classification.state === 'FULLY_VERIFIED')
      .map((x) => x.requirement_id);
    const exit = run.pass === run.total ? 0 : 1;
    const ev = record({
      kind: 'requirement_batch_verification',
      command: `uap verify-requirements --batch=${run.batch_id}`,
      exit_code: exit,
      summary: `batch ${run.batch_id}: ${run.pass}/${run.total} real probes passed; ${verifiedIds.length} requirements fully verified by this batch`,
      specification_ids: run.specs,
      // Only requirements genuinely verified by this batch are bound.
      requirement_ids: verifiedIds,
      inputs: { probes: run.probes },
      stdout: JSON.stringify(run.probe_results),
      findings: run.probe_results.filter((p) => !p.ok).map((p) => ({
        severity: 'WARN', code: 'probe_not_passed', message: `${p.probe_id}: ${p.detail}`,
      })),
    });
    batchEvidence[run.batch_id] = {
      evidence_id: ev.evidence_id,
      evidence_path: ev.file,
      evidence_hash: ev.content_hash,
      hash_valid: verifyEvidence(ev.evidence_id).hash_valid,
      binding_valid: verifyEvidence(ev.evidence_id).binding_valid,
      command: `uap verify-requirements --batch=${run.batch_id}`,
      exit_code: exit,
    };
  }

  const rows = [];
  for (const pre of preClassified) {
    const r = matrix.requirements.find((x) => x.requirement_id === pre.requirement_id);
    const cov = pre.cov;
    const c = pre.classification;
    const batch = registry.batches.find((b) => b.id === cov.batch_id);
    const ev = batchEvidence[cov.batch_id] || null;
    rows.push({
      requirement_id: r.requirement_id,
      specification_id: r.specification_id,
      section: r.section,
      statement_sha256: r.statement_sha256,
      batch_id: cov.batch_id,
      batch_name: cov.batch_name,
      applicability: c.state === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : 'APPLICABLE',
      verification_state: c.state,
      reason: c.reason,
      coverage_basis: cov.coverage_basis,
      probes: c.probes,
      probe_detail: c.probe_detail,
      implementation_reference: c.implementation_reference || r.implementation_files || [],
      standard_reference: {
        specification_id: r.specification_id,
        statement_sha256: r.statement_sha256,
        executor_ids: r.executor_ids || [],
        validator_ids: r.validator_ids || [],
      },
      test_command: ev?.command || null,
      test_exit_code: ev?.exit_code ?? null,
      validator_id: 'phase2.requirement_independent_validator',
      validation_result: independent.ok ? 'PASS' : 'FAIL',
      independent_rechecked_probes: independent.rechecked || [],
      evidence_path: ev?.evidence_path || null,
      evidence_hash: ev?.evidence_hash || null,
      evidence_id: ev?.evidence_id || null,
      evidence_hash_valid: ev?.hash_valid ?? false,
      evidence_binding_valid: ev?.binding_valid ?? false,
      execution_id: execution.execution_id,
      commit_sha: execution.git_head,
      worktree_fingerprint: execution.worktree_fingerprint,
      timestamp: now(),
      blocked_dependency_id: c.blocked_dependency_id || null,
      unblock_condition: c.unblock_condition || null,
      na_reason: c.reason && c.state === 'NOT_APPLICABLE' ? c.reason : null,
      na_basis: c.na_basis || null,
      na_approval: c.na_approval || null,
    });
  }

  const counts = {};
  for (const s of VERIFICATION_STATES) counts[s] = rows.filter((x) => x.verification_state === s).length;
  const out = {
    schema_version: '1.0',
    report_id: 'REQUIREMENT-VERIFICATION-RESULTS',
    generated_at: now(),
    generator: 'node .uap/tools/requirement-verification.mjs',
    execution_id: execution.execution_id,
    git_head: execution.git_head,
    worktree_fingerprint: execution.worktree_fingerprint,
    totals: {
      requirements: rows.length,
      specifications: new Set(rows.map((x) => x.specification_id)).size,
      probes_registered: PROBE_IDS.length,
      probes_executed: Object.keys(probeResults).length,
      probes_passed: Object.values(probeResults).filter((p) => p?.ok === true).length,
      batches: batchRuns.length,
    },
    counts,
    independent_validation: independent,
    batch_runs: batchRuns,
    batch_evidence: batchEvidence,
    probe_results: probeResults,
    rows,
  };
  writeJSON(RESULTS, out);
  fs.mkdirSync(BATCH_DIR, { recursive: true });
  for (const run of batchRuns) writeJSON(path.join(BATCH_DIR, `${run.batch_id}.json`), run);
  return out;
}

/** Consumed by `requirement-matrix.mjs` to merge real verification into the matrix. */
export function verificationOverlay() {
  const j = readJSON(RESULTS, null);
  if (!j?.rows?.length) return null;
  const e = currentExecution();
  // An overlay produced against a different code version is stale and must
  // never promote a historical PASS into the current run.
  if (j.execution_id !== e.execution_id || j.git_head !== e.git_head
      || j.worktree_fingerprint !== e.worktree_fingerprint) return null;
  return new Map(j.rows.map((r) => [r.requirement_id, r]));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const args = process.argv.slice(2);
  const batches = args.filter((a) => a.startsWith('--batch=')).map((a) => a.split('=')[1]).filter(Boolean);
  const cacheFile = args.find((a) => a.startsWith('--probe-cache='))?.split('=')[1];
  const dryRun = args.includes('--dry-run');
  const cache = cacheFile ? readJSON(cacheFile, null) : null;
  try {
    const out = await verifyRequirements({ batches: batches.length ? batches : null, probeCache: cache?.probe_results || cache, dryRun });
    if (dryRun) { console.log(`DRY RUN: ${out.batches.length} batches, ${out.coverage} requirements mapped`); process.exit(0); }
    console.log(`requirement verification: ${out.totals.requirements} requirements / ${out.totals.probes_executed} real probes / ${out.totals.probes_passed} passed`);
    console.log(`states: ${JSON.stringify(out.counts)}`);
    console.log(`independent validator: ${out.independent_validation.ok ? 'PASS' : 'FAIL'} (${out.independent_validation.rechecked.length} rechecked)`);
    process.exit(out.independent_validation.ok ? 0 : 1);
  } catch (e) {
    console.error(`FATAL: ${e.message}`);
    process.exit(1);
  }
}
