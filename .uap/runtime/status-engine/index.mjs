/**
 * UAP single source of truth for status computation.
 *
 * This module is deliberately PURE: it never reads the filesystem, never reads
 * a historical card, and never writes a report. It consumes an execution
 * snapshot and returns a verdict. Every consumer (SPECIFICATION-INDEX.md,
 * validation reports, FINAL-STATUS.json, the CLI `status` command) must call
 * the same `computeFinalStatus()` so they cannot disagree.
 *
 * Hard rules (UAP 1.0 directive §3.4 / §16):
 *   - A result counts only when it belongs to the CURRENT execution id AND the
 *     current git HEAD. Historical PASS results are stale, not evidence.
 *   - Skipped / not-executed tests are never counted as passes.
 *   - Missing evidence is never counted as a pass.
 *   - Any unresolved applicable P0 requirement forbids FULLY_*.
 *   - FULLY_OPERATIONAL additionally requires a real Uter business-code repair
 *     closed loop, independent regression, recovery, and E2E verification.
 *   - NOT_APPLICABLE requires an explicit reason and approval record.
 */
export const component = 'runtime.status-engine';
export const version = '1.0.0';

export const FINAL_STATES = Object.freeze([
  'NOT_BUILT', 'PARTIALLY_BUILT', 'IMPLEMENTED_NOT_VERIFIED',
  'PARTIALLY_VERIFIED', 'FULLY_VERIFIED', 'FULLY_OPERATIONAL', 'BLOCKED', 'FAILED',
]);

const APPLICABLE_REQ_STATES = new Set([
  'NOT_IMPLEMENTED', 'PARTIALLY_IMPLEMENTED', 'IMPLEMENTED',
  'IMPLEMENTED_NOT_VERIFIED', 'VERIFIED', 'BLOCKED',
]);

/** True when an artefact belongs to this exact execution and code version. */
export function isCurrent(artefact, snapshot) {
  if (!artefact || typeof artefact !== 'object') return false;
  if (!snapshot?.execution_id || !snapshot?.git_head) return false;
  if (artefact.execution_id !== snapshot.execution_id
      || artefact.git_head !== snapshot.git_head
      || artefact.exit_code !== 0) return false;
  // When the snapshot pins a business-code fingerprint, an artefact produced
  // against different code is stale even if the commit hash is unchanged.
  if (snapshot.worktree_fingerprint
      && artefact.worktree_fingerprint !== snapshot.worktree_fingerprint) return false;
  return true;
}

/**
 * @param {object} snapshot
 * @param {string} snapshot.execution_id   unique id of the current run
 * @param {string} snapshot.git_head       HEAD the run executed against
 * @param {Array}  snapshot.requirements  traceability-matrix rows
 * @param {object} snapshot.tests         {total,pass,fail,skipped,not_executed, execution_id, git_head, exit_code}
 * @param {object} snapshot.validators    {results:[{status,...}], execution_id, git_head, exit_code}
 * @param {string[]} snapshot.spec_index_statuses  statuses declared in the index
 * @param {Array}  snapshot.p0_blockers   unresolved P0 blockers
 * @param {object} snapshot.capabilities  {real_code_repair, independent_regression, recovery, e2e, database_integration, financial_integrity}
 * @param {object} snapshot.claims        counts asserted by generated reports
 */
