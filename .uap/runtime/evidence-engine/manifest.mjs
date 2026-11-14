/**
 * UAP evidence binding / manifest — Phase 2 remediation (P2-11).
 *
 * Audit defect: final reports were bound to four different HEADs
 * (f7289555 / 412f0a28 / 7b986469 / d83e81f3), several carried the empty-string
 * worktree fingerprint, and `current-execution` was left RUNNING. Historical
 * reports could therefore be copied forward and mistaken for current evidence.
 *
 * This module makes binding machine-checkable:
 *   - every final report carries repository / branch / commit SHA / execution_id
 *     / worktree fingerprint / generated_at / command / environment / counts;
 *   - EVIDENCE-MANIFEST.json records the SHA256 of every final report's raw
 *     bytes plus its declared binding;
 *   - the manifest hash is independently recomputable;
 *   - a code change AFTER report generation changes `worktreeFingerprint()` and
 *     automatically invalidates the whole batch (stale evidence);
 *   - old reports are never deleted, they are explicitly listed as HISTORICAL.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ROOT, REPORTS, FILES, relToRoot } from '../_lib/paths.mjs';
import { nowISO, readJSON, writeJSON, hash } from '../_lib/util.mjs';
import { gitHead, worktreeFingerprint, fingerprintBasis, currentExecution } from '../status-engine/execution.mjs';
import { TEST_STATUSES } from '../status-engine/test-status.mjs';

export const component = 'runtime.evidence-engine.manifest';
export const version = '1.0.0';

export const MANIFEST_FILE = path.join(REPORTS, 'EVIDENCE-MANIFEST.json');

/** Deliverables that MUST belong to one final acceptance batch. */
export const FINAL_REPORTS = Object.freeze([
  'PHASE-2-REMEDIATION-REPORT.md',
  'DATABASE-INTEGRATION.json',
  'DATABASE-MIGRATIONS.json',
  'PAYMENT-SANDBOX.json',
  'E2E-RESULTS.json',
  'ACCESSIBILITY-RESULTS.json',
  'VISUAL-REGRESSION.json',
  'SECURITY-VERIFICATION.json',
  'REQUIREMENT-TRACEABILITY-MATRIX.json',
  'REQUIREMENT-VERIFICATION-RESULTS.json',
  'RUNTIME-TEST-RESULTS.json',
  'VALIDATION-RESULTS.json',
  'FINAL-ACCEPTANCE.json',
  'FINAL-STATUS.json',
]);

function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15000,
    }).trim();
  } catch { return null; }
}

export function repositoryIdentity() {
  return {
    repository: git(['config', '--get', 'remote.origin.url']) || 'unknown',
    branch: git(['branch', '--show-current']) || 'unknown',
    commit_sha: gitHead(),
  };
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** Fields required on every final report by the acceptance contract. */
export const REQUIRED_REPORT_FIELDS = Object.freeze([
  'execution_id', 'git_head', 'worktree_fingerprint', 'generated_at',
]);

function declaredBinding(file, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  return {
    execution_id: data.execution_id ?? null,
    git_head: data.git_head ?? null,
    worktree_fingerprint: data.worktree_fingerprint ?? null,
    generated_at: data.generated_at ?? null,
    status_model: data.status_model ?? null,
    status: data.status ?? null,
    counts: data.counts && TEST_STATUSES.every((s) => typeof data.counts[s] === 'number') ? data.counts : null,
    test_command: data.command ?? null,
    environment: data.environment ?? (data.target ? { target: data.target } : null),
  };
}

/**
 * Generate the manifest from the REAL bytes currently on disk.
 * `extraFiles` lets the final gate add derived reports before the last pass.
 */
export function generateEvidenceManifest({ execution, extraFiles = [] } = {}) {
  const e = execution || currentExecution();
  const repo = repositoryIdentity();
  const names = [...new Set([...FINAL_REPORTS, ...extraFiles])];
  const entries = [];
  const missing = [];
  for (const name of names) {
    const file = path.join(REPORTS, name);
    if (!fs.existsSync(file)) { missing.push(name); continue; }
    const stat = fs.statSync(file);
    const data = name.endsWith('.json') ? readJSON(file, null) : null;
    entries.push({
      path: relToRoot(file),
      name,
      bytes: stat.size,
      sha256: sha256File(file),
      binding: declaredBinding(file, data),
      is_json: name.endsWith('.json'),
    });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));

  // Reports that exist but are not part of this batch are HISTORICAL. They are
  // never deleted and never promoted; the gate lists them explicitly.
  const known = new Set(names);
  const historical = fs.existsSync(REPORTS)
    ? fs.readdirSync(REPORTS).filter((f) => f.endsWith('.json') && !known.has(f) && f !== 'EVIDENCE-MANIFEST.json')
      .map((f) => {
        const d = readJSON(path.join(REPORTS, f), null);
        return { name: f, execution_id: d?.execution_id ?? null, git_head: d?.git_head ?? null, classification: 'HISTORICAL' };
      })
    : [];

  const body = {
    schema_version: '1.0',
    component,
    generated_at: nowISO(),
    repository: repo.repository,
    branch: repo.branch,
    commit_sha: repo.commit_sha,
    execution_id: e.execution_id,
    git_head: e.git_head,
    worktree_fingerprint: e.worktree_fingerprint,
    fingerprint_basis: fingerprintBasis(),
    final_report_count: entries.length,
    missing_reports: missing,
    entries,
    historical_reports: historical,
    // Excluded from the manifest itself (self-reference is impossible).
    manifest_scope: 'all FINAL_REPORTS except EVIDENCE-MANIFEST.json; FINAL-ACCEPTANCE.json pins manifest_integrity_hash',
  };
  body.manifest_integrity_hash = hash(JSON.stringify({ entries: body.entries, execution_id: body.execution_id, git_head: body.git_head, worktree_fingerprint: body.worktree_fingerprint }));
  writeJSON(MANIFEST_FILE, body);
  return body;
}

