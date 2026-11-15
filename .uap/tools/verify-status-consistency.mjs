/**
 * INDEPENDENT status / evidence consistency verifier — Phase 2 hardened.
 *
 * The old verifier only compared FINAL-STATUS.json, the index block and the
 * CLI, and NEVER checked worktree_fingerprint, capability cards, evidence
 * hashes, or the evidence manifest. The audit found reports bound to three
 * different HEADs and an empty-string fingerprint all passing that check.
 *
 * This version:
 *   - treats the final acceptance gate result (when bound to the current
 *     execution) as the authoritative verdict;
 *   - requires execution_id + git_head + worktree_fingerprint on EVERY final
 *     card and checks the fingerprint is still the CURRENT worktree;
 *   - recomputes card counts from raw items and rejects BLOCKED/SKIPPED/NOT_RUN
 *     promoted to PASS;
 *   - verifies the evidence manifest and every entry hash;
 *   - compares FINAL-STATUS.json, the machine-readable index block and an
 *     independent `uap status --json` process against the same verdict.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { ROOT, FILES, UAP, REPORTS } from '../runtime/_lib/paths.mjs';
import { readJSON, readText, exists, nowISO, writeJSON } from '../runtime/_lib/util.mjs';
import { statusVerdict } from '../runtime/status-engine/snapshot.mjs';
import { gitHead, worktreeFingerprint, currentExecution, environmentFingerprint } from '../runtime/status-engine/execution.mjs';
import { verifyEvidenceManifest, verifyFinalReportBindings, FINAL_REPORTS } from '../runtime/evidence-engine/manifest.mjs';
import { summarize, TEST_STATUS } from '../runtime/status-engine/test-status.mjs';

export const component = 'uap.verify-status-consistency';
export const version = '2.0.0';

const STATUS_BLOCK_RE = /<!--\s*UAP-STATUS-BLOCK\s+(\{[\s\S]*?\})\s*-->/;
const CLI = path.join(UAP, 'bin', 'uap.mjs');
const CARDS = Object.freeze([
  'DATABASE-INTEGRATION.json', 'PAYMENT-SANDBOX.json', 'E2E-RESULTS.json',
  'ACCESSIBILITY-RESULTS.json', 'VISUAL-REGRESSION.json', 'SECURITY-VERIFICATION.json',
  'RUNTIME-TEST-RESULTS.json', 'VALIDATION-RESULTS.json',
]);

function parseIndexBlock() {
  if (!exists(FILES.index)) return null;
  const m = STATUS_BLOCK_RE.exec(readText(FILES.index));
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function runCliStatus() {
  try {
    const out = execFileSync(process.execPath, [CLI, 'status', '--json'], {
      cwd: ROOT, encoding: 'utf8', timeout: 180000,
      stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, UAP_ROOT: ROOT },
    });
    return { ok: true, result: JSON.parse(out) };
  } catch (error) {
    return { ok: false, error: error.message, stdout: String(error.stdout || '').slice(0, 500) };
  }
}

/** @returns {{ok: boolean, problems: string[], checks: Array}} */
export function verifyStatusConsistency({ withCli = true } = {}) {
  const checks = [];
  const problems = [];
  const add = (name, ok, detail) => {
    checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
    if (!ok) problems.push(`${name}: ${detail}`);
  };

  const execution = currentExecution();
  const legacy = statusVerdict();
  const gate = readJSON(path.join(REPORTS, 'FINAL-ACCEPTANCE.json'), null);
  const gateIsCurrent = Boolean(gate && gate.execution_id === execution.execution_id
    && gate.git_head === execution.git_head
    && gate.worktree_fingerprint === execution.worktree_fingerprint
    && gate.environment_fingerprint === execution.environment_fingerprint);
  const finalCard = readJSON(FILES.finalStatus, null);
  const block = parseIndexBlock();

  const authoritative = gateIsCurrent ? gate.status : legacy.verdict.overall_status;
  const claimAllowed = gateIsCurrent ? gate.claim_allowed === true : legacy.verdict.claim_allowed;
  const reportOverall = gateIsCurrent ? (gate.overall_status || null) : (finalCard?.overall_status ?? null);
  const recomputed = gateIsCurrent ? gate.status : legacy.verdict.overall_status;

  add('final_status_exists', Boolean(finalCard), finalCard ? 'FINAL-STATUS.json present' : 'FINAL-STATUS.json missing');
  add('final_acceptance_exists', Boolean(gate), gate ? 'FINAL-ACCEPTANCE.json present' : 'final acceptance gate has not been run');
  add('index_status_block_exists', Boolean(block), block ? 'UAP-STATUS-BLOCK present' : 'index has no machine-readable status block');

  add('final_acceptance_bound_to_current_execution', gateIsCurrent,
    gate ? `gate=${gate.execution_id}/${gate.git_head}/${String(gate.worktree_fingerprint).slice(0, 12)} current=${execution.execution_id}/${execution.git_head}/${String(execution.worktree_fingerprint).slice(0, 12)}` : 'gate missing');

  add('report_matches_recomputed_verdict', reportOverall === recomputed,
    `report=${reportOverall} recomputed=${recomputed}`);
  add('index_overall_matches_report', block?.overall_status === reportOverall,
    `index=${block?.overall_status} report=${reportOverall}`);
  add('claim_allowed_matches_engine',
    finalCard?.claim_allowed === claimAllowed && finalCard?.final_acceptance?.claim_allowed === claimAllowed,
    `report=${finalCard?.claim_allowed} gate=${claimAllowed}`);
  add('claim_allowed_matches_state_machine',
    claimAllowed === ['FULLY_VERIFIED', 'FULLY_OPERATIONAL'].includes(recomputed),
    `overall=${recomputed} claim_allowed=${claimAllowed}`);

  const bindings = verifyFinalReportBindings({ execution });
  add('all_final_reports_bound_to_same_batch', bindings.ok,
    bindings.ok ? `${bindings.checked.length} final reports bound` : bindings.problems.join('; '));

  // Fingerprint must be a REAL, content-bearing hash and must still describe
  // the current worktree. The old empty-string fingerprint is rejected.
  const fpNow = worktreeFingerprint();
  const EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  add('worktree_fingerprint_is_not_empty_hash', fpNow !== EMPTY && /^[0-9a-f]{64}$/.test(String(fpNow)),
    `fingerprint=${fpNow}`);
  add('code_unchanged_since_batch_start', fpNow === execution.worktree_fingerprint,
    `now=${fpNow} bound=${execution.worktree_fingerprint}`);
  add('git_head_matches_current_run', gitHead() === execution.git_head,
    `now=${gitHead()} bound=${execution.git_head}`);
  // Directive §3.1/§3.3: a toolchain/OS change opens a new identity and must
  // invalidate prior evidence. Independently recompute the environment pin.
  const envNow = environmentFingerprint();
  add('environment_fingerprint_matches_current_run', envNow === execution.environment_fingerprint,
    `now=${envNow} bound=${execution.environment_fingerprint}`);
  // Directive §3.4: the gate must have PROVEN single-batch consistency. Confirm
  // its six verdicts independently rather than trusting the overall status.
  const bc = gate?.batch_consistency || null;
  const bcKeys = ['single_execution_id', 'single_git_head', 'single_worktree_fingerprint', 'single_environment_fingerprint', 'evidence_integrity', 'evidence_freshness'];
  const bcOk = gateIsCurrent && bc != null && bcKeys.every((k) => bc[k] === true);
  add('single_batch_consistency_proven', bcOk,
    bc ? bcKeys.map((k) => `${k}=${bc[k]}`).join(' ') : 'gate has no batch_consistency verdict');

  // Every capability card must be bound AND its counts must be recomputable.
  const cardProblems = [];
  for (const name of CARDS) {
    const card = readJSON(path.join(REPORTS, name), null);
    if (!card) { cardProblems.push(`${name}: missing`); continue; }
    for (const field of ['execution_id', 'git_head', 'worktree_fingerprint', 'environment_fingerprint', 'generated_at']) {
      if (!card[field]) cardProblems.push(`${name}: missing ${field}`);
    }
    if (card.execution_id !== execution.execution_id) cardProblems.push(`${name}: execution_id=${card.execution_id}`);
    if (card.git_head !== execution.git_head) cardProblems.push(`${name}: git_head=${card.git_head}`);
    if (card.worktree_fingerprint !== execution.worktree_fingerprint) cardProblems.push(`${name}: fingerprint mismatch`);
    if (card.environment_fingerprint !== execution.environment_fingerprint) cardProblems.push(`${name}: environment_fingerprint mismatch`);
    if (card.status === 'PASS' && Number(card.exit_code ?? 1) !== 0 && name !== 'E2E-RESULTS.json') {
      cardProblems.push(`${name}: status=PASS but exit_code=${card.exit_code}`);
    }
    if (Array.isArray(card.items) && card.items.length) {
      const s = summarize(card.items);
      for (const k of Object.keys(s.counts)) {
        if (Number(card.counts?.[k] ?? 0) !== s.counts[k]) {
          cardProblems.push(`${name}: counts.${k}=${card.counts?.[k]} but items contain ${s.counts[k]}`);
        }
      }
      if (card.status === 'PASS' && (s.counts.BLOCKED || s.counts.SKIPPED || s.counts.NOT_RUN || s.counts.FAIL)) {
        cardProblems.push(`${name}: status=PASS while items include non-PASS states`);
      }
    }
  }
  add('capability_cards_have_real_counts_and_bindings', cardProblems.length === 0,
    cardProblems.length ? cardProblems.join('; ') : `${CARDS.length} cards verified`);

  const manifest = verifyEvidenceManifest({ strictCurrent: true, execution });
  add('evidence_manifest_hashes_and_bindings', manifest.ok,
    manifest.ok ? `${manifest.checked} file hashes verified` : manifest.problems.join('; '));
  add('no_stale_pass_promoted', !(claimAllowed && (gateIsCurrent === false || !manifest.ok)),
    `claim_allowed=${claimAllowed} gate_current=${gateIsCurrent} manifest_ok=${manifest.ok}`);
  add('p0_blockers_forbid_full_claim', !(claimAllowed && legacy.snapshot.p0_blockers.length > 0),
    `claim_allowed=${claimAllowed} open_p0=${legacy.snapshot.p0_blockers.length}`);

  let cli = null;
  if (withCli) {
    cli = runCliStatus();
    add('cli_process_executed', cli.ok, cli.ok ? 'uap status --json exit 0' : `failed: ${cli.error} ${cli.stdout}`);
    if (cli.ok) {
      const cliFinal = cli.result?.data?.final_status;
      add('cli_overall_matches_report', cliFinal?.overall_status === reportOverall,
        `cli=${cliFinal?.overall_status} report=${reportOverall}`);
      add('cli_execution_matches_report', cliFinal?.execution_id === execution.execution_id,
        `cli=${cliFinal?.execution_id} current=${execution.execution_id}`);
    }
  }

  const result = {
    component, version, ok: problems.length === 0,
    checked_at: nowISO(),
    execution_id: execution.execution_id,
    git_head: execution.git_head,
    worktree_fingerprint: execution.worktree_fingerprint,
    environment_fingerprint: execution.environment_fingerprint,
    recomputed_status: recomputed,
    report_status: reportOverall,
    index_status: block?.overall_status ?? null,
    verified_requirements: gateIsCurrent ? (gate.checks?.find((c) => c.id === '6.4_requirements')?.details?.counts?.VERIFIED ?? 0) : legacy.verdict.counts.verified,
    applicable_requirements: gateIsCurrent ? (gate.checks?.find((c) => c.id === '6.4_requirements')?.details?.total ?? 538) : legacy.verdict.counts.applicable,
    capability_gaps: legacy.verdict.capability_gaps,
    reasons: gateIsCurrent ? gate.problems : legacy.verdict.reasons,
    checks,
    problems,
    gate_is_current: gateIsCurrent,
  };
  writeJSON(path.join(REPORTS, 'STATUS-CONSISTENCY.json'), result);
  return result;
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const r = verifyStatusConsistency();
  console.log(`status consistency: ${r.ok ? 'PASS' : 'FAIL'} — ${r.checks.filter((c) => c.status === 'PASS').length}/${r.checks.length} checks, recomputed=${r.recomputed_status}, report=${r.report_status}, index=${r.index_status}`);
  for (const c of r.checks) console.log(`  ${c.status === 'PASS' ? 'ok' : 'XX'} ${c.name}: ${c.detail}`);
  if (!r.ok) { for (const p of r.problems) console.error(`FAIL: ${p}`); process.exit(1); }
}