export function computeFinalStatus(snapshot = {}) {
  const reasons = [];
  const reqs = Array.isArray(snapshot.requirements) ? snapshot.requirements : [];
  const applicable = reqs.filter((r) => APPLICABLE_REQ_STATES.has(r.implementation_status)
    && !(r.implementation_status === 'NOT_APPLICABLE'));
  const na = reqs.filter((r) => r.implementation_status === 'NOT_APPLICABLE');
  const badNA = na.filter((r) => !r.na_reason || !r.na_approval);

  const counts = {
    requirements_total: reqs.length,
    applicable: applicable.length,
    not_applicable: na.length,
    not_implemented: applicable.filter((r) => r.implementation_status === 'NOT_IMPLEMENTED').length,
    partially_implemented: applicable.filter((r) => r.implementation_status === 'PARTIALLY_IMPLEMENTED').length,
    implemented: applicable.filter((r) => r.implementation_status === 'IMPLEMENTED').length,
    implemented_not_verified: applicable.filter((r) => r.implementation_status === 'IMPLEMENTED_NOT_VERIFIED').length,
    verified: 0,
    blocked_requirements: applicable.filter((r) => r.implementation_status === 'BLOCKED').length,
  };

  // A requirement is VERIFIED only if it is implemented, has a linked test,
  // has evidence bound to THIS execution, and that test actually passed.
  const testsCurrent = isCurrent(snapshot.tests, snapshot);
  const validatorsCurrent = isCurrent(snapshot.validators, snapshot);
  const passingTestNames = new Set(
    testsCurrent ? (snapshot.tests.passing_test_names || []) : [],
  );
  for (const r of applicable) {
    const implemented = ['IMPLEMENTED', 'IMPLEMENTED_NOT_VERIFIED', 'VERIFIED'].includes(r.implementation_status);
    const hasTest = (r.test_cases || []).length > 0;
    const testPassed = hasTest && (r.test_cases || []).some((t) => passingTestNames.has(t));
    const evidenceCurrent = (r.evidence || []).some((e) => {
      if (typeof e === 'string') return false; // a bare id proves no binding
      if (e.execution_id !== snapshot.execution_id || e.git_head !== snapshot.git_head || e.hash_valid !== true) return false;
      if (snapshot.worktree_fingerprint && e.worktree_fingerprint !== snapshot.worktree_fingerprint) return false;
      return true;
    });
    const noBlocker = (r.blockers || []).length === 0;
    if (implemented && hasTest && testPassed && evidenceCurrent && noBlocker
        && r.verification_status === 'VERIFIED') counts.verified += 1;
  }

  // Consistency check between the index and the reports.
  const indexDecl = snapshot.spec_index_statuses;
  const indexVerified = Array.isArray(indexDecl)
    ? indexDecl.filter((s) => s === 'VERIFIED' || s === 'ACTIVE').length
    : (Number(indexDecl?.verified_specs) || 0);
  const reportVerified = snapshot.claims?.specifications_verified;
  const indexReportMismatch = typeof reportVerified === 'number' && reportVerified !== indexVerified;
  if (indexReportMismatch) reasons.push(`index/report mismatch: index=${indexVerified} report=${reportVerified}`);
  const reportOverall = snapshot.claims?.overall_status;
  const indexOverall = Array.isArray(indexDecl) ? null : indexDecl?.overall_status;
  const overallMismatch = Boolean(reportOverall && indexOverall && reportOverall !== indexOverall);
  if (overallMismatch) reasons.push(`index/report overall_status mismatch: index=${indexOverall} report=${reportOverall}`);

  // Stale-result detection: a historical PASS must never be promoted.
  const stalePasses = [];
  if (snapshot.tests && !testsCurrent) stalePasses.push('tests');
  if (snapshot.validators && !validatorsCurrent) stalePasses.push('validators');
  if (stalePasses.length) reasons.push(`stale artefacts not bound to current execution/HEAD: ${stalePasses.join(',')}`);

  const tests = snapshot.tests || {};
  const skipped = (tests.skipped || 0) + (tests.not_executed || 0);
  const testFailures = tests.fail || 0;
  if (testFailures) reasons.push(`${testFailures} test(s) failed`);
  if (skipped) reasons.push(`${skipped} test(s) skipped/not executed — never counted as pass`);
  if (counts.not_implemented) reasons.push(`${counts.not_implemented} requirement(s) not implemented`);
  if (counts.partially_implemented) reasons.push(`${counts.partially_implemented} requirement(s) partially implemented`);
  if (counts.implemented_not_verified) reasons.push(`${counts.implemented_not_verified} requirement(s) implemented but not verified`);
  if (counts.blocked_requirements) reasons.push(`${counts.blocked_requirements} requirement(s) blocked`);
  if (badNA.length) reasons.push(`${badNA.length} NOT_APPLICABLE without reason+approval`);
  if (applicable.length && counts.verified < applicable.length) {
    reasons.push(`${applicable.length - counts.verified}/${applicable.length} applicable requirements lack current valid evidence`);
  }
  const missingEvidence = applicable.filter((r) => !(r.evidence || []).length).length;
  if (missingEvidence) reasons.push(`${missingEvidence} requirement(s) have no evidence record`);

  const p0 = snapshot.p0_blockers || [];
  const openP0 = p0.filter((b) => !['RESOLVED', 'ACCEPTED'].includes(b.status)).length;
  if (openP0) reasons.push(`${openP0} unresolved P0 blocker(s)`);

  const caps = snapshot.capabilities || {};
  const capMissing = Object.entries(caps).filter(([, v]) => v !== true).map(([k]) => k);

  // Core existence gate.
  if (!reqs.length || !snapshot.execution_id || !snapshot.git_head) {
    return verdict('NOT_BUILT', counts, [...reasons, 'no requirements/execution identity'], snapshot, caps);
  }
  if (openP0 && p0.some((b) => b.category === 'CRITICAL_DEPENDENCY_MISSING')) {
    return verdict('BLOCKED', counts, reasons, snapshot, caps);
  }

  const allVerified = applicable.length > 0
    && counts.verified === applicable.length
    && !indexReportMismatch && !overallMismatch && !stalePasses.length
    && testFailures === 0 && skipped === 0 && missingEvidence === 0
    && !badNA.length && openP0 === 0;

  if (allVerified) {
    // FULLY_OPERATIONAL is strictly stronger than FULLY_VERIFIED.
    if (capMissing.length === 0) {
      return verdict('FULLY_OPERATIONAL', counts, reasons, snapshot, caps);
    }
    return verdict('FULLY_VERIFIED', counts,
      [...reasons, `operational capabilities not demonstrated: ${capMissing.join(',')}`], snapshot, caps);
  }

  const anyImplementation = counts.implemented + counts.implemented_not_verified + counts.verified > 0;
  if (!anyImplementation && counts.not_implemented === applicable.length) {
    return verdict('PARTIALLY_BUILT', counts, reasons, snapshot, caps);
  }
  if (counts.verified === 0) {
    return verdict('IMPLEMENTED_NOT_VERIFIED', counts, reasons, snapshot, caps);
  }
  return verdict('PARTIALLY_VERIFIED', counts, reasons, snapshot, caps);
}

