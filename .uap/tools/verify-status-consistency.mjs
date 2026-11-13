/**
 * INDEPENDENT status consistency verifier.
 *
 * It deliberately does NOT trust the report generator. It recomputes the
 * verdict from raw artifacts (matrix, test card, validator card, evidence),
 * then compares the three published artifacts against that recomputation:
 *   - .uap/reports/FINAL-STATUS.json
 *   - .uap/SPECIFICATION-INDEX.md (machine-readable UAP-STATUS-BLOCK)
 *   - `./uap status --json` executed as a separate process
 *
 * Any disagreement is a FAIL. A historical PASS card, a hand-edited status
 * field or a report that was not regenerated after a code change is detected.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { ROOT, FILES, UAP } from '../runtime/_lib/paths.mjs';
import { readJSON, readText, exists, nowISO } from '../runtime/_lib/util.mjs';
import { statusVerdict } from '../runtime/status-engine/snapshot.mjs';

export const component = 'uap.verify-status-consistency';
export const version = '1.0.0';

const STATUS_BLOCK_RE = /<!--\s*UAP-STATUS-BLOCK\s+(\{[\s\S]*?\})\s*-->/;
const CLI = path.join(UAP, 'bin', 'uap.mjs');

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
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, UAP_ROOT: ROOT },
    });
    return { ok: true, result: JSON.parse(out) };
  } catch (error) {
    return { ok: false, error: error.message, stdout: String(error.stdout || '').slice(0, 500) };
  }
}

/** @returns {{ok: boolean, problems: string[], checks: Array, recomputed: object}} */
export function verifyStatusConsistency({ withCli = true } = {}) {
  const checks = [];
  const problems = [];
  const add = (name, ok, detail) => {
    checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
    if (!ok) problems.push(`${name}: ${detail}`);
  };

  const engine = statusVerdict();          // independent recompute, no injected claims
  const verdict = engine.verdict;
  const finalCard = readJSON(FILES.finalStatus, null);
  const block = parseIndexBlock();

  add('final_status_exists', Boolean(finalCard), finalCard ? 'FINAL-STATUS.json present' : 'FINAL-STATUS.json missing');
  add('index_status_block_exists', Boolean(block), block ? 'UAP-STATUS-BLOCK present' : 'index has no machine-readable status block');

  const reportOverall = finalCard?.overall_status ?? null;
  const indexOverall = block?.overall_status ?? null;
  const reportVerified = finalCard?.specifications?.verified ?? null;
  const indexVerified = block?.specifications_verified ?? null;
  const matrixVerified = engine.specVer.verified_specs;

  add('index_overall_matches_report', reportOverall !== null && reportOverall === indexOverall,
    `index=${indexOverall} report=${reportOverall}`);
  add('index_verified_matches_report', reportVerified !== null && reportVerified === indexVerified,
    `index=${indexVerified} report=${reportVerified}`);
  add('report_verified_matches_matrix', reportVerified === matrixVerified,
    `report=${reportVerified} matrix=${matrixVerified}`);
  add('report_matches_recomputed_verdict', reportOverall === verdict.overall_status,
    `report=${reportOverall} recomputed=${verdict.overall_status}`);
  add('claim_allowed_matches_engine',
    finalCard?.final_acceptance?.claim_allowed === verdict.claim_allowed
    && finalCard?.claim_allowed === verdict.claim_allowed,
    `report.final_acceptance=${finalCard?.final_acceptance?.claim_allowed} report.claim_allowed=${finalCard?.claim_allowed} engine=${verdict.claim_allowed}`);
  add('claim_allowed_matches_state_machine',
    verdict.claim_allowed === ['FULLY_VERIFIED', 'FULLY_OPERATIONAL'].includes(reportOverall),
    `overall=${reportOverall} claim_allowed=${verdict.claim_allowed}`);
  add('execution_id_matches_current_run',
    Boolean(finalCard?.status_engine?.execution_id)
    && finalCard.status_engine.execution_id === verdict.execution_id
    && block?.execution_id === verdict.execution_id,
    `report=${finalCard?.status_engine?.execution_id} index=${block?.execution_id} current=${verdict.execution_id}`);
  add('git_head_matches_current_run',
    finalCard?.status_engine?.git_head === verdict.git_head && block?.git_head === verdict.git_head,
    `report=${finalCard?.status_engine?.git_head} index=${block?.git_head} current=${verdict.git_head}`);
  add('three_independent_results_match_engine',
    finalCard?.three_independent_results?.uap_runtime_capability?.status === verdict.three_independent_results.uap_runtime_capability
    && finalCard?.three_independent_results?.uter_real_compliance?.status === verdict.three_independent_results.uter_real_compliance,
    `report.uap=${finalCard?.three_independent_results?.uap_runtime_capability?.status} report.uter=${finalCard?.three_independent_results?.uter_real_compliance?.status} engine=${JSON.stringify(verdict.three_independent_results)}`);

  const stale = verdict.reasons.filter((r) => r.includes('stale artefacts'));
  add('no_stale_pass_promoted', !(verdict.claim_allowed && stale.length),
    verdict.claim_allowed ? `claim_allowed=true with stale artifacts: ${stale.join(';')}` : `claim_allowed=false (stale artifacts: ${stale.length})`);
  add('p0_blockers_forbid_full_claim',
    !(verdict.claim_allowed && engine.snapshot.p0_blockers.length > 0),
    `claim_allowed=${verdict.claim_allowed} open_p0=${engine.snapshot.p0_blockers.length}`);

  // Independent process path: the CLI must not be able to report a different
  // status than the published report.
  let cli = null;
  if (withCli) {
    cli = runCliStatus();
    add('cli_process_executed', cli.ok, cli.ok ? 'uap status --json exit 0' : `failed: ${cli.error} ${cli.stdout}`);
    if (cli.ok) {
      const cliFinal = cli.result?.data?.final_status;
      add('cli_overall_matches_report', cliFinal?.overall_status === reportOverall,
        `cli=${cliFinal?.overall_status} report=${reportOverall}`);
      add('cli_execution_matches_report', cliFinal?.execution_id === finalCard?.status_engine?.execution_id,
        `cli=${cliFinal?.execution_id} report=${finalCard?.status_engine?.execution_id}`);
      add('cli_three_results_match_report',
        cli.result?.data?.three_independent_results?.uter_real_compliance === finalCard?.three_independent_results?.uter_real_compliance?.status,
        `cli=${cli.result?.data?.three_independent_results?.uter_real_compliance} report=${finalCard?.three_independent_results?.uter_real_compliance?.status}`);
    }
  }

  const result = {
    component, version, ok: problems.length === 0,
    checked_at: nowISO(),
    execution_id: verdict.execution_id,
    git_head: verdict.git_head,
    recomputed_status: verdict.overall_status,
    report_status: reportOverall,
    index_status: indexOverall,
    verified_requirements: verdict.counts.verified,
    applicable_requirements: verdict.counts.applicable,
    capability_gaps: verdict.capability_gaps,
    reasons: verdict.reasons,
    checks,
    problems,
  };
  if (fs.existsSync(path.dirname(FILES.finalStatus))) {
    fs.writeFileSync(path.join(ROOT, '.uap', 'reports', 'STATUS-CONSISTENCY.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }
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
