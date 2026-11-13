/**
 * UAP execution identity.
 *
 * A PASS is only meaningful for one (execution_id, git_head, worktree) tuple.
 * This module establishes that identity from the REAL repository via git, and
 * binds every produced artefact to it. It never invents a HEAD and never
 * reuses an identity after the code version changes.
 *
 * Runtime-only artifacts (.uap/state, .uap/reports, .uap/evidence) are excluded
 * from the worktree fingerprint: writing a report is not a code change and must
 * not invalidate evidence produced earlier in the SAME verification run.
 * Tracked business-code changes DO invalidate it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, STATE } from '../_lib/paths.mjs';
import { nowISO, readJSON, writeJSON, hash, newId } from '../_lib/util.mjs';

export const component = 'runtime.status-engine.execution';
export const version = '1.0.0';

const CURRENT = path.join(STATE, 'current-execution.json');
const HISTORY = path.join(STATE, 'executions.jsonl');

const VOLATILE_PREFIXES = Object.freeze([
  '.uap/state/', '.uap/reports/', '.uap/evidence/',
  '.uap/state', '.uap/reports', '.uap/evidence',
]);

function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15000,
    }).trim();
  } catch (error) {
    // fail-closed: never fabricate a HEAD or a clean worktree
    return null;
  }
}

/** Real current HEAD. Null when git cannot be queried. */
export function gitHead() {
  const head = git(['rev-parse', 'HEAD']);
  return head && /^[0-9a-f]{40}$/.test(head) ? head : null;
}

/** Stable fingerprint of TRACKED business-code changes. */
export function worktreeFingerprint() {
  const out = git(['status', '--porcelain=v1', '--untracked-files=no']);
  if (out === null) return null;
  const lines = out.split('\n').map((l) => l.trimEnd()).filter(Boolean)
    .filter((line) => {
      const file = line.slice(3).split(' -> ').pop();
      return !VOLATILE_PREFIXES.some((p) => file === p || file.startsWith(p));
    })
    .sort();
  return hash(lines.join('\n'));
}

/** Append-only execution ledger. */
export function executionHistory() {
  if (!fs.existsSync(HISTORY)) return [];
  return fs.readFileSync(HISTORY, 'utf8').split('\n').filter(Boolean)
    .map((line) => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}

/** Explicitly open a new verification run. */
export function startExecution(reason = 'manual') {
  const head = gitHead();
  if (!head) throw new Error('cannot establish execution identity: git rev-parse HEAD failed');
  const execution = {
    execution_id: newId('UAP-EXEC'),
    git_head: head,
    worktree_fingerprint: worktreeFingerprint(),
    started_at: nowISO(),
    started_by: reason,
    status: 'RUNNING',
  };
  fs.mkdirSync(STATE, { recursive: true });
  fs.appendFileSync(HISTORY, `${JSON.stringify(execution)}\n`, 'utf8');
  writeJSON(CURRENT, execution);
  return execution;
}

/**
 * Return the identity of the current verification run. If the code version
 * changed, a fresh identity is opened; the old one is retained in the ledger
 * so its evidence can never be promoted to a PASS for the new code.
 */
export function currentExecution() {
  const head = gitHead();
  const fp = worktreeFingerprint();
  const cur = readJSON(CURRENT, null);
  if (cur && cur.execution_id && cur.git_head === head
      && cur.worktree_fingerprint === fp) return cur;
  return startExecution(cur ? 'code-version-changed' : 'bootstrap');
}

/** Bind an artefact to the current execution. */
export function bindExecution(artefact = {}) {
  const e = currentExecution();
  // Identity always wins: an artefact may never declare its own binding.
  return {
    ...artefact,
    execution_id: e.execution_id,
    git_head: e.git_head,
    worktree_fingerprint: e.worktree_fingerprint,
  };
}

export function health() {
  try {
    const e = currentExecution();
    return {
      component, version, ok: Boolean(e.execution_id && e.git_head),
      checks: {
        git_head_resolved: Boolean(e.git_head),
        worktree_fingerprint_resolved: Boolean(e.worktree_fingerprint),
        ledger_present: fs.existsSync(HISTORY),
        identity_stable: currentExecution().execution_id === e.execution_id,
      },
      execution_id: e.execution_id, git_head: e.git_head,
      worktree_fingerprint: e.worktree_fingerprint, checked_at: nowISO(),
    };
  } catch (error) {
    return { component, version, ok: false, checks: {}, error: error.message, checked_at: nowISO() };
  }
}
