import { FILES, ROOT } from '../_lib/paths.mjs';
import { readJSON, writeJSON, newId, nowISO, hash } from '../_lib/util.mjs';
import { executorResult, assertExecutorResult, validatorResult, assertValidatorResult, finding, ContractError } from '../_lib/contract.mjs';
import { transition, isTerminal, assertTransition } from '../state-machine/index.mjs';
import { publish } from '../event-system/index.mjs';
import { acquire, release } from '../resource-manager/index.mjs';
import { record } from '../evidence-engine/index.mjs';
import { check } from '../policy-engine/index.mjs';

export const component = 'task-engine';
export const version = '1.0.0';
export const MAX_RETRIES = 2; // 3 attempts total for one root cause

const handlers = new Map();

function store() {
  return readJSON(FILES.tasks, { version: '1.0', tasks: {} });
}

function persist(data) {
  writeJSON(FILES.tasks, data);
}

export function registerStepHandler(name, fn) {
  if (typeof name !== 'string' || typeof fn !== 'function') throw new Error('invalid step handler');
  handlers.set(name, fn);
}

export function hasStepHandler(name) {
  return handlers.has(name);
}

export function listStepHandlers() {
  return [...handlers.keys()];
}

function normaliseSteps(steps) {
  return (steps || []).map((s, index) => {
    const base = typeof s === 'string' ? { name: s } : { ...s };
    return {
      step_id: base.step_id || `step-${index + 1}`,
      name: base.name,
      idempotent: base.idempotent !== false,
      handler: base.handler || base.name,
      status: 'PENDING',
      attempts: 0,
      evidence_refs: [],
      changed_files: [],
      outputs: {},
      error: null,
    };
  });
}

export function createTask(input = {}) {
  const required = ['objective', 'scope', 'specification_ids', 'constraints', 'acceptance_criteria'];
  const missing = required.filter((k) => !(k in input));
  if (missing.length) throw new ContractError(`task missing required contract fields: ${missing.join(', ')}`);
  const data = store();
  const task_id = input.task_id || newId('UAP-TASK');
  if (data.tasks[task_id]) throw new Error(`task already exists: ${task_id}`);
  const task = {
    task_id,
    objective: input.objective,
    scope: input.scope,
    specification_ids: input.specification_ids,
    constraints: input.constraints,
    acceptance_criteria: input.acceptance_criteria,
    dependencies: input.dependencies || [],
    permissions: input.permissions || [],
    agent_id: input.agent_id || 'uap-orchestrator',
    files: input.files || [],
    state: 'CREATED',
    steps: normaliseSteps(input.steps && input.steps.length ? input.steps : [{ name: 'execute' }]),
    side_effects: [],
    retry_count: 0,
    max_retries: input.max_retries ?? MAX_RETRIES,
    context_version: hash(JSON.stringify({ specs: input.specification_ids, constraints: input.constraints, steps: input.steps || [] })),
    trace_id: newId('UAP-TRACE'),
    created_at: nowISO(),
    updated_at: nowISO(),
    history: [],
    evidence_refs: [],
    changed_files: [],
    validation_results: [],
    blocked_reasons: [],
    error: null,
    health_probe: input.health_probe === true,
  };
  data.tasks[task_id] = task;
  persist(data);
  publish('task.created', { task_id, objective: task.objective, trace_id: task.trace_id }, { task_id, trace_id: task.trace_id });
  return task;
}

export function getTask(id) {
  return store().tasks[id] || null;
}

