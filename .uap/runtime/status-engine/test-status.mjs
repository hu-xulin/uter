/**
 * UAP unified TEST status model — Phase 2 remediation (P2-03 / P2-10).
 *
 * Root cause of the audit finding: Playwright's JSON reporter sets `ok: true`
 * for a SKIPPED spec, and UAP counted `spec.ok` as PASS. `biz_01 注册新用户
 * [BLOCKED_BY_POLICY]` was therefore recorded as a pass even though registration
 * never ran. Similar leaks existed in the payment / visual / security cards.
 *
 * This module is the SINGLE source of truth for:
 *   - the status enum,
 *   - normalising raw runner output into that enum,
 *   - counting (ONLY PASS is countable as a pass),
 *   - aggregating suites into an overall verdict, and
 *   - detecting false-pass attempts after the fact.
 *
 * It is deliberately PURE: no filesystem access, no report writing, no git.
 */
export const component = 'runtime.status-engine.test-status';
export const version = '1.0.0';

/** The only six test states UAP admits. */
export const TEST_STATUS = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  SKIPPED: 'SKIPPED',
  BLOCKED: 'BLOCKED',
  NOT_RUN: 'NOT_RUN',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

export const TEST_STATUSES = Object.freeze(Object.values(TEST_STATUS));
/** Only a genuinely executed, genuinely passing test may be counted as PASS. */
export const PASS_COUNTABLE = Object.freeze(new Set([TEST_STATUS.PASS]));
/** States that must prevent a complete acceptance, even with zero FAILs. */
export const ACCEPTANCE_BLOCKING = Object.freeze(new Set([
  TEST_STATUS.FAIL, TEST_STATUS.BLOCKED, TEST_STATUS.SKIPPED, TEST_STATUS.NOT_RUN,
]));

/** Statuses that require an explicit written justification. */
export const REASON_REQUIRED = Object.freeze(new Set([
  TEST_STATUS.BLOCKED, TEST_STATUS.SKIPPED, TEST_STATUS.NOT_RUN, TEST_STATUS.NOT_APPLICABLE,
]));

const VALID = new Set(TEST_STATUSES);

export function isTestStatus(value) { return VALID.has(value); }

/**
 * Normalise an arbitrary status-ish value into the enum. Unknown / missing
 * values fail closed to NOT_RUN (never to PASS).
 */
export function coerceStatus(value, fallback = TEST_STATUS.NOT_RUN) {
  if (typeof value !== 'string') return fallback;
  const v = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (VALID.has(v)) return v;
  // Runner-specific spellings, mapped conservatively.
  if (v === 'PASSED' || v === 'OK' || v === 'SUCCESS' || v === 'EXPECTED') return TEST_STATUS.PASS;
  if (v === 'FAILED' || v === 'ERROR' || v === 'UNEXPECTED' || v === 'TIMEDOUT') return TEST_STATUS.FAIL;
  if (v === 'SKIP' || v === 'CANCELLED' || v === 'TODO') return TEST_STATUS.SKIPPED;
  if (v === 'BLOCKED_BY_POLICY' || v === 'RESTRICTED' || v === 'NOT_EXECUTED') return TEST_STATUS.BLOCKED;
  if (v === 'NA' || v === 'N/A') return TEST_STATUS.NOT_APPLICABLE;
  return fallback;
}

/** Read a `UAP_STATUS` annotation from a Playwright spec. */
export function annotationOf(spec) {
  const list = [...(spec?.annotations || []), ...(spec?.tests || []).flatMap((t) => t.annotations || [])];
  for (const a of list) {
    if (!a || (a.type !== 'UAP_STATUS' && a.type !== 'uap_status')) continue;
    const raw = typeof a.description === 'string' ? a.description : String(a.description ?? '');
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch { /* fall back to a plain string status */ }
    return { status: raw.trim().toUpperCase(), reason: raw };
  }
  return null;
}

/**
 * Normalise ONE Playwright spec into a strict status item.
 *
 * Order of authority:
 *   1. explicit UAP_STATUS annotation (BLOCKED / SKIPPED / NOT_APPLICABLE / ...)
 *   2. `[BLOCKED_BY_POLICY]` / `[NOT_APPLICABLE]` markers in the title
 *   3. per-result statuses from tests[].results[]
 *   4. spec.ok — used ONLY as a last resort, and only for genuine failures
 *
 * `ok === true` alone NEVER produces PASS.
 */