function verdict(status, counts, reasons, snapshot, caps) {
  return {
    overall_status: status,
    computed_by: 'runtime.status-engine/computeFinalStatus',
    computed_at: snapshot.computed_at || null,
    execution_id: snapshot.execution_id || null,
    git_head: snapshot.git_head || null,
    counts,
    capabilities: caps,
    capability_gaps: Object.entries(caps).filter(([, v]) => v !== true).map(([k]) => k),
    reasons,
    claim_allowed: status === 'FULLY_OPERATIONAL' || status === 'FULLY_VERIFIED',
    // The three independent results must be derived from the same snapshot.
    three_independent_results: {
      specification_completeness: counts.requirements_total > 0 && !reasons.some((r) => r.includes('not implemented')) ? 'COMPLETE' : 'INCOMPLETE',
      uap_runtime_capability: status === 'FULLY_OPERATIONAL' ? 'FULLY_OPERATIONAL' : 'NOT_FULLY_VERIFIED',
      uter_real_compliance: status === 'FULLY_OPERATIONAL' ? 'FULLY_COMPLIANT' : 'NOT_FULLY_VERIFIED',
    },
  };
}

/** Verify every artefact in the evidence chain. Fail-closed on any defect. */
export function verifyEvidenceChain(entries = [], snapshot = {}) {
  const problems = [];
  for (const e of entries) {
    if (!e || typeof e !== 'object') { problems.push('evidence entry is not an object'); continue; }
    if (!e.evidence_id) problems.push('missing evidence_id');
    if (e.execution_id !== snapshot.execution_id) problems.push(`${e.evidence_id}: execution_id mismatch`);
    if (e.git_head !== snapshot.git_head) problems.push(`${e.evidence_id}: git_head mismatch`);
    if (snapshot.worktree_fingerprint && e.worktree_fingerprint !== snapshot.worktree_fingerprint) problems.push(`${e.evidence_id}: worktree_fingerprint mismatch`);
    if (e.hash_valid !== true) problems.push(`${e.evidence_id}: hash invalid or unchecked`);
    if (!e.recorded_at) problems.push(`${e.evidence_id}: missing recorded_at`);
    if (e.immutable_violation) problems.push(`${e.evidence_id}: historical evidence was mutated`);
  }
  return { ok: problems.length === 0, problems, checked: entries.length };
}