export function listTasks(filter = {}) {
  let tasks = Object.values(store().tasks);
  if (filter.state) tasks = tasks.filter((t) => t.state === filter.state);
  if (filter.health_probe === false) tasks = tasks.filter((t) => !t.health_probe);
  return tasks.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function updateTask(id, patch) {
  const data = store();
  if (!data.tasks[id]) throw new Error(`unknown task: ${id}`);
  data.tasks[id] = { ...data.tasks[id], ...patch, updated_at: nowISO() };
  persist(data);
  return data.tasks[id];
}

export function cancelTask(id, reason = 'cancelled by operator') {
  const task = getTask(id);
  if (!task) throw new Error(`unknown task: ${id}`);
  if (isTerminal(task.state)) return task;
  transition(task, 'CANCELLED', reason);
  publish('task.cancelled', { task_id: id, reason }, { task_id: id, trace_id: task.trace_id });
  return updateTask(id, task);
}

export function pauseTask(id, reason = 'paused by operator') {
  const task = getTask(id);
  if (!task) throw new Error(`unknown task: ${id}`);
  if (!['QUEUED', 'RUNNING'].includes(task.state)) throw new Error(`cannot pause task in state ${task.state}`);
  transition(task, 'PAUSED', reason);
  return updateTask(id, task);
}

export function markInterrupted(id, reason = 'simulated process interruption') {
  const task = getTask(id);
  if (!task) throw new Error(`unknown task: ${id}`);
  if (task.state === 'RUNNING' || task.state === 'QUEUED' || task.state === 'PAUSED') {
    transition(task, 'WAITING_RECOVERY', reason);
  }
  task.error = reason;
  publish('task.interrupted', { task_id: id, reason }, { task_id: id, trace_id: task.trace_id });
  return updateTask(id, task);
}

function classifyFailure(error) {
  const message = String(error?.message || error);
  if (error?.name === 'PolicyDeniedError' || /permission/i.test(message)) return 'permission_denied';
  if (error?.name === 'ContractError' || /unknown step handler|missing dependency|not registered/i.test(message)) return 'missing_dependency';
  if (/validation/i.test(message)) return 'validation_failed';
  if (/unrecoverable/i.test(message)) return 'unrecoverable';
  return 'retryable';
}

/** Default independent validation: real checks over persisted step evidence. */
export function defaultValidator(task) {
  const findings = [];
  const checksRun = [];
  const unfinished = task.steps.filter((s) => s.status !== 'SUCCEEDED');
  checksRun.push('all_steps_succeeded');
  if (unfinished.length) findings.push(finding('BLOCKER', 'steps_unfinished', `${unfinished.length} steps not SUCCEEDED`));
  const withoutEvidence = task.steps.filter((s) => !s.evidence_refs.length);
  checksRun.push('step_evidence_present');
  if (withoutEvidence.length) findings.push(finding('BLOCKER', 'step_evidence_missing', `${withoutEvidence.length} steps have no evidence`));
  checksRun.push('state_history_legal');
  let legal = true;
  for (const h of task.history) {
    try { assertTransition(h.from, h.to); } catch { legal = false; }
  }
  if (!legal) findings.push(finding('BLOCKER', 'illegal_state_history', 'task history contains an illegal transition'));
  checksRun.push('no_blocking_errors');
  if (task.blocked_reasons.length) findings.push(finding('BLOCKER', 'task_blocked', task.blocked_reasons.join('; ')));
  return validatorResult({
    validator_id: 'core.task_default_validator',
    status: findings.length ? 'FAIL' : 'PASS',
    executed: true,
    exit_code: findings.length ? 1 : 0,
    evidence_refs: task.evidence_refs,
    findings,
    checks_run: checksRun,
    summary: `${checksRun.length} checks, ${findings.length} blocking findings`,
  });
}

/**
 * Execute (or resume) a task. Steps with status SUCCEEDED are never repeated.
 * Non-idempotent steps are write-ahead logged before execution; an ambiguous
 * step after an interruption is BLOCKED, never replayed.
 */
export async function runTask(id, options = {}) {
  let task = getTask(id);
  if (!task) throw new Error(`unknown task: ${id}`);
  if (['SUCCEEDED', 'CANCELLED'].includes(task.state)) return { task, result: null, skipped: true };

  const resume = options.resume === true || task.state === 'WAITING_RECOVERY';
  if (task.state === 'RUNNING' && resume) {
    transition(task, 'WAITING_RECOVERY', 'recovery: previous process died while RUNNING');
  }
  if (task.state === 'CREATED') transition(task, 'QUEUED', 'task accepted');
  if (task.state === 'PAUSED') transition(task, 'QUEUED', 'resumed');
  if (task.state === 'WAITING_RECOVERY') transition(task, 'QUEUED', 'recovered from interruption');
  if (task.state === 'BLOCKED' || task.state === 'FAILED') {
    if (!resume) return { task, result: null, skipped: true };
    transition(task, 'QUEUED', 'retry requested');
  }

  // Dependency gate — never run a task whose predecessors did not succeed.
  for (const dep of task.dependencies) {
    const parent = getTask(dep);
    if (!parent || parent.state !== 'SUCCEEDED') {
      task.blocked_reasons.push(`dependency ${dep} is ${parent ? parent.state : 'missing'}`);
      publish('task.blocked', { task_id: id, reason: `dependency ${dep}` }, { task_id: id, trace_id: task.trace_id });
      return { task: updateTask(id, task), result: null, blocked: true };
    }
  }

  // Permission gate — fail closed, before any side effect.
  for (const permission of task.permissions) {
    const decision = check({ agent_id: task.agent_id, permission, action: `runTask(${id})` });
    if (!decision.allowed) {
      transition(task, 'BLOCKED', decision.reason);
      task.blocked_reasons.push(decision.reason);
      publish('task.blocked', { task_id: id, reason: decision.reason }, { task_id: id, trace_id: task.trace_id });
      return { task: updateTask(id, task), result: null, blocked: true };
    }
  }

  transition(task, 'RUNNING', resume ? 'resumed execution' : 'execution started');
  updateTask(id, task);
  let lockHeld = false;
  const commands = [];
  try {
    acquire(id, { files: task.files });
    lockHeld = true;

    for (const step of task.steps) {
      if (step.status === 'SUCCEEDED') continue;
      if (!step.idempotent && task.side_effects.some((s) => s.step_id === step.step_id && s.state === 'started')) {
        step.status = 'BLOCKED';
        step.error = 'ambiguous non-idempotent side effect; refusing replay';
        task.blocked_reasons.push(step.error);
        publish('task.step.blocked', { task_id: id, step_id: step.step_id, reason: step.error }, { task_id: id, trace_id: task.trace_id });
        updateTask(id, task);
        continue;
      }
      const handler = handlers.get(step.handler);
      if (!handler) throw new Error(`unknown step handler: ${step.handler}`);

      if (!step.idempotent) {
        task.side_effects.push({ step_id: step.step_id, state: 'started', at: nowISO() });
        updateTask(id, task);
      }

      let ok = false;
      let lastError = null;
      for (let attempt = 1; attempt <= task.max_retries + 1; attempt += 1) {
        step.attempts = attempt;
        try {
          const out = await handler({ task, step, attempt, root: ROOT });
          const status = out?.status || 'SUCCEEDED';
          if (status === 'BLOCKED') {
            step.status = 'BLOCKED';
            step.error = out?.summary || 'blocked by handler';
            task.blocked_reasons.push(step.error);
            lastError = null;
            break;
          }
          if (status !== 'SUCCEEDED') throw new Error(out?.summary || 'handler returned non-success');
          step.status = 'SUCCEEDED';
          step.outputs = out.outputs || {};
          step.changed_files = out.changed_files || [];
          step.evidence_refs = out.evidence_refs || [];
          if (Array.isArray(out.commands)) commands.push(...out.commands);
          ok = true;
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          const kind = classifyFailure(error);
          if (kind === 'permission_denied' || kind === 'missing_dependency' || kind === 'unrecoverable') break;
        }
      }
      if (!ok && lastError) {
        step.status = 'FAILED';
        step.error = String(lastError.message || lastError);
        task.error = `${classifyFailure(lastError)}: ${step.error}`;
      }
      if (!step.idempotent && step.status === 'SUCCEEDED') {
        const ledger = task.side_effects.find((s) => s.step_id === step.step_id && s.state === 'started');
        if (ledger) { ledger.state = 'committed'; ledger.at = nowISO(); }
      }

      // Every completed or failed step gets a real evidence record.
      const ev = record({
        kind: 'task_step',
        task_id: id,
        trace_id: task.trace_id,
        specification_ids: task.specification_ids,
        command: `step:${step.name}`,
        exit_code: step.status === 'SUCCEEDED' ? 0 : 1,
        inputs: { step_id: step.step_id, attempts: step.attempts },
        summary: step.status === 'SUCCEEDED' ? `${step.name} succeeded` : `${step.name} failed: ${step.error}`,
        findings: step.status === 'SUCCEEDED' ? [] : [{ severity: 'BLOCKER', code: 'step_failed', message: step.error }],
      });
      step.evidence_refs.push(ev.evidence_id);
      task.evidence_refs.push(ev.evidence_id);
      for (const f of step.changed_files) if (!task.changed_files.includes(f)) task.changed_files.push(f);
      publish('task.step.finished', { task_id: id, step_id: step.step_id, status: step.status }, { task_id: id, trace_id: task.trace_id, severity: step.status === 'SUCCEEDED' ? 'INFO' : 'ERROR' });
      updateTask(id, task); // persist after each step
      if (step.status === 'FAILED' || step.status === 'BLOCKED') break;
    }

    // Independent validation (never the executor's own boolean).
    const validator = options.validator || defaultValidator;
    const validation = validator(task);
    assertValidatorResult(validation);
    task.validation_results = [validation];
    updateTask(id, task);

    const allStepsOk = task.steps.every((s) => s.status === 'SUCCEEDED');
    const acceptanceOk = validation.status === 'PASS' && allStepsOk && task.blocked_reasons.length === 0;
    if (!acceptanceOk) {
      transition(task, task.blocked_reasons.length ? 'BLOCKED' : 'FAILED', 'acceptance criteria not met');
      task.error = task.error || (task.blocked_reasons.join('; ') || `validator ${validation.validator_id} returned ${validation.status}`);
    } else {
      transition(task, 'SUCCEEDED', 'all acceptance criteria met with independent validation');
    }
    updateTask(id, task);

    const result = executorResult({
      task_id: id,
      executor_id: options.executor_id || 'core.autonomous_execution',
      status: task.state === 'SUCCEEDED' ? 'SUCCEEDED' : (task.state === 'BLOCKED' ? 'BLOCKED' : 'FAILED'),
      summary: `task ${id} finished: ${task.state}`,
      changed_files: task.changed_files,
      commands,
      evidence_refs: task.evidence_refs,
      blocked_reasons: task.blocked_reasons,
      outputs: { validation_status: validation.status, steps: task.steps.length },
    });
    // The executor result itself must not carry validation_results: the
    // independent verdict lives on the task, never inside the executor's
    // self-report. assertExecutorResult enforces this separation.
    assertExecutorResult(result);
    const finalEv = record({
      kind: 'task_result',
      task_id: id,
      trace_id: task.trace_id,
      command: `uap task run ${id}`,
      exit_code: task.state === 'SUCCEEDED' ? 0 : 1,
      summary: result.summary,
      inputs: { objective: task.objective, specification_ids: task.specification_ids },
      findings: validation.findings,
    });
    task.evidence_refs.push(finalEv.evidence_id);
    updateTask(id, task);
    publish('task.finished', { task_id: id, state: task.state }, { task_id: id, trace_id: task.trace_id, severity: task.state === 'SUCCEEDED' ? 'INFO' : 'ERROR' });
    return { task: getTask(id), result };
  } finally {
    if (lockHeld) release(id);
  }
}

export async function resumeTask(id, options = {}) {
  const task = getTask(id);
  if (!task) throw new Error(`unknown task: ${id}`);
  if (task.state === 'SUCCEEDED') return { task, result: null, skipped: true, reason: 'already succeeded' };
  // A process killed mid-step leaves the persisted task in RUNNING. That is a
  // legitimate recovery entry point: runTask() first moves RUNNING ->
  // WAITING_RECOVERY -> QUEUED before replaying only unfinished steps.
  if (!['RUNNING', 'WAITING_RECOVERY', 'PAUSED', 'FAILED', 'BLOCKED', 'QUEUED', 'CREATED'].includes(task.state)) {
    throw new Error(`cannot resume task in state ${task.state}`);
  }
  return runTask(id, { ...options, resume: true });
}

export function health() {
  const id = newId('UAP-TASK-HEALTH');
  registerStepHandler('__health_step__', async () => ({ status: 'SUCCEEDED', summary: 'health step executed', outputs: { ran: true } }));
  const task = createTask({
    task_id: id,
    objective: 'runtime health probe',
    scope: 'task-engine',
    specification_ids: ['UAP-00-002'],
    constraints: ['no external side effects'],
    acceptance_criteria: ['all steps succeed', 'independent validator passes'],
    steps: [{ name: '__health_step__', idempotent: true }],
    health_probe: true,
  });
  return runTask(id).then(({ task: finished, result }) => {
    const checks = {
      task_persisted: Boolean(getTask(id)),
      state_reached_succeeded: finished.state === 'SUCCEEDED',
      step_evidence_recorded: finished.steps[0].evidence_refs.length > 0,
      independent_validation_passed: finished.validation_results[0]?.status === 'PASS',
      executor_result_valid: result ? assertExecutorResult(result) : false,
      trace_id_present: Boolean(finished.trace_id),
    };
    return {
      component,
      version,
      ok: Object.values(checks).every(Boolean),
      checks,
      checked_at: nowISO(),
      probe_task_id: id,
    };
  });
}

export async function execute(task) {
  const created = createTask({
    objective: task?.objective || 'delegated task',
    scope: task?.scope || 'unspecified',
    specification_ids: task?.specification_ids || [],
    constraints: task?.constraints || [],
    acceptance_criteria: task?.acceptance_criteria || [],
    steps: task?.inputs?.steps || [{ name: '__health_step__' }],
  });
  const { task: finished } = await runTask(created.task_id);
  return { status: finished.state === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED', summary: `task ${finished.task_id} ${finished.state}`, outputs: { task_id: finished.task_id, state: finished.state } };
}
