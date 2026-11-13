/**
 * The ONE adapter that turns real on-disk artefacts into the execution
 * snapshot consumed by computeFinalStatus().
 *
 * Every consumer — `uap status`, report-generator / FINAL-STATUS.json,
 * SPECIFICATION-INDEX.md and the independent consistency verifier — must go
 * through this module. None of them may invent a pass count.
 *
 * Design rules:
 *   - Historical cards without an execution_id / git_head / worktree fingerprint
 *     are STALE. They are still reported, but status-engine refuses to count
 *     them as current passes.
 *   - Capabilities default to false. Only a real, current, bound artefact can
 *     turn one true. A missing tool never becomes a PASS.
 *   - simulated_only financial results are explicitly NOT financial integrity.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, STATE, REPORTS, FILES, rootPath } from '../_lib/paths.mjs';
import { readJSON, readText, nowISO, hash } from '../_lib/util.mjs';
import { currentExecution } from './execution.mjs';
import { computeFinalStatus, verifyEvidenceChain } from './index.mjs';

export const component = 'runtime.status-engine.snapshot';
export const version = '1.0.0';

const MATRIX = path.join(REPORTS, 'REQUIREMENT-TRACEABILITY-MATRIX.json');
const INDEX = FILES.index;
const STATUS_BLOCK_RE = /<!--\s*UAP-STATUS-BLOCK\s+(\{[\s\S]*?\})\s*-->/;

function p(name) { return path.join(REPORTS, name); }

function readIndexBlock() {
  if (!fs.existsSync(INDEX)) return null;
  const m = STATUS_BLOCK_RE.exec(readText(INDEX));
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

/** Build the machine-readable status block emitted into SPECIFICATION-INDEX.md. */
export function renderStatusBlock(verdict, specVer) {
  const payload = {
    computed_by: verdict.computed_by,
    execution_id: verdict.execution_id,
    git_head: verdict.git_head,
    overall_status: verdict.overall_status,
    claim_allowed: verdict.claim_allowed,
    requirements_total: verdict.counts.applicable,
    requirements_verified: verdict.counts.verified,
    specifications_verified: specVer.verified_specs,
    specifications_total: specVer.total_specs,
    generated_at: nowISO(),
  };
  return `<!-- UAP-STATUS-BLOCK ${JSON.stringify(payload)} -->`;
}

/** Per-specification verification derived from the requirement matrix. */
export function specificationVerification(matrix) {
  const bySpec = new Map();
  for (const r of (matrix?.requirements || [])) {
    if (!bySpec.has(r.specification_id)) bySpec.set(r.specification_id, []);
    bySpec.get(r.specification_id).push(r);
  }
  let verified_specs = 0;
  const per_spec = {};
  for (const [id, rows] of bySpec) {
    const verified = rows.filter((r) => r.verification_status === 'VERIFIED'
      && (r.test_cases || []).length > 0 && (r.evidence || []).length > 0
      && (r.blockers || []).length === 0).length;
    const status = rows.length > 0 && verified === rows.length
      ? 'VERIFIED' : 'IMPLEMENTED_NOT_VERIFIED';
    if (status === 'VERIFIED') verified_specs += 1;
    per_spec[id] = { total: rows.length, verified, status };
  }
  return { verified_specs, total_specs: bySpec.size, per_spec };
}