/**
 * Runtime module contract: every runtime index.mjs module must export a
 * string `component` and a `health()` function (enforced by the real
 * `core.architecture_integrity` validator). This probe is PURE: it re-runs the
 * state-machine invariants on synthetic snapshots and never reads a report,
 * so it cannot be made green by editing a status field on disk.
 */
export function health() {
  const EX = 'UAP-EXEC-HEALTH';
  const HEAD = 'HEALTH-PROBE-HEAD';
  const req = (i) => ({
    requirement_id: `PROBE-R-${i}`,
    implementation_status: 'IMPLEMENTED',
    verification_status: 'VERIFIED',
    test_cases: [`probe-case-${i}`],
    evidence: [{ evidence_id: `PROBE-EV-${i}`, execution_id: EX, git_head: HEAD, hash_valid: true, recorded_at: 'probe' }],
    blockers: [],
  });
  const base = () => ({
    execution_id: EX,
    git_head: HEAD,
    requirements: [req(1), req(2)],
    tests: {
      total: 2, pass: 2, fail: 0, skipped: 0, not_executed: 0,
      passing_test_names: ['probe-case-1', 'probe-case-2'],
      execution_id: EX, git_head: HEAD, exit_code: 0,
    },
    validators: { results: [{ status: 'PASS' }], execution_id: EX, git_head: HEAD, exit_code: 0 },
    spec_index_statuses: { verified_specs: 2, total_specs: 2, overall_status: 'FULLY_OPERATIONAL' },
    claims: { specifications_verified: 2, overall_status: 'FULLY_OPERATIONAL' },
    p0_blockers: [],
    capabilities: {
      real_code_repair: true, independent_regression: true, recovery: true,
      e2e: true, database_integration: true, financial_integrity: true,
    },
  });

  const full = computeFinalStatus(base());
  const stale = base(); stale.tests.execution_id = 'UAP-EXEC-OLD';
  const skipped = base(); skipped.tests.skipped = 1;
  const noEvidence = base(); noEvidence.requirements[0].evidence = [];
  const p0 = base(); p0.p0_blockers = [{ status: 'OPEN', category: 'CAPABILITY_GAP' }];
  const noCaps = base(); noCaps.capabilities.real_code_repair = false;

  const checks = {
    final_states_complete: FINAL_STATES.length === 8,
    stale_rejected: !isCurrent({ execution_id: 'OLD', git_head: HEAD, exit_code: 0 }, { execution_id: EX, git_head: HEAD }),
    happy_path_is_operational: full.overall_status === 'FULLY_OPERATIONAL',
    stale_never_promoted: computeFinalStatus(stale).claim_allowed === false,
    skipped_never_pass: computeFinalStatus(skipped).claim_allowed === false,
    missing_evidence_never_pass: computeFinalStatus(noEvidence).claim_allowed === false,
    p0_forbids_full_claim: computeFinalStatus(p0).claim_allowed === false,
    capabilities_required_for_operational: computeFinalStatus(noCaps).overall_status === 'FULLY_VERIFIED',
    evidence_chain_fail_closed: verifyEvidenceChain([{ ...req(1).evidence[0], hash_valid: false }], { execution_id: EX, git_head: HEAD }).ok === false,
  };
  return {
    component, version,
    ok: Object.values(checks).every(Boolean),
    checks,
    checked_at: new Date().toISOString(),
  };
}
