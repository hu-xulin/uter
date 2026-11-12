import { nowISO, newId } from './util.mjs';

export const LIFECYCLE_STATUSES = Object.freeze([
  'NOT_BUILT',
  'PARTIALLY_BUILT',
  'IMPLEMENTED_NOT_VERIFIED',
  'PARTIALLY_VERIFIED',
  'FULLY_VERIFIED',
  'FULLY_OPERATIONAL',
  'BLOCKED',
  'FAILED',
]);

export const TASK_STATES = Object.freeze([
  'CREATED',
  'QUEUED',
  'RUNNING',
  'PAUSED',
  'WAITING_RECOVERY',
  'BLOCKED',
  'FAILED',
  'SUCCEEDED',
  'CANCELLED',
]);

/** Legal task state transitions. Anything else throws (fail-closed). */
export const TASK_TRANSITIONS = Object.freeze({
  CREATED: ['QUEUED', 'CANCELLED'],
  QUEUED: ['RUNNING', 'PAUSED', 'CANCELLED', 'BLOCKED'],
  RUNNING: ['SUCCEEDED', 'FAILED', 'PAUSED', 'WAITING_RECOVERY', 'CANCELLED', 'BLOCKED'],
  PAUSED: ['QUEUED', 'CANCELLED'],
  WAITING_RECOVERY: ['QUEUED', 'FAILED', 'BLOCKED', 'CANCELLED'],
  BLOCKED: ['QUEUED', 'FAILED', 'CANCELLED'],
  FAILED: ['QUEUED', 'BLOCKED', 'CANCELLED'],
  SUCCEEDED: [],
  CANCELLED: [],
});

export const VALIDATOR_STATUSES = Object.freeze(['PASS', 'FAIL', 'BLOCKED', 'NOT_EXECUTED']);

/**
 * Normalised executor result. Executors are forbidden from setting
 * `validation_results` themselves — that field is filled by independent
 * validators. An executor may only report what it did.
 */
export function executorResult(input = {}) {
  const status = input.status || 'SUCCEEDED';
  return {
    result_id: input.result_id || newId('UAP-EXR'),
    task_id: input.task_id || null,
    executor_id: input.executor_id || 'unknown',
    status,
    summary: input.summary || '',
    changed_files: input.changed_files || [],
    commands: input.commands || [],
    evidence_refs: input.evidence_refs || [],
    blocked_reasons: input.blocked_reasons || [],
    outputs: input.outputs || {},
    validation_results: [],
    completed_at: nowISO(),
  };
}

/**
 * Normalised validator result. This is the single place where PASS can be
 * produced, and only when the check actually ran, exited 0, and produced no
 * blocking findings. This prevents "file exists => PASS" style fake green.
 */
export function validatorResult(input = {}) {
  const executed = input.executed === true;
  const exitCode = input.exit_code === undefined ? null : input.exit_code;
  const findings = input.findings || [];
  const blocking = findings.filter((f) => f.severity === 'BLOCKER');
  let status = input.status || 'NOT_EXECUTED';
  if (!VALIDATOR_STATUSES.includes(status)) status = 'NOT_EXECUTED';
  if (status === 'PASS') {
    if (!executed || exitCode !== 0 || blocking.length > 0) {
      status = 'FAIL';
    }
  }
  return {
    validator_id: input.validator_id || 'unknown',
    status,
    executed,
    exit_code: exitCode,
    checked_at: input.checked_at || nowISO(),
    evidence_refs: input.evidence_refs || [],
    findings,
    checks_run: input.checks_run || [],
    commands: input.commands || [],
    summary: input.summary || '',
    duration_ms: input.duration_ms || 0,
    // For BLOCKED results only: why the check could not run. Declared
    // categories let consumers distinguish an environment/authorization limit
    // (not a capability failure) from an unimplemented check. A BLOCKED
    // result without a declared category counts as a capability failure.
    block_category: input.block_category || null,
  };
}

export function finding(severity, code, message, extra = {}) {
  return { severity, code, message, ...extra };
}

export class ContractError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ContractError';
  }
}

export function assertExecutorResult(result) {
  if (!result || typeof result !== 'object') throw new ContractError('executor result is not an object');
  for (const key of ['result_id', 'task_id', 'executor_id', 'status', 'changed_files', 'evidence_refs']) {
    if (!(key in result)) throw new ContractError(`executor result missing ${key}`);
  }
  if (result.validation_results.length !== 0) {
    throw new ContractError('executor must not self-declare validation_results');
  }
  return true;
}

export function assertValidatorResult(result) {
  if (!result || typeof result !== 'object') throw new ContractError('validator result is not an object');
  for (const key of ['validator_id', 'status', 'executed', 'exit_code', 'checked_at', 'evidence_refs', 'findings', 'summary']) {
    if (!(key in result)) throw new ContractError(`validator result missing ${key}`);
  }
  if (result.status === 'PASS' && (!result.executed || result.exit_code !== 0)) {
    throw new ContractError('PASS requires executed=true and exit_code=0');
  }
  return true;
}