export function normalizePlaywrightSpec(spec, index = 0) {
  const title = String(spec?.title ?? `spec_${index}`);
  const annotation = annotationOf(spec);
  const results = (spec?.tests || []).flatMap((t) => t.results || []);
  const statuses = results.map((r) => String(r?.status || '').toLowerCase());
  const hasSkipped = statuses.some((s) => ['skipped', 'cancelled', 'todo', 'interrupted'].includes(s));
  const hasFailed = statuses.some((s) => ['failed', 'timedout', 'unexpected'].includes(s));
  const explicitErrors = [
    ...(spec?.errors || []),
    ...(spec?.tests || []).flatMap((t) => [...(t.errors || []), ...(t.results || []).flatMap((r) => r.errors || [])]),
  ];

  let status = TEST_STATUS.NOT_RUN;
  let reason = null;
  let source = 'runner';

  if (annotation && annotation.status) {
    status = coerceStatus(annotation.status, TEST_STATUS.BLOCKED);
    reason = annotation.reason || annotation.policy || annotation.basis || null;
    source = 'annotation';
  } else if (/\[BLOCKED_BY_POLICY\]/i.test(title) || /BLOCKED_BY_POLICY/i.test(title)) {
    status = TEST_STATUS.BLOCKED;
    reason = 'policy marker in spec title: execution prohibited';
    source = 'title';
  } else if (/\[NOT_APPLICABLE\]/i.test(title)) {
    status = TEST_STATUS.NOT_APPLICABLE;
    reason = 'not-applicable marker in spec title';
    source = 'title';
  } else if (hasFailed || explicitErrors.length > 0 || spec?.ok === false) {
    status = TEST_STATUS.FAIL;
    reason = explicitErrors[0] ? String(explicitErrors[0].message || explicitErrors[0]).slice(0, 300) : 'runner reported a failure';
  } else if (hasSkipped) {
    status = TEST_STATUS.SKIPPED;
    reason = 'runner reported status=skipped';
  } else if (statuses.some((s) => s === 'passed')) {
    status = TEST_STATUS.PASS;
  } else if (spec?.ok === true && results.length === 0) {
    // No per-result evidence: a bare `ok:true` is NOT a pass.
    status = TEST_STATUS.NOT_RUN;
    reason = 'spec.ok=true but no per-test result evidence';
  }

  if (!isTestStatus(status)) status = TEST_STATUS.NOT_RUN;
  // A policy-blocked/skipped/not-run item may never be silently promoted by a
  // later "runner said ok" observation.
  if (REASON_REQUIRED.has(status) && !reason) reason = `status=${status} without explicit reason`;

  return {
    id: String(spec?.id ?? spec?.title ?? index),
    title,
    status,
    reason,
    source,
    runner_ok: spec?.ok === true,
    runner_statuses: statuses,
    evidence_ref: annotation?.evidence_ref ?? null,
  };
}

/** Normalise a `go test -json` action into the enum. */
export function normalizeGoAction(action) {
  if (action === 'pass') return TEST_STATUS.PASS;
  if (action === 'fail') return TEST_STATUS.FAIL;
  if (action === 'skip') return TEST_STATUS.SKIPPED;
  return TEST_STATUS.NOT_RUN;
}

/**
 * Strict counting. Never infers PASS from a boolean `ok`.
 * `items` may be status strings or `{status}` objects.
 */
export function summarize(items = []) {
  const counts = Object.fromEntries(TEST_STATUSES.map((s) => [s, 0]));
  const problems = [];
  let falsePassAttempts = 0;
  for (const raw of items) {
    const obj = typeof raw === 'string' ? { status: raw } : (raw || {});
    const status = coerceStatus(obj.status);
    counts[status] += 1;
    if (REASON_REQUIRED.has(status) && !obj.reason && !obj.basis && !obj.unblock_condition) {
      problems.push(`${obj.title || obj.id || 'item'}: status=${status} has no reason`);
    }
    // Detect the exact historical false-pass pattern.
    if (obj.runner_ok === true && status !== TEST_STATUS.PASS && status !== TEST_STATUS.FAIL) {
      falsePassAttempts += 1;
    }
  }
  const total = items.length;
  const pass = PASS_COUNTABLE.has(TEST_STATUS.PASS) ? counts.PASS : 0;
  return {
    status_model: 'UAP-TEST-STATUS-1.0',
    total,
    counts,
    pass,
    fail: counts.FAIL,
    blocked: counts.BLOCKED,
    skipped: counts.SKIPPED,
    not_run: counts.NOT_RUN,
    not_applicable: counts.NOT_APPLICABLE,
    // Only a full set of real PASSes is an all-clear. NOT_APPLICABLE with a
    // written basis is allowed, but is reported separately and never counted
    // as a pass.
    all_pass: total > 0 && counts.PASS + counts.NOT_APPLICABLE === total && counts.FAIL === 0,
    has_failure: counts.FAIL > 0,
    has_blocking: [...ACCEPTANCE_BLOCKING].some((s) => counts[s] > 0),
    false_pass_attempts: falsePassAttempts,
    problems,
  };
}

/**
 * Aggregate multiple suites into ONE verdict.
 * Any FAIL => FAIL. Otherwise any BLOCKED/SKIPPED/NOT_RUN => BLOCKED.
 * Otherwise (all PASS or justified NOT_APPLICABLE) => PASS.
 */
