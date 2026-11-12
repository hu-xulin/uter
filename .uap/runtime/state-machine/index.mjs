import { TASK_TRANSITIONS, TASK_STATES } from '../_lib/contract.mjs';
import { nowISO } from '../_lib/util.mjs';

export const component = 'state-machine';
export const version = '1.0.0';

export class IllegalTransitionError extends Error {
  constructor(from, to) {
    super(`illegal task state transition: ${from} -> ${to}`);
    this.name = 'IllegalTransitionError';
    this.from = from;
    this.to = to;
  }
}

export function isKnownState(state) {
  return TASK_STATES.includes(state);
}

export function legalNext(state) {
  if (!isKnownState(state)) return [];
  return [...(TASK_TRANSITIONS[state] || [])];
}

export function canTransition(from, to) {
  return legalNext(from).includes(to);
}

/** Fail-closed: unknown states and illegal edges throw instead of being coerced. */
export function assertTransition(from, to) {
  if (!isKnownState(from)) throw new IllegalTransitionError(from, to);
  if (!isKnownState(to)) throw new IllegalTransitionError(from, to);
  if (!canTransition(from, to)) throw new IllegalTransitionError(from, to);
  return true;
}

export function transition(task, to, reason = '') {
  assertTransition(task.state, to);
  const from = task.state;
  task.state = to;
  task.updated_at = nowISO();
  task.history = task.history || [];
  task.history.push({ from, to, reason, at: task.updated_at });
  return task;
}

export function isTerminal(state) {
  return ['SUCCEEDED', 'FAILED', 'CANCELLED', 'BLOCKED'].includes(state);
}

export function health() {
  const checks = {
    states_defined: TASK_STATES.length === 9,
    all_states_have_transitions: TASK_STATES.every((s) => Array.isArray(TASK_TRANSITIONS[s])),
    terminal_states_closed: ['SUCCEEDED', 'CANCELLED'].every((s) => TASK_TRANSITIONS[s].length === 0),
    illegal_edge_rejected: !canTransition('CREATED', 'SUCCEEDED'),
    legal_edge_accepted: canTransition('RUNNING', 'SUCCEEDED'),
    recovery_edge_accepted: canTransition('WAITING_RECOVERY', 'QUEUED'),
  };
  return {
    component,
    version,
    ok: Object.values(checks).every(Boolean),
    checks,
    checked_at: nowISO(),
  };
}

export async function execute(task) {
  const next = task?.inputs?.next_state;
  if (!next) return { status: 'FAILED', summary: 'missing inputs.next_state' };
  try {
    assertTransition(task.inputs.current_state || 'CREATED', next);
    return { status: 'SUCCEEDED', summary: `transition ${task.inputs.current_state || 'CREATED'} -> ${next} is legal`, outputs: { next } };
  } catch (error) {
    return { status: 'FAILED', summary: error.message, outputs: { error: error.name } };
  }
}