/** Recompute the manifest from disk and compare, without trusting its fields. */
export function verifyEvidenceManifest({ strictCurrent = true, execution } = {}) {
  const problems = [];
  const manifest = readJSON(MANIFEST_FILE, null);
  if (!manifest) return { ok: false, problems: ['EVIDENCE-MANIFEST.json missing'], checked: 0 };

  const expectedSelf = hash(JSON.stringify({
    entries: manifest.entries, execution_id: manifest.execution_id,
    git_head: manifest.git_head, worktree_fingerprint: manifest.worktree_fingerprint,
  }));
  if (expectedSelf !== manifest.manifest_integrity_hash) {
    problems.push('manifest_integrity_hash mismatch (manifest was edited by hand)');
  }

  const current = execution || currentExecution();
  if (manifest.execution_id !== current.execution_id) problems.push(`manifest execution_id=${manifest.execution_id} current=${current.execution_id}`);
  if (manifest.git_head !== current.git_head) problems.push(`manifest git_head=${manifest.git_head} current=${current.git_head}`);
  if (manifest.worktree_fingerprint !== current.worktree_fingerprint) {
    problems.push(`manifest worktree_fingerprint=${manifest.worktree_fingerprint} current=${current.worktree_fingerprint}`);
  }
  const headNow = gitHead();
  if (headNow !== manifest.commit_sha) problems.push(`manifest commit_sha=${manifest.commit_sha} HEAD now=${headNow}`);
  if (strictCurrent) {
    const fpNow = worktreeFingerprint();
    if (fpNow !== current.worktree_fingerprint) {
      problems.push(`code changed AFTER report generation: fingerprint now=${fpNow} bound=${current.worktree_fingerprint}`);
    }
  }

  let checked = 0;
  const mismatched = [];
  for (const entry of manifest.entries || []) {
    const file = path.join(ROOT, entry.path);
    if (!fs.existsSync(file)) { problems.push(`missing manifest entry: ${entry.name}`); continue; }
    checked += 1;
    const actual = sha256File(file);
    if (actual !== entry.sha256) { problems.push(`${entry.name}: sha256 changed (was ${entry.sha256}, now ${actual})`); mismatched.push(entry.name); }
    if (!entry.is_json) continue;
    const data = readJSON(file, null);
    const binding = declaredBinding(file, data);
    if (!binding?.execution_id || !binding?.git_head || !binding?.worktree_fingerprint || !binding?.generated_at) {
      problems.push(`${entry.name}: missing required binding field(s) ${REQUIRED_REPORT_FIELDS.join(',')}`);
      continue;
    }
    if (binding.execution_id !== manifest.execution_id) problems.push(`${entry.name}: execution_id=${binding.execution_id} manifest=${manifest.execution_id}`);
    if (binding.git_head !== manifest.git_head) problems.push(`${entry.name}: git_head=${binding.git_head} manifest=${manifest.git_head}`);
    if (binding.worktree_fingerprint !== manifest.worktree_fingerprint) {
      problems.push(`${entry.name}: worktree_fingerprint mismatch with manifest`);
    }
  }
  return {
    ok: problems.length === 0, problems, checked,
    mismatched, execution_id: manifest.execution_id,
    git_head: manifest.git_head, worktree_fingerprint: manifest.worktree_fingerprint,
    manifest_integrity_hash: manifest.manifest_integrity_hash,
    historical_count: (manifest.historical_reports || []).length,
    checked_at: nowISO(),
  };
}

/**
 * Independent binding check over all final reports, usable by the acceptance
 * gate even before a manifest exists.
 */
export function verifyFinalReportBindings({ execution } = {}) {
  const e = execution || currentExecution();
  const problems = [];
  const checked = [];
  for (const name of FINAL_REPORTS) {
    const file = path.join(REPORTS, name);
    if (!fs.existsSync(file)) { problems.push(`missing final report: ${name}`); continue; }
    checked.push(name);
    if (!name.endsWith('.json') || name === 'EVIDENCE-MANIFEST.json') continue;
    const data = readJSON(file, null);
    for (const field of REQUIRED_REPORT_FIELDS) {
      if (!data?.[field]) { problems.push(`${name}: missing ${field}`); continue; }
    }
    if (data?.execution_id !== e.execution_id) problems.push(`${name}: execution_id=${data?.execution_id} expected=${e.execution_id}`);
    if (data?.git_head !== e.git_head) problems.push(`${name}: git_head=${data?.git_head} expected=${e.git_head}`);
    if (data?.worktree_fingerprint !== e.worktree_fingerprint) problems.push(`${name}: worktree_fingerprint mismatch`);
  }
  return { ok: problems.length === 0, problems, checked, execution_id: e.execution_id, git_head: e.git_head, worktree_fingerprint: e.worktree_fingerprint };
}

export function health() {
  const v = verifyEvidenceManifest({ strictCurrent: false });
  return {
    component, version,
    ok: v.ok,
    checks: { manifest_exists: Boolean(readJSON(MANIFEST_FILE, null)), hashes_checked: v.checked, problems: v.problems.length },
    checked_at: nowISO(),
  };
}