function tapCounts(card) {
  const text = `${card?.stdout_tail || ''}\n${card?.stderr_tail || ''}`;
  const num = (re) => { const m = re.exec(text); return m ? Number(m[1]) : 0; };
  const total = num(/# tests (\d+)/);
  const pass = num(/# pass (\d+)/);
  const fail = num(/# fail (\d+)/);
  const skipped = num(/# skipped (\d+)/) + num(/# cancelled (\d+)/) + num(/# todo (\d+)/);
  const passing_test_names = [...text.matchAll(/^\s*ok \d+ - (.+)$/gm)].map((m) => m[1].trim());
  return {
    total, pass, fail, skipped,
    not_executed: total ? Math.max(0, total - pass - fail - skipped) : 0,
    passing_test_names,
    execution_id: card?.execution_id ?? null,
    git_head: card?.git_head ?? null,
    worktree_fingerprint: card?.worktree_fingerprint ?? null,
    exit_code: card?.exit_code ?? null,
  };
}

/** A capability is true only for a real artefact bound to THIS execution. */
function currentArtefact(file, predicate, execution) {
  const card = readJSON(file, null);
  if (!card || !predicate(card)) return false;
  return card.execution_id === execution.execution_id
    && card.git_head === execution.git_head
    && card.worktree_fingerprint === execution.worktree_fingerprint
    && card.exit_code === 0;
}

function capabilities(execution) {
  const bound = (name, predicate) => currentArtefact(p(name), predicate, execution);
  const repair = readJSON(p('AUTO-REPAIR.json'), null);
  const recovery = readJSON(path.join(STATE, 'recovery-verification.json'), null);
  const financial = readJSON(p('FINANCIAL-INTEGRITY.json'), null);
  return {
    // A sandbox-only repair explicitly declares business_code_untouched.
    real_code_repair: bound('BUSINESS-CODE-REPAIR.json',
      (c) => c.business_code_repair?.status === 'SUCCEEDED' && c.business_code_untouched === false),
    independent_regression: bound('INDEPENDENT-REGRESSION.json',
      (c) => c.status === 'PASS' && (c.regression_commands || []).length > 0),
    recovery: Boolean(recovery?.ok === true)
      && recovery.execution_id === execution.execution_id
      && recovery.git_head === execution.git_head
      && recovery.worktree_fingerprint === execution.worktree_fingerprint,
    e2e: bound('E2E-RESULTS.json',
      (c) => c.status === 'PASS' && (c.browser_runs || []).length > 0),
    database_integration: bound('DATABASE-INTEGRATION.json',
      (c) => c.status === 'PASS' && (c.transactions || []).length > 0),
    // simulated_only is a simulation layer, never real financial integrity.
    financial_integrity: bound('FINANCIAL-INTEGRATION.json',
      (c) => c.status === 'PASS' && c.simulated_only !== true),
    _diagnostics: {
      auto_repair_business_code_untouched: repair?.business_code_untouched ?? null,
      financial_simulated_only: financial?.simulated_only ?? null,
      recovery_has_binding: Boolean(recovery?.execution_id),
    },
  };
}

function p0Blockers(execution, caps) {
  const out = [];
  const defects = readJSON(FILES.defects, null);
  for (const d of defects?.defects || []) {
    if (d.severity === 'P0' && !['FIXED', 'VERIFIED', 'ACCEPTED_RISK'].includes(d.status)) {
      out.push({ id: d.id, status: d.status, category: 'OPEN_DEFECT', title: d.title });
    }
  }
  if (!caps.real_code_repair) {
    out.push({ id: 'UAP-P0-REAL-CODE-REPAIR', status: 'OPEN', category: 'CAPABILITY_GAP',
      title: 'auto-repair 仅修复 sandbox fixture，尚未完成真实 Uter 业务代码修复闭环' });
  }
  if (!caps.independent_regression) {
    out.push({ id: 'UAP-P0-INDEPENDENT-REGRESSION', status: 'OPEN', category: 'CAPABILITY_GAP',
      title: '缺少独立回归路径（不得由 UAP 自验证充当唯一验收依据）' });
  }
  return out;
}

/** Build the snapshot from real artefacts. `claims` can be injected by a
 *  generator that is about to write the report, otherwise it is read from the
 *  last generated FINAL-STATUS.json (and may therefore be stale). */
export function buildStatusSnapshot({ claims, indexDeclaration } = {}) {
  const execution = currentExecution();
  const matrix = readJSON(MATRIX, null);
  const testsCard = readJSON(p('RUNTIME-TEST-RESULTS.json'), null);
  const validationCard = readJSON(p('VALIDATION-RESULTS.json'), null);
  const finalCard = readJSON(FILES.finalStatus, null);
  const indexBlock = readIndexBlock();

  const requirements = (matrix?.requirements || []).map((r) => ({
    requirement_id: r.requirement_id,
    specification_id: r.specification_id,
    implementation_status: r.implementation_status || 'NOT_IMPLEMENTED',
    verification_status: r.verification_status || 'NOT_VERIFIED',
    test_cases: r.test_cases || [],
    evidence: r.evidence || [],
    blockers: r.blockers || [],
    na_reason: r.na_reason ?? null,
    na_approval: r.na_approval ?? null,
  }));

  const injectedClaims = claims || {
    specifications_verified: finalCard?.specifications?.verified,
    overall_status: finalCard?.overall_status,
  };

  const caps = capabilities(execution);
  const { _diagnostics, ...capFlags } = caps;

  const snapshot = {
    execution_id: execution.execution_id,
    git_head: execution.git_head,
    worktree_fingerprint: execution.worktree_fingerprint,
    computed_at: nowISO(),
    requirements,
    tests: testsCard ? tapCounts(testsCard) : null,
    validators: validationCard ? {
      results: validationCard.results || [],
      execution_id: validationCard.execution_id ?? null,
      git_head: validationCard.git_head ?? null,
      worktree_fingerprint: validationCard.worktree_fingerprint ?? null,
      exit_code: validationCard.exit_code ?? null,
      pass: validationCard.pass, fail: validationCard.fail, total: validationCard.total,
    } : null,
    // indexDeclaration lets a generator bind the report and the index to the
    // exact same verdict instance BEFORE either file is written. The on-disk
    // block is used by `uap status` and by the independent verifier.
    spec_index_statuses: indexDeclaration || (indexBlock ? {
      verified_specs: indexBlock.specifications_verified,
      total_specs: indexBlock.specifications_total,
      overall_status: indexBlock.overall_status,
    } : null),
    claims: injectedClaims,
    p0_blockers: p0Blockers(execution, capFlags),
    capabilities: capFlags,
    diagnostics: {
      matrix_present: Boolean(matrix), matrix_generated_at: matrix?.generated_at ?? null,
      tests_card_present: Boolean(testsCard), tests_card_generated_at: testsCard?.generated_at ?? null,
      validation_card_present: Boolean(validationCard), validation_card_generated_at: validationCard?.generated_at ?? null,
      index_block_present: Boolean(indexBlock),
      ..._diagnostics,
    },
  };
  return snapshot;
}

/** The single status calculation entry point for all consumers. */
export function statusVerdict(options = {}) {
  const snapshot = buildStatusSnapshot(options);
  const verdict = computeFinalStatus(snapshot);
  const matrix = readJSON(MATRIX, null);
  const specVer = specificationVerification(matrix);
  const evidenceEntries = listCurrentEvidence(snapshot);
  return { snapshot, verdict, specVer, evidence_chain: verifyEvidenceChain(evidenceEntries, snapshot) };
}

/** Evidence records that claim to belong to the current execution. */
function listCurrentEvidence(snapshot) {
  const dir = path.join(ROOT, '.uap', 'evidence');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    let rec;
    try { rec = JSON.parse(readText(path.join(dir, f))); } catch { continue; }
    if (rec.execution_id !== snapshot.execution_id) continue;
    const expected = hash(JSON.stringify({ ...rec, content_hash: null }));
    out.push({
      evidence_id: rec.evidence_id,
      execution_id: rec.execution_id,
      git_head: rec.git_head ?? null,
      worktree_fingerprint: rec.worktree_fingerprint ?? null,
      recorded_at: rec.recorded_at ?? null,
      hash_valid: expected === rec.content_hash,
      immutable_violation: false,
    });
  }
  return out;
}

export function health() {
  try {
    const { verdict, specVer } = statusVerdict();
    return {
      component, version, ok: true,
      checks: {
        execution_bound: Boolean(verdict.execution_id && verdict.git_head),
        matrix_consumed: verdict.counts.requirements_total > 0,
        status_computed_by_engine: verdict.computed_by === 'runtime.status-engine/computeFinalStatus',
        spec_verification_derived: specVer.total_specs > 0,
      },
      overall_status: verdict.overall_status, checked_at: nowISO(),
    };
  } catch (error) {
    return { component, version, ok: false, checks: {}, error: error.message, checked_at: nowISO() };
  }
}

export { rootPath };
