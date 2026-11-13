#!/usr/bin/env node
/**
 * Capture the single authoritative audit baseline for one UAP execution.
 *
 * Every field is produced by a real command against the current working tree.
 * No status/verdict is asserted here: this file records facts only. Because
 * `.uap/reports/` is excluded from `worktreeFingerprint()`, writing this file
 * never invalidates evidence bound to the current execution.
 *
 * Usage:
 *   node .uap/tools/capture-baseline.mjs            # initial audit capture
 *   node .uap/tools/capture-baseline.mjs --bind     # append the verification
 *                                                   # execution identity after
 *                                                   # code changes are complete
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '../..');
const REPORT = path.join(ROOT, '.uap', 'reports', 'CURRENT-EXECUTION-BASELINE.json');

function sh(command, args, opts = {}) {
  try {
    return execFileSync(command, args, {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      timeout: opts.timeout || 30000,
      // trimEnd only: `git status --porcelain` encodes staged/unstaged state in
      // the FIRST character of each line. A leading `.trim()` would strip the
      // leading space of ` M file` and misreport it as a staged `M  file`.
    }).trimEnd();
  } catch (error) {
    return null; // fail-closed: null, never a fabricated value
  }
}

function version(command, args) {
  const out = sh(command, args, { timeout: 15000 });
  return out ? out.split('\n')[0] : null;
}

function statusRows() {
  const out = sh('git', ['status', '--porcelain=v1', '--untracked-files=all']);
  if (out === null) return null;
  return out.split('\n').filter(Boolean).map((line) => ({
    code: line.slice(0, 2),
    path: line.slice(3),
  }));
}

function previousReports() {
  const dir = path.join(ROOT, '.uap', 'reports');
  const rows = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.json')) continue;
    const file = path.join(dir, name);
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      rows.push({
        file: `.uap/reports/${name}`,
        generated_at: j.generated_at || j.checked_at || j.timestamp || j.computed_at || null,
        git_head: j.git_head || j.gitHead || j.commit_sha || j.base_commit || null,
        execution_id: j.execution_id || j.executionId || j.execution?.execution_id || null,
        bytes: fs.statSync(file).size,
      });
    } catch {
      rows.push({ file: `.uap/reports/${name}`, parse_error: true });
    }
  }
  return rows;
}

function wipSnapshot(rows) {
  // Hash the actual content of each modified TRACKED file. This proves which
  // user WIP existed before UAP touched anything, so a later diff can show
  // that no user change was overwritten.
  const tracked = rows.filter((r) => !r.code.startsWith('??') && !r.code.startsWith('!!'));
  const entries = [];
  for (const r of tracked) {
    const abs = path.join(ROOT, r.path);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
    try {
      entries.push({
        path: r.path,
        code: r.code,
        sha256: crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex'),
        bytes: fs.statSync(abs).size,
      });
    } catch { /* unreadable file is recorded as missing, not skipped silently */ }
  }
  return {
    tracked_modified_count: tracked.length,
    untracked_count: rows.filter((r) => r.code.startsWith('??')).length,
    files: entries,
  };
}

const rows = statusRows() || [];
const head = sh('git', ['rev-parse', 'HEAD']);
const remoteHead = sh('git', ['rev-parse', 'origin/main']);
const reports = previousReports();

const baseline = {
  schema_version: '1.0',
  generator: 'node .uap/tools/capture-baseline.mjs',
  execution_id: null,
  repository: sh('git', ['remote', 'get-url', 'origin']) || null,
  branch: sh('git', ['branch', '--show-current']),
  base_commit: head,
  remote_main_commit: remoteHead,
  head_matches_remote_main: head !== null && head === remoteHead,
  audit_timestamp: new Date().toISOString(),
  runtime_environment: {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    cwd: ROOT,
  },
  toolchain_versions: {
    node: version('node', ['--version']),
    go: version('go', ['version']),
    bun: version('bun', ['--version']),
    git: version('git', ['--version']),
    npm: version('npm', ['--version']),
  },
  working_tree_status: {
    total: rows.length,
    staged: rows.filter((r) => 'MARD'.includes(r.code[0]) && r.code[0] !== ' ').length,
    unstaged: rows.filter((r) => r.code[1] !== ' ' && r.code[1] !== '?').length,
    untracked: rows.filter((r) => r.code.startsWith('??')).length,
    paths: rows.map((r) => `${r.code} ${r.path}`),
  },
  existing_wip: wipSnapshot(rows),
  previous_report_versions: reports,
  stale_reports: reports.filter((r) => r.git_head && r.git_head !== head).map((r) => ({
    file: r.file, git_head: r.git_head, generated_at: r.generated_at,
  })),
  // Fail-closed: a report that declares no git_head/execution_id cannot be
  // proven to belong to this code version, so it is never inherited as PASS.
  reports_without_version_binding: reports.filter((r) => !r.git_head).map((r) => r.file),
  scope: {
    task: 'UAP final closure: specification completeness, real autonomous repair, independent verification, Uter compliance',
    branch_policy: 'local main only; no branch, no PR, no push, no production deploy',
    forbidden: ['production deploy', 'production database write', 'real payment', 'real refund', 'secret export', 'destructive git'],
  },
  integrity_notes: [
    'All fields come from real commands; nothing here is a verdict.',
    'Historical reports are bound to older commits and are stale for this HEAD.',
    'Evidence for this run must be bound to verification_execution (see --bind).',
  ],
};

if (process.argv.includes('--bind')) {
  const current = path.join(ROOT, '.uap', 'state', 'current-execution.json');
  if (!fs.existsSync(current)) {
    process.stderr.write('BIND FAILED: .uap/state/current-execution.json missing; run `uap execution start` first\n');
    process.exit(1);
  }
  const e = JSON.parse(fs.readFileSync(current, 'utf8'));
  const existing = fs.existsSync(REPORT)
    ? JSON.parse(fs.readFileSync(REPORT, 'utf8'))
    : baseline;
  existing.verification_execution = {
    execution_id: e.execution_id,
    git_head: e.git_head,
    worktree_fingerprint: e.worktree_fingerprint,
    started_at: e.started_at,
    started_by: e.started_by,
    bound_at: new Date().toISOString(),
    binding_rule: 'all validation artefacts for this run must carry this execution_id, git_head and fingerprint',
  };
  existing.execution_id = e.execution_id;
  fs.writeFileSync(REPORT, `${JSON.stringify(existing, null, 2)}\n`);
  process.stdout.write(`BIND OK ${e.execution_id} @ ${e.git_head}\n`);
} else {
  fs.writeFileSync(REPORT, `${JSON.stringify(baseline, null, 2)}\n`);
  process.stdout.write(`BASELINE OK ${REPORT}\nhead=${head} wip=${rows.length} stale_reports=${baseline.stale_reports.length}\n`);
}
