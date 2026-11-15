import fs from 'node:fs';
import path from 'node:path';
import { EVIDENCE, ROOT } from '../_lib/paths.mjs';
import { newId, nowISO, hash, writeEvidence, readJSON, readText, redact } from '../_lib/util.mjs';
import { currentExecution } from '../status-engine/execution.mjs';

export const component = 'evidence-engine';
export const version = '1.0.0';

/**
 * Evidence is immutable and append-only. A second write with the same ID
 * throws rather than silently overwriting history.
 */
export function record(input = {}) {
  const evidence_id = input.evidence_id || newId('UAP-EV');
  const file = path.join(EVIDENCE, `${evidence_id}.json`);
  const finished_at = nowISO();
  const duration = Number(input.duration_ms) || 0;
  const started_at = new Date(new Date(finished_at).getTime() - duration).toISOString();

  // §8: every evidence record is bound to the exact execution, HEAD and
  // business-code fingerprint it was produced against. Fail-closed: if the
  // identity cannot be established, the record is still written but is marked
  // BINDING_FAILED and can never be counted as a current PASS.
  let binding;
  try {
    const e = currentExecution();
    binding = {
      execution_id: e.execution_id,
      git_head: e.git_head,
      worktree_fingerprint: e.worktree_fingerprint,
      environment_fingerprint: e.environment_fingerprint,
      binding_status: 'BOUND',
      binding_error: null,
    };
  } catch (error) {
    binding = {
      execution_id: null, git_head: null, worktree_fingerprint: null,
      environment_fingerprint: null,
      binding_status: 'BINDING_FAILED', binding_error: error.message,
    };
  }

  const record = {
    evidence_id,
    kind: input.kind || 'command_result',
    task_id: input.task_id || null,
    trace_id: input.trace_id || null,
    specification_ids: input.specification_ids || [],
    requirement_ids: input.requirement_ids || [],
    recorded_at: finished_at,
    started_at,
    finished_at,
    execution: binding,
    execution_id: binding.execution_id,
    git_head: binding.git_head,
    worktree_fingerprint: binding.worktree_fingerprint,
    environment_fingerprint: binding.environment_fingerprint,
    modified_files: input.modified_files || [],
    environment: {
      platform: process.platform,
      node: process.version,
      cwd: ROOT,
      uap_root: process.env.UAP_ROOT || null,
    },
    command: input.command || null,
    exit_code: input.exit_code === undefined ? null : input.exit_code,
    duration_ms: input.duration_ms === undefined ? null : input.duration_ms,
    inputs: redact(JSON.stringify(input.inputs || {})),
    stdout: redact(String(input.stdout || '').slice(0, 200000)),
    stderr: redact(String(input.stderr || '').slice(0, 200000)),
    artifacts: input.artifacts || [],
    findings: input.findings || [],
    summary: input.summary || '',
    content_hash: null,
  };
  record.content_hash = hash(JSON.stringify({ ...record, content_hash: null }));
  writeEvidence(file, record);
  return { evidence_id, file: path.relative(ROOT, file), content_hash: record.content_hash };
}

export function get(evidence_id) {
  const file = path.join(EVIDENCE, `${evidence_id}.json`);
  if (!fs.existsSync(file)) return null;
  return readJSON(file);
}

export function verify(evidence_id) {
  const rec = get(evidence_id);
  if (!rec) return { valid: false, reason: 'not_found' };
  const expected = hash(JSON.stringify({ ...rec, content_hash: null }));
  const hashValid = expected === rec.content_hash;
  // Hash integrity and execution binding are reported separately: a historical
  // record may be untampered yet unusable as evidence for the CURRENT run.
  const bindingValid = rec.execution?.binding_status === 'BOUND'
    && Boolean(rec.execution_id) && Boolean(rec.git_head)
    && Boolean(rec.worktree_fingerprint) && Boolean(rec.environment_fingerprint);
  return {
    valid: hashValid,
    reason: hashValid ? 'hash_match' : 'hash_mismatch',
    hash_valid: hashValid,
    binding_valid: bindingValid,
    binding_status: rec.execution?.binding_status || 'LEGACY_UNBOUND',
    evidence_id,
  };
}

/** Structured evidence records that belong to the current execution. */
export function currentEvidence() {
  let e;
  try { e = currentExecution(); } catch { return []; }
  if (!fs.existsSync(EVIDENCE)) return [];
  const out = [];
  for (const f of fs.readdirSync(EVIDENCE).filter((x) => x.endsWith('.json'))) {
    let rec;
    try { rec = JSON.parse(readText(path.join(EVIDENCE, f))); } catch { continue; }
    if (rec.execution_id !== e.execution_id) continue;
    const v = verify(rec.evidence_id);
    out.push({
      evidence_id: rec.evidence_id,
      execution_id: rec.execution_id,
      git_head: rec.git_head,
      worktree_fingerprint: rec.worktree_fingerprint,
      recorded_at: rec.recorded_at,
      hash_valid: v.hash_valid,
      binding_valid: v.binding_valid,
      exit_code: rec.exit_code,
      command: rec.command,
      specification_ids: rec.specification_ids || [],
      requirement_ids: rec.requirement_ids || [],
      modified_files: rec.modified_files || [],
    });
  }
  return out;
}

export function list() {
  if (!fs.existsSync(EVIDENCE)) return [];
  return fs.readdirSync(EVIDENCE).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
}

export function resolveAll(refs) {
  return refs.map((ref) => ({ ref, found: Boolean(get(ref)), verification: verify(ref) }));
}

export function health() {
  const probe = record({ kind: 'health_probe', command: 'evidence-engine.health()', exit_code: 0, summary: 'immutability probe', inputs: { secret: 'EXAMPLE_ONLY_NOT_A_REAL_KEY' } });
  const first = get(probe.evidence_id);
  const verified = verify(probe.evidence_id);
  let overwriteRejected = false;
  try {
    record({ evidence_id: probe.evidence_id, kind: 'tamper', exit_code: 0 });
  } catch {
    overwriteRejected = true;
  }
  const untouched = get(probe.evidence_id).kind === 'health_probe';
  const redactionWorks = redact('token: SUPERSECRETVALUE123') !== 'token: SUPERSECRETVALUE123';
  return {
    component,
    version,
    ok: verified.valid && overwriteRejected && untouched && Boolean(first.environment.node) && redactionWorks,
    checks: {
      persisted: Boolean(first),
      hash_verified: verified.valid,
      overwrite_rejected: overwriteRejected,
      original_untouched: untouched,
      environment_recorded: Boolean(first.environment.node),
      command_and_exit_recorded: first.command === 'evidence-engine.health()' && first.exit_code === 0,
      secret_redaction: redactionWorks,
    },
    checked_at: nowISO(),
    probe_evidence_id: probe.evidence_id,
  };
}

export async function execute(task) {
  const probe = record({
    kind: task?.inputs?.kind || 'task_evidence',
    task_id: task?.task_id,
    command: task?.inputs?.command || null,
    exit_code: task?.inputs?.exit_code ?? null,
    summary: task?.inputs?.summary || '',
  });
  return { status: 'SUCCEEDED', summary: `recorded ${probe.evidence_id}`, outputs: probe };
}
