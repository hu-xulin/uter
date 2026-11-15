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
import { ROOT, REPORTS } from '../_lib/paths.mjs';
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
  'BUILD-RESULTS.json',
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

/**
 * A final report may not claim to belong to the current batch while being
 * arbitrarily old. 24h is a deliberately loose upper bound, but it is a REAL
 * computation against Date.now(), never a hard-coded "pass".
 */
export const MAX_REPORT_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Optional path injection for isolated tests. Defaults MUST be the real
 * constants so production behaviour is byte-for-byte unchanged.
 */
function resolveReportsDir(reportsDir) { return reportsDir || REPORTS; }
function resolveRootDir(rootDir) { return rootDir || ROOT; }
function manifestPathFor(reportsDir) { return path.join(reportsDir, 'EVIDENCE-MANIFEST.json'); }
function relToFile(file, rootDir) {
  return path.relative(rootDir, file).split(path.sep).join('/');
}

function declaredBinding(file, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  return {
    execution_id: data.execution_id ?? null,
    git_head: data.git_head ?? null,
    worktree_fingerprint: data.worktree_fingerprint ?? null,
    environment_fingerprint: data.environment_fingerprint ?? null,
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
export function generateEvidenceManifest({ execution, extraFiles = [], reportsDir, rootDir, headSha } = {}) {
  const injected = Boolean(reportsDir);
  const dir = resolveReportsDir(reportsDir);
  const root = resolveRootDir(rootDir);
  const head = headSha ?? gitHead();
  const e = execution || currentExecution();
  // In injected (test) mode we must not shell out to git: use deterministic
  // identity so isolated temp dirs are fully hermetic. Production uses the
  // real repositoryIdentity()/gitHead() exactly as before.
  const repo = injected
    ? { repository: 'test://injected', branch: 'test-branch', commit_sha: head }
    : repositoryIdentity();
  const names = [...new Set([...FINAL_REPORTS, ...extraFiles])];
  const entries = [];
  const missing = [];
  for (const name of names) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) { missing.push(name); continue; }
    const stat = fs.statSync(file);
    const data = name.endsWith('.json') ? readJSON(file, null) : null;
    entries.push({
      path: relToFile(file, root),
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
  const historical = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !known.has(f) && f !== 'EVIDENCE-MANIFEST.json')
      .map((f) => {
        const d = readJSON(path.join(dir, f), null);
        return { name: f, execution_id: d?.execution_id ?? null, git_head: d?.git_head ?? null, classification: 'HISTORICAL' };
      })
    : [];

  const body = {
    schema_version: '1.0',
    component,
    generated_at: nowISO(),
    repository: repo.repository,
    branch: repo.branch,
    commit_sha: head,
    execution_id: e.execution_id,
    git_head: e.git_head,
    worktree_fingerprint: e.worktree_fingerprint,
    environment_fingerprint: e.environment_fingerprint,
    fingerprint_basis: fingerprintBasis(),
    final_report_count: entries.length,
    missing_reports: missing,
    entries,
    historical_reports: historical,
    // Excluded from the manifest itself (self-reference is impossible).
    manifest_scope: 'all FINAL_REPORTS except EVIDENCE-MANIFEST.json; FINAL-ACCEPTANCE.json pins manifest_integrity_hash',
  };
  body.manifest_integrity_hash = hash(JSON.stringify({ entries: body.entries, execution_id: body.execution_id, git_head: body.git_head, worktree_fingerprint: body.worktree_fingerprint, environment_fingerprint: body.environment_fingerprint }));
  writeJSON(manifestPathFor(dir), body);
  return body;
}

/** Recompute the manifest from disk and compare, without trusting its fields. */
export function verifyEvidenceManifest({ strictCurrent = true, execution, reportsDir, rootDir, headSha } = {}) {
  const problems = [];
  const dir = resolveReportsDir(reportsDir);
  const root = resolveRootDir(rootDir);
  const manifest = readJSON(manifestPathFor(dir), null);
  if (!manifest) return { ok: false, problems: ['EVIDENCE-MANIFEST.json missing'], checked: 0 };

  const expectedSelf = hash(JSON.stringify({
    entries: manifest.entries, execution_id: manifest.execution_id,
    git_head: manifest.git_head, worktree_fingerprint: manifest.worktree_fingerprint,
    environment_fingerprint: manifest.environment_fingerprint,
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
  if (manifest.environment_fingerprint !== current.environment_fingerprint) {
    problems.push(`manifest environment_fingerprint=${manifest.environment_fingerprint} current=${current.environment_fingerprint}`);
  }
  const headNow = headSha ?? gitHead();
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
    const file = path.join(root, entry.path);
    if (!fs.existsSync(file)) { problems.push(`missing manifest entry: ${entry.name}`); continue; }
    checked += 1;
    const actual = sha256File(file);
    if (actual !== entry.sha256) { problems.push(`${entry.name}: sha256 changed (was ${entry.sha256}, now ${actual})`); mismatched.push(entry.name); }
    if (!entry.is_json) continue;
    const data = readJSON(file, null);
    // A3: the report's OWN commit_sha, when present, must agree with the
    // manifest's version pin. This runs IN ADDITION to the entry sha256 check.
    if (data && data.commit_sha !== undefined && data.commit_sha !== null && data.commit_sha !== ''
        && data.commit_sha !== manifest.commit_sha) {
      problems.push(`${entry.name}: report commit_sha=${data.commit_sha} != manifest commit_sha=${manifest.commit_sha}`);
    }
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
    // Environment pin: when a report declares an environment fingerprint it
    // MUST agree with the batch. Absent = legacy schema (tolerated here; the
    // final acceptance gate additionally requires presence for a new batch).
    if (binding.environment_fingerprint != null
        && binding.environment_fingerprint !== manifest.environment_fingerprint) {
      problems.push(`${entry.name}: environment_fingerprint mismatch with manifest`);
    }
  }
  return {
    ok: problems.length === 0, problems, checked,
    mismatched, execution_id: manifest.execution_id,
    git_head: manifest.git_head, worktree_fingerprint: manifest.worktree_fingerprint,
    environment_fingerprint: manifest.environment_fingerprint,
    manifest_integrity_hash: manifest.manifest_integrity_hash,
    historical_count: (manifest.historical_reports || []).length,
    checked_at: nowISO(),
  };
}

/**
 * Independent binding check over all final reports, usable by the acceptance
 * gate even before a manifest exists.
 */
export function verifyFinalReportBindings({ execution, reportsDir, headSha } = {}) {
  const e = execution || currentExecution();
  const dir = resolveReportsDir(reportsDir);
  const head = headSha ?? gitHead();
  const now = Date.now();
  const problems = [];
  const warnings = [];
  const checked = [];
  for (const name of FINAL_REPORTS) {
    const file = path.join(dir, name);
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
    if (data?.environment_fingerprint != null && data.environment_fingerprint !== e.environment_fingerprint) {
      problems.push(`${name}: environment_fingerprint=${data.environment_fingerprint} expected=${e.environment_fingerprint}`);
    } else if (data?.environment_fingerprint == null) {
      warnings.push(`${name}: no environment_fingerprint field (legacy schema; not environment-pinned)`);
    }
    // A2a: a declared commit_sha MUST equal the current HEAD. Missing
    // commit_sha is tolerated (old-schema compatibility) but recorded as a
    // warning so ok is not forced false purely for the absent field.
    if (data && data.commit_sha !== undefined && data.commit_sha !== null && data.commit_sha !== '') {
      if (data.commit_sha !== head) problems.push(`${name}: commit_sha=${data.commit_sha} != HEAD=${head}`);
    } else {
      warnings.push(`${name}: no commit_sha field (legacy schema; not version-pinned by SHA)`);
    }
    // A2b: generated_at must not be in the future and must not be older than
    // the allowed batch window. This is a REAL age computation, not a constant.
    if (data?.generated_at) {
      const ts = Date.parse(data.generated_at);
      if (Number.isNaN(ts)) {
        problems.push(`${name}: generated_at is not a valid ISO timestamp (${data.generated_at})`);
      } else {
        if (ts > now) problems.push(`${name}: generated_at=${data.generated_at} is in the future`);
        if (now - ts > MAX_REPORT_AGE_MS) {
          problems.push(`${name}: generated_at=${data.generated_at} is stale (${now - ts}ms > ${MAX_REPORT_AGE_MS}ms)`);
        }
      }
    }
  }
  return { ok: problems.length === 0, problems, warnings, checked, execution_id: e.execution_id, git_head: e.git_head, worktree_fingerprint: e.worktree_fingerprint, checked_at: nowISO() };
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