export function aggregate(summaries = []) {
  const totals = Object.fromEntries(TEST_STATUSES.map((s) => [s, 0]));
  const problems = [];
  let executed = 0;
  for (const s of summaries) {
    if (!s || typeof s !== 'object') { problems.push('suite summary missing'); continue; }
    executed += s.total || 0;
    for (const k of TEST_STATUSES) totals[k] += Number(s.counts?.[k] || 0);
    problems.push(...(s.problems || []).map((p) => `${s.suite || 'suite'}: ${p}`));
  }
  let status = TEST_STATUS.PASS;
  if (totals.FAIL > 0) status = TEST_STATUS.FAIL;
  else if (totals.BLOCKED > 0 || totals.SKIPPED > 0 || totals.NOT_RUN > 0) status = TEST_STATUS.BLOCKED;
  else if (executed === 0) status = TEST_STATUS.NOT_RUN;
  return {
    status_model: 'UAP-TEST-STATUS-1.0',
    status,
    total: executed,
    counts: totals,
    pass: totals.PASS,
    fail: totals.FAIL,
    blocked: totals.BLOCKED,
    skipped: totals.SKIPPED,
    not_run: totals.NOT_RUN,
    not_applicable: totals.NOT_APPLICABLE,
    problems,
    claim_allowed: status === TEST_STATUS.PASS,
  };
}

/**
 * Post-hoc guard: a card must not claim PASS while its own items disagree.
 * Throws on any inconsistency so a caller cannot accidentally emit a green
 * card. This is the machine check behind "BLOCKED never counts as PASS".
 */
export function assertNoFalsePass(card) {
  const errors = [];
  const counts = card?.counts || {};
  const items = Array.isArray(card?.items) ? card.items : [];
  const recomputed = summarize(items);
  for (const k of TEST_STATUSES) {
    if (items.length && Number(counts[k] || 0) !== recomputed.counts[k]) {
      errors.push(`counts.${k}=${counts[k] ?? 0} but items contain ${recomputed.counts[k]}`);
    }
  }
  if (items.length && Number(card?.pass ?? card?.passed ?? 0) !== recomputed.counts.PASS) {
    errors.push(`pass=${card?.pass ?? card?.passed} but items contain ${recomputed.counts.PASS} PASS`);
  }
  if (card?.status === 'PASS' && items.length && !recomputed.all_pass) {
    errors.push('status=PASS while items include FAIL/BLOCKED/SKIPPED/NOT_RUN');
  }
  if (card?.status === 'PASS' && recomputed.false_pass_attempts > 0 && recomputed.counts.BLOCKED + recomputed.counts.SKIPPED > 0) {
    errors.push(`${recomputed.false_pass_attempts} runner_ok=true item(s) would have been miscounted as PASS`);
  }
  if (errors.length) {
    const err = new Error(`false-pass guard: ${errors.join('; ')}`);
    err.code = 'UAP_FALSE_PASS';
    throw err;
  }
  return { ok: true, recomputed };
}

/** Build a strict, bound-ready card body. */
export function makeCard({ suite, command, exit_code, items, extra = {} }) {
  const normalized = (items || []).map((it, i) => (typeof it === 'string' || !it.status
    ? { status: coerceStatus(it.status || it), title: it.title || `${suite}_${i}` }
    : it));
  const summary = { suite, ...summarize(normalized) };
  let status = TEST_STATUS.PASS;
  if (exit_code !== 0 || summary.counts.FAIL > 0) status = TEST_STATUS.FAIL;
  else if (summary.has_blocking) status = TEST_STATUS.BLOCKED;
  else if (summary.total === 0) status = TEST_STATUS.NOT_RUN;
  const card = {
    status_model: 'UAP-TEST-STATUS-1.0',
    status,
    suite,
    command,
    exit_code,
    items: normalized,
    counts: summary.counts,
    total: summary.total,
    pass: summary.pass,
    fail: summary.fail,
    blocked: summary.blocked,
    skipped: summary.skipped,
    not_run: summary.not_run,
    not_applicable: summary.not_applicable,
    ...extra,
  };
  assertNoFalsePass(card);
  return card;
}

export function health() {
  const blocked = [{ status: 'BLOCKED', title: 'biz_01', reason: 'policy', runner_ok: true }];
  const s = summarize(blocked);
  const honest = s.pass === 0 && s.counts.BLOCKED === 1 && s.has_blocking && s.false_pass_attempts === 1;
  const mixed = summarize([{ status: 'PASS' }, { status: 'SKIPPED', reason: 'x' }, { status: 'FAIL' }]);
  const strict = mixed.pass === 1 && mixed.counts.SKIPPED === 1 && mixed.has_failure;
  let guardWorks = false;
  try {
    assertNoFalsePass({ status: 'PASS', counts: { PASS: 1 }, pass: 1, items: [{ status: 'BLOCKED', reason: 'policy' }] });
  } catch (e) { guardWorks = e.code === 'UAP_FALSE_PASS'; }
  return {
    component, version, ok: honest && strict && guardWorks,
    checks: { blocked_not_pass: honest, strict_counting: strict, false_pass_guard: guardWorks },
    checked_at: new Date().toISOString(),
  };
}
